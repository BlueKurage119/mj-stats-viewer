import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  searchPlayer,
  getPlayerStats,
  getPlayerExtendedStats,
  getGlobalStatistics,
  getGlobalHistogram,
  getLevelStatistics,
  getCurrentLevel,
} from './endpoints';
import { setSelectedMirrorIndex, MIRRORS } from './mirrors';
import { FakeStorage, jsonResponse } from './testFixtures';
import type {
  RawGlobalStatistics,
  RawPlayerStats,
  RawPlayerExtendedStats,
  RawPlayerSearchResult,
  LevelStatisticsItem,
  GlobalHistogram,
} from './types';
import playerStatsFixture from './testdata/player_stats.json';
import playerExtendedStatsFixture from './testdata/player_extended_stats.json';
import globalStatistics2Fixture from './testdata/global_statistics_2.json';
import searchPlayerFixture from './testdata/search_player.json';
import levelStatisticsFixture from './testdata/level_statistics.json';
import globalHistogramFixture from './testdata/global_histogram.json';

const playerStatsRaw = playerStatsFixture as unknown as RawPlayerStats;
const playerExtendedStatsRaw = playerExtendedStatsFixture as unknown as RawPlayerExtendedStats;
const globalStatistics2Raw = globalStatistics2Fixture as unknown as RawGlobalStatistics;
const searchPlayerRaw = searchPlayerFixture as unknown as RawPlayerSearchResult[];
const levelStatisticsRaw = levelStatisticsFixture as unknown as LevelStatisticsItem[];
const globalHistogramRaw = globalHistogramFixture as unknown as GlobalHistogram;

beforeEach(() => {
  vi.stubGlobal('localStorage', new FakeStorage());
  setSelectedMirrorIndex(0);
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-21T12:34:56Z'));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('getPlayerStats — mode 省略時の URL (T9)', () => {
  it('modes 省略時、URL に全モードを明示列挙する（空 mode を送らない）', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, playerStatsRaw));
    vi.stubGlobal('fetch', fetchMock);

    await getPlayerStats(4, 123456789, new Date(0), new Date(1000), undefined);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('mode=16.12.9.15.11.8');
    expect(url).not.toContain('mode=&');
    expect(url).not.toMatch(/mode=$/);
  });

  it('modes に空配列を渡した場合も全モードを明示列挙する（設計書 §6.1: 省略時・空配列時）', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, playerStatsRaw));
    vi.stubGlobal('fetch', fetchMock);

    await getPlayerStats(4, 123456789, new Date(0), new Date(2000), []);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('mode=16.12.9.15.11.8');
    expect(url).not.toContain('mode=&');
    expect(url).not.toMatch(/mode=$/);
  });
});

describe('getGlobalStatistics — mode キーの剥がし (T10)', () => {
  it('ワイヤの mode 文字列キー1段を剥がして levelId キーだけの GlobalStatistics を返す', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, globalStatistics2Raw));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getGlobalStatistics(4, [16]);

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('mode=16');

    // ワイヤはトップキー "16" の下に levelId が並ぶが、公開型はその段を剥がしてある
    expect(Object.keys(result).sort()).toEqual(['10301', '10503']);
    expect(result['10301'].basic.gameCount).toBe(globalStatistics2Raw['16']['10301'].basic.count);
    expect(result['10301'].extended.roundCount).toBe(globalStatistics2Raw['16']['10301'].extended.count);
    // 10503 段位帯は回数系6キーが欠落しており 0 補完される
    expect(result['10503'].extended.最大连庄).toBe(0);
  });
});

describe('getCurrentLevel (T12)', () => {
  it('全期間・全モードの URL を叩き、getPlayerStats とキャッシュを共有する', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, playerStatsRaw));
    vi.stubGlobal('fetch', fetchMock);

    const info = await getCurrentLevel(4, 123456789);
    expect(info).not.toBeNull();
    expect(info?.level).toEqual(playerStatsRaw.level);
    expect(info?.nickname).toBe(playerStatsRaw.nickname);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    // dataMinDate() (2010-01-01T00:00:00Z = 1262304000000) から現在時刻の1時間切り上げまで
    expect(url).toContain('/1262304000000/');
    expect(url).toContain('mode=16.12.9.15.11.8');

    fetchMock.mockClear();
    // getPlayerStats を同一パラメータ（全期間・全モード）で呼んでもキャッシュ共有され追加 fetch は発生しない
    const currentHourEndMs = Math.ceil(Date.now() / 3_600_000) * 3_600_000;
    await getPlayerStats(4, 123456789, new Date(1262304000000), new Date(currentHourEndMs), [16, 12, 9, 15, 11, 8]);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it('該当データなし（404）の場合 null を返す', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(404, { error: 'id_not_found' }));
    vi.stubGlobal('fetch', fetchMock);

    const info = await getCurrentLevel(4, 999999999);
    expect(info).toBeNull();
  });
});

