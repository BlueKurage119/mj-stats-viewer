import { useCallback } from 'react';
import type { LevelStatistics, NumPlayers } from '../api';
import { getLevelStatistics } from '../api';
import { useRetryResource } from '../feedback/useRetryResource';
import type { RequestIssue, RetryResource } from '../feedback/requestIssue';
export type LevelStatisticsState =
  | { kind: 'loading' }
  | { kind: 'ready'; stats: LevelStatistics }
  | { kind: 'error'; message: string; issue: RequestIssue };
export function useLevelStatistics(numPlayers: NumPlayers): RetryResource<LevelStatisticsState> {
  const load = useCallback(() => getLevelStatistics(numPlayers), [numPlayers]);
  const resource = useRetryResource(String(numPlayers), load);
  const state: LevelStatisticsState = resource.state.kind === 'ready'
    ? { kind: 'ready', stats: resource.state.data }
    : resource.state.kind === 'empty' ? { kind: 'loading' } : resource.state;
  return { ...resource, state };
}
