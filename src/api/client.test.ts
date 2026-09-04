import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiGet } from './client';
import { ApiError, MaintenanceError } from './errors';
import { MIRRORS, setSelectedMirrorIndex } from './mirrors';
import { FakeStorage, jsonResponse } from './testFixtures';

let pathCounter = 0;
/** テストごとに一意の path を発行し、client.ts 内部のモジュール共有キャッシュを汚染しないようにする */
function uniquePath(label: string): string {
  pathCounter += 1;
  return `api/v2/pl4/__test_${label}_${pathCounter}`;
}

let fakeStorage: FakeStorage;

beforeEach(() => {
  fakeStorage = new FakeStorage();
  vi.stubGlobal('localStorage', fakeStorage);
  setSelectedMirrorIndex(0);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('apiGet — キャッシュ (T3)', () => {
  it('同一 URL 2回呼び出しても fetch は1回だけ', async () => {
    const path = uniquePath('cache_sequential');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { value: 1 }));
    vi.stubGlobal('fetch', fetchMock);

    const first = await apiGet<{ value: number }>(path);
    const second = await apiGet<{ value: number }>(path);

    expect(first).toEqual({ value: 1 });
    expect(second).toEqual({ value: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('同一 URL への同時多発呼び出しも fetch は1回に合流する（in-flight dedupe）', async () => {
    const path = uniquePath('cache_concurrent');
    let resolveFetch!: (r: Response) => void;
    const fetchMock = vi.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const p1 = apiGet<{ value: number }>(path);
    const p2 = apiGet<{ value: number }>(path);
    resolveFetch(jsonResponse(200, { value: 42 }));

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toEqual({ value: 42 });
    expect(r2).toEqual({ value: 42 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('apiGet — ミラーフォールバック (T4 / T5)', () => {
  it('1st ミラー reject → 2nd ミラーで成功し、以後の呼び出しは2ndへ直行。localStorage も更新される', async () => {
    const path1 = uniquePath('fallback_1');
    const path2 = uniquePath('fallback_2');

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.startsWith(MIRRORS[0])) {
        return Promise.reject(new Error('network down'));
      }
      return Promise.resolve(jsonResponse(200, { url }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const result1 = await apiGet<{ url: string }>(path1);
    expect(result1.url).toBe(`${MIRRORS[1]}/${path1}`);
    expect(fakeStorage.getItem('mjsv:api-mirror')).toBe(MIRRORS[1]);

    fetchMock.mockClear();
    const result2 = await apiGet<{ url: string }>(path2);
    expect(result2.url).toBe(`${MIRRORS[1]}/${path2}`);
    // 2nd ミラーへ直行しているので呼び出しは1回だけ（1st ミラーへの再トライが無い）
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('4ミラー全 reject → ApiError（status 0）', async () => {
    const path = uniquePath('all_fail');
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiGet(path)).rejects.toMatchObject({ status: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(MIRRORS.length);
  });

  it('同時に異なる path がフォールバックしても、後発のリクエストが唯一生きているミラーを飛ばさない', async () => {
    // 再現シナリオ（指摘2）: A・B が同時にミラー0で失敗 → A がミラー1で成功し
    // selectedMirrorIndex を書き換える → B がループ内で可変グローバルを読み直す実装だと
    // ミラー1を飛ばして 2→3→0 を試し「全ミラー失敗」と誤報告する。
    // 各リクエストは呼び出し開始時点の起点インデックスを1回だけスナップショットし、
    // 以降はそれを使って全ミラーをちょうど1周するべき。
    vi.useFakeTimers();
    const pathA = uniquePath('race_a');
    const pathB = uniquePath('race_b');
    let pathBMirror0Calls = 0;

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === `${MIRRORS[0]}/${pathA}`) {
        // A の1stミラーは即座に失敗する
        return Promise.reject(new Error('mirror0 down (A)'));
      }
      if (url === `${MIRRORS[0]}/${pathB}`) {
        pathBMirror0Calls += 1;
        if (pathBMirror0Calls === 1) {
          // B の1stミラー失敗は、A がミラー1で成功して selectedMirrorIndex を
          // 書き換え終えた「あと」に確定させる（10ms 遅延）
          return new Promise<Response>((_, reject) => {
            setTimeout(() => reject(new Error('mirror0 down (B)')), 10);
          });
        }
        // バグ挙動で mirror0 に再度たどり着いた場合はテストがハングしないよう即失敗させる
        return Promise.reject(new Error(`mirror0 down (B) retry #${pathBMirror0Calls}`));
      }
      if (url === `${MIRRORS[1]}/${pathA}` || url === `${MIRRORS[1]}/${pathB}`) {
        return Promise.resolve(jsonResponse(200, { url }));
      }
      // ミラー2・3 は用意していない（正しい実装なら到達しないはず）
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    const promiseA = apiGet<{ url: string }>(pathA);
    const promiseB = apiGet<{ url: string }>(pathB);

    // A は fake timer に依存せず即座に解決する（ミラー1が即成功するため）
    const resultA = await promiseA;
    expect(resultA.url).toBe(`${MIRRORS[1]}/${pathA}`);
    expect(fakeStorage.getItem('mjsv:api-mirror')).toBe(MIRRORS[1]);

    // ここで B の1stミラー失敗を確定させる（A の更新は既に完了済み）
    await vi.advanceTimersByTimeAsync(10);

    const resultB = await promiseB;
    expect(resultB.url).toBe(`${MIRRORS[1]}/${pathB}`);
  });
});

describe('apiGet — 404 の扱い (T6)', () => {
  it('nullOn404: true の場合、HTTP 404 は throw せず null を解決する', async () => {
    const path = uniquePath('404_null');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(404, { error: 'id_not_found' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiGet(path, { nullOn404: true });
    expect(result).toBeNull();
  });

  it('nullOn404 を指定しないエンドポイントの 404 は ApiError を throw する', async () => {
    const path = uniquePath('404_throw');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(404, { error: 'id_not_found' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiGet(path)).rejects.toBeInstanceOf(ApiError);
    await expect(apiGet(uniquePath('404_throw_status'))).rejects.toMatchObject({ status: 404 });
  });
});

describe('apiGet — 特殊レスポンス (T7)', () => {
  it('{maintenance} は MaintenanceError を throw する', async () => {
    const path = uniquePath('maintenance');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { maintenance: 'under maintenance' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiGet(path)).rejects.toBeInstanceOf(MaintenanceError);
  });

  it('{result_key} は1秒待機後に result/{key} を再取得し最終値を返す（URL は元リクエストと同じ mirror/apiPrefix を維持する）', async () => {
    vi.useFakeTimers();
    const path = uniquePath('result_key');
    // path は api/v2/pl4/__test_result_key_N の形。result 再取得は同じ mirror・同じ
    // api プレフィックス（api/v2/pl4）を保った完全一致 URL でなければならない（指摘1）。
    const expectedResultUrl = `${MIRRORS[0]}/api/v2/pl4/result/abc123`;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === expectedResultUrl) {
        return Promise.resolve(jsonResponse(200, { value: 'done' }));
      }
      return Promise.resolve(jsonResponse(200, { result_key: 'abc123' }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = apiGet<{ value: string }>(path);
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toEqual({ value: 'done' });
    const calls = fetchMock.mock.calls as [string, RequestInit | undefined][];
    // 部分一致ではなく、mirror・apiPrefix を含む URL 全体の完全一致を検証する
    const resultCall = calls.find(([url]) => url === expectedResultUrl);
    expect(resultCall).toBeDefined();
    const [, resultInit] = resultCall!;
    const headers = (resultInit?.headers ?? {}) as Record<string, string>;
    expect(headers['Cache-Control']).toBe('max-age=0, no-cache');
  });

  it('result_key が5回を超えて解決しない場合は ApiError を throw する', async () => {
    vi.useFakeTimers();
    const path = uniquePath('result_key_giveup');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { result_key: 'never-done' }));
    vi.stubGlobal('fetch', fetchMock);

    const promise = apiGet(path);
    const assertion = expect(promise).rejects.toBeInstanceOf(ApiError);
    await vi.advanceTimersByTimeAsync(1000 * 6);
    await assertion;
  });
});

describe('apiGet — タイムアウトでフォールバック (A)', () => {
  it('1st ミラーがタイムアウト（AbortController 発火）すると、2nd ミラーへフォールバックする', async () => {
    vi.useFakeTimers();
    const path = uniquePath('timeout_fallback');

    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.startsWith(MIRRORS[0])) {
        // 1st ミラーは応答せず放置する。fetchWithTimeout の AbortController が発火した
        // ときだけ reject する（実 fetch の abort 挙動を模す）。timer で abort されなければ
        // この Promise は永遠に解決しない。
        return new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted', 'AbortError'));
          });
        });
      }
      return Promise.resolve(jsonResponse(200, { url }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = apiGet<{ url: string }>(path);
    // FETCH_TIMEOUT_MS(5000ms) 経過で AbortController.abort() が呼ばれるはず
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;

    expect(result.url).toBe(`${MIRRORS[1]}/${path}`);
    const [firstCallUrl, firstCallInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(firstCallUrl).toBe(`${MIRRORS[0]}/${path}`);
    expect(firstCallInit.signal?.aborted).toBe(true);
  });
});

describe('result_key の再取得先ミラー (D)', () => {
  it('元リクエストが1stミラー失敗・2ndミラーで成功した場合、result_key の再取得も2ndミラーへ行く（MIRRORS[0] 固定にならない）', async () => {
    vi.useFakeTimers();
    const path = uniquePath('result_key_mirror');
    const expectedResultUrl = `${MIRRORS[1]}/api/v2/pl4/result/xyz789`;
    const wrongResultUrl = `${MIRRORS[0]}/api/v2/pl4/result/xyz789`;

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === `${MIRRORS[0]}/${path}`) {
        return Promise.reject(new Error('mirror0 down'));
      }
      if (url === `${MIRRORS[1]}/${path}`) {
        return Promise.resolve(jsonResponse(200, { result_key: 'xyz789' }));
      }
      if (url === expectedResultUrl) {
        return Promise.resolve(jsonResponse(200, { value: 'done-via-mirror1' }));
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = apiGet<{ value: string }>(path);
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toEqual({ value: 'done-via-mirror1' });
    const calls = fetchMock.mock.calls as [string][];
    const resultCall = calls.find(([url]) => url === expectedResultUrl);
    expect(resultCall).toBeDefined();
    // MIRRORS[0] 固定ではないことを完全一致で確認する（ミューテーションでミラーを固定すると落ちる。設計書 §2.1 D）
    expect(calls.some(([url]) => url === wrongResultUrl)).toBe(false);
  });
});

describe('apiGet — 失敗した Promise はキャッシュされない (F)', () => {
  it('全ミラー失敗後、同じ path へ再度 apiGet すると再度 fetch される', async () => {
    const path = uniquePath('fail_then_retry');
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiGet(path)).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(MIRRORS.length);

    fetchMock.mockClear();
    fetchMock.mockResolvedValue(jsonResponse(200, { value: 'ok' }));

    const result = await apiGet<{ value: string }>(path);
    expect(result).toEqual({ value: 'ok' });
    // 失敗した Promise がキャッシュに残っていれば再 fetch は発生しないはず → 実際には発生する
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('apiGet — キャッシュ上限到達で全クリアされる (G)', () => {
  it('MAX_CACHE_ENTRIES(500) に達すると、それ以前にキャッシュされていたエントリも巻き込んで全クリアされる', async () => {
    // MAX_CACHE_ENTRIES はテストの都合で注入可能にする production 変更をしない
    // （設計書 §2.1 G）。そのため 500 件そのまま積む形になるが、fetch はモックで即時解決
    // するため実行コストは小さい。この 500 という数値は client.ts の実装定数と結合しており、
    // 実装側で MAX_CACHE_ENTRIES を変えたらこのテストの件数（499）も合わせて更新すること。
    //
    // このファイルの他のテストは client.ts のモジュール共有キャッシュに既にいくつかエントリを
    // 積んでいる（uniquePath で衝突は避けているが、Map 自体はテスト間で共有され続ける）。
    // 500件ちょうどの境界を検証するには、その残存分の影響を受けない「まっさらなキャッシュ」
    // が必要なので、vi.resetModules() で client.ts を再読み込みしてから使う
    // （トップレベルで static import 済みの apiGet はこの後も既存モジュールのままなので、
    // 他のテストには影響しない）。
    vi.resetModules();
    const freshClient = await import('./client');
    const freshApiGet = freshClient.apiGet;

    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { value: 'first-gen' }));
    vi.stubGlobal('fetch', fetchMock);

    const firstPath = uniquePath('overflow_first');
    await freshApiGet(firstPath);

    const otherPaths: string[] = [];
    for (let i = 0; i < 499; i++) {
      otherPaths.push(uniquePath(`overflow_fill_${i}`));
    }
    await Promise.all(otherPaths.map((p) => freshApiGet(p)));

    // ここでキャッシュはちょうど500件（firstPath 含む）。firstPath は依然キャッシュヒットする
    fetchMock.mockClear();
    await freshApiGet(firstPath);
    expect(fetchMock).not.toHaveBeenCalled();

    // 501件目の新規 path を積むと、上限到達により全クリアされる
    const overflowPath = uniquePath('overflow_trigger');
    await freshApiGet(overflowPath);

    // 全クリアされた結果、firstPath は再び fetch される
    fetchMock.mockClear();
    await freshApiGet(firstPath);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('apiGet — 中断された Promise はキャッシュに残らない (#38)', () => {
  it('abort 直後に同一 path を要求すると、道連れにならず新しい fetch が発行される', async () => {
    const path = uniquePath('abort_evicts_cache');
    // 1本目は永久に解決しない fetch にして「中断されるまで在庫が残る」状況を作る
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          }),
      )
      .mockResolvedValue(jsonResponse(200, { value: 'second' }));
    vi.stubGlobal('fetch', fetchMock);

    const controller = new AbortController();
    const aborted = apiGet<{ value: string }>(path, {}, controller.signal);
    // 未処理 rejection にしないでおく
    const abortedSettled = aborted.catch(() => 'rejected' as const);

    // React StrictMode の cleanup 相当。abort と同じタスク内で同一 path を引き直す
    controller.abort();
    const retried = await apiGet<{ value: string }>(path);

    await expect(abortedSettled).resolves.toBe('rejected');
    expect(retried).toEqual({ value: 'second' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('正常に解決した Promise は signal を渡していてもキャッシュに残る', async () => {
    const path = uniquePath('abort_keeps_resolved');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { value: 1 }));
    vi.stubGlobal('fetch', fetchMock);

    const controller = new AbortController();
    await apiGet(path, {}, controller.signal);
    // 解決後の abort（＝呼び出し元のアンマウント等）でキャッシュを落とさない
    controller.abort();
    await apiGet(path);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
