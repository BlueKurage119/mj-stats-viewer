/**
 * 段位分布カードのビューモデル・段位ID正規化・ラベル純関数群。
 *
 * 設計書: docs/design/issue-13-comparison-tab.md §5・§8.6
 */

import type { LevelStatistics, NumPlayers } from '../api';
import { levelDistributionPosition } from '../domain/derived';
import { getLevelTag, isKonten, parseLevelId } from '../domain/level';
import { toTopPercent, type TopPercent } from './histogramView';

export interface LevelDistributionBar {
  readonly bucketId: number;
  readonly label: string; // '雀傑2' / '魂天'
  readonly count: number;
  readonly ratio: number; // count / total（0..1）
  readonly isSelf: boolean;
}

export interface LevelDistributionView {
  readonly bars: readonly LevelDistributionBar[]; // levelId 昇順
  readonly total: number;
  readonly selfBucketId: number | null;
  readonly topPercent: TopPercent | null; // 1 - levelDistributionPosition()
  readonly note: string;
}

/**
 * level_statistics のバケット levelId へ正規化する。
 * 魂天（majorRank >= 6）は numPlayerId * 10000 + 799 に畳み込む。
 */
export function levelStatBucketId(levelId: number): number {
  const level = parseLevelId(levelId);
  if (isKonten(level)) {
    return level.numPlayerId * 10000 + 799;
  }
  return levelId;
}

/**
 * バケット levelId の表示ラベル。
 * 799 は '魂天'（getLevelTagFromId だと '魂天99' になってしまう問題への対処）。
 */
export function levelBucketLabel(bucketId: number): string {
  const level = parseLevelId(bucketId);
  if (level.minorRank === 99 || isKonten(level)) {
    return '魂天';
  }
  return getLevelTag(level);
}

export const LEVEL_DISTRIBUTION_NOTE =
  '同じ段位帯の人は上位に数えません（level_statistics 全ゾーン合算）';

/**
 * level_statistics から段位分布のビューモデルを構築する。
 */
export function buildLevelDistributionView(args: {
  stats: LevelStatistics;
  numPlayers: NumPlayers;
  selfLevelId: number | null;
}): LevelDistributionView {
  const { stats, numPlayers, selfLevelId } = args;
  const targetNumPlayerId = numPlayers === 4 ? 1 : 2;

  const countByBucket = new Map<number, number>();
  let total = 0;

  for (const [, id, count] of stats) {
    if (Math.floor(id / 10000) === targetNumPlayerId) {
      const current = countByBucket.get(id) ?? 0;
      countByBucket.set(id, current + count);
      total += count;
    }
  }

  const sortedBuckets = Array.from(countByBucket.entries()).sort((a, b) => a[0] - b[0]);

  const selfBucketId = selfLevelId !== null ? levelStatBucketId(selfLevelId) : null;

  const bars: LevelDistributionBar[] = sortedBuckets.map(([bucketId, count]) => ({
    bucketId,
    label: levelBucketLabel(bucketId),
    count,
    ratio: total > 0 ? count / total : 0,
    isSelf: selfBucketId !== null && bucketId === selfBucketId,
  }));

  let topPercent: TopPercent | null = null;
  if (selfLevelId !== null && total > 0) {
    const bucketForPosition = levelStatBucketId(selfLevelId);
    const pos = levelDistributionPosition(stats, bucketForPosition);
    if (pos !== null) {
      topPercent = toTopPercent(pos, 'higher');
    }
  }

  return {
    bars,
    total,
    selfBucketId,
    topPercent,
    note: LEVEL_DISTRIBUTION_NOTE,
  };
}
