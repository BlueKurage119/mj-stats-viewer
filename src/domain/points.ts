/**
 * 段位Pt変動（calculateDeltaPoint）と順位別変動・期待値。
 *
 * 出典: amae-koromo（MIT License）src/data/types/metadata.ts の
 * calculateDeltaPoint を逐語移植したもの。詳細: docs/design/issue-4-domain-logic.md §1.3・§4.1
 */

import type { GameMode } from '../api';
import { isKonten, getPenaltyPoint, type Level } from './level';
import {
  KONTEN_DELTA,
  KONTEN_FALLBACK_LEVEL_ID,
  MODE_DELTA,
  baseOriginForMode,
  numPlayersForMode,
  rankDeltaTableForMode,
} from './levelConstants';

export type DeltaOptions = { includePenalty?: boolean; trimNumber?: boolean };

function kontenFallbackLevel(level: Level): Level {
  // KONTEN_FALLBACK_LEVEL_ID = 503 → majorRank 5, minorRank 3（雀聖3）
  const majorRank = Math.floor(KONTEN_FALLBACK_LEVEL_ID / 100);
  const minorRank = KONTEN_FALLBACK_LEVEL_ID % 100;
  return { numPlayerId: level.numPlayerId, majorRank, minorRank };
}

/**
 * §1.3 の逐語移植。level は「変動を受ける側の段位」。
 * 魂天（KONTEN_DELTA があるモード）は score を完全に無視して固定値を返す。
 */
export function calculateDeltaPoint(
  score: number,
  rank: number,
  mode: GameMode,
  level: Level,
  options?: DeltaOptions,
): number {
  const includePenalty = options?.includePenalty ?? true;
  const trimNumber = options?.trimNumber ?? true;

  let effectiveLevel = level;
  if (isKonten(level)) {
    const kontenDelta = KONTEN_DELTA[mode];
    if (kontenDelta) {
      return kontenDelta[rank];
    }
    effectiveLevel = kontenFallbackLevel(level);
  }

  const base = baseOriginForMode(mode);
  const rankDeltaTable = rankDeltaTableForMode(mode);
  const raw = (score - base) / 1000 + rankDeltaTable[rank];
  const trimmed = trimNumber ? Math.ceil(raw) : raw;
  let result = trimmed + MODE_DELTA[mode][rank];
  if (rank === rankDeltaTable.length - 1 && includePenalty) {
    result -= getPenaltyPoint(effectiveLevel, mode);
  }
  return result;
}

function assertRankCount(mode: GameMode, length: number): void {
  const expected = numPlayersForMode(mode);
  if (length !== expected) {
    throw new Error(
      `points: array length ${length} does not match mode ${mode}'s player count ${expected}`,
    );
  }
}

/** rank_avg_score を順位ごとに代入した変動値。長さは rank_avg_score と同じ */
export function rankDeltaPoints(
  rankAvgScores: readonly number[],
  mode: GameMode,
  level: Level,
  options?: DeltaOptions,
): number[] {
  assertRankCount(mode, rankAvgScores.length);
  return rankAvgScores.map((score, rank) => calculateDeltaPoint(score, rank, mode, level, options));
}

/** Σ(rank_rates[i] × rankDeltaPoints[i])。rank_rates は正規化しない */
export function expectedPointPerGame(
  rankRates: readonly number[],
  rankAvgScores: readonly number[],
  mode: GameMode,
  level: Level,
  options?: DeltaOptions,
): number {
  const deltas = rankDeltaPoints(rankAvgScores, mode, level, options);
  assertRankCount(mode, rankRates.length);
  return rankRates.reduce((sum, rate, i) => sum + rate * deltas[i], 0);
}
