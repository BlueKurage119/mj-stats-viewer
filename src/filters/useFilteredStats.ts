import { useCallback, useEffect, useMemo, useState } from 'react';
import type { NumPlayers, PlayerExtendedStats, PlayerStats, ResolvedRange } from '../api';
import { getPlayerExtendedStats, getPlayerStats, resolveRange } from '../api';
import { useRetryResource } from '../feedback/useRetryResource';
import type { RequestIssue, ResourceState } from '../feedback/requestIssue';
import { serializeModes, type GlobalFilter } from './filterState';

export type ExtendedStatsState = ResourceState<PlayerExtendedStats>;
export type FilteredStatsState =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'ready'; stats: PlayerStats; extended: PlayerExtendedStats | null; extendedState: ExtendedStatsState }
  | { kind: 'error'; message: string; issue: RequestIssue };
export type StatsRetryTarget = 'stats' | 'extended' | 'failed';
export interface FilteredStatsResource {
  readonly state: FilteredStatsState;
  readonly retry: (target?: StatsRetryTarget) => void;
  readonly retryingIssues: Readonly<Partial<Record<'stats' | 'extended', RequestIssue>>>;
}
const noStats = (data: PlayerStats | null) => data === null || data.gameCount === 0;
const noExtended = (data: PlayerExtendedStats | null) => data === null;

export function useFilteredStats(
  numPlayers: NumPlayers, playerId: number, filter: GlobalFilter | null, delayMs = 250,
): FilteredStatsResource {
  const key = filter ? `${numPlayers}|${playerId}|${serializeModes(filter.modes)}|${filter.period}` : null;
  const [settled, setSettled] = useState(key);
  useEffect(() => {
    if (key === null || settled === null) {
      // oxlint-disable-next-line react/set-state-in-effect
      setSettled(key);
      return;
    }
    if (key === settled) return;
    const timer = setTimeout(() => setSettled(key), delayMs);
    return () => clearTimeout(timer);
  }, [key, settled, delayMs]);
  // Invalidate old requests immediately; begin the new generation after debounce.
  const requestKey = key === settled ? key : null;
  const source = useMemo(() => {
    if (!requestKey) return null;
    const [np, id, modes, period] = requestKey.split('|');
    let range: Promise<ResolvedRange> | null = null;
    const getRange = () => {
      if (!range) {
        range = resolveRange({ kind: 'preset', preset: period as GlobalFilter['period'] }, Number(np) as NumPlayers, Number(id));
        void range.catch(() => { range = null; });
      }
      return range;
    };
    return { np: Number(np) as NumPlayers, id: Number(id), modes: modes.split('.').map(Number) as GlobalFilter['modes'], getRange };
  }, [requestKey]);
  const loadStats = useCallback(async () => {
    if (!source) return null;
    const range = await source.getRange();
    return getPlayerStats(source.np, source.id, range.start, range.end, source.modes);
  }, [source]);
  const loadExtended = useCallback(async () => {
    if (!source) return null;
    const range = await source.getRange();
    return getPlayerExtendedStats(source.np, source.id, range.start, range.end, source.modes);
  }, [source]);
  const basic = useRetryResource(requestKey, loadStats, noStats);
  const detailed = useRetryResource(requestKey, loadExtended, noExtended);
  const retryBasic = basic.retry;
  const retryDetailed = detailed.retry;
  const retry = useCallback((target: StatsRetryTarget = 'failed') => {
    if (!requestKey) return;
    if (target !== 'extended') retryBasic();
    if (target !== 'stats') retryDetailed();
  }, [requestKey, retryBasic, retryDetailed]);
  let state: FilteredStatsState;
  if (basic.state.kind === 'ready' && basic.state.data) {
    const extendedState = detailed.state as ExtendedStatsState;
    state = { kind: 'ready', stats: basic.state.data, extendedState,
      extended: extendedState.kind === 'ready' ? extendedState.data : null };
  } else if (basic.state.kind === 'error') state = basic.state;
  else if (basic.state.kind === 'empty') state = { kind: 'empty' };
  else state = { kind: 'loading' };
  return { state, retry, retryingIssues: {
    ...(basic.retryingIssue ? { stats: basic.retryingIssue } : {}),
    ...(detailed.retryingIssue ? { extended: detailed.retryingIssue } : {}),
  } };
}
