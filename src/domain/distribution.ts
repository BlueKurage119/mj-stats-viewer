/**
 * 分布統計: histogramFull からの μ・σ、偏差値、パーセンタイル。
 * 本家は μ・σ を計算していない。σ の定義は本設計の独自定義（母集団標準偏差、N 除算）。
 * クランプ済みヒストグラム（histogramFull ではない方）は使わない（σ が過小になり偏差値が過大に出るため）。
 * 詳細: docs/design/issue-4-domain-logic.md §1.8・§5.1
 */

import type { GameMode } from '../api';
import type { GlobalHistogram, HistogramData } from '../api';

export type MetricDistribution = { mean: number; sd: number; count: number };

/**
 * ビン中央値 c_i = min + step*(i+0.5) を代表値として算出。
 * μ = Σ(n_i·c_i)/N, σ = sqrt(Σ(n_i·c_i²)/N − μ²)（母集団標準偏差。N-1 ではない）
 */
export function histogramStats(h: HistogramData): MetricDistribution {
  const step = (h.max - h.min) / h.bins.length;
  let n = 0;
  let sumC = 0;
  let sumC2 = 0;
  for (let i = 0; i < h.bins.length; i++) {
    const count = h.bins[i];
    const c = h.min + step * (i + 0.5);
    n += count;
    sumC += count * c;
    sumC2 += count * c * c;
  }
  if (n === 0) return { mean: 0, sd: 0, count: 0 };
  const mean = sumC / n;
  const variance = sumC2 / n - mean * mean;
  return { mean, sd: Math.sqrt(Math.max(variance, 0)), count: n };
}

/** 偏差値 = 50 + 10(x − μ)/σ。σ === 0 のときは 50 を返す */
export function deviationValue(x: number, d: MetricDistribution): number {
  if (d.sd === 0) return 50;
  return 50 + (10 * (x - d.mean)) / d.sd;
}

/** パーセンタイル（0..1）。getValueAccumulation を移植し N で割る */
export function percentile(x: number, h: HistogramData): number {
  const total = h.bins.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const binStep = (h.max - h.min) / h.bins.length;
  const bin = Math.floor((x - h.min) / binStep);
  let accumulation: number;
  if (bin < 0) {
    accumulation = 0;
  } else if (bin >= h.bins.length) {
    accumulation = total;
  } else {
    let sum = 0;
    for (let i = 0; i < bin; i++) sum += h.bins[i];
    sum += h.bins[bin] * ((x - (h.min + binStep * bin)) / binStep);
    accumulation = sum;
  }
  return accumulation / total;
}

/** GlobalHistogram から band "0" の histogramFull を引く。無ければ null */
export function getBandZeroHistogram(gh: GlobalHistogram, mode: GameMode, metric: string): HistogramData | null {
  return gh[String(mode)]?.['0']?.[metric]?.histogramFull ?? null;
}

/** metric → MetricDistribution の遅延ルックアップ（呼び出しごとに新規生成される閉包でキャッシュする） */
export function createStatsLookup(
  gh: GlobalHistogram,
  mode: GameMode,
): (metric: string) => MetricDistribution | null {
  const cache = new Map<string, MetricDistribution | null>();
  return (metric: string) => {
    if (cache.has(metric)) return cache.get(metric) ?? null;
    const h = getBandZeroHistogram(gh, mode, metric);
    const result = h ? histogramStats(h) : null;
    cache.set(metric, result);
    return result;
  };
}
