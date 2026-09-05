/**
 * カード3（打ち筋: レーダー＋傾向2軸）のビューモデル。React 非依存の純関数。
 * `calcRadar` / `calcTendency` / `toBand` は `src/domain` からそのまま呼び、式を書き写さない。
 * タイプ名・バンドの呼称は作らない（オーナー確定。§0.1 R-1/R-2）。
 * 詳細: docs/design/issue-10-playstyle.md §3〜§4
 */

import type { GameMode, PlayerExtendedStats } from '../api';
import { MODE_LABELS } from '../filters/filterState';
import type { MetricLookup } from '../filters/useGlobalHistogram';
import { calcRadar, calcTendency, type RadarAxes, type Tendency } from '../domain';

/** レーダーの幾何定数（TSX に直書きしない） */
export const RADAR_CENTER = 100;
export const RADAR_RADIUS = 70;
export const RADAR_LABEL_RADIUS = 86;
export const RADAR_MIN = 20;
export const RADAR_MAX = 80;
export const RADAR_RINGS: readonly number[] = [35, 50, 65, 80];
export const RADAR_AXIS_ORDER = ['攻', '守', '速', '制', '運'] as const;

type RadarAxis = (typeof RADAR_AXIS_ORDER)[number];

export interface RadarPoint {
  readonly axis: RadarAxis;
  readonly value: number | null; // クランプ前の実値
  readonly valueText: string | null; // '57.2' / null
  readonly x: number; // viewBox 座標。value === null なら中心点（外周上の点は返さない）
  readonly y: number;
  readonly clamped: boolean;
}

export interface TendencyRow {
  readonly key: 'offenseDefense' | 'concealedSpeed';
  readonly band: 0 | 1 | 2 | 3 | 4 | null; // null = 判定不能（分布欠損）
  readonly poleStart: string; // バー左端の極ラベル（'守' / '門前'）
  readonly poleEnd: string; // バー右端の極ラベル（'攻' / '速度'）
  readonly ariaLabel: string; // '守 ⇔ 攻: 5段階のうち守側から4番目' / '守 ⇔ 攻: 判定できません'
}

export interface PlaystyleView {
  readonly points: readonly RadarPoint[]; // 常に長さ5・RADAR_AXIS_ORDER 順
  readonly polygonPoints: string | null; // 全軸有効なときだけ 'x,y x,y …'。1つでも null なら null
  readonly rows: readonly TendencyRow[]; // 常に長さ2
  readonly radarAriaLabel: string; // '打ち筋レーダー 攻 57.2 守 53.6 …（データなしの軸は「データなし」）'
  readonly modeNote: string; // '王座の間・半荘の全体分布との比較'
  readonly allAxesMissing: boolean; // true なら呼び出し側は unavailable 表示にする
}

/** 極座標→viewBox 座標（単体テスト対象） */
export function radarPointAt(index: number, radius: number): { x: number; y: number } {
  const angleDeg = -90 + 72 * index;
  const angleRad = (angleDeg * Math.PI) / 180;
  return {
    x: RADAR_CENTER + radius * Math.cos(angleRad),
    y: RADAR_CENTER + radius * Math.sin(angleRad),
  };
}

/** 偏差値レンジ [RADAR_MIN, RADAR_MAX] を半径 [0, RADAR_RADIUS] に線形マップ（クランプする） */
export function radiusForValue(value: number): number {
  const clamped = Math.min(RADAR_MAX, Math.max(RADAR_MIN, value));
  return ((clamped - RADAR_MIN) / (RADAR_MAX - RADAR_MIN)) * RADAR_RADIUS;
}

function buildPoints(axes: RadarAxes): readonly RadarPoint[] {
  return RADAR_AXIS_ORDER.map((axis, index) => {
    const value = axes[axis];
    if (value === null) {
      const center = radarPointAt(index, 0);
      return { axis, value: null, valueText: null, x: center.x, y: center.y, clamped: false };
    }
    const clamped = value < RADAR_MIN || value > RADAR_MAX;
    const { x, y } = radarPointAt(index, radiusForValue(value));
    return { axis, value, valueText: value.toFixed(1), x, y, clamped };
  });
}

function buildPolygonPoints(points: readonly RadarPoint[]): string | null {
  if (points.some((p) => p.value === null)) return null;
  return points.map((p) => `${p.x},${p.y}`).join(' ');
}

/*
 * バー両端の極ラベル。レーダーの軸ラベル（RADAR_AXIS_ORDER の '攻' / '守'）とは別物で、
 * こちらは1文字に詰める必要がないため語として読める形にしている（オーナー指示・2026-09-06）。
 */
const POLE_LABELS: Record<TendencyRow['key'], { start: string; end: string }> = {
  offenseDefense: { start: '守備', end: '攻撃' },
  concealedSpeed: { start: '門前', end: '速度' },
};

function tendencyAriaLabel(poleStart: string, poleEnd: string, band: 0 | 1 | 2 | 3 | 4 | null): string {
  const prefix = `${poleStart} ⇔ ${poleEnd}`;
  if (band === null) return `${prefix}: 判定できません`;
  return `${prefix}: 5段階のうち${poleStart}側から${band + 1}番目`;
}

function buildRows(tendency: Tendency): readonly TendencyRow[] {
  return (['offenseDefense', 'concealedSpeed'] as const).map((key) => {
    const { start: poleStart, end: poleEnd } = POLE_LABELS[key];
    const band = tendency[key]?.band ?? null;
    return { key, band, poleStart, poleEnd, ariaLabel: tendencyAriaLabel(poleStart, poleEnd, band) };
  });
}

function buildRadarAriaLabel(points: readonly RadarPoint[]): string {
  const parts = points.map((p) => `${p.axis} ${p.valueText ?? 'データなし'}`);
  return `打ち筋レーダー ${parts.join(' ')}`;
}

/** 部屋名＋卓の長さ（半荘/東風）の注記。MODE_LABELS が東風系のみ「東」を含む点を利用する */
function buildModeNote(mode: GameMode): string {
  const label = MODE_LABELS[mode];
  const length = label.endsWith('東') ? '東風' : '半荘';
  return `${label}の間・${length}の全体分布との比較`;
}

export function buildPlaystyleView(input: {
  readonly extended: PlayerExtendedStats;
  readonly lookup: MetricLookup;
  readonly mode: GameMode;
}): PlaystyleView {
  const { extended, lookup, mode } = input;

  const radarAxes = calcRadar(extended, lookup);
  const tendency = calcTendency(extended, lookup);

  const points = buildPoints(radarAxes);
  const polygonPoints = buildPolygonPoints(points);
  const rows = buildRows(tendency);

  const allAxesMissing = points.every((p) => p.value === null) && rows.every((r) => r.band === null);

  return {
    points,
    polygonPoints,
    rows,
    radarAriaLabel: buildRadarAriaLabel(points),
    modeNote: buildModeNote(mode),
    allAxesMissing,
  };
}
