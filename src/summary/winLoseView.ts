/**
 * カード5（和銃分布ドーナツ3枚）のビューモデル。React 非依存の純関数。
 * 詳細: docs/design/issue-12-win-lose-donuts.md §4.3-b/c
 */

import type { PlayerExtendedStats } from '../api';
import type { Breakdown } from '../domain';
import { dealInBreakdown, dealInStateBreakdown, winBreakdown } from '../domain';
import type { HandColorKey } from '../theme/seeds';
import { percentTenths, toDonutArcs } from './donutShared';

export type DonutKey = 'winState' | 'dealInState' | 'dealInTarget';

const SLICE_KEYS: readonly HandColorKey[] = ['hand-riichi', 'hand-furo', 'hand-menzen'];

export interface WinLoseSlice {
  readonly key: HandColorKey; // React key 兼 色トークン名
  readonly label: string; // '立直' | '副露' | '黙聴' | '門前'
  readonly rate: number; // 0..1（丸め前）
  readonly percentText: string; // '36.2'（% 記号なし。3枚合計は常に '100.0' 相当）
  readonly arcLength: number | null;
  readonly arcOffset: number;
}

export interface WinLoseDonut {
  readonly key: DonutKey;
  readonly title: string; // '和了時の状態' 等
  readonly slices: readonly WinLoseSlice[] | null; // null = このドーナツはデータ無し
  readonly ariaLabel: string; // slices が null なら '和了時の状態 データなし'
}

export interface WinLoseView {
  readonly donuts: readonly WinLoseDonut[]; // 常に長さ3・§2.1 表の順
}

interface DonutSpec {
  readonly key: DonutKey;
  readonly title: string;
  readonly labels: readonly [string, string, string];
  readonly breakdown: (extended: PlayerExtendedStats) => Breakdown | null;
}

const DONUT_SPECS: readonly DonutSpec[] = [
  { key: 'winState', title: '和了時の状態', labels: ['立直', '副露', '黙聴'], breakdown: winBreakdown },
  { key: 'dealInState', title: '放銃時の状態', labels: ['立直', '副露', '門前'], breakdown: dealInStateBreakdown },
  { key: 'dealInTarget', title: '放銃相手の状態', labels: ['立直', '副露', '黙聴'], breakdown: dealInBreakdown },
];

/**
 * ドーナツごとの固定ラベル3つ（立直/副露/黙聴 or 門前）。
 * このドーナツが空（slices === null）のときでも、カード側が凡例のラベル列だけは
 * 表示し続けるために使う（§4.5「凡例は3行のまま値を — にする」）。
 */
export const DONUT_LABELS: Record<DonutKey, readonly [string, string, string]> = {
  winState: DONUT_SPECS[0].labels,
  dealInState: DONUT_SPECS[1].labels,
  dealInTarget: DONUT_SPECS[2].labels,
};

function emptyDonut(spec: DonutSpec): WinLoseDonut {
  return { key: spec.key, title: spec.title, slices: null, ariaLabel: `${spec.title} データなし` };
}

function buildDonut(spec: DonutSpec, extended: PlayerExtendedStats): WinLoseDonut {
  const breakdown = spec.breakdown(extended);
  if (breakdown === null) return emptyDonut(spec);

  const rates = [breakdown.立直, breakdown.副露, breakdown.默听] as const;

  // Number.isFinite ガード: ?? 0 補完が効かなかった場合の二重の守り（issue-12 §4.3-b）。
  if (!rates.every((rate) => Number.isFinite(rate))) return emptyDonut(spec);

  const tenths = percentTenths(rates);
  const arcs = toDonutArcs(rates);

  const slices: WinLoseSlice[] = rates.map((rate, i) => ({
    key: SLICE_KEYS[i],
    label: spec.labels[i],
    rate,
    percentText: (tenths[i] / 10).toFixed(1),
    arcLength: arcs[i].arcLength,
    arcOffset: arcs[i].arcOffset,
  }));

  const ariaLabel = `${spec.title} ${slices.map((s) => `${s.label} ${s.percentText}%`).join(' ')}`;

  return { key: spec.key, title: spec.title, slices, ariaLabel };
}

/** extended が null のときは呼ばない（カード側でメッセージを出す） */
export function buildWinLoseView(extended: PlayerExtendedStats): WinLoseView {
  return { donuts: DONUT_SPECS.map((spec) => buildDonut(spec, extended)) };
}
