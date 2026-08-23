import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { GameMode, NumPlayers, PeriodPreset } from '../api';
import {
  DEFAULT_PERIOD,
  MODE_QUERY_KEY,
  PERIOD_QUERY_KEY,
  defaultModes,
  parseModes,
  parsePeriod,
  serializeModes,
  type GlobalFilter,
} from './filterState';
import type { CurrentIdentityState } from './useCurrentIdentity';

export interface UseGlobalFilter {
  /** null = 既定値の解決待ち（URL に mode 指定が無く identity がまだ loading） */
  filter: GlobalFilter | null;
  setModes(next: readonly GameMode[]): void;
  setPeriod(next: PeriodPreset): void;
}

export function useGlobalFilter(
  numPlayers: NumPlayers,
  identity: CurrentIdentityState,
): UseGlobalFilter {
  const [searchParams, setSearchParams] = useSearchParams();

  const filter: GlobalFilter | null = useMemo(() => {
    const period = parsePeriod(searchParams.get(PERIOD_QUERY_KEY)) ?? DEFAULT_PERIOD;
    const urlModes = parseModes(searchParams.get(MODE_QUERY_KEY), numPlayers);

    if (urlModes !== null) {
      return { modes: urlModes, period };
    }
    if (identity.kind === 'loading') {
      return null;
    }
    if (identity.kind === 'ready') {
      const modes = defaultModes(
        numPlayers,
        identity.identity.level.id,
        identity.identity.playedModes,
      );
      return { modes, period };
    }
    const modes = defaultModes(numPlayers, null, []);
    return { modes, period };
  }, [searchParams, numPlayers, identity]);

  useEffect(() => {
    if (filter === null) {
      return;
    }
    const targetMode = serializeModes(filter.modes);
    const targetPeriod = filter.period;
    const currentMode = searchParams.get(MODE_QUERY_KEY);
    const currentPeriod = searchParams.get(PERIOD_QUERY_KEY);

    if (currentMode !== targetMode || currentPeriod !== targetPeriod) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set(MODE_QUERY_KEY, targetMode);
          next.set(PERIOD_QUERY_KEY, targetPeriod);
          return next;
        },
        { replace: true },
      );
    }
  }, [filter, searchParams, setSearchParams]);

  const setModes = useCallback(
    (next: readonly GameMode[]) => {
      setSearchParams(
        (prev) => {
          const nextParams = new URLSearchParams(prev);
          nextParams.set(MODE_QUERY_KEY, serializeModes(next));
          return nextParams;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setPeriod = useCallback(
    (next: PeriodPreset) => {
      setSearchParams(
        (prev) => {
          const nextParams = new URLSearchParams(prev);
          nextParams.set(PERIOD_QUERY_KEY, next);
          return nextParams;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return {
    filter,
    setModes,
    setPeriod,
  };
}
