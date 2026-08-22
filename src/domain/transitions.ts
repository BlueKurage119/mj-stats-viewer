/**
 * 昇格・降格条件（素点境界の探索）。
 *
 * 旧 CLI 実装は移植しない（モードボーナス欠落・ラスペナ欠落の2バグ）。
 * calculateDeltaPoint は素点について単調非減少なので、境界は100点刻みグリッド上の
 * 二分探索で厳密に求める（逆算式は使わない）。
 * 詳細: docs/design/issue-4-domain-logic.md §4.2
 */

import type { GameMode } from '../api';
import type { LevelWithDelta } from '../api';
import { calculateDeltaPoint } from './points';
import { currentPoint, getMaxPoint, parseLevelId, isKonten } from './level';
import { KONTEN_DELTA, numPlayersForMode } from './levelConstants';

export type RankCondition =
  | { rank: number; kind: 'always' }
  | { rank: number; kind: 'never' }
  | { rank: number; kind: 'atLeast'; score: number }
  | { rank: number; kind: 'atMost'; score: number };

const SCORE_STEP = 100;

function totalFor(mode: GameMode): number {
  return numPlayersForMode(mode) === 4 ? 100000 : 105000;
}

/** predicate は score について非減少（false...false, true...true）であることを仮定する */
function findLowerBoundary(total: number, predicate: (score: number) => boolean): number | 'always' | 'never' {
  if (predicate(0)) return 'always';
  if (!predicate(total)) return 'never';
  let lo = 0;
  let hi = total / SCORE_STEP;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (predicate(mid * SCORE_STEP)) hi = mid;
    else lo = mid;
  }
  return hi * SCORE_STEP;
}

/** predicate は score について非増加（true...true, false...false）であることを仮定する */
function findUpperBoundary(total: number, predicate: (score: number) => boolean): number | 'always' | 'never' {
  if (!predicate(0)) return 'never';
  if (predicate(total)) return 'always';
  let lo = 0;
  let hi = total / SCORE_STEP;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (predicate(mid * SCORE_STEP)) lo = mid;
    else hi = mid;
  }
  return lo * SCORE_STEP;
}

function allNever(n: number): RankCondition[] {
  return Array.from({ length: n }, (_, rank) => ({ rank, kind: 'never' as const }));
}

/** 「この1戦で昇段するか」= delta >= (上限pt − 現在pt) */
export function promotionConditions(lv: LevelWithDelta, mode: GameMode): RankCondition[] {
  const level = parseLevelId(lv.id);
  const n = numPlayersForMode(mode);
  const maxPoint = getMaxPoint(level);
  if (maxPoint === 0) return allNever(n); // 上限が無い＝これ以上昇段する先が無い

  const point = currentPoint(lv);
  const needed = maxPoint - point;
  const total = totalFor(mode);

  const results: RankCondition[] = [];
  for (let rank = 0; rank < n; rank++) {
    if (isKonten(level) && KONTEN_DELTA[mode]) {
      const delta = calculateDeltaPoint(0, rank, mode, level);
      results.push({ rank, kind: delta >= needed ? 'always' : 'never' });
      continue;
    }
    const predicate = (score: number) => calculateDeltaPoint(score, rank, mode, level) >= needed;
    const boundary = findLowerBoundary(total, predicate);
    if (boundary === 'always' || boundary === 'never') {
      results.push({ rank, kind: boundary });
    } else {
      results.push({ rank, kind: 'atLeast', score: boundary });
    }
  }
  return results;
}

/** 「この1戦で降段するか」= 現在pt + delta < 0 */
export function demotionConditions(lv: LevelWithDelta, mode: GameMode): RankCondition[] {
  const level = parseLevelId(lv.id);
  const n = numPlayersForMode(mode);
  const maxPoint = getMaxPoint(level);
  const cannotDemote = maxPoint === 0 || level.majorRank === 1 || (level.majorRank === 2 && level.minorRank === 1);
  if (cannotDemote) return allNever(n);

  const point = currentPoint(lv);
  const total = totalFor(mode);

  const results: RankCondition[] = [];
  for (let rank = 0; rank < n; rank++) {
    if (isKonten(level) && KONTEN_DELTA[mode]) {
      const delta = calculateDeltaPoint(0, rank, mode, level);
      results.push({ rank, kind: point + delta < 0 ? 'always' : 'never' });
      continue;
    }
    const predicate = (score: number) => point + calculateDeltaPoint(score, rank, mode, level) < 0;
    const boundary = findUpperBoundary(total, predicate);
    if (boundary === 'always' || boundary === 'never') {
      results.push({ rank, kind: boundary });
    } else {
      results.push({ rank, kind: 'atMost', score: boundary });
    }
  }
  return results;
}
