/**
 * 成長指標: 入れる最上の卓・半荘 / 昇降まで◯戦 / n戦後の見込み。
 * 詳細: docs/design/issue-4-domain-logic.md §1.4・§4.3
 */

import type { GameMode, NumPlayers } from '../api';
import { allModes } from '../api';
import {
  getMaxPoint,
  getNextLevel,
  getPreviousLevel,
  getStartingPoint,
  getVersionAdjustedLevel,
  getVersionAdjustedScore,
  isAllowedMode,
  parseLevelId,
  toLevelId,
} from './level';

export type LevelPoint = { levelId: number; point: number };

/** 入れる最上の卓・半荘。allModes(numPlayers) の並び（王座半荘が先頭）で最初に入室可能なもの */
export function preferredMode(levelId: number): GameMode | null {
  const level = parseLevelId(levelId);
  const numPlayers: NumPlayers = level.numPlayerId === 1 ? 4 : 3;
  for (const mode of allModes(numPlayers)) {
    if (isAllowedMode(level, mode)) return mode;
  }
  return null;
}

/** 1戦分のポイント変動を適用し、必要なら段位を1段だけ動かす（本家 getAdjustedLevel 準拠） */
export function applyPointDelta(lp: LevelPoint, delta: number): LevelPoint {
  const originalLevel = parseLevelId(lp.levelId);
  const rawScore = lp.point + delta;
  const score = getVersionAdjustedScore(originalLevel, rawScore);
  const level = getVersionAdjustedLevel(originalLevel);
  const maxPoint = getMaxPoint(level);

  if (maxPoint && score >= maxPoint) {
    const next = getNextLevel(level);
    return { levelId: toLevelId(next), point: getStartingPoint(next) };
  }
  if (score < 0) {
    const cannotDemote = !maxPoint || level.majorRank === 1 || (level.majorRank === 2 && level.minorRank === 1);
    if (cannotDemote) {
      return { levelId: toLevelId(level), point: 0 };
    }
    const prev = getPreviousLevel(level);
    return { levelId: toLevelId(prev), point: getStartingPoint(prev) };
  }
  return { levelId: toLevelId(level), point: score };
}

/** 昇段まで◯戦。delta <= 0 / 上限0のときは null */
export function gamesToPromotion(lp: LevelPoint, deltaPerGame: number): number | null {
  if (deltaPerGame <= 0) return null;
  const level = parseLevelId(lp.levelId);
  const maxPoint = getMaxPoint(level);
  if (maxPoint === 0) return null;
  const needed = maxPoint - lp.point;
  return Math.ceil(needed / deltaPerGame);
}

/** 降段まで◯戦。delta >= 0 / 降段できない段位のときは null */
export function gamesToDemotion(lp: LevelPoint, deltaPerGame: number): number | null {
  if (deltaPerGame >= 0) return null;
  const level = parseLevelId(lp.levelId);
  const maxPoint = getMaxPoint(level);
  const cannotDemote = maxPoint === 0 || level.majorRank === 1 || (level.majorRank === 2 && level.minorRank === 1);
  if (cannotDemote) return null;
  return Math.floor(lp.point / -deltaPerGame) + 1;
}

/** n戦後の見込み。1戦ずつ applyPointDelta を適用する（段位跨ぎを本家規則で処理） */
export function projectAfterGames(lp: LevelPoint, deltaPerGame: number, games: number): LevelPoint {
  let current = lp;
  for (let i = 0; i < games; i++) {
    current = applyPointDelta(current, deltaPerGame);
  }
  return current;
}
