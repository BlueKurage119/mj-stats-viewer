import { describe, it, expect } from 'vitest';
import { createStatsLookup, deviationValue, getBandZeroHistogram, histogramStats, percentile } from './distribution';
import type { GlobalHistogram, HistogramData } from '../api';
import globalHistogramRaw from './__fixtures__/global_histogram.json';

const gh = globalHistogramRaw as unknown as GlobalHistogram;

function wakachiHistogram(): HistogramData {
  const h = getBandZeroHistogram(gh, 16, '和牌率');
  if (!h) throw new Error('fixture missing 和牌率 histogramFull');
  return h;
}

describe('distribution: histogramStats', () => {
  it('和牌率の μ・σ（Issue の実測値）', () => {
    const stats = histogramStats(wakachiHistogram());
    expect(stats.mean).toBeCloseTo(0.2093, 4);
    expect(stats.sd).toBeCloseTo(0.0239, 4);
  });
});

describe('distribution: deviationValue', () => {
  it('和牌率0.24の偏差値 ≈ 62.8', () => {
    const stats = histogramStats(wakachiHistogram());
    expect(deviationValue(0.24, stats)).toBeCloseTo(62.845, 3);
  });

  it('平均値の偏差値は50。σ=0の分布は50を返す', () => {
    const stats = histogramStats(wakachiHistogram());
    expect(deviationValue(stats.mean, stats)).toBeCloseTo(50, 6);
    expect(deviationValue(0.5, { mean: 0.5, sd: 0, count: 1 })).toBe(50);
  });
});

describe('distribution: percentile', () => {
  it('和牌率の分布内パーセンタイル', () => {
    const h = wakachiHistogram();
    expect(percentile(0.24, h)).toBeCloseTo(0.902, 3);
    expect(percentile(0.18, h)).toBeCloseTo(0.108, 3);
  });

  it('域外で飽和する', () => {
    const h = wakachiHistogram();
    expect(percentile(-1, h)).toBe(0);
    expect(percentile(999, h)).toBe(1);
  });
});

describe('distribution: histogramClamped を使わない', () => {
  it('clamped から計算した σ とは異なる（clamped は使っていない証拠）', () => {
    const full = wakachiHistogram();
    const clamped = gh['16']?.['0']?.['和牌率']?.histogramClamped;
    if (!clamped) throw new Error('fixture missing histogramClamped for 和牌率');
    const statsFull = histogramStats(full);
    const statsClamped = histogramStats(clamped);
    expect(statsFull.sd).not.toBeCloseTo(statsClamped.sd, 3);
  });
});

describe('distribution: getBandZeroHistogram', () => {
  it('存在しない指標は null', () => {
    expect(getBandZeroHistogram(gh, 16, '存在しない指標')).toBe(null);
  });

  it('band 0 を持たないモードは null', () => {
    expect(getBandZeroHistogram(gh, 9, '和牌率')).toBe(null);
  });
});

describe('distribution: createStatsLookup', () => {
  it('同一 metric を2回引いても同じ結果になる（キャッシュ）', () => {
    const lookup = createStatsLookup(gh, 16);
    const a = lookup('和牌率');
    const b = lookup('和牌率');
    expect(a).toEqual(b);
  });

  it('存在しない metric は null をキャッシュして返す', () => {
    const lookup = createStatsLookup(gh, 16);
    expect(lookup('存在しない指標')).toBe(null);
    expect(lookup('存在しない指標')).toBe(null);
  });
});
