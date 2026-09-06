/**
 * ヒストグラムのビューモデル・クロップ・パス生成・パーセンタイル変換純関数群。
 *
 * 設計書: docs/design/issue-13-comparison-tab.md §3・§4.2・§4.3・§6.2
 */

import type { GameMode, GlobalHistogram, HistogramData } from '../api';
import { getBandZeroHistogram } from '../domain/distribution';
import { COMPARE_METRICS, type MetricDirection, type MetricUnit } from './compareMetrics';

export const CROP_TAIL_RATIO = 0.0005; // 両裾それぞれ 0.05%
export const HISTOGRAM_VIEWBOX_WIDTH = 320;
export const HISTOGRAM_VIEWBOX_HEIGHT = 72;
export const HISTOGRAM_MARKER_OVERSHOOT = 8; // マーカーが最頻値バーより突き出る高さ
export const HISTOGRAM_TOTAL_HEIGHT = HISTOGRAM_VIEWBOX_HEIGHT + HISTOGRAM_MARKER_OVERSHOOT; // 80

/** 表示窓。bin インデックスの閉区間 [lo, hi] と、それに対応する値域 */
export interface HistogramWindow {
  readonly lo: number; // bin index (inclusive)
  readonly hi: number; // bin index (inclusive)
  readonly xMin: number; // h.min + step*lo
  readonly xMax: number; // h.min + step*(hi+1)
  readonly peak: number; // 窓内の最大 bin 度数（y スケール用）
  readonly total: number; // 全域の度数合計（母集団n の算出にも使う）
}

/**
 * 両裾から CROP_TAIL_RATIO ずつ度数を切り落とした表示窓を返す。
 * marks に与えた値（自分・卓平均・段位平均）が窓の外に出る場合は、その値を含むまで窓を広げる。
 * 度数合計が 0、または bins が空なら null。
 */
export function cropHistogram(
  h: HistogramData,
  marks?: readonly (number | null | undefined)[],
): HistogramWindow | null {
  const numBins = h.bins.length;
  if (numBins === 0) return null;

  let total = 0;
  for (let i = 0; i < numBins; i++) {
    total += h.bins[i];
  }
  if (total === 0) return null;

  const cutoff = total * CROP_TAIL_RATIO;
  let lo = 0;
  let sumL = 0;
  while (lo < numBins && sumL + h.bins[lo] <= cutoff) {
    sumL += h.bins[lo];
    lo++;
  }

  let hi = numBins - 1;
  let sumR = 0;
  while (hi >= 0 && sumR + h.bins[hi] <= cutoff) {
    sumR += h.bins[hi];
    hi--;
  }

  // 度数が1ビンに集中して交差した場合
  if (hi < lo) {
    const mid = Math.floor((lo + hi) / 2);
    lo = Math.max(0, mid - 1);
    hi = Math.min(numBins - 1, mid + 1);
  }

  const step = (h.max - h.min) / numBins;

  // marks の包含（[h.min, h.max] 内の値のみ対象）
  if (marks) {
    for (const m of marks) {
      if (typeof m === 'number' && Number.isFinite(m) && m >= h.min && m <= h.max) {
        let binIdx = Math.floor((m - h.min) / step);
        if (binIdx < 0) binIdx = 0;
        if (binIdx >= numBins) binIdx = numBins - 1;
        if (binIdx < lo) lo = binIdx;
        if (binIdx > hi) hi = binIdx;
      }
    }
  }

  // 窓幅が3ビン未満なら左右に足して3ビン以上にする（潰れ防止）
  while (hi - lo + 1 < 3 && (lo > 0 || hi < numBins - 1)) {
    if (lo > 0) lo--;
    if (hi - lo + 1 < 3 && hi < numBins - 1) hi++;
  }

  let peak = 0;
  for (let i = lo; i <= hi; i++) {
    if (h.bins[i] > peak) {
      peak = h.bins[i];
    }
  }
  if (peak === 0) {
    peak = 1;
  }

  const xMin = h.min + step * lo;
  const xMax = h.min + step * (hi + 1);

  return {
    lo,
    hi,
    xMin,
    xMax,
    peak,
    total,
  };
}

/**
 * 指標値を単位に応じてフォーマットする。
 */
export function formatMetricValue(value: number | null | undefined, unit: MetricUnit): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  switch (unit) {
    case 'rate':
      return `${(Math.round(value * 1000) / 10).toFixed(1)}%`;
    case 'point': {
      const rounded = Math.round(value);
      const sign = rounded < 0 ? '\u2212' : '';
      return `${sign}${Math.abs(rounded).toLocaleString('ja-JP')}`;
    }
    case 'turn':
      return `${value.toFixed(2)}巡`;
  }
}

/**
 * ヒストグラムカードの value-row に併記する卓平均・段位平均テキストを生成する。
 * 両方 null または無効な場合は null を返す。
 */
export function formatMeanNote(
  tableMean: number | null | undefined,
  levelMean: number | null | undefined,
  unit: MetricUnit
): string | null {
  const notes: string[] = [];
  if (tableMean !== null && tableMean !== undefined && Number.isFinite(tableMean)) {
    notes.push(`卓平均 ${formatMetricValue(tableMean, unit)}`);
  }
  if (levelMean !== null && levelMean !== undefined && Number.isFinite(levelMean)) {
    notes.push(`段位平均 ${formatMetricValue(levelMean, unit)}`);
  }
  return notes.length > 0 ? notes.join('　') : null;
}