describe('三麻（pl3）経路のカバレッジ（PR #22 再レビュー指摘3: pl3 が一度も実行されていなかった）', () => {
  it('searchPlayer(numPlayers=3) は api/v2/pl3/ を叩く', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, searchPlayerRaw));
    vi.stubGlobal('fetch', fetchMock);

    await searchPlayer(3, 'abc');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/api/v2/pl3/search_player/');
    expect(url).not.toContain('/api/v2/pl4/');
  });

  it('getPlayerStats(numPlayers=3) は api/v2/pl3/ を叩き、三麻の全モード（21〜26）を明示列挙する', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, playerStatsRaw));
    vi.stubGlobal('fetch', fetchMock);

    await getPlayerStats(3, 123456789, new Date(0), new Date(1000), undefined);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/api/v2/pl3/player_stats/');
    expect(url).not.toContain('/api/v2/pl4/');
    expect(url).toContain('mode=26.24.22.25.23.21');
  });

  it('getLevelStatistics(numPlayers=3) は api/v2/pl3/ を叩き、levelId(index 1) 昇順にソートして返す（I）', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, levelStatisticsRaw));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getLevelStatistics(3);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/api/v2/pl3/level_statistics');
    expect(url).not.toContain('/api/v2/pl4/');

    // フィクスチャは [10503, 10301, 10799, 10101] の順で並んでいる（未ソート）。
    // levelId (タプルの index 1) 昇順に並べ替わっていることを完全一致で検証する。
    expect(levelStatisticsRaw.map((item) => item[1])).toEqual([10503, 10301, 10799, 10101]);
    expect(result.map((item) => item[1])).toEqual([10101, 10301, 10503, 10799]);
  });

  it('getGlobalStatistics(numPlayers=3) は api/v2/pl3/ を叩く', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, globalStatistics2Raw));
    vi.stubGlobal('fetch', fetchMock);

    await getGlobalStatistics(3, [26]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/api/v2/pl3/global_statistics_2');
    expect(url).not.toContain('/api/v2/pl4/');
  });

  it('getCurrentLevel(numPlayers=3) は api/v2/pl3/ を叩く', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, playerStatsRaw));
    vi.stubGlobal('fetch', fetchMock);

    await getCurrentLevel(3, 123456789);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/api/v2/pl3/player_stats/');
    expect(url).not.toContain('/api/v2/pl4/');
  });
});

describe('公開結果の不変性 — getGlobalHistogram / getLevelStatistics（検収担当が実証した freeze 適用漏れ）', () => {
  it('getGlobalHistogram の結果はトップレベル・ネストしたオブジェクト・配列（bins）まで凍結されている', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, globalHistogramRaw));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getGlobalHistogram(4);
    const band0 = result['8']['0'];

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(band0)).toBe(true);
    expect(Object.isFrozen(band0.和牌率)).toBe(true);
    expect(Object.isFrozen(band0.和牌率.histogramFull)).toBe(true);
    expect(Object.isFrozen(band0.和牌率.histogramFull?.bins)).toBe(true);

    // トップレベルへの新キー追加も、ネストした bins への代入も TypeError で落ちる
    expect(() => {
      (result as unknown as Record<string, unknown>).zzz = 1;
    }).toThrow(TypeError);
    expect(() => {
      band0.和牌率.histogramFull!.bins[0] = 999;
    }).toThrow(TypeError);

    // 「2回目の呼び出しで汚染が見える」症状が再現しないことを確認する
    fetchMock.mockClear();
    const second = await getGlobalHistogram(4);
    expect(fetchMock).toHaveBeenCalledTimes(0); // キャッシュ共有（同一インスタンス）
    expect(second['8']['0'].和牌率.histogramFull?.bins[0]).toBe(1);
    expect(Object.prototype.hasOwnProperty.call(second, 'zzz')).toBe(false);
  });

  it('getLevelStatistics の結果は外側配列だけでなく要素のタプルまで凍結されている', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, levelStatisticsRaw));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getLevelStatistics(4);

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result[0])).toBe(true);

    // 要素タプルへの書き込みは TypeError で落ちる（外側配列の複製だけでは防げない）
    expect(() => {
      result[0][1] = 99999;
    }).toThrow(TypeError);

    // 「2回目の呼び出しでソート順が変わる」症状が再現しないことを確認する
    fetchMock.mockClear();
    const second = await getLevelStatistics(4);
    expect(fetchMock).toHaveBeenCalledTimes(0); // キャッシュ共有
    expect(second.map((item) => item[1])).toEqual([10101, 10301, 10503, 10799]);
  });
});

