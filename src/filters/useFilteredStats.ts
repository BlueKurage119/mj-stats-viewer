import { useEffect, useRef, useState } from 'react';
import type { NumPlayers, PlayerExtendedStats, PlayerStats } from '../api';
import { getPlayerExtendedStats, getPlayerStats, resolveRange } from '../api';
import { createDebouncer, type Debouncer } from '../util/debounce';
import { describeStatsError } from './filterErrors';
import { serializeModes, type GlobalFilter } from './filterState';

export type FilteredStatsState =
  | { kind: 'loading' }
  | { kind: 'empty' } // player_stats が null（§2.8）
  | { kind: 'ready'; stats: PlayerStats; extended: PlayerExtendedStats | null }
  | { kind: 'error'; message: string };

export function useFilteredStats(
  numPlayers: NumPlayers,
  playerId: number,
  filter: GlobalFilter | null,
  delayMs = 250,
): FilteredStatsState {
  const [state, setState] = useState<FilteredStatsState>({ kind: 'loading' });
  const [debouncedFilter, setDebouncedFilter] = useState<GlobalFilter | null>(filter);

  const filterKey = filter
    ? `${numPlayers}|${playerId}|${serializeModes(filter.modes)}|${filter.period}`
    : null;

  const hasFiredRef = useRef<boolean>(false);
  const debouncerRef = useRef<Debouncer<GlobalFilter> | null>(null);

  useEffect(() => {
    debouncerRef.current = createDebouncer(delayMs, (value) => {
      setDebouncedFilter(value);
    });
    return () => {
      debouncerRef.current?.cancel();
    };
  }, [delayMs]);

  useEffect(() => {
    if (filterKey === null || filter === null) {
      debouncerRef.current?.cancel();
      // oxlint-disable-next-line react/set-state-in-effect
      setDebouncedFilter(null);
      return;
    }

    if (!hasFiredRef.current) {
      hasFiredRef.current = true;
      debouncerRef.current?.cancel();
      // oxlint-disable-next-line react/set-state-in-effect
      setDebouncedFilter(filter);
    } else {
      debouncerRef.current?.schedule(filter);
    }
  }, [filterKey, filter]);

  useEffect(() => {
    if (debouncedFilter === null) {
      // oxlint-disable-next-line react/set-state-in-effect
      setState({ kind: 'loading' });
      return;
    }

    let cancelled = false;
    // oxlint-disable-next-line react/set-state-in-effect
    setState({ kind: 'loading' });

    const fetchStats = async () => {
      try {
        const range = await resolveRange(
          { kind: 'preset', preset: debouncedFilter.period },
          numPlayers,
          playerId,
        );
        if (cancelled) return;

        const [stats, extended] = await Promise.all([
          getPlayerStats(numPlayers, playerId, range.start, range.end, debouncedFilter.modes),
          getPlayerExtendedStats(numPlayers, playerId, range.start, range.end, debouncedFilter.modes),
        ]);
        if (cancelled) return;

        if (stats === null) {
          setState({ kind: 'empty' });
        } else {
          setState({ kind: 'ready', stats, extended });
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setState({ kind: 'error', message: describeStatsError(err) });
        }
      }
    };

    void fetchStats();

    return () => {
      cancelled = true;
    };
  }, [debouncedFilter, numPlayers, playerId]);

  return state;
}
