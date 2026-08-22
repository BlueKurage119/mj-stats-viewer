import { describe, it, expect } from 'vitest';
import { calcTendency, toBand, type TendencyInput } from './tendency';
import { createStatsLookup, deviationValue } from './distribution';
import type { GlobalHistogram } from '../api';
import globalHistogramRaw from './__fixtures__/global_histogram.json';
import extendedStats from './__fixtures__/extended_stats_4p.json';

const gh = globalHistogramRaw as unknown as GlobalHistogram;
const lookup = createStatsLookup(gh, 16);
const stats: TendencyInput = extendedStats;

function z(metric: string, x: number): number {
  const d = lookup(metric);
  if (!d) throw new Error(`missing distribution for ${metric}`);
  return (deviationValue(x, d) - 50) / 10;
}

describe('tendency: calcTendency', () => {
  it('2軸の値（Issue の実測値）と band', () => {
    const tendency = calcTendency(stats, lookup);
    expect(tendency.offenseDefense?.value).toBeCloseTo(0.3436, 4);
    expect(tendency.offenseDefense?.band).toBe(2);
    expect(tendency.concealedSpeed?.value).toBeCloseTo(0.139, 4);
    expect(tendency.concealedSpeed?.band).toBe(2);
  });

  it('等係数の単純平均であること', () => {
    const tendency = calcTendency(stats, lookup);
    const zRiichi = z('立直率', stats.立直率);
    const zOitachi = z('追立率', stats.追立率);
    const zHoujuu = z('放铳率', stats.放铳率);
    const zMoten = z('默听率', stats.默听率);
    const expectedOffense = (zRiichi + zOitachi + zHoujuu - zMoten) / 4;
    expect(tendency.offenseDefense?.value).toBeCloseTo(expectedOffense, 10);
  });

  it('一部 metric の分布が欠けても残りの項で平均される', () => {
    const partialLookup = (metric: string) => (metric === '追立率' ? null : lookup(metric));
    const tendency = calcTendency(stats, partialLookup);
    const zRiichi = z('立直率', stats.立直率);
    const zHoujuu = z('放铳率', stats.放铳率);
    const zMoten = z('默听率', stats.默听率);
    expect(tendency.offenseDefense?.value).toBeCloseTo((zRiichi + zHoujuu - zMoten) / 3, 10);
  });

  it('全項の分布が欠けると軸は null', () => {
    const tendency = calcTendency(stats, () => null);
    expect(tendency.offenseDefense).toBe(null);
    expect(tendency.concealedSpeed).toBe(null);
  });
});

describe('tendency: toBand', () => {
  it('境界値', () => {
    expect(toBand(-1.5)).toBe(1);
    expect(toBand(-1.51)).toBe(0);
    expect(toBand(-0.5)).toBe(2);
    expect(toBand(0.5)).toBe(3);
    expect(toBand(1.5)).toBe(4);
    expect(toBand(0)).toBe(2);
  });
});
