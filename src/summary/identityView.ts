/**
 * カード1（アイデンティティ）の表示用ビューモデルを組み立てる純関数群。
 * React・DOM に依存しない。カード1の禁止事項（issue-8 §2）に従い、
 * フィルタ適用後の統計値やグローバルフィルタの型は一切扱わないこと
 * （`useCurrentIdentity` が返す `CurrentLevelInfo` だけを唯一のデータ源とする）。
 *
 * 詳細: docs/design/issue-8-identity-card.md §4.2・§3.3
 */

import type { CurrentLevelInfo, GameMode, LevelWithDelta } from '../api';
import type { LevelPoint, RankCondition } from '../domain';
import {
  applyPointDelta,
  currentPoint,
  demotionConditions,
  getLevelMajorTag,
  getLevelTag,
  getMaxPoint,
  getNextLevel,
  getScoreDisplay,
  isKonten,
  parseLevelId,
  preferredMode,
  promotionConditions,
  tableTotalScore,
} from '../domain';

export type RankBadge =
  | { readonly kind: 'stars'; readonly major: string; readonly stars: number } // 通常段位
  | { readonly kind: 'plain'; readonly text: string }; // 魂天

export interface ConditionLine {
  readonly key: string; // React key（'p0' / 'd2' 等）
  readonly rankLabel: string; // '1位' | '2位以内' | '3位以下'
  readonly threshold: number | null; // 素点。null = 順位だけで成立
}

export interface IdentityView {
  readonly nickname: string;
  readonly badge: RankBadge;
  readonly levelText: string; // getLevelTag(effLevel)。aria-label 用（'雀傑2'）
  readonly pointText: string; // '232' / 魂天 '19.6'
  readonly maxPointText: string | null; // '1400' / 魂天20 は null
  readonly progress: number | null; // 0..1。上限0のとき null
  readonly remainingText: string | null; // '1168' / 魂天20 は null
  readonly nextLevelText: string | null; // '雀傑3' / 魂天20 は null
  readonly conditionMode: GameMode | null;
  readonly promotions: readonly ConditionLine[];
  readonly demotions: readonly ConditionLine[];
  readonly gameCount: number;
}

/**
 * 現在pt（score+delta）が上限超え／負のとき、本家規則で1段動かした後の (levelId, point)。
 * 実体は applyPointDelta(lp, 0)。戻り値の levelId は majorRank 6 を含まない（issue-8 §1.4）。
 */
export function effectiveLevelPoint(lv: LevelWithDelta): LevelPoint {
  return applyPointDelta({ levelId: lv.id, point: currentPoint(lv) }, 0);
}

type RowStatus =
  | { readonly kind: 'hidden' }
  | { readonly kind: 'unconditional' }
  | { readonly kind: 'threshold'; readonly score: number };

/** 到達可能性による足切り（issue-8 §3.3(b)）。reachable(rank) = 卓総素点 / (rank+1) */
function resolveRow(condition: RankCondition, total: number): RowStatus {
  const reachable = total / (condition.rank + 1);
  switch (condition.kind) {
    case 'never':
      return { kind: 'hidden' };
    case 'always':
      return { kind: 'unconditional' };
    case 'atLeast':
      return condition.score > reachable ? { kind: 'hidden' } : { kind: 'threshold', score: condition.score };
    case 'atMost':
      return condition.score >= reachable ? { kind: 'unconditional' } : { kind: 'threshold', score: condition.score };
  }
}

/** RankCondition[] → 表示行。到達不能な閾値を落とし、連続する無条件行を畳む（issue-8 §3.3） */
export function toConditionLines(
  conditions: readonly RankCondition[],
  mode: GameMode,
  direction: 'promotion' | 'demotion',
): ConditionLine[] {
  const total = tableTotalScore(mode);
  const n = conditions.length;
  const statuses = conditions.map((c) => resolveRow(c, total));

  // 実際に連続している範囲だけを畳む（単調性を前提にしない。issue-8 §3.3(c)）。
  let foldStart = -1;
  let foldEnd = -1;
  if (direction === 'promotion') {
    let end = -1;
    for (let rank = 0; rank < n; rank++) {
      if (statuses[rank].kind === 'unconditional') end = rank;
      else break;
    }
    if (end >= 1) {
      foldStart = 0;
      foldEnd = end;
    }
  } else {
    let start = n;
    for (let rank = n - 1; rank >= 0; rank--) {
      if (statuses[rank].kind === 'unconditional') start = rank;
      else break;
    }
    if (start <= n - 2) {
      foldStart = start;
      foldEnd = n - 1;
    }
  }

  const prefix = direction === 'promotion' ? 'p' : 'd';
  const lines: ConditionLine[] = [];

  for (let rank = 0; rank < n; rank++) {
    if (foldStart >= 0 && rank === foldStart) {
      const label = direction === 'promotion' ? `${foldEnd + 1}位以内` : `${foldStart + 1}位以下`;
      lines.push({ key: `${prefix}${foldStart}`, rankLabel: label, threshold: null });
      rank = foldEnd;
      continue;
    }
    const status = statuses[rank];
    if (status.kind === 'hidden') continue;
    if (status.kind === 'unconditional') {
      lines.push({ key: `${prefix}${rank}`, rankLabel: `${rank + 1}位`, threshold: null });
    } else {
      lines.push({ key: `${prefix}${rank}`, rankLabel: `${rank + 1}位`, threshold: status.score });
    }
  }

  return lines;
}

export function buildIdentityView(info: CurrentLevelInfo): IdentityView {
  const eff = effectiveLevelPoint(info.level);
  const effLevel = parseLevelId(eff.levelId);

  const badge: RankBadge = isKonten(effLevel)
    ? { kind: 'plain', text: getLevelTag(effLevel) }
    : { kind: 'stars', major: getLevelMajorTag(effLevel), stars: effLevel.minorRank };

  const maxPoint = getMaxPoint(effLevel);
  const pointText = getScoreDisplay(effLevel, eff.point);

  let maxPointText: string | null = null;
  let progress: number | null = null;
  let remainingText: string | null = null;
  let nextLevelText: string | null = null;

  if (maxPoint > 0) {
    maxPointText = getScoreDisplay(effLevel, maxPoint);
    progress = eff.point / maxPoint;
    remainingText = getScoreDisplay(effLevel, maxPoint - eff.point);
    nextLevelText = getLevelTag(getNextLevel(effLevel));
  }

  const conditionMode = preferredMode(eff.levelId);
  let promotions: ConditionLine[] = [];
  let demotions: ConditionLine[] = [];

  if (conditionMode !== null) {
    const effLv: LevelWithDelta = { id: eff.levelId, score: eff.point, delta: 0 };
    promotions = toConditionLines(promotionConditions(effLv, conditionMode), conditionMode, 'promotion');
    demotions = toConditionLines(demotionConditions(effLv, conditionMode), conditionMode, 'demotion');
  }

  return {
    nickname: info.nickname,
    badge,
    levelText: getLevelTag(effLevel),
    pointText,
    maxPointText,
    progress,
    remainingText,
    nextLevelText,
    conditionMode,
    promotions,
    demotions,
    gameCount: info.gameCount,
  };
}
