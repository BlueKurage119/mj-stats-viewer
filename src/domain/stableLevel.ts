/**
 * 安定段位（estimateStableLevel2 / estimateStableLevel の移植）。
 * 詳細: docs/design/issue-4-domain-logic.md §1.7・§4.4
 */

import type { GameMode } from '../api';
import { expectedPointPerGame } from './points';
import { getAdjustedLevel, getNextLevel, getPreviousLevel, isAllowedMode, isKonten, parseLevelId, toLevelId, type Level } from './level';
import { KONTEN_DELTA } from './levelConstants';

export type StableLevel =
  | { kind: 'number'; value: number } // 玉/王座（四麻半荘）
  | { kind: 'level'; levelId: number; bound: 'exact' | 'plus' | 'minus'; expectedPoint: number }
  | { kind: 'konten'; levelId: number; expectedPoint: number }
  | { kind: 'unavailable' };

export type StableLevelInput = {
  levelId: number;
  score: number;
  delta: number;
  rankRates: readonly number[];
  rankAvgScores: readonly number[];
};

const MAX_ITERATIONS = 32;
const EPSILON = 0.001;

function expectedAt(input: StableLevelInput, mode: GameMode, level: Level, includePenalty: boolean): number {
  return expectedPointPerGame(input.rankRates, input.rankAvgScores, mode, level, { includePenalty });
}

function jinsei3Level(level: Level): Level {
  return { numPlayerId: level.numPlayerId, majorRank: 5, minorRank: 3 };
}

export function estimateStableLevel2(input: StableLevelInput, mode: GameMode): StableLevel {
  if (mode !== 12 && mode !== 16) return estimateStableLevel(input, mode);

  const lastRate = input.rankRates[input.rankRates.length - 1];
  if (!lastRate) return { kind: 'unavailable' };

  const level = getAdjustedLevel(parseLevelId(input.levelId), input.score + input.delta);
  const kontenDelta = KONTEN_DELTA[mode];
  let E = expectedAt(input, mode, level, false);

  if (isKonten(level) && kontenDelta) {
    if (Math.abs(E) < EPSILON) {
      return { kind: 'konten', levelId: toLevelId(level), expectedPoint: 0 };
    }
    if (E > 0) {
      return { kind: 'konten', levelId: toLevelId(level), expectedPoint: E };
    }
    // E <= 0: 雀聖3固定で再計算して以下へ
    E = expectedAt(input, mode, jinsei3Level(level), false);
  } else {
    const provisionalResult = E / (lastRate * 15) - 10;
    if (provisionalResult > 7 && kontenDelta) {
      return estimateStableLevel(input, mode);
    }
  }

  const result = E / (lastRate * 15) - 10;
  return { kind: 'number', value: result };
}

export function estimateStableLevel(input: StableLevelInput, mode: GameMode): StableLevel {
  let level = getAdjustedLevel(parseLevelId(input.levelId), input.score + input.delta);
  let lastPositive: Level | null = null;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const E = expectedAt(input, mode, level, true);
    if (Math.abs(E) < EPSILON) {
      return { kind: 'level', levelId: toLevelId(level), bound: 'exact', expectedPoint: 0 };
    }
    if (E >= 0) {
      if (isKonten(level)) {
        return { kind: 'konten', levelId: toLevelId(level), expectedPoint: E };
      }
      lastPositive = level;
      const next = getNextLevel(level);
      if (!isAllowedMode(next, mode)) {
        return { kind: 'level', levelId: toLevelId(lastPositive), bound: 'plus', expectedPoint: E };
      }
      level = next;
      continue;
    }
    // E < 0
    if (lastPositive) {
      return {
        kind: 'level',
        levelId: toLevelId(lastPositive),
        bound: 'exact',
        expectedPoint: expectedAt(input, mode, lastPositive, true),
      };
    }
    break;
  }

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const prev = getPreviousLevel(level);
    if (!isAllowedMode(prev, mode) || toLevelId(prev) === toLevelId(level)) {
      return { kind: 'level', levelId: toLevelId(level), bound: 'minus', expectedPoint: expectedAt(input, mode, level, true) };
    }
    level = prev;
    const E = expectedAt(input, mode, level, true);
    if (E > -EPSILON) {
      return { kind: 'level', levelId: toLevelId(level), bound: 'exact', expectedPoint: Math.abs(E) };
    }
  }

  return { kind: 'unavailable' };
}

/** kind:'number' の表示分解。value >= 4 → 雀聖(value-3) / それ以外 → 雀豪(value)。小数2桁「切り捨て」 */
export function splitStableLevelNumber(value: number): { majorRank: 4 | 5; value: number; text: string } {
  const truncate2 = (x: number): string => (Math.trunc(x * 100) / 100).toFixed(2);
  if (value >= 4) {
    const v = value - 3;
    return { majorRank: 5, value: v, text: `雀聖${truncate2(v)}` };
  }
  return { majorRank: 4, value, text: `雀豪${truncate2(value)}` };
}
