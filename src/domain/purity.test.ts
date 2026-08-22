import { describe, it, expect } from 'vitest';
import { rankDeltaPoints, expectedPointPerGame } from './points';
import { promotionConditions } from './transitions';
import { calcRadar } from './radar';
import { calcTendency } from './tendency';
import { roundBalance, levelDistributionPosition } from './derived';
import { parseLevelId } from './level';
import { createStatsLookup } from './distribution';
import type { GlobalHistogram, LevelStatistics } from '../api';
import globalHistogramRaw from './__fixtures__/global_histogram.json';
import extendedStats from './__fixtures__/extended_stats_4p.json';
import levelStatistics from './__fixtures__/level_statistics.json';

/** 再帰的 Object.freeze。src/api/freeze.ts の deepFreeze 相当（テスト専用に独立実装） */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as Record<string, unknown>)) {
      deepFreeze(v);
    }
  }
  return value;
}

const gh = deepFreeze(structuredClone(globalHistogramRaw)) as unknown as GlobalHistogram;
const stats = deepFreeze(structuredClone(extendedStats));
const levelStats = deepFreeze(structuredClone(levelStatistics)) as unknown as LevelStatistics;

describe('purity: 入力を変更しない（freeze した引数でも TypeError が出ない）', () => {
  it('rankDeltaPoints / expectedPointPerGame', () => {
    const rankAvgScores = deepFreeze([62500, 35700, 6800]);
    const rankRates = deepFreeze([0.3002, 0.34, 0.3598]);
    const level = deepFreeze(parseLevelId(20302));
    expect(() => rankDeltaPoints(rankAvgScores, 22, level)).not.toThrow();
    expect(() => expectedPointPerGame(rankRates, rankAvgScores, 22, level)).not.toThrow();
  });

  it('promotionConditions', () => {
    const lv = deepFreeze({ id: 20302, score: 1350, delta: 0 });
    expect(() => promotionConditions(lv, 22)).not.toThrow();
  });

  it('calcRadar', () => {
    const lookup = createStatsLookup(gh, 16);
    expect(() => calcRadar(stats, lookup)).not.toThrow();
  });

  it('calcTendency', () => {
    const lookup = createStatsLookup(gh, 16);
    expect(() => calcTendency(stats, lookup)).not.toThrow();
  });

  it('roundBalance', () => {
    const input = deepFreeze({
      rankRates: [0.3002, 0.34, 0.3598],
      rankAvgScores: [62500, 35700, 6800],
      mode: 22 as const,
      gameCount: 814,
      roundCount: 3256,
    });
    expect(() => roundBalance(input)).not.toThrow();
  });

  it('levelDistributionPosition', () => {
    expect(() => levelDistributionPosition(levelStats, 10301)).not.toThrow();
  });
});

describe('purity: 参照透過（同じ引数で2回呼ぶと deep-equal な結果になる）', () => {
  it('expectedPointPerGame', () => {
    const level = parseLevelId(20302);
    const a = expectedPointPerGame([0.3002, 0.34, 0.3598], [62500, 35700, 6800], 22, level);
    const b = expectedPointPerGame([0.3002, 0.34, 0.3598], [62500, 35700, 6800], 22, level);
    expect(a).toEqual(b);
  });

  it('calcRadar', () => {
    const lookup = createStatsLookup(gh, 16);
    expect(calcRadar(stats, lookup)).toEqual(calcRadar(stats, lookup));
  });
});
