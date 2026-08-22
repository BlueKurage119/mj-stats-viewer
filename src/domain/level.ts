/**
 * levelId のパース・タグ・上限pt・遷移・魂天補正・表示整形。
 *
 * 出典: amae-koromo（MIT License）src/data/types/level.ts の Level クラスを
 * 純関数群として移植したもの（クラスではなく plain object + 関数）。
 * 詳細: docs/design/issue-4-domain-logic.md §1・§3
 */

import type { GameMode } from '../api';
import type { LevelWithDelta } from '../api';
import {
  LEVEL_ALLOWED_MODES,
  LEVEL_MAX_POINTS,
  LEVEL_MAX_POINT_KONTEN,
  LEVEL_TAGS_JA,
  penaltyTableForMode,
} from './levelConstants';

export type NumPlayerId = 1 | 2; // 1=四麻 2=三麻
export type Level = { readonly numPlayerId: number; readonly majorRank: number; readonly minorRank: number };

export function parseLevelId(levelId: number): Level {
  const numPlayerId = Math.floor(levelId / 10000);
  const realId = levelId % 10000;
  const majorRank = Math.floor(realId / 100);
  const minorRank = realId % 100;
  return { numPlayerId, majorRank, minorRank };
}

export function toLevelId(level: Level): number {
  return level.numPlayerId * 10000 + level.majorRank * 100 + level.minorRank;
}

/** majorRank >= 6（旧魂天も現行魂天も真） */
export function isKonten(level: Level): boolean {
  return level.majorRank >= 6;
}

/** 本家 isSame。魂天は 6 と 7 を同一視する */
export function isSameLevel(a: Level, b: Level): boolean {
  if (a.numPlayerId !== b.numPlayerId || a.minorRank !== b.minorRank) return false;
  if (a.majorRank === b.majorRank) return true;
  return isKonten(a) && isKonten(b);
}

export function isAllowedMode(level: Level, mode: GameMode): boolean {
  const key = level.numPlayerId * 100 + level.majorRank;
  const list = LEVEL_ALLOWED_MODES[key] ?? [];
  return list.includes(mode);
}

const KONTEN_TOP_MINOR_RANK = 20;

/** 魂天20 → 0（上限なし）、魂天（それ以外） → 2000、通常段位 → LEVEL_MAX_POINTS */
export function getMaxPoint(level: Level): number {
  if (isKonten(level)) {
    return level.minorRank >= KONTEN_TOP_MINOR_RANK ? 0 : LEVEL_MAX_POINT_KONTEN;
  }
  const idx = (level.majorRank - 1) * 3 + (level.minorRank - 1);
  return LEVEL_MAX_POINTS[idx] ?? 0;
}

/** 魂天では 0 を返す（§1.3-4） */
export function getPenaltyPoint(level: Level, mode: GameMode): number {
  if (isKonten(level)) return 0;
  const idx = (level.majorRank - 1) * 3 + (level.minorRank - 1);
  const table = penaltyTableForMode(mode);
  return table[idx] ?? 0;
}

export function getStartingPoint(level: Level): number {
  return level.majorRank === 1 ? 0 : getMaxPoint(level) / 2;
}

export function getNextLevel(level: Level): Level {
  if (level.majorRank === 5 && level.minorRank === 3) {
    // 雀聖3 → 魂天1（majorRank 6 を飛ばす）
    return { numPlayerId: level.numPlayerId, majorRank: 7, minorRank: 1 };
  }
  if (isKonten(level)) {
    return { numPlayerId: level.numPlayerId, majorRank: level.majorRank, minorRank: level.minorRank + 1 };
  }
  if (level.minorRank === 3) {
    return { numPlayerId: level.numPlayerId, majorRank: level.majorRank + 1, minorRank: 1 };
  }
  return { numPlayerId: level.numPlayerId, majorRank: level.majorRank, minorRank: level.minorRank + 1 };
}

