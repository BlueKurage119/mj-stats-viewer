/**
 * カード4（主要スタッツ: 6タイル・卓平均差分）のビューモデル。React 非依存の純関数。
 * `getBandZeroMean` のみ `src/domain` から呼び、卓平均は必ず API の `mean` を直接読む
 * （`histogramStats` のビン中央値近似は使わない。issue-11 §1.2）。
 * 詳細: docs/design/issue-11-key-stats.md §3
 */

import type { GameMode, PlayerExtendedStats } from '../api';
import { MODE_LABELS } from '../filters/filterState';

export type MetricDirection = 'higher' | 'lower' | 'neutral';
export type MetricUnit = 'rate' | 'point';

export interface KeyStatMetric {
  readonly key: string;
  readonly label: string;
  readonly statsKey: keyof PlayerExtendedStats & string;
  readonly histogramKey: string;
  readonly unit: MetricUnit;
  readonly direction: MetricDirection;
}

/**
 * このカードの単一情報源。表示順・向きはすべてここで決まる。
 * 立直率・副露率の direction は §0 R-1 により暫定 `neutral`（統括担当が承認・確定済み）。
 */
export const KEY_STAT_METRICS: readonly KeyStatMetric[] = [
  { key: 'winRate', label: '和了率', statsKey: '和牌率', histogramKey: '和牌率', unit: 'rate', direction: 'higher' },
  { key: 'dealInRate', label: '放銃率', statsKey: '放铳率', histogramKey: '放铳率', unit: 'rate', direction: 'lower' },
  { key: 'riichiRate', label: '立直率', statsKey: '立直率', histogramKey: '立直率', unit: 'rate', direction: 'neutral' },
  { key: 'callRate', label: '副露率', statsKey: '副露率', histogramKey: '副露率', unit: 'rate', direction: 'neutral' },
  {
    key: 'avgWinScore',
    label: '平均打点',
    statsKey: '平均打点',
    histogramKey: '平均打点',
    unit: 'point',
    direction: 'higher',
  },
  {
    key: 'avgDealInScore',
    label: '平均放銃点',
    statsKey: '平均铳点',
    histogramKey: '平均铳点',
    unit: 'point',
    direction: 'lower',
  },
];

export type DeltaSign = 'up' | 'down' | 'flat';
export type DeltaTone = 'good' | 'bad' | 'neutral';

export interface KeyStatDelta {
  readonly sign: DeltaSign;
  readonly tone: DeltaTone;
  readonly glyph: '▲' | '▼' | '±';
  readonly text: string;
}

export interface KeyStatTile {
  readonly key: string;
  readonly label: string;
  readonly valueText: string;
  readonly delta: KeyStatDelta | null;
  readonly ariaLabel: string;
}

export interface KeyStatsView {
  readonly tiles: readonly KeyStatTile[];
  readonly note: string;
  readonly comparable: boolean;
}

/** U+2212 MINUS SIGN。ASCII ハイフンではない（§3.3）。 */
const MINUS_SIGN = '−';

function toneFor(metric: KeyStatMetric, sign: DeltaSign): DeltaTone {
  if (sign === 'flat') return 'neutral';
  if (metric.direction === 'neutral') return 'neutral';
  if (metric.direction === 'higher') return sign === 'up' ? 'good' : 'bad';
  // direction === 'lower'
  return sign === 'up' ? 'bad' : 'good';
}

function glyphFor(sign: DeltaSign): '▲' | '▼' | '±' {
  if (sign === 'up') return '▲';
  if (sign === 'down') return '▼';
  return '±';
}

/** 率系の百分率テキスト（rankView.percentText と同じ二重丸め回避方針。issue-9 §3.5） */
function ratePercentText(rate: number): string {
  return (Math.round(rate * 1000) / 10).toFixed(1);
}

function formatValueText(metric: KeyStatMetric, value: number): string {
  if (metric.unit === 'rate') return `${ratePercentText(value)}%`;
  return Math.round(value).toLocaleString('ja-JP');
}

function buildDelta(metric: KeyStatMetric, value: number, mean: number | null): KeyStatDelta | null {
  if (mean === null) return null;

  if (metric.unit === 'rate') {
    const diffPercentPoints = Math.round((value - mean) * 1000) / 10;
    const sign: DeltaSign = diffPercentPoints > 0 ? 'up' : diffPercentPoints < 0 ? 'down' : 'flat';
    const glyph = glyphFor(sign);
    const tone = toneFor(metric, sign);
    const text =
      sign === 'flat'
        ? '±0.0%'
        : `${sign === 'up' ? '+' : MINUS_SIGN}${Math.abs(diffPercentPoints).toFixed(1)}%`;
    return { sign, tone, glyph, text };
  }

  const diffPoints = Math.round(value - mean);
  const sign: DeltaSign = diffPoints > 0 ? 'up' : diffPoints < 0 ? 'down' : 'flat';
  const glyph = glyphFor(sign);
  const tone = toneFor(metric, sign);
  const text =
    sign === 'flat' ? '±0' : `${sign === 'up' ? '+' : MINUS_SIGN}${Math.abs(diffPoints).toLocaleString('ja-JP')}`;
  return { sign, tone, glyph, text };
}

function ariaLabelFor(metric: KeyStatMetric, valueText: string, delta: KeyStatDelta | null): string {
  if (delta === null) return `${metric.label} ${valueText}、卓平均と比較できません`;

  if (delta.sign === 'flat') return `${metric.label} ${valueText}、卓平均と同じ`;

  const direction = delta.sign === 'up' ? '高い' : '低い';
  const magnitudeText = delta.text.replace(/^[+−]/, '').replace(/%$/, '');
  const unitLabel = metric.unit === 'rate' ? 'ポイント' : '点';
  const judgement = delta.tone === 'good' ? '（良い）' : delta.tone === 'bad' ? '（悪い）' : '';

  return `${metric.label} ${valueText}、卓平均より ${magnitudeText} ${unitLabel}${direction}${judgement}`;
}

/** カード3の buildModeNote と同じ規則だが末尾の文言のみ異なる（issue-10 のテストが文言を固定しているため共有化しない。§3.2） */
function buildModeNote(mode: GameMode): string {
  const label = MODE_LABELS[mode];
  const length = label.endsWith('東') ? '東風' : '半荘';
  return `${label}の間・${length}の卓全体平均との比較`;
}

export function buildKeyStatsView(input: {
  readonly extended: PlayerExtendedStats;
  readonly meanOf: (metric: string) => number | null;
  readonly mode: GameMode;
}): KeyStatsView {
  const { extended, meanOf, mode } = input;

  const tiles: KeyStatTile[] = KEY_STAT_METRICS.map((metric) => {
    const value = extended[metric.statsKey] as number;
    const valueText = formatValueText(metric, value);
    const mean = meanOf(metric.histogramKey);
    const delta = buildDelta(metric, value, mean);
    const ariaLabel = ariaLabelFor(metric, valueText, delta);
    return { key: metric.key, label: metric.label, valueText, delta, ariaLabel };
  });

  const comparable = tiles.some((t) => t.delta !== null);

  return { tiles, note: buildModeNote(mode), comparable };
}
