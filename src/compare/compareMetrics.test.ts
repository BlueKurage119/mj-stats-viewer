import { describe, expect, it } from 'vitest';
import {
  COMPARE_CATEGORY_LABELS,
  COMPARE_METRICS,
  type CompareCategory,
} from './compareMetrics';

describe('compareMetrics', () => {
  it('defines exactly 14 metrics in the specified order', () => {
    expect(COMPARE_METRICS).toHaveLength(14);
    const keys = COMPARE_METRICS.map((m) => m.key);
    expect(keys).toEqual([
      'winRate',
      'dealInRate',
      'riichiRate',
      'callRate',
      'tsumoRate',
      'damatenRate',
      'avgWinScore',
      'avgDealInScore',
      'winEfficiency',
      'lossEfficiency',
      'netEfficiency',
      'avgWinTurn',
      'uradoraRate',
      'ippatsuRate',
    ]);
  });

  // A2-1: direction === 'lower' が 放銃率・平均放銃点・銃点損失・平均和了巡目 のちょうど4件
  it('has exactly 4 lower-is-better metrics', () => {
    const lowerMetrics = COMPARE_METRICS.filter((m) => m.direction === 'lower');
    expect(lowerMetrics).toHaveLength(4);
    expect(lowerMetrics.map((m) => m.key)).toEqual([
      'dealInRate',
      'avgDealInScore',
      'lossEfficiency',
      'avgWinTurn',
    ]);
  });

  it('has exactly 4 neutral metrics', () => {
    const neutralMetrics = COMPARE_METRICS.filter((m) => m.direction === 'neutral');
    expect(neutralMetrics).toHaveLength(4);
    expect(neutralMetrics.map((m) => m.key)).toEqual([
      'riichiRate',
      'callRate',
      'tsumoRate',
      'damatenRate',
    ]);
  });

  it('has 6 higher-is-better metrics', () => {
    const higherMetrics = COMPARE_METRICS.filter((m) => m.direction === 'higher');
    expect(higherMetrics).toHaveLength(6);
    expect(higherMetrics.map((m) => m.key)).toEqual([
      'winRate',
      'avgWinScore',
      'winEfficiency',
      'netEfficiency',
      'uradoraRate',
      'ippatsuRate',
    ]);
  });

  it('groups metrics into valid categories', () => {
    const counts: Record<CompareCategory, number> = {
      rate: 0,
      point: 0,
      speed: 0,
      luck: 0,
    };
    for (const m of COMPARE_METRICS) {
      counts[m.category]++;
    }
    expect(counts).toEqual({
      rate: 6,
      point: 5,
      speed: 1,
      luck: 2,
    });
    for (const cat of Object.keys(counts) as CompareCategory[]) {
      expect(COMPARE_CATEGORY_LABELS[cat]).toBeTruthy();
    }
  });

  it('specifies denominator notes for tsumoRate and damatenRate', () => {
    const tsumo = COMPARE_METRICS.find((m) => m.key === 'tsumoRate');
    const damaten = COMPARE_METRICS.find((m) => m.key === 'damatenRate');
    expect(tsumo?.denominatorNote).toBe('和了回数比');
    expect(damaten?.denominatorNote).toBe('和了回数比');
  });
});
