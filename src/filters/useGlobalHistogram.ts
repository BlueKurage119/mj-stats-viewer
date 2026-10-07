import { useCallback, useMemo } from 'react';
import type { GameMode, GlobalHistogram, NumPlayers } from '../api';
import { allModes, getGlobalHistogram } from '../api';
import { createStatsLookup, type MetricDistribution } from '../domain';
import { useRetryResource } from '../feedback/useRetryResource';
import type { RequestIssue, RetryResource } from '../feedback/requestIssue';
export type MetricLookup = (metric: string) => MetricDistribution | null;
export type DistributionState =
  | { kind: 'loading' }
  | { kind: 'ready'; histogram: GlobalHistogram; lookupFor: (mode: GameMode) => MetricLookup }
  | { kind: 'error'; message: string; issue: RequestIssue };
export function useGlobalHistogram(numPlayers: NumPlayers): RetryResource<DistributionState> {
  const load = useCallback(() => getGlobalHistogram(numPlayers), [numPlayers]);
  const resource = useRetryResource(String(numPlayers), load);
  const histogram = resource.state.kind === 'ready' ? resource.state.data : null;
  const lookupFor = useMemo(() => {
    const cache = new Map(allModes(numPlayers).map(mode => [mode, histogram ? createStatsLookup(histogram, mode) : () => null] as const));
    return (mode: GameMode): MetricLookup => cache.get(mode) ?? (() => null);
  }, [histogram, numPlayers]);
  const state: DistributionState = histogram ? { kind: 'ready', histogram, lookupFor }
    : resource.state.kind === 'error' ? resource.state : { kind: 'loading' };
  return { ...resource, state };
}
