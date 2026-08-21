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

  it('{result_key} は1秒待機後に result/{key} を再取得し最終値を返す', async () => {
    vi.useFakeTimers();
    const path = uniquePath('result_key');
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/result/abc123')) {
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
    const resultCall = calls.find(([url]) => url.includes('/result/abc123'));
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
