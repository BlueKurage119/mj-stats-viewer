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
  it('2軸の値（Issue の実測値・校正後）と band', () => {
    const tendency = calcTendency(stats, lookup);
    expect(tendency.offenseDefense?.value).toBeCloseTo(0.6871, 4);
    expect(tendency.offenseDefense?.band).toBe(3);
    expect(tendency.concealedSpeed?.value).toBeCloseTo(0.2407, 4);
    expect(tendency.concealedSpeed?.band).toBe(2);
  });

  it('等係数の合成を √項数 で正規化していること', () => {
    const tendency = calcTendency(stats, lookup);
    const zRiichi = z('立直率', stats.立直率);
    const zOitachi = z('追立率', stats.追立率);
    const zHoujuu = z('放铳率', stats.放铳率);
    const zMoten = z('默听率', stats.默听率);
    const expectedOffense = (zRiichi + zOitachi + zHoujuu - zMoten) / Math.sqrt(4);
    expect(tendency.offenseDefense?.value).toBeCloseTo(expectedOffense, 10);
  });

  it('一部 metric の分布が欠けても残りの項で合成される', () => {
    const partialLookup = (metric: string) => (metric === '追立率' ? null : lookup(metric));
    const tendency = calcTendency(stats, partialLookup);
    const zRiichi = z('立直率', stats.立直率);
    const zHoujuu = z('放铳率', stats.放铳率);
    const zMoten = z('默听率', stats.默听率);
    expect(tendency.offenseDefense?.value).toBeCloseTo((zRiichi + zHoujuu - zMoten) / Math.sqrt(3), 10);
  });

  it('全項の分布が欠けると軸は null', () => {
    const tendency = calcTendency(stats, () => null);
    expect(tendency.offenseDefense).toBe(null);
    expect(tendency.concealedSpeed).toBe(null);
  });

  it('合成値は単位 SD に正規化されている（DT1: Σz / √k に一致）', () => {
    const tendency = calcTendency(stats, lookup);
    const zRiichi = z('立直率', stats.立直率);
    const zOitachi = z('追立率', stats.追立率);
    const zHoujuu = z('放铳率', stats.放铳率);
    const zMoten = z('默听率', stats.默听率);
    const zFuro = z('副露率', stats.副露率);
    const zJunsu = z('和了巡数', stats.和了巡数);

    expect(tendency.offenseDefense?.value).toBeCloseTo((zRiichi + zOitachi + zHoujuu - zMoten) / Math.sqrt(4), 10);
    expect(tendency.concealedSpeed?.value).toBeCloseTo((zFuro - zMoten - zJunsu) / Math.sqrt(3), 10);

    const partialLookup = (metric: string) => (metric === '追立率' ? null : lookup(metric));
    const partial = calcTendency(stats, partialLookup);
    expect(partial.offenseDefense?.value).toBeCloseTo((zRiichi + zHoujuu - zMoten) / Math.sqrt(3), 10);
  });

  it('項が1つだけのとき値はその z そのもの（DT2）', () => {
    const onlyRiichiLookup = (metric: string) => (metric === '立直率' ? lookup(metric) : null);
    const tendency = calcTendency(stats, onlyRiichiLookup);
    const zRiichi = z('立直率', stats.立直率);
    expect(tendency.offenseDefense?.value).toBeCloseTo(zRiichi, 10);
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
