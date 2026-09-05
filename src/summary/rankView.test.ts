import { describe, it, expect } from 'vitest';
import {
  buildRankView,
  skeletonSliceCount,
  DONUT_CIRCUMFERENCE,
  DONUT_GAP,
  DONUT_MIN_ARC,
} from './rankView';
import { averageScore, lastPlaceRate, rentaiRate } from '../domain';
import type { PlayerExtendedStats, PlayerStats } from '../api';

/** 実レスポンス相当（四麻）。src/api/testdata/player_stats.json / player_extended_stats.json の実値 */
function make4pStats(overrides: Partial<PlayerStats> = {}): PlayerStats {
  return {
    id: 123456789,
    nickname: 'テストプレイヤー',
    gameCount: 54,
    level: { id: 10301, score: 695, delta: -11 },
    max_level: { id: 10301, score: 1184, delta: 0 },
    rank_rates: [0.2037, 0.1481, 0.3888, 0.2592],
    rank_avg_score: [37718, 27250, 21357, 11079],
    avg_rank: 2.7037,
    negative_rate: 0.0555,
    played_modes: [8],
    ...overrides,
  };
}

/** fixture 相当（三麻）。src/domain/__fixtures__/player_stats_3p.json の実値 */
function make3pStats(overrides: Partial<PlayerStats> = {}): PlayerStats {
  return {
    id: 123456789,
    nickname: 'テストプレイヤー3',
    gameCount: 814,
    level: { id: 20302, score: 58, delta: 174 },
    max_level: { id: 20302, score: 1000, delta: 0 },
    rank_rates: [0.3002, 0.34, 0.3598],
    rank_avg_score: [62500, 35700, 6800],
    avg_rank: 2.0596,
    negative_rate: 0.09,
    played_modes: [22],
    ...overrides,
  };
}

function makeExtended(roundCount: number): PlayerExtendedStats {
  return { roundCount } as PlayerExtendedStats;
}

