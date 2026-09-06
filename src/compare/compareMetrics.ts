/**
 * 比較タブの指標設定テーブル（このタブの単一情報源）。
 *
 * 設計書: docs/design/issue-13-comparison-tab.md §4.1
 */

import type { PlayerExtendedStats } from '../api';

export type CompareCategory = 'rate' | 'point' | 'speed' | 'luck';
export type MetricDirection = 'higher' | 'lower' | 'neutral';
export type MetricUnit = 'rate' | 'point' | 'turn';

export interface CompareMetric {
  readonly key: string; // 'winRate' 等の安定キー（data-metric / テスト用）
  readonly label: string; // '和了率'
  readonly category: CompareCategory;
  readonly statsKey: keyof PlayerExtendedStats & string; // '和牌率'
  readonly histogramKey: string; // '和牌率'（global_histogram 側のキー）
  readonly unit: MetricUnit;
  readonly direction: MetricDirection;
  readonly denominatorNote?: string; // 分母注記（要件 §8）。無ければ表示しない
}

export const COMPARE_CATEGORY_LABELS: Readonly<Record<CompareCategory, string>> = {
  rate: '率系',
  point: '打点系',
  speed: '速度',
  luck: '運',
};

export const COMPARE_METRICS: readonly CompareMetric[] = [
  {
    key: 'winRate',
    label: '和了率',
    category: 'rate',
    statsKey: '和牌率',
    histogramKey: '和牌率',
    unit: 'rate',
    direction: 'higher',
  },
  {
    key: 'dealInRate',
    label: '放銃率',
    category: 'rate',
    statsKey: '放铳率',
    histogramKey: '放铳率',
    unit: 'rate',
    direction: 'lower',
  },
  {
    key: 'riichiRate',
    label: '立直率',
    category: 'rate',
    statsKey: '立直率',
    histogramKey: '立直率',
    unit: 'rate',
    direction: 'neutral',
  },
  {
    key: 'callRate',
    label: '副露率',
    category: 'rate',
    statsKey: '副露率',
    histogramKey: '副露率',
    unit: 'rate',
    direction: 'neutral',
  },
  {
    key: 'tsumoRate',
    label: 'ツモ率',
    category: 'rate',
    statsKey: '自摸率',
    histogramKey: '自摸率',
    unit: 'rate',
    direction: 'neutral',
    denominatorNote: '和了回数比',
  },
  {
    key: 'damatenRate',
    label: '闇聴率',
    category: 'rate',
    statsKey: '默听率',
    histogramKey: '默听率',
    unit: 'rate',
    direction: 'neutral',
    denominatorNote: '和了回数比',
  },
  {
    key: 'avgWinScore',
    label: '平均打点',
    category: 'point',
    statsKey: '平均打点',
    histogramKey: '平均打点',
    unit: 'point',
    direction: 'higher',
  },
  {
    key: 'avgDealInScore',
    label: '平均放銃点',
    category: 'point',
    statsKey: '平均铳点',
    histogramKey: '平均铳点',
    unit: 'point',
    direction: 'lower',
  },
  {
    key: 'winEfficiency',
    label: '打点効率',
    category: 'point',
    statsKey: '打点效率',
    histogramKey: '打点效率',
    unit: 'point',
    direction: 'higher',
  },
  {
    key: 'lossEfficiency',
    label: '銃点損失',
    category: 'point',
    statsKey: '铳点损失',
    histogramKey: '铳点损失',
    unit: 'point',
    direction: 'lower',
  },
  {
    key: 'netEfficiency',
    label: '調整打点効率',
    category: 'point',
    statsKey: '净打点效率',
    histogramKey: '净打点效率',
    unit: 'point',
    direction: 'higher',
  },
  {
    key: 'avgWinTurn',
    label: '平均和了巡目',
    category: 'speed',
    statsKey: '和了巡数',
    histogramKey: '和了巡数',
    unit: 'turn',
    direction: 'lower',
  },
  {
    key: 'uradoraRate',
    label: '裏ドラ率',
    category: 'luck',
    statsKey: '里宝率',
    histogramKey: '里宝率',
    unit: 'rate',
    direction: 'higher',
  },
  {
    key: 'ippatsuRate',
    label: '一発率',
    category: 'luck',
    statsKey: '一发率',
    histogramKey: '一发率',
    unit: 'rate',
    direction: 'higher',
  },
];
