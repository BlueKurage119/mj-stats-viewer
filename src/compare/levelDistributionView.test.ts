import { describe, expect, it } from 'vitest';
import levelStatsFixture from '../domain/__fixtures__/level_statistics.json';
import type { LevelStatistics } from '../api';
import {
  buildLevelDistributionView,
  levelBucketLabel,
  levelStatBucketId,
  LEVEL_DISTRIBUTION_NOTE,
} from './levelDistributionView';

const stats = levelStatsFixture as LevelStatistics;

describe('levelDistributionView', () => {
  // A6-1: buildLevelDistributionView の集計
  it('aggregates zones correctly and excludes other numPlayers (A6-1)', () => {
    const view = buildLevelDistributionView({
      stats,
      numPlayers: 4,
      selfLevelId: 10301,
    });

    // 10101: 20411 (zone 1) + 1000 (zone 3) = 21411
    // 10301: 15302 (zone 1) + 5000 (zone 2) = 20302
    // 10501: 1204 (zone 1) + 400 (zone 2) = 1604
    // 10799: 87 (zone 1)
    // 20302 (三麻) は除外される
    // total = 21411 + 20302 + 1604 + 87 = 43404
    expect(view.bars.map((b) => b.bucketId)).toEqual([10101, 10301, 10501, 10799]);
    expect(view.bars.map((b) => b.count)).toEqual([21411, 20302, 1604, 87]);
    expect(view.total).toBe(43404);
    expect(view.note).toBe(LEVEL_DISTRIBUTION_NOTE);
  });

  // A6-2: 上位%（R-5 定義: 自分の帯は上位に数えない）
  it('calculates top percent correctly for selfLevelId (A6-2)', () => {
    // 10301 より上は 10501(1604) + 10799(87) = 1691
    // 1691 / 43404 ≈ 0.0389595... (3.89%) -> 上位 3.9%
    const view10301 = buildLevelDistributionView({
      stats,
      numPlayers: 4,
      selfLevelId: 10301,
    });
    expect(view10301.topPercent).not.toBeNull();
    expect(view10301.topPercent!.ratio).toBeCloseTo(0.03896, 4);
    expect(view10301.topPercent!.text).toBe('上位 3.9%');

    // 10501 より上は 10799(87) -> 87 / 43404 ≈ 0.002004... (0.2%) -> 上位 0.2%
    const view10501 = buildLevelDistributionView({
      stats,
      numPlayers: 4,
      selfLevelId: 10501,
    });
    expect(view10501.topPercent).not.toBeNull();
    expect(view10501.topPercent!.ratio).toBeCloseTo(0.002004, 4);
    expect(view10501.topPercent!.text).toBe('上位 0.2%');
  });

  // A6-2b: 魂天の畳み込み
  it('folds konten into 10799 bucket and reports 上位 0.1%未満 (A6-2b)', () => {
    const viewKonten = buildLevelDistributionView({
      stats,
      numPlayers: 4,
      selfLevelId: 10701, // 魂天1
    });
    expect(viewKonten.selfBucketId).toBe(10799);
    const kontenBar = viewKonten.bars.find((b) => b.bucketId === 10799);
    expect(kontenBar).toBeDefined();
    expect(kontenBar!.isSelf).toBe(true);

    // 魂天より上の帯はないので 0 人 -> ratio = 0 -> 上位 0.1%未満
    expect(viewKonten.topPercent).not.toBeNull();
    expect(viewKonten.topPercent!.ratio).toBe(0);
    expect(viewKonten.topPercent!.text).toBe('上位 0.1%未満');
  });

  // A6-3: ラベル判定
  it('formats bucket labels correctly (A6-3)', () => {
    expect(levelBucketLabel(10799)).toBe('魂天'); // '魂天99' ではない
    expect(levelBucketLabel(10501)).toBe('雀聖1');
    expect(levelBucketLabel(10401)).toBe('雀豪1');
    expect(levelBucketLabel(10301)).toBe('雀傑1');
    expect(levelBucketLabel(10101)).toBe('初心1');
  });

  // A6-4: selfLevelId が null のとき
  it('handles selfLevelId: null gracefully (A6-4)', () => {
    const viewNull = buildLevelDistributionView({
      stats,
      numPlayers: 4,
      selfLevelId: null,
    });
    expect(viewNull.selfBucketId).toBeNull();
    expect(viewNull.topPercent).toBeNull();
    expect(viewNull.bars.every((b) => !b.isSelf)).toBe(true);
    expect(viewNull.bars).toHaveLength(4);
  });

  it('normalizes konten bucket IDs with levelStatBucketId', () => {
    expect(levelStatBucketId(10701)).toBe(10799);
    expect(levelStatBucketId(10720)).toBe(10799);
    expect(levelStatBucketId(20701)).toBe(20799);
    expect(levelStatBucketId(10503)).toBe(10503);
    expect(levelStatBucketId(10101)).toBe(10101);
  });
});