export interface TopPercent {
  readonly ratio: number; // 0..1。0 に近いほど上位
  readonly text: string; // '上位 21.8%' 等
  readonly tone: 'good' | 'bad' | 'neutral';
}

/**
 * direction に従って percentile() の結果を「上位%」へ変換する。
 * percentileValue は percentile() 関数が返した 0..1 の値。
 */
export function toTopPercent(percentileValue: number, direction: MetricDirection): TopPercent {
  const ratio = direction === 'lower' ? percentileValue : 1 - percentileValue;
  const pct = ratio * 100;

  let text: string;
  if (pct < 0.1) {
    text = '上位 0.1%未満';
  } else if (pct > 99.9) {
    text = '上位 99.9%超';
  } else {
    text = `上位 ${pct.toFixed(1)}%`;
  }

  const tone: 'good' | 'bad' | 'neutral' =
    direction === 'neutral' ? 'neutral' : ratio <= 0.5 ? 'good' : 'bad';

  return {
    ratio,
    text,
    tone,
  };
}

/**
 * ヒストグラムの階段状閉多角形 path d 文字列を生成する。
 * 最頻値のバー上端が y = HISTOGRAM_MARKER_OVERSHOOT となり、
 * マーカー線がバーより上に突き出る余白を確保する。
 */
export function buildHistogramPath(h: HistogramData, window: HistogramWindow): string {
  const binCount = window.hi - window.lo + 1;
  if (binCount <= 0) return '';

  const w = HISTOGRAM_VIEWBOX_WIDTH;
  const bottomY = HISTOGRAM_TOTAL_HEIGHT;
  const barHeight = HISTOGRAM_VIEWBOX_HEIGHT;

  const points: string[] = [];
  const firstX = 0;
  points.push(`M ${firstX},${bottomY}`);

  for (let i = window.lo; i <= window.hi; i++) {
    const x0 = (w * (i - window.lo)) / binCount;
    const x1 = (w * (i - window.lo + 1)) / binCount;
    const count = h.bins[i] ?? 0;
    const y = bottomY - (barHeight * count) / window.peak;
    points.push(`L ${x0.toFixed(2)},${y.toFixed(2)}`);
    points.push(`L ${x1.toFixed(2)},${y.toFixed(2)}`);
  }

  points.push(`L ${w},${bottomY} Z`);
  return points.join(' ');
}

export interface MarkerPosition {
  readonly x: number;
  readonly clamped: 'low' | 'high' | null;
}

/**
 * マーカーの X 座標およびレンジ外クランプ判定を算出する。
 */
export function getMarkerPosition(
  val: number | null | undefined,
  h: HistogramData,
  window: HistogramWindow,
): MarkerPosition | null {
  if (val === null || val === undefined || !Number.isFinite(val)) {
    return null;
  }

  if (val < h.min) {
    return { x: 0, clamped: 'low' };
  }
  if (val > h.max) {
    return { x: HISTOGRAM_VIEWBOX_WIDTH, clamped: 'high' };
  }

  const span = window.xMax - window.xMin;
  if (span <= 0) {
    return { x: 0, clamped: null };
  }

  const x = Math.min(
    HISTOGRAM_VIEWBOX_WIDTH,
    Math.max(0, (HISTOGRAM_VIEWBOX_WIDTH * (val - window.xMin)) / span),
  );
  return { x, clamped: null };
}

/**
 * 母集団 n（band 0 の histogramFull 度数合計）。
 * count 指標優先、無ければ設定テーブルの先頭から引けたものを採用。
 */
export function populationSize(gh: GlobalHistogram, mode: GameMode): number | null {
  const countHist = getBandZeroHistogram(gh, mode, 'count');
  if (countHist && countHist.bins.length > 0) {
    return countHist.bins.reduce((a, b) => a + b, 0);
  }

  for (const m of COMPARE_METRICS) {
    const h = getBandZeroHistogram(gh, mode, m.histogramKey);
    if (h && h.bins.length > 0) {
      return h.bins.reduce((a, b) => a + b, 0);
    }
  }

  return null;
}

/**
 * 段位帯 band の mean を引く。
 * 魂天（majorRank >= 6）は numPlayerId*10000+799 で再試行。
 */
export function getLevelBandMean(
  gh: GlobalHistogram,
  mode: GameMode,
  levelId: number | null,
  metricKey: string,
): number | null {
  if (levelId === null) return null;

  const modeData = gh[String(mode)];
  if (!modeData) return null;

  const exactMean = modeData[String(levelId)]?.[metricKey]?.mean;
  if (typeof exactMean === 'number' && Number.isFinite(exactMean)) {
    return exactMean;
  }

  // 魂天フォールバック
  const numPlayerId = Math.floor(levelId / 10000);
  const realId = levelId % 10000;
  const majorRank = Math.floor(realId / 100);
  if (majorRank >= 6) {
    const kontenBand = String(numPlayerId * 10000 + 799);
    const kontenMean = modeData[kontenBand]?.[metricKey]?.mean;
    if (typeof kontenMean === 'number' && Number.isFinite(kontenMean)) {
      return kontenMean;
    }
  }

  return null;
}
