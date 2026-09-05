/**
 * fetch 核: タイムアウト・ミラーフォールバック・キャッシュ・特殊レスポンス
 * （docs/design/issue-3-api-layer.md §5）。
 */

import { MIRRORS, getSelectedMirrorIndex, setSelectedMirrorIndex } from './mirrors';
import { ApiError, MaintenanceError } from './errors';

const FETCH_TIMEOUT_MS = 5000;
const MAX_CACHE_ENTRIES = 500;
const MAX_RESULT_KEY_RETRIES = 5;
const RESULT_KEY_WAIT_MS = 1000;

/** キーは `apiPrefix + path`（クエリ込み）。ミラーは含まない。Promise を格納して in-flight dedupe する */
const cache = new Map<string, Promise<unknown>>();

export type ApiGetOptions = {
  /** true のとき HTTP 404 は throw せず null を解決値として返す（player_stats / player_extended_stats のみ） */
  nullOn404?: boolean;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  externalSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * path（例 `api/v2/pl4/player_stats/...`）先頭の API プレフィックス（`api/v2/pl4`）を取り出す。
 * 仕様書 §3「パスはすべて {mirror}{apiSuffix} の後ろに続く」に基づき、result_key の
 * 再取得（§5.4）でも同じプレフィックスを付け直す必要があるため使う。
 */
function apiPrefixOf(path: string): string {
  const [seg0, seg1, seg2] = path.split('/');
  return `${seg0}/${seg1}/${seg2}`;
}

/**
 * 特殊レスポンス（maintenance / result_key）を処理し、最終的な JSON を返す。
 * result_key の再帰は同一ハンドラを通す（§5.4）。result/... のフェッチはキャッシュしない。
 *
 * mirror は「元リクエストで実際に成功したミラー」を呼び出し元から引き継ぐ（可変グローバル
 * selectedMirrorIndex をここで読み直すと、並行リクエストの結果で値が変わっていた場合に
 * 誤ったミラーへ result_key を再取得しにいくため）。
 */
async function handleResponse<T>(
  response: Response,
  path: string,
  opts: ApiGetOptions,
  resultKeyRetries: number,
  mirror: string,
): Promise<T> {
  if (response.status === 404 && opts.nullOn404) {
    return null as T;
  }
  if (!response.ok) {
    throw new ApiError(`HTTP ${response.status} for ${path}`, response.status, path);
  }

  const data: unknown = await response.json();

  if (isPlainObject(data)) {
    if (typeof data.maintenance === 'string') {
      throw new MaintenanceError(data.maintenance);
    }
    if (typeof data.result_key === 'string') {
      if (resultKeyRetries >= MAX_RESULT_KEY_RETRIES) {
        throw new ApiError(`result_key retry limit exceeded for ${path}`, response.status, path);
      }
      await delay(RESULT_KEY_WAIT_MS);
      // 元リクエストと同じ API プレフィックス・同じミラーで result/{key} を再取得する（実挙動未確認・§5.4）
      const resultUrl = `${mirror}/${apiPrefixOf(path)}/result/${data.result_key}`;
      const resultResponse = await fetchWithTimeout(resultUrl, {
        headers: { 'Cache-Control': 'max-age=0, no-cache' },
      });
      return handleResponse<T>(resultResponse, path, opts, resultKeyRetries + 1, mirror);
    }
  }

  return data as T;
}

/**
 * 選択中ミラーから逐次フォールバックしてリクエストする。
 * ネットワーク層の失敗（fetch reject / タイムアウト）のときのみ次のミラーへ進む。
 * HTTP エラーレスポンスはフォールバックしない（どのミラーでも同じ結果になるため）。
 *
 * 起点インデックスはループに入る前に1回だけスナップショットする。ループの中で
 * 可変グローバル selectedMirrorIndex を読み直すと、並行リクエストが互いのフォールバック
 * 中に選択インデックスを書き換え合い、「唯一生きているミラーを飛ばして全滅と誤判定する」
 * 事故が起きるため（同時に発行される player_stats / player_extended_stats の2本で実際に踏む）。
 */
async function fetchWithFallback<T>(
  path: string,
  opts: ApiGetOptions,
  signal?: AbortSignal,
): Promise<T> {
  let lastError: unknown;
  const startIndex = getSelectedMirrorIndex();
  for (let i = 0; i < MIRRORS.length; i++) {
    const mirrorIndex = (startIndex + i) % MIRRORS.length;
    const mirror = MIRRORS[mirrorIndex];
    let response: Response;
    try {
      response = await fetchWithTimeout(`${mirror}/${path}`, undefined, signal);
    } catch (err) {
      // 呼び出し元による意図的な中断は「このミラーが失敗した」ではないため、
      // 他ミラーへフォールバックせず即座に伝播する
      if (signal?.aborted) {
        throw err;
      }
      lastError = err;
      continue;
    }
    if (mirrorIndex !== getSelectedMirrorIndex()) {
      setSelectedMirrorIndex(mirrorIndex);
    }
    return handleResponse<T>(response, path, opts, 0, mirror);
  }
  throw new ApiError('all mirrors failed', 0, path, { cause: lastError });
}

/**
 * API層の唯一の fetch エントリポイント。同一 path への同時呼び出しは1リクエストに合流する。
 * 失敗した Promise はキャッシュから削除する（失敗をキャッシュしない）。
 *
 * signal は「呼び出し元がもう結果を必要としなくなった」ときの通知にのみ使う（例: 検索の
 * デバウンス確定値が変わった／人数トグルが切り替わった）。同一 path への同時呼び出しは
 * 上記のとおり1つの Promise に合流するため、signal を渡した呼び出しが唯一の待機者とは
 * 限らない点に注意（現状の呼び出し元はいずれも path が呼び出しごとに一意になるため安全）。
 */
export function apiGet<T>(path: string, opts: ApiGetOptions = {}, signal?: AbortSignal): Promise<T> {
  const cached = cache.get(path);
  if (cached) {
    return cached as Promise<T>;
  }

  const promise = fetchWithFallback<T>(path, opts, signal).catch((err: unknown) => {
    cache.delete(path);
    throw err;
  });

  // 中断が確定した時点で「同期的に」キャッシュから落とす。reject 経由の cache.delete は
  // マイクロタスクなので、それを待っていると「abort → 同一 path を即座に再要求」の間に
  // 道連れの Promise を掴ませてしまう（React StrictMode の二重マウントで決定的に踏む。#38）。
  //
  // ただし「解決済みの Promise を後から abort されたとき」は落としてはならない（値は有効で、
  // 落とすと無駄な再リクエストになる）。settled の追跡はこの promise に対する最初の then として
  // 登録するため、同じ promise を await している呼び出し元より必ず先に走る（登録順で発火する）。
  if (signal) {
    let settled = false;
    const markSettled = () => {
      settled = true;
    };
    void promise.then(markSettled, markSettled);
    signal.addEventListener(
      'abort',
      () => {
        if (!settled && cache.get(path) === promise) {
          cache.delete(path);
        }
      },
      { once: true },
    );
  }

  if (cache.size >= MAX_CACHE_ENTRIES) {
    cache.clear();
  }
  cache.set(path, promise);

  return promise;
}
