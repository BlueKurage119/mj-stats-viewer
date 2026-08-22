import { describe, it, expect } from 'vitest';
import { calcRadar, type RadarInput } from './radar';
import { createStatsLookup } from './distribution';
import type { GlobalHistogram } from '../api';
import globalHistogramRaw from './__fixtures__/global_histogram.json';
import extendedStats from './__fixtures__/extended_stats_4p.json';

const gh = globalHistogramRaw as unknown as GlobalHistogram;
const lookup = createStatsLookup(gh, 16);
const stats: RadarInput = extendedStats;

describe('radar: calcRadar', () => {
  it('5軸の値（Issue の実測値）', () => {
    const axes = calcRadar(stats, lookup);
    expect(axes.攻).toBeCloseTo(57.2223, 3);
    expect(axes.守).toBeCloseTo(53.6364, 3);
    expect(axes.速).toBeCloseTo(57.8244, 3);
    expect(axes.制).toBeCloseTo(58.6209, 3);
    expect(axes.運).toBeCloseTo(53.6481, 3);
  });

  it('分布が引けない metric があるとその軸だけ null、他は算出される', () => {
    const partialLookup = (metric: string) => (metric === '打点效率' ? null : lookup(metric));
    const axes = calcRadar(stats, partialLookup);
    expect(axes.攻).toBe(null);
    expect(axes.守).not.toBe(null);
    expect(axes.速).not.toBe(null);
    expect(axes.制).not.toBe(null);
    expect(axes.運).not.toBe(null);
  });

  it('運の分母が0のときは null', () => {
    const zeroLookup = (metric: string) => {
      if (metric === '里宝率' || metric === '一发率') return { mean: 0, sd: 1, count: 1 };
      return lookup(metric);
    };
    const axes = calcRadar(stats, zeroLookup);
    expect(axes.運).toBe(null);
  });
});