describe('searchPlayer — 空・空白のみの prefix では fetch を発行しない (B)', () => {
  it('空文字の prefix では fetch を発行せず空配列を返す', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await searchPlayer(4, '');

    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('空白のみ（半角・全角混在）の prefix でも fetch を発行しない', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await searchPlayer(4, '   　  ');

    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('searchPlayer — ニックネームの encodeURIComponent (C)', () => {
  it('/ ? # を含む prefix が encodeURIComponent され、URL 全体が完全一致する', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, searchPlayerRaw));
    vi.stubGlobal('fetch', fetchMock);

    await searchPlayer(4, 'a/b?c#d', 5);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    // 部分一致ではなく URL 全体の完全一致で検証する（設計書 §2.1 B: #3 の url.includes(...) 教訓）
    const expectedUrl = `${MIRRORS[0]}/api/v2/pl4/search_player/${encodeURIComponent('a/b?c#d')}?limit=5&tag=all`;
    expect(url).toBe(expectedUrl);
  });

  it('日本語ニックネームが encodeURIComponent され、URL 全体が完全一致する', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, searchPlayerRaw));
    vi.stubGlobal('fetch', fetchMock);

    await searchPlayer(4, 'てすと', 3);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    const expectedUrl = `${MIRRORS[0]}/api/v2/pl4/search_player/${encodeURIComponent('てすと')}?limit=3&tag=all`;
    expect(url).toBe(expectedUrl);
  });
});

describe('hourTag — 時刻依存と search_player の tag=all 固定 (E)', () => {
  it('player_stats の tag は1時間ごとに変わり URL に反映される。同一時間内は同じ tag でキャッシュが効く', async () => {
    vi.setSystemTime(new Date('2026-01-01T10:15:00Z'));
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, playerStatsRaw));
    vi.stubGlobal('fetch', fetchMock);

    const playerId = 555555501;
    await getPlayerStats(4, playerId, new Date(0), new Date(1000), [16]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url1] = fetchMock.mock.calls[0] as [string];
    const tag1 = Math.floor(Date.parse('2026-01-01T10:15:00Z') / 3_600_000);
    expect(url1).toBe(
      `${MIRRORS[0]}/api/v2/pl4/player_stats/${playerId}/0/1000?mode=16&tag=${tag1}`,
    );

    // 同一時間内（10:15 → 10:50）に全く同じ引数で再度呼ぶ → 同じ URL・同じ tag → キャッシュヒットで fetch は増えない
    vi.setSystemTime(new Date('2026-01-01T10:50:00Z'));
    fetchMock.mockClear();
    await getPlayerStats(4, playerId, new Date(0), new Date(1000), [16]);
    expect(fetchMock).not.toHaveBeenCalled();

    // 次の時間帯（11:05）に進む → tag が変わり、新しい URL で fetch が発生する
    vi.setSystemTime(new Date('2026-01-01T11:05:00Z'));
    fetchMock.mockClear();
    await getPlayerStats(4, playerId, new Date(0), new Date(1000), [16]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url2] = fetchMock.mock.calls[0] as [string];
    const tag2 = Math.floor(Date.parse('2026-01-01T11:05:00Z') / 3_600_000);
    expect(tag2).not.toBe(tag1);
    expect(url2).toBe(
      `${MIRRORS[0]}/api/v2/pl4/player_stats/${playerId}/0/1000?mode=16&tag=${tag2}`,
    );
  });

  it('search_player は時刻が変わっても tag=all で固定される', async () => {
    vi.setSystemTime(new Date('2026-01-01T10:15:00Z'));
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, searchPlayerRaw));
    vi.stubGlobal('fetch', fetchMock);

    await searchPlayer(4, 'tagcheck-a');
    const [url1] = fetchMock.mock.calls[0] as [string];
    expect(url1).toBe(`${MIRRORS[0]}/api/v2/pl4/search_player/tagcheck-a?limit=20&tag=all`);

    vi.setSystemTime(new Date('2026-01-01T23:59:00Z'));
    await searchPlayer(4, 'tagcheck-b');
    const [url2] = fetchMock.mock.calls[1] as [string];
    expect(url2).toBe(`${MIRRORS[0]}/api/v2/pl4/search_player/tagcheck-b?limit=20&tag=all`);
  });
});

