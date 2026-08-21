/**
 * API層の公開面。アプリコードは必ずここから import する（docs/design/issue-3-api-layer.md §2）。
 * Raw* 型と client 内部関数はここに載せない。
 */

export type { GameMode, NumPlayers } from './gameMode';
export { ALL_MODES_4, ALL_MODES_3, allModes, joinModes } from './gameMode';

export { ApiError, MaintenanceError, RangeNotSupportedError } from './errors';

export type {
  LevelWithDelta,
  PlayerSearchResult,
  PlayerStats,
  FanStatEntry,
  PlayerExtendedStats,
  GlobalStatisticsEntry,
  GlobalStatistics,
  HistogramData,
  HistogramGroup,
  GlobalHistogramLevelBand,
  GlobalHistogram,
  LevelStatisticsItem,
  LevelStatistics,
} from './types';

export {
  searchPlayer,
  getPlayerStats,
  getPlayerExtendedStats,
  getGlobalHistogram,
  getGlobalStatistics,
  getLevelStatistics,
  getCurrentLevel,
} from './endpoints';
export type { CurrentLevelInfo } from './endpoints';

export type { PeriodPreset, RangeSpec, ResolvedRange, RangeResolver } from './range';
export { DATA_MIN_DATE, defaultRangeResolver, resolveRange, setRangeResolver } from './range';
