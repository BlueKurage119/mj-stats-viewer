/**
 * 局収支・連対率・ラス率・平均持ち点・内訳%・段位分布内の位置。
 * 詳細: docs/design/issue-4-domain-logic.md §6
 */

import type { GameMode } from '../api';
import type { LevelStatistics, PlayerExtendedStats } from '../api';
import { baseOriginForMode } from './levelConstants';

export function averageScore(rankRates: readonly number[], rankAvgScores: readonly number[]): number {
  return rankRates.reduce((sum, rate, i) => sum + rate * rankAvgScores[i], 0);
}

/** 局収支 = (Σ rankRates[i]×rankAvgScores[i] − 配給原点) × 試合数 ÷ 局数 */
export function roundBalance(input: {
  rankRates: readonly number[];
  rankAvgScores: readonly number[];
  mode: GameMode;
  gameCount: number;
  roundCount: number;
}): number | null {
  if (input.roundCount === 0) return null;
  const avg = averageScore(input.rankRates, input.rankAvgScores);
  const base = baseOriginForMode(input.mode);
  return ((avg - base) * input.gameCount) / input.roundCount;
}

export function rentaiRate(rankRates: readonly number[]): number {
  return rankRates[0] + rankRates[1];
}

export function lastPlaceRate(rankRates: readonly number[]): number {
  return rankRates[rankRates.length - 1];
}

type Breakdown = { 立直: number; 副露: number; 默听: number };

function breakdown(riichi: number, furo: number, moten: number): Breakdown | null {
  const total = riichi + furo + moten;
  if (total === 0) return null;
  return { 立直: riichi / total, 副露: furo / total, 默听: moten / total };
}

/** 和了の相手内訳（ドーナツ用）。合計 0 のときは null */
export function winBreakdown(s: Pick<PlayerExtendedStats, '立直和了' | '副露和了' | '默听和了'>): Breakdown | null {
  return breakdown(s.立直和了, s.副露和了, s.默听和了);
}

/** 放銃の相手内訳（ドーナツ用）。合計 0 のときは null */
export function dealInBreakdown(
  s: Pick<PlayerExtendedStats, '放铳至立直' | '放铳至副露' | '放铳至默听'>,
): Breakdown | null {
  return breakdown(s.放铳至立直, s.放铳至副露, s.放铳至默听);
}

/** level_statistics を全 zone 合算し、自分の levelId 以下の累積割合（0..1）を返す */
export function levelDistributionPosition(stats: LevelStatistics, levelId: number): number | null {
  const numPlayerId = Math.floor(levelId / 10000);
  const filtered = stats.filter(([, id]) => Math.floor(id / 10000) === numPlayerId);
  const total = filtered.reduce((sum, [, , n]) => sum + n, 0);
  if (total === 0) return null;
  const cumulative = filtered.filter(([, id]) => id <= levelId).reduce((sum, [, , n]) => sum + n, 0);
  return cumulative / total;
}
