import { useOutletContext } from 'react-router-dom';
import type { GameMode, NumPlayers, PeriodPreset } from '../api';
import type { GlobalFilter } from './filterState';
import type { CurrentIdentityState } from './useCurrentIdentity';
import type { FilteredStatsState } from './useFilteredStats';
import type { DistributionState } from './useGlobalHistogram';

export interface PlayerScope {
  readonly numPlayers: NumPlayers;
  readonly playerId: number;
  readonly identity: CurrentIdentityState;
  readonly filter: GlobalFilter | null;
  readonly stats: FilteredStatsState;
  readonly distribution: DistributionState;
  readonly setModes: (next: readonly GameMode[]) => void;
  readonly setPeriod: (next: PeriodPreset) => void;
}

/**
 * 各タブ（Outlet の子ルート）はこれで scope を取る。useOutletContext<PlayerScope>() の薄いラッパー。
 * ルート定義上、タブは PlayerLayout の子ルートとしてしか描画されない（np/id 不正時は
 * PlayerLayout が <Navigate> を返し Outlet 自体が描画されない）ため、正常系で throw する
 * 経路は存在しない。宣言型どおり非 null を保証するためのランタイムガード（issue-8 §3.5）。
 */
export function usePlayerScope(): PlayerScope {
  const scope = useOutletContext<PlayerScope | undefined>();
  if (!scope) {
    throw new Error('usePlayerScope must be used within PlayerLayout の Outlet');
  }
  return scope;
}
