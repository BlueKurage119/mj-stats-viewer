/**
 * グローバルフィルタの状態・定数・純関数群。
 * DOM や React に依存せず、純粋なロジックとして完結する。
 */

import type { GameMode, NumPlayers, PeriodPreset } from '../api';
import { allModes, joinModes } from '../api';
import { LEVEL_ALLOWED_MODES } from '../domain/levelConstants';
import { parseLevelId } from '../domain/level';

export const MODE_QUERY_KEY = 'mode';
export const PERIOD_QUERY_KEY = 'period';
export const DEFAULT_PERIOD: PeriodPreset = 'all';
export const NO_GAMES_IN_PERIOD_MESSAGE = 'この期間の対局はありません';

export interface GlobalFilter {
  readonly modes: readonly GameMode[]; // 空にならない（§2.5）
  readonly period: PeriodPreset;
}

/** 表示順・ラベル。全12 GameMode を網羅する */
export const MODE_LABELS: Readonly<Record<GameMode, string>> = {
  16: '王座',
  12: '玉',
  9: '金',
  15: '王東',
  11: '玉東',
  8: '金東',
  26: '三王座',
  24: '三玉',
  22: '三金',
  25: '三王東',
  23: '三玉東',
  21: '三金東',
};

export const PERIOD_OPTIONS: readonly { readonly preset: PeriodPreset; readonly label: string }[] = [
  { preset: 'all', label: '全期間' },
  { preset: '1y', label: '1年' },
  { preset: '90d', label: '90日' },
  { preset: '30d', label: '30日' },
  { preset: '7d', label: '7日' },
];

/** 重複除去 → numPlayers に属さない ID を除去 → allModes(numPlayers) の順に整列。冪等 */
export function canonicalizeModes(
  modes: readonly number[],
  numPlayers: NumPlayers,
): readonly GameMode[] {
  const order = allModes(numPlayers);
  const modeSet = new Set(modes);
  return order.filter((m) => modeSet.has(m));
}

/** '16.12' → [16,12]。空・全要素不正なら null（＝「指定なし」） */
export function parseModes(raw: string | null, numPlayers: NumPlayers): readonly GameMode[] | null {
  if (!raw || raw.trim() === '') {
    return null;
  }
  const parts = raw.split('.');
  const nums: number[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (/^\d+$/.test(trimmed)) {
      const n = parseInt(trimmed, 10);
      if (Number.isSafeInteger(n)) {
        nums.push(n);
      }
    }
  }
  const canonical = canonicalizeModes(nums, numPlayers);
  return canonical.length > 0 ? canonical : null;
}

/** joinModes(canonicalizeModes(...)) の薄いラッパー */
export function serializeModes(modes: readonly GameMode[]): string {
  return joinModes(modes);
}

/** PeriodPreset として妥当なら返す。それ以外は null */
export function parsePeriod(raw: string | null): PeriodPreset | null {
  if (raw === 'all' || raw === '1y' || raw === '90d' || raw === '30d' || raw === '7d') {
    return raw;
  }
  return null;
}

/** §2.4 の規則。levelId が null なら手順1)を飛ばす。戻り値は必ず非空 */
export function defaultModes(
  numPlayers: NumPlayers,
  levelId: number | null,
  playedModes: readonly GameMode[],
): readonly GameMode[] {
  const order = allModes(numPlayers);
  if (levelId !== null) {
    const level = parseLevelId(levelId);
    const key = level.numPlayerId * 100 + level.majorRank;
    const allowed = LEVEL_ALLOWED_MODES[key] ?? [];
    const firstAllowed = order.find((m) => allowed.includes(m));
    if (firstAllowed !== undefined) {
      return [firstAllowed];
    }
  }
  const firstPlayed = order.find((m) => playedModes.includes(m));
  if (firstPlayed !== undefined) {
    return [firstPlayed];
  }
  return [...order];
}

/** §2.5。空になる除去は no-op（current をそのまま返す） */
export function toggleMode(
  current: readonly GameMode[],
  mode: GameMode,
  numPlayers: NumPlayers,
): readonly GameMode[] {
  if (current.includes(mode)) {
    if (current.length <= 1) {
      return current;
    }
    const filtered = current.filter((m) => m !== mode);
    return canonicalizeModes(filtered, numPlayers);
  }
  return canonicalizeModes([...current, mode], numPlayers);
}

/**
 * #13（比較タブ）向けの代表モードセレクタ。
 * gameCountByMode が与えられればその最大値のモード、同数・未提供のときは
 * allModes(numPlayers) の順（上位卓・半荘優先）で selected の先頭を返す。
 * selected が空なら Error を throw する（不変条件違反の早期検出）。
 * ※ モード別対局数は player_stats 1本からは取れない。§7 参照
 */
export function selectRepresentativeMode(
  numPlayers: NumPlayers,
  selected: readonly GameMode[],
  gameCountByMode?: Readonly<Partial<Record<GameMode, number>>>,
): GameMode {
  if (selected.length === 0) {
    throw new Error('selectRepresentativeMode: selected modes must not be empty');
  }
  const order = allModes(numPlayers);
  const sorted = order.filter((m) => selected.includes(m));
  if (!gameCountByMode) {
    return sorted[0];
  }
  let bestMode = sorted[0];
  let maxCount = gameCountByMode[bestMode] ?? 0;
  for (let i = 1; i < sorted.length; i++) {
    const mode = sorted[i];
    const count = gameCountByMode[mode] ?? 0;
    if (count > maxCount) {
      maxCount = count;
      bestMode = mode;
    }
  }
  return bestMode;
}
