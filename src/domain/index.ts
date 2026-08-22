/**
 * ドメイン層の公開面。アプリコードは必ずここから import する。
 * 内部ヘルパー（levelConstants.ts の定数・境界探索ヘルパー等）は公開しない。
 */

export type { Level, NumPlayerId } from './level';
export {
  currentPoint,
  formatAdjustedScore,
  formatLevelWithDelta,
  getAdjustedLevel,
  getLevelTag,
  getLevelTagFromId,
  getMaxPoint,
  getNextLevel,
  getPenaltyPoint,
  getPreviousLevel,
  getScoreDisplay,
  getStartingPoint,
  getVersionAdjustedLevel,
  getVersionAdjustedScore,
  isAllowedMode,
  isKonten,
  isSameLevel,
  parseLevelId,
  toLevelId,
} from './level';

export type { DeltaOptions } from './points';
export { calculateDeltaPoint, expectedPointPerGame, rankDeltaPoints } from './points';

export type { RankCondition } from './transitions';
export { demotionConditions, promotionConditions } from './transitions';

export type { LevelPoint } from './growth';
export { applyPointDelta, gamesToDemotion, gamesToPromotion, preferredMode, projectAfterGames } from './growth';

export type { StableLevel, StableLevelInput } from './stableLevel';
export { estimateStableLevel, estimateStableLevel2, splitStableLevelNumber } from './stableLevel';

export type { MetricDistribution } from './distribution';
export { createStatsLookup, deviationValue, getBandZeroHistogram, histogramStats, percentile } from './distribution';

export type { RadarAxes, RadarInput } from './radar';
export { calcRadar } from './radar';

export type { Tendency, TendencyAxis, TendencyInput } from './tendency';
export { calcTendency, toBand } from './tendency';

export {
  averageScore,
  dealInBreakdown,
  lastPlaceRate,
  levelDistributionPosition,
  rentaiRate,
  roundBalance,
  winBreakdown,
} from './derived';
