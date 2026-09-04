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

/**
 * 本家 isSame（level.ts:74-81）。両者が魂天 かつ どちらかの majorRank が6（旧魂天）なら
 * minorRank を見ずに true を返す（旧魂天は現行魂天のどの minorRank とも同一視される）。
 * それ以外は numPlayerId・majorRank・minorRank の完全一致。
 */
export function isSameLevel(a: Level, b: Level): boolean {
  if (a.numPlayerId !== b.numPlayerId) return false;
  if (isKonten(a) && isKonten(b) && (a.majorRank === 6 || b.majorRank === 6)) return true;
  return a.majorRank === b.majorRank && a.minorRank === b.minorRank;
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

/**
 * 段位の主要部ラベル（'初心'|'雀士'|'雀傑'|'雀豪'|'雀聖'|'魂天'）。魂天は majorRank>=6 で '魂天'。
 * getLevelTag() の戻り値を文字列操作して主要部を取り出すのではなく、idx算出を独立に行う
 * （設計書 issue-8 §3.2）。
 */
export function getLevelMajorTag(level: Level): string {
  const idx = isKonten(level) ? 5 : level.majorRank - 1;
  return LEVEL_TAGS_JA[idx];
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

/**
 * '232/1400' 形式。上限0のときは数値のみ。段位が変わる場合は新段位の初期ポイントを表示する。
 * 本家 formatAdjustedScore（level.ts:194-200）逐語移植。getScoreDisplay を分子・分母の
 * 両方に適用する（魂天では分母も /100 の小数1桁表示になる。例: 2000 → '20.0'）。
 * score は「渡された level のスケールで既に評価可能な値」であること（majorRank 6 の
 * 生スコアをそのまま渡さない。version 補正は呼び出し側の責務 — formatLevelWithDelta 参照）。
 */
export function formatAdjustedScore(level: Level, score: number): string {
  let displayLevel = level;
  let displayScore = score;
  const maxPoint = getMaxPoint(level);
  if (maxPoint && score >= maxPoint) {
    displayLevel = getNextLevel(level);
    displayScore = getStartingPoint(displayLevel);
  } else if (score < 0) {
    const cannotDemote = !maxPoint || level.majorRank === 1 || (level.majorRank === 2 && level.minorRank === 1);
    if (cannotDemote) {
      displayScore = Math.max(score, 0);
    } else {
      displayLevel = getPreviousLevel(level);
      displayScore = getStartingPoint(displayLevel);
    }
  }
  const newMax = getMaxPoint(displayLevel);
  const scoreText = getScoreDisplay(displayLevel, displayScore);
  if (!newMax) return scoreText;
  return `${scoreText}/${getScoreDisplay(displayLevel, newMax)}`;
}

export function currentPoint(lv: LevelWithDelta): number {
  return lv.score + lv.delta;
}

/**
 * '雀傑2 232/1400' 形式。
 * 分子（現在pt）は getVersionAdjustedScore 相当の変換をかけてから formatAdjustedScore に
 * 渡す（majorRank 6 の生スコアをそのまま渡すと、majorRank 7 スケールの上限pt と誤って
 * 比較され不正な昇段判定を起こすため）。
 */
export function formatLevelWithDelta(lv: LevelWithDelta): string {
  const level = parseLevelId(lv.id);
  const point = currentPoint(lv);
  const adjustedLevel = getVersionAdjustedLevel(level);
  const adjustedPoint = getVersionAdjustedScore(level, point);
  const adjusted = getAdjustedLevel(level, point);
  return `${getLevelTag(adjusted)} ${formatAdjustedScore(adjustedLevel, adjustedPoint)}`;
}