export function getPreviousLevel(level: Level): Level {
  if (level.majorRank === 1 && level.minorRank === 1) {
    // 初心1: 自分自身を返す
    return level;
  }
  if (level.majorRank === 7 && level.minorRank === 1) {
    // 魂天1 → 雀聖3（majorRank 6 を飛ばす）
    return { numPlayerId: level.numPlayerId, majorRank: 5, minorRank: 3 };
  }
  if (isKonten(level)) {
    return { numPlayerId: level.numPlayerId, majorRank: level.majorRank, minorRank: level.minorRank - 1 };
  }
  if (level.minorRank === 1) {
    return { numPlayerId: level.numPlayerId, majorRank: level.majorRank - 1, minorRank: 3 };
  }
  return { numPlayerId: level.numPlayerId, majorRank: level.majorRank, minorRank: level.minorRank - 1 };
}

/** majorRank 6（旧魂天）は majorRank 7 minorRank 1 として扱う */
export function getVersionAdjustedLevel(level: Level): Level {
  return level.majorRank === 6 ? { numPlayerId: level.numPlayerId, majorRank: 7, minorRank: 1 } : level;
}

/** majorRank 6（旧魂天）のスコアを現行魂天スケールへ補正する */
export function getVersionAdjustedScore(level: Level, score: number): number {
  return level.majorRank === 6 ? Math.ceil(score / 100) * 10 + 200 : score;
}

/**
 * 現在ポイントを与えたときの実効段位（本家 getAdjustedLevel。1ステップのみ）。
 * 段位跨ぎ時のポイント計算は growth.ts の applyPointDelta を使うこと。
 */
export function getAdjustedLevel(level: Level, score: number): Level {
  const adjustedScore = getVersionAdjustedScore(level, score);
  const adjustedLevel = getVersionAdjustedLevel(level);
  const maxPoints = getMaxPoint(adjustedLevel);
  if (maxPoints && adjustedScore >= maxPoints) {
    return getNextLevel(adjustedLevel);
  }
  if (adjustedScore < 0) {
    const cannotDemote =
      !maxPoints || adjustedLevel.majorRank === 1 || (adjustedLevel.majorRank === 2 && adjustedLevel.minorRank === 1);
    if (cannotDemote) return adjustedLevel;
    return getPreviousLevel(adjustedLevel);
  }
  return adjustedLevel;
}

export function getLevelTag(level: Level): string {
  const idx = isKonten(level) ? 5 : level.majorRank - 1;
  const label = LEVEL_TAGS_JA[idx];
  if (level.majorRank === 6) return label; // 旧魂天だけは数字を付けない
  return `${label}${level.minorRank}`;
}

export function getLevelTagFromId(levelId: number): string {
  return getLevelTag(parseLevelId(levelId));
}

/** 魂天は score/100 の小数1桁、それ以外はそのまま数値文字列 */
export function getScoreDisplay(level: Level, score: number): string {
  const adjustedScore = getVersionAdjustedScore(level, score);
  if (isKonten(level)) return (adjustedScore / 100).toFixed(1);
  return String(score);
}

/** '232/1400' 形式。上限0のときは数値のみ。段位が変わる場合は新段位の初期ポイントを表示する */
export function formatAdjustedScore(level: Level, score: number): string {
  const adjusted = getAdjustedLevel(level, score);
  const displayScore = isSameLevel(adjusted, level) ? score : getStartingPoint(adjusted);
  const maxPoint = getMaxPoint(adjusted);
  const scoreText = getScoreDisplay(adjusted, displayScore);
  return maxPoint ? `${scoreText}/${maxPoint}` : scoreText;
}

export function currentPoint(lv: LevelWithDelta): number {
  return lv.score + lv.delta;
}

/** '雀傑2 232/1400' 形式 */
export function formatLevelWithDelta(lv: LevelWithDelta): string {
  const level = parseLevelId(lv.id);
  const point = currentPoint(lv);
  const adjusted = getAdjustedLevel(level, point);
  return `${getLevelTag(adjusted)} ${formatAdjustedScore(level, point)}`;
}
