/**
 * fetch 核: タイムアウト・ミラーフォールバック・キャッシュ・特殊レスポンス
 * （docs/design/issue-3-api-layer.md §5）。
 */

import { MIRRORS, getSelectedMirror, getSelectedMirrorIndex, setSelectedMirrorIndex } from './mirrors';
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

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * 特殊レスポンス（maintenance / result_key）を処理し、最終的な JSON を返す。
 * result_key の再帰は同一ハンドラを通す（§5.4）。result/... のフェッチはキャッシュしない。
 */
async function handleResponse<T>(
  response: Response,
  path: string,
  opts: ApiGetOptions,
  resultKeyRetries: number,
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
      const resultPath = `result/${data.result_key}`;
      const resultResponse = await fetchWithTimeout(`${getSelectedMirror()}/${resultPath}`, {
        headers: { 'Cache-Control': 'max-age=0, no-cache' },
      });
      return handleResponse<T>(resultResponse, path, opts, resultKeyRetries + 1);
    }
  }

  return data as T;
}

/**
 * 選択中ミラーから逐次フォールバックしてリクエストする。
 * ネットワーク層の失敗（fetch reject / タイムアウト）のときのみ次のミラーへ進む。
 * HTTP エラーレスポンスはフォールバックしない（どのミラーでも同じ結果になるため）。
 */
async function fetchWithFallback<T>(path: string, opts: ApiGetOptions): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < MIRRORS.length; i++) {
    const mirrorIndex = (getSelectedMirrorIndex() + i) % MIRRORS.length;
    const mirror = MIRRORS[mirrorIndex];
    let response: Response;
    try {
      response = await fetchWithTimeout(`${mirror}/${path}`);
    } catch (err) {
      lastError = err;
      continue;
    }
    if (mirrorIndex !== getSelectedMirrorIndex()) {
      setSelectedMirrorIndex(mirrorIndex);
    }
    return handleResponse<T>(response, path, opts, 0);
  }
  throw new ApiError('all mirrors failed', 0, path, { cause: lastError });
}

/**
 * API層の唯一の fetch エントリポイント。同一 path への同時呼び出しは1リクエストに合流する。
 * 失敗した Promise はキャッシュから削除する（失敗をキャッシュしない）。
 */
export function apiGet<T>(path: string, opts: ApiGetOptions = {}): Promise<T> {
  const cached = cache.get(path);
  if (cached) {
    return cached as Promise<T>;
  }

  const promise = fetchWithFallback<T>(path, opts).catch((err: unknown) => {
    cache.delete(path);
    throw err;
  });

  if (cache.size >= MAX_CACHE_ENTRIES) {
    cache.clear();
  }
  cache.set(path, promise);

  return promise;
}
