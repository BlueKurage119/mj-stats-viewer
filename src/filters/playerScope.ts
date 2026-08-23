import { useOutletContext } from 'react-router-dom';
import type { GameMode, NumPlayers, PeriodPreset } from '../api';
import type { GlobalFilter } from './filterState';
import type { CurrentIdentityState } from './useCurrentIdentity';
import type { FilteredStatsState } from './useFilteredStats';

export interface PlayerScope {
  readonly numPlayers: NumPlayers;
  readonly playerId: number;
  readonly identity: CurrentIdentityState;
  readonly filter: GlobalFilter | null;
  readonly stats: FilteredStatsState;
  readonly setModes: (next: readonly GameMode[]) => void;
  readonly setPeriod: (next: PeriodPreset) => void;
}

/** 各タブ（Outlet の子ルート）はこれで scope を取る。useOutletContext<PlayerScope>() の薄いラッパー */
export function usePlayerScope(): PlayerScope {
  return useOutletContext<PlayerScope>();
}