describe('rankView: buildRankView', () => {
  it('U1: 四麻の実レスポンス値でスライスが4つ・順位ラベルが1位〜4位になる', () => {
    const view = buildRankView({ stats: make4pStats(), extended: makeExtended(194) });
    expect(view).not.toBeNull();
    expect(view!.slices).toHaveLength(4);
    expect(view!.slices.map((s) => s.label)).toEqual(['1位', '2位', '3位', '4位']);
  });

  it('U2: 三麻でスライスが3つになる', () => {
    const view = buildRankView({ stats: make3pStats(), extended: null });
    expect(view).not.toBeNull();
    expect(view!.slices).toHaveLength(3);
  });

  it('U3: 四麻の色トークンが rank-1..rank-4 の順になる', () => {
    const view = buildRankView({ stats: make4pStats(), extended: null });
    expect(view!.slices.map((s) => s.colorToken)).toEqual(['rank-1', 'rank-2', 'rank-3', 'rank-4']);
  });

  it('U4: 三麻の3スライス目の色トークンが rank-3 になる（rank-4 でないこと）', () => {
    const view = buildRankView({ stats: make3pStats(), extended: null });
    expect(view!.slices.map((s) => s.colorToken)).toEqual(['rank-1', 'rank-2', 'rank-3']);
    expect(view!.slices[2].colorToken).not.toBe('rank-4');
  });

  it('U5: arcOffset が累積割合×円周の負値になる（先頭は -0、2番目は -(C*rates[0])）', () => {
    const stats = make4pStats();
    const view = buildRankView({ stats, extended: null });
    expect(view!.slices[0].arcOffset).toBe(-0);
    expect(view!.slices[1].arcOffset).toBeCloseTo(-(DONUT_CIRCUMFERENCE * stats.rank_rates[0]), 6);
    expect(view!.slices[2].arcOffset).toBeCloseTo(
      -(DONUT_CIRCUMFERENCE * (stats.rank_rates[0] + stats.rank_rates[1])),
      6,
    );
  });

  it('U6: arcLength が C*rate - DONUT_GAP になる', () => {
    const stats = make4pStats();
    const view = buildRankView({ stats, extended: null });
    expect(view!.slices[0].arcLength).toBeCloseTo(DONUT_CIRCUMFERENCE * stats.rank_rates[0] - DONUT_GAP, 6);
  });

  it('U7: rate が 0 のスライスの arcLength が null になる', () => {
    const stats = make4pStats({ rank_rates: [0.6, 0.4, 0, 0], rank_avg_score: [40000, 30000, 10000, 5000] });
    const view = buildRankView({ stats, extended: null });
    expect(view!.slices[2].arcLength).toBeNull();
    expect(view!.slices[3].arcLength).toBeNull();
    expect(view!.slices[0].arcLength).not.toBeNull();
  });

  it('U8: 極小の rate でも arcLength が DONUT_MIN_ARC を下回らない', () => {
    const stats = make4pStats({
      rank_rates: [0.997, 0.001, 0.001, 0.001],
      rank_avg_score: [40000, 30000, 10000, 5000],
    });
    const view = buildRankView({ stats, extended: null });
    for (const slice of view!.slices.slice(1)) {
      expect(slice.arcLength).not.toBeNull();
      expect(slice.arcLength!).toBeGreaterThanOrEqual(DONUT_MIN_ARC);
    }
  });

  it('U9: タイルが常に5枚・§3.6 の順・key が固定', () => {
    const view = buildRankView({ stats: make4pStats(), extended: null });
    expect(view!.tiles).toHaveLength(5);
    expect(view!.tiles.map((t) => t.key)).toEqual(['avgRank', 'rentai', 'last', 'negative', 'avgScore']);
  });

  it('U10: タイルの値が domain の関数と一致する', () => {
    const stats = make4pStats();
    const view = buildRankView({ stats, extended: null });
    const expectedRentai = `${(Math.round(rentaiRate(stats.rank_rates) * 1000) / 10).toFixed(1)}%`;
    const expectedLast = `${(Math.round(lastPlaceRate(stats.rank_rates) * 1000) / 10).toFixed(1)}%`;
    const expectedAvgScore = Math.round(averageScore(stats.rank_rates, stats.rank_avg_score)).toLocaleString(
      'ja-JP',
    );
    expect(view!.tiles[1].value).toBe(expectedRentai);
    expect(view!.tiles[2].value).toBe(expectedLast);
    expect(view!.tiles[4].value).toBe(expectedAvgScore);
  });

  it('U11: 平均順位・飛び率が API 値をそのまま整形した文字列になる', () => {
    const view = buildRankView({ stats: make4pStats(), extended: null });
    expect(view!.tiles[0].value).toBe('2.70');
    expect(view!.tiles[3].value).toBe('5.6%');
  });

  it('U12: 平均持ち点が3桁区切りの整数になる', () => {
    const view = buildRankView({ stats: make4pStats(), extended: null });
    expect(view!.tiles[4].value).toBe('22,894');
  });

  it('U13: extended が null のとき roundCountText が null', () => {
    const view = buildRankView({ stats: make4pStats(), extended: null });
    expect(view!.roundCountText).toBeNull();
  });

  it('U13b: extended が非 null のとき roundCountText が局数の3桁区切り文字列', () => {
    const view = buildRankView({ stats: make4pStats(), extended: makeExtended(194) });
    expect(view!.roundCountText).toBe('194');
  });

  it('U14: rank_rates.length が 2 のとき buildRankView が null を返す', () => {
    const stats = make4pStats({ rank_rates: [0.5, 0.5], rank_avg_score: [30000, 20000] });
    expect(buildRankView({ stats, extended: null })).toBeNull();
  });

  it('U15: rank_avg_score の長さが rank_rates と違うとき null を返す', () => {
    const stats = make4pStats({ rank_avg_score: [37718, 27250, 21357] });
    expect(buildRankView({ stats, extended: null })).toBeNull();
  });

  it('U16: ariaLabel に全順位の割合が含まれる', () => {
    const view = buildRankView({ stats: make4pStats(), extended: null });
    expect(view!.ariaLabel).toBe('順位分布 1位 20.4% 2位 14.8% 3位 38.9% 4位 25.9%');
  });

  it('U17: skeletonSliceCount(4) === 4 / skeletonSliceCount(3) === 3', () => {
    expect(skeletonSliceCount(4)).toBe(4);
    expect(skeletonSliceCount(3)).toBe(3);
  });

  it('gameCountText が試合数の3桁区切り文字列になる', () => {
    const view = buildRankView({ stats: make4pStats(), extended: null });
    expect(view!.gameCountText).toBe('54');
  });

  it('P3-1: gameCountText/roundCountText が4桁以上でも3桁区切りになる（12345戦 / 56789局）', () => {
    const stats = make4pStats({ gameCount: 12345 });
    const view = buildRankView({ stats, extended: makeExtended(56789) });
    expect(view!.gameCountText).toBe('12,345');
    expect(view!.roundCountText).toBe('56,789');
  });

  it('U18: 四麻の実レスポンス値(54戦)の回数が rank_rates×gameCountの最大剰余法で 11/8/21/14 になる', () => {
    const view = buildRankView({ stats: make4pStats(), extended: null });
    expect(view!.slices.map((s) => s.count)).toEqual([11, 8, 21, 14]);
    expect(view!.slices.map((s) => s.countText)).toEqual(['11', '8', '21', '14']);
    expect(view!.slices.reduce((sum, s) => sum + s.count, 0)).toBe(54);
  });

  it('U19: 単純な四捨五入では合計が gameCount と一致しないケースでも、最大剰余法で合計は一致する', () => {
    // 対照実験: rate*gameCount がすべて xx.5 になるケース。Math.round は .5 を常に切り上げるため、
    // 単純に各順位を四捨五入すると 2+2+2+6=12 ≠ 10 になり合計が壊れる。
    const stats = make4pStats({
      rank_rates: [0.15, 0.15, 0.15, 0.55],
      rank_avg_score: [40000, 30000, 20000, 10000],
      gameCount: 10,
    });
    const naiveSum = stats.rank_rates.reduce((sum, rate) => sum + Math.round(rate * stats.gameCount), 0);
    expect(naiveSum).not.toBe(stats.gameCount); // 単純四捨五入では合わないことの確認

    const view = buildRankView({ stats, extended: null });
    const total = view!.slices.reduce((sum, s) => sum + s.count, 0);
    expect(total).toBe(stats.gameCount);
  });

  it('U20: rate が 0 のスライスの回数は 0 になる（0%を含む状態）', () => {
    const stats = make4pStats({ rank_rates: [0.6, 0.4, 0, 0], rank_avg_score: [40000, 30000, 10000, 5000], gameCount: 5 });
    const view = buildRankView({ stats, extended: null });
    expect(view!.slices[2].count).toBe(0);
    expect(view!.slices[3].count).toBe(0);
    expect(view!.slices.reduce((sum, s) => sum + s.count, 0)).toBe(5);
  });
});
