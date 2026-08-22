/**
 * 段位・段位Pt変動に関する定数。
 *
 * 出典: amae-koromo（MIT License）
 *   - src/data/types/level.ts
 *   - src/data/types/metadata.ts
 * 本ファイルは上記2ファイルの定数部分を移植したもの。
 * 詳細な調査結果は docs/design/issue-4-domain-logic.md §1.1・§1.2 を参照。
 */

import type { GameMode, NumPlayers } from '../api';

/** 段位の上限pt。添字 = (majorRank-1)*3 + (minorRank-1)（長さ15 = 初心1〜雀聖3） */
export const LEVEL_MAX_POINTS: readonly number[] = [
  20, 80, 200, 600, 800, 1000, 1200, 1400, 2000, 2800, 3200, 3600, 4000, 6000, 9000,
];

/** ラスペナ表。LEVEL_MAX_POINTS より1つ長い（長さ16。添字15は未使用） */
export const LEVEL_PENALTY: readonly number[] = [
  0, 0, 0, 20, 40, 60, 80, 100, 120, 165, 180, 195, 210, 225, 240, 255,
]; // 四麻・半荘
export const LEVEL_PENALTY_3: readonly number[] = [
  0, 0, 0, 20, 40, 60, 80, 100, 120, 165, 190, 215, 240, 265, 290, 320,
]; // 三麻・半荘
export const LEVEL_PENALTY_E: readonly number[] = [
  0, 0, 0, 10, 20, 30, 40, 50, 60, 80, 90, 100, 110, 120, 130, 140,
]; // 四麻・東風
export const LEVEL_PENALTY_E_3: readonly number[] = [
  0, 0, 0, 10, 20, 30, 40, 50, 60, 80, 95, 110, 125, 140, 160, 175,
]; // 三麻・東風

export const LEVEL_KONTEN = 7;
export const LEVEL_MAX_POINT_KONTEN = 2000;
/** 魂天が KONTEN_DELTA の無いモードで計算されるときの代替段位（雀聖3） */
export const KONTEN_FALLBACK_LEVEL_ID = 503;

/** ペナルティ表のモード対応（§1.1）。キー = GameMode */
const PENALTY_TABLE_BY_MODE: Record<GameMode, readonly number[]> = {
  9: LEVEL_PENALTY,
  12: LEVEL_PENALTY,
  16: LEVEL_PENALTY,
  8: LEVEL_PENALTY_E,
  11: LEVEL_PENALTY_E,
  15: LEVEL_PENALTY_E,
  22: LEVEL_PENALTY_3,
  24: LEVEL_PENALTY_3,
  26: LEVEL_PENALTY_3,
  21: LEVEL_PENALTY_E_3,
  23: LEVEL_PENALTY_E_3,
  25: LEVEL_PENALTY_E_3,
};

export function penaltyTableForMode(mode: GameMode): readonly number[] {
  return PENALTY_TABLE_BY_MODE[mode];
}

/** キー = numPlayerId*100 + majorRank */
export const LEVEL_ALLOWED_MODES: Readonly<Record<number, readonly GameMode[]>> = {
  101: [],
  102: [],
  103: [9, 8],
  104: [9, 12, 8, 11],
  105: [12, 16, 11, 15],
  106: [16, 15],
  107: [16, 15],
  201: [],
  202: [],
  203: [22, 21],
  204: [22, 24, 21, 23],
  205: [24, 26, 23, 25],
  206: [26, 25],
  207: [26, 25],
};

export const RANK_DELTA_4: readonly number[] = [15, 5, -5, -15];
export const RANK_DELTA_3: readonly number[] = [15, 0, -15];

/** 順位別モードボーナス（キー = GameMode） */
export const MODE_DELTA: Readonly<Record<GameMode, readonly number[]>> = {
  9: [80, 40, 0, 0], // 金
  12: [110, 55, 0, 0], // 玉
  16: [120, 60, 0, 0], // 王座
  8: [40, 20, 0, 0], // 金東
  11: [55, 30, 0, 0], // 玉東
  15: [60, 30, 0, 0], // 王東
  22: [105, 0, 0], // 三金
  24: [160, 0, 0], // 三玉
  26: [240, 0, 0], // 三王座
  21: [55, 0, 0], // 三金東
  23: [75, 0, 0], // 三玉東
  25: [120, 0, 0], // 三王東
};

/** 魂天は素点によらず固定。王座/王東のみ定義（他モードには入室できない） */
export const KONTEN_DELTA: Readonly<Partial<Record<GameMode, readonly number[]>>> = {
  16: [50, 20, -20, -50], // 王座
  15: [30, 10, -10, -30], // 王東
  26: [50, 0, -50], // 三王座
  25: [30, 0, -30], // 三王東
};

const FOUR_PLAYER_MODES: ReadonlySet<GameMode> = new Set([8, 9, 11, 12, 15, 16]);

export function numPlayersForMode(mode: GameMode): NumPlayers {
  return FOUR_PLAYER_MODES.has(mode) ? 4 : 3;
}

/** 配給原点。四麻25000 / 三麻35000 */
export function baseOriginForMode(mode: GameMode): number {
  return numPlayersForMode(mode) === 4 ? 25000 : 35000;
}

export function rankDeltaTableForMode(mode: GameMode): readonly number[] {
  return numPlayersForMode(mode) === 4 ? RANK_DELTA_4 : RANK_DELTA_3;
}

/** 添字 = majorRank-1、魂天は添字5固定 */
export const LEVEL_TAGS_JA: readonly string[] = ['初心', '雀士', '雀傑', '雀豪', '雀聖', '魂天'];
