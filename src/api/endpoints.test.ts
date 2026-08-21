import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchPlayer, getPlayerStats, getGlobalStatistics, getLevelStatistics, getCurrentLevel } from './endpoints';
import { setSelectedMirrorIndex } from './mirrors';
import { FakeStorage, jsonResponse } from './testFixtures';
import type { RawGlobalStatistics, RawPlayerStats, RawPlayerSearchResult, LevelStatisticsItem } from './types';
import playerStatsFixture from './testdata/player_stats.json';
import globalStatistics2Fixture from './testdata/global_statistics_2.json';
import searchPlayerFixture from './testdata/search_player.json';
import levelStatisticsFixture from './testdata/level_statistics.json';

const playerStatsRaw = playerStatsFixture as unknown as RawPlayerStats;
const globalStatistics2Raw = globalStatistics2Fixture as unknown as RawGlobalStatistics;
const searchPlayerRaw = searchPlayerFixture as unknown as RawPlayerSearchResult[];
const levelStatisticsRaw = levelStatisticsFixture as unknown as LevelStatisticsItem[];

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

  it('getLevelStatistics(numPlayers=3) は api/v2/pl3/ を叩く', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, levelStatisticsRaw));
    vi.stubGlobal('fetch', fetchMock);

    await getLevelStatistics(3);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/api/v2/pl3/level_statistics');
    expect(url).not.toContain('/api/v2/pl4/');
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