describe('公開7経路の戻り値に freeze で守れない組み込み型が残っていないこと（設計書 §1.5）', () => {
  const FORBIDDEN_CTORS = [Date, Map, Set, RegExp] as const;

  /**
   * value を再帰的に走査し、typeof x === 'object' かつ Object.freeze で内部状態を
   * 保護できない組み込み型（Date / Map / Set / RegExp 等）が含まれていないか確認する。
   * 見つかった場合は throw する（Date 等が将来再混入したら本テストが落ちる）。
   */
  function assertNoUnfreezableBuiltins(value: unknown, path: string, seen: Set<unknown> = new Set()): void {
    if (value === null || typeof value !== 'object') {
      return;
    }
    if (seen.has(value)) {
      return;
    }
    seen.add(value);
    for (const Ctor of FORBIDDEN_CTORS) {
      if (value instanceof Ctor) {
        throw new Error(`${path} is an instance of ${Ctor.name}, which Object.freeze cannot protect from mutation`);
      }
    }
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      assertNoUnfreezableBuiltins(v, `${path}.${key}`, seen);
    }
  }

  it('assertNoUnfreezableBuiltins 自体が Date/Map/Set/RegExp の混入を検出できる（自己検証）', () => {
    expect(() => assertNoUnfreezableBuiltins({ nested: { at: new Date() } }, 'root')).toThrow(/Date/);
    expect(() => assertNoUnfreezableBuiltins([1, 2, new Map()], 'root')).toThrow(/Map/);
    expect(() => assertNoUnfreezableBuiltins(new Set([1, 2]), 'root')).toThrow(/Set/);
    expect(() => assertNoUnfreezableBuiltins(/x/, 'root')).toThrow(/RegExp/);
  });

  it('searchPlayer の戻り値', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, searchPlayerRaw));
    vi.stubGlobal('fetch', fetchMock);
    const result = await searchPlayer(4, 'invariants-search');
    expect(() => assertNoUnfreezableBuiltins(result, 'searchPlayer()')).not.toThrow();
  });

  it('getPlayerStats の戻り値', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, playerStatsRaw));
    vi.stubGlobal('fetch', fetchMock);
    const result = await getPlayerStats(4, 555555502, new Date(0), new Date(1000), [16]);
    expect(() => assertNoUnfreezableBuiltins(result, 'getPlayerStats()')).not.toThrow();
  });

  it('getPlayerExtendedStats の戻り値（recentBigLoss を含む）', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, playerExtendedStatsRaw));
    vi.stubGlobal('fetch', fetchMock);
    const result = await getPlayerExtendedStats(4, 555555503, new Date(0), new Date(1000), [16]);
    // フィクスチャに recentBigLoss がある前提（無いと再帰チェックの対象から漏れて検証が空振りする）
    expect(result?.recentBigLoss).toBeDefined();
    expect(() => assertNoUnfreezableBuiltins(result, 'getPlayerExtendedStats()')).not.toThrow();
  });

  it('getGlobalHistogram の戻り値', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, globalHistogramRaw));
    vi.stubGlobal('fetch', fetchMock);
    const result = await getGlobalHistogram(4);
    expect(() => assertNoUnfreezableBuiltins(result, 'getGlobalHistogram()')).not.toThrow();
  });

  it('getGlobalStatistics の戻り値', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, globalStatistics2Raw));
    vi.stubGlobal('fetch', fetchMock);
    const result = await getGlobalStatistics(4, [16]);
    expect(() => assertNoUnfreezableBuiltins(result, 'getGlobalStatistics()')).not.toThrow();
  });

  it('getLevelStatistics の戻り値', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, levelStatisticsRaw));
    vi.stubGlobal('fetch', fetchMock);
    const result = await getLevelStatistics(4);
    expect(() => assertNoUnfreezableBuiltins(result, 'getLevelStatistics()')).not.toThrow();
  });

  it('getCurrentLevel の戻り値', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, playerStatsRaw));
    vi.stubGlobal('fetch', fetchMock);
    const result = await getCurrentLevel(4, 555555504);
    expect(() => assertNoUnfreezableBuiltins(result, 'getCurrentLevel()')).not.toThrow();
  });
});
