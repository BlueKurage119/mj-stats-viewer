import { describe, it, expect } from 'vitest';
import {
  averageScore,
  dealInBreakdown,
  lastPlaceRate,
  levelDistributionPosition,
  rentaiRate,
  roundBalance,
  winBreakdown,
} from './derived';
import levelStatistics from './__fixtures__/level_statistics.json';
import type { LevelStatistics } from '../api';

describe('derived: roundBalance', () => {
  it('三麻フィクスチャ相当の入力', () => {
    const result = roundBalance({
      rankRates: [0.3002, 0.34, 0.3598],
      rankAvgScores: [62500, 35700, 6800],
      mode: 22,
      gameCount: 814,
      roundCount: 3256,
    });
    expect(result).toBeCloseTo(-413.215, 3);
  });

  it('roundCount === 0 で null', () => {
    const result = roundBalance({
      rankRates: [0.3002, 0.34, 0.3598],
      rankAvgScores: [62500, 35700, 6800],
      mode: 22,
      gameCount: 814,
      roundCount: 0,
    });
    expect(result).toBe(null);
  });
});

describe('derived: averageScore / rentaiRate / lastPlaceRate', () => {
  const rankRates = [0.3002, 0.34, 0.3598];
  const rankAvgScores = [62500, 35700, 6800];

  it('averageScore', () => {
    expect(averageScore(rankRates, rankAvgScores)).toBeCloseTo(33347.14, 2);
  });

  it('rentaiRate', () => {
    expect(rentaiRate(rankRates)).toBeCloseTo(0.6402, 4);
  });

  it('lastPlaceRate', () => {
    expect(lastPlaceRate(rankRates)).toBeCloseTo(0.3598, 4);
  });
});

describe('derived: winBreakdown / dealInBreakdown', () => {
  it('winBreakdown: 内訳比率を計算する', () => {
    const result = winBreakdown({ 立直和了: 30, 副露和了: 50, 默听和了: 20 });
    expect(result).toEqual({ 立直: 0.3, 副露: 0.5, 默听: 0.2 });
  });

  it('winBreakdown: 合計0はnull', () => {
    expect(winBreakdown({ 立直和了: 0, 副露和了: 0, 默听和了: 0 })).toBe(null);
  });

  it('dealInBreakdown: 内訳比率を計算する', () => {
    const result = dealInBreakdown({ 放铳至立直: 10, 放铳至副露: 60, 放铳至默听: 30 });
    expect(result).toEqual({ 立直: 0.1, 副露: 0.6, 默听: 0.3 });
  });

  it('dealInBreakdown: 合計0はnull', () => {
    expect(dealInBreakdown({ 放铳至立直: 0, 放铳至副露: 0, 放铳至默听: 0 })).toBe(null);
  });
});

describe('derived: levelDistributionPosition', () => {
  it('10301以下の四麻人数の累積割合', () => {
    const result = levelDistributionPosition(levelStatistics as LevelStatistics, 10301);
    expect(result).toBeCloseTo(0.96104, 5);
  });

  it('三麻エントリは除外される（levelId 20302 で三麻集計になる）', () => {
    const result = levelDistributionPosition(levelStatistics as LevelStatistics, 20302);
    // 三麻分は [2, 20302, 900] のみ → 累積割合は 1
    expect(result).toBeCloseTo(1, 6);
  });
});
