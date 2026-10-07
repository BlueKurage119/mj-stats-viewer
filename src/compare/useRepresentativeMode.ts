/**
 * 代表モードの決定フックおよび純粋ロジック。
 *
 * 設計書: docs/design/issue-13-comparison-tab.md §6.3
 */

import { useCallback, useMemo } from 'react';
import { useRetryResource } from '../feedback/useRetryResource';
import type { RequestIssue, RetryResource } from '../feedback/requestIssue';
import type { GameMode, NumPlayers } from '../api';
import { getPlayerStats, resolveRange } from '../api';

import {
  canonicalizeModes,
  selectRepresentativeMode,
  type GlobalFilter,
} from '../filters/filterState';

export type RepresentativeModeState =
  | { kind: 'loading' }
  | { kind: 'empty' } // 候補が0（この期間・選択モードでの対局が無い）
  | {
      kind: 'ready';
      mode: GameMode;
      candidates: readonly GameMode[];
      gameCountByMode: Readonly<Partial<Record<GameMode, number>>>;
      auto: boolean;
    }
  | { kind: 'error'; message: string; issue: RequestIssue };

/**
 * 選択モード ∩ playedModes から候補モードを抽出する。
 */
export function resolveCandidates(
  filterModes: readonly GameMode[] | null,
  playedModes: readonly GameMode[] | null,
  numPlayers: NumPlayers,
): readonly GameMode[] {
  if (!filterModes || !playedModes) return [];
  const playedSet = new Set(playedModes);
  const matched = filterModes.filter((m) => playedSet.has(m));
  return canonicalizeModes(matched, numPlayers);
}

/**
 * 候補と対局数、ユーザー指定 override から最終的な代表モードを決定する純関数。
 */
export function determineRepresentativeMode(
  numPlayers: NumPlayers,
  candidates: readonly GameMode[],
  gameCountByMode: Readonly<Partial<Record<GameMode, number>>>,
  override: GameMode | null,
): { mode: GameMode; auto: boolean } | null {
  if (candidates.length === 0) return null;

  if (override !== null && candidates.includes(override)) {
    return { mode: override, auto: false };
  }

  const mode = selectRepresentativeMode(numPlayers, candidates, gameCountByMode);
  return { mode, auto: true };
}

/**
 * フィルタの変更に伴ってユーザー指定の overrideMode をリセットすべきかを判定する純関数（A4-4）。
 * 期間（period）または選択モード（modes）が変わった場合に true を返す。
 */
export function shouldResetOverride(
  prevFilter: GlobalFilter | null,
  nextFilter: GlobalFilter | null,
): boolean {
  if (prevFilter === nextFilter) return false;
  if (!prevFilter || !nextFilter) return true;
  if (prevFilter.period !== nextFilter.period) return true;
  if (prevFilter.modes.length !== nextFilter.modes.length) return true;
  return prevFilter.modes.some((m, i) => m !== nextFilter.modes[i]);
}

export interface RepresentativeModeArgs {
  numPlayers: NumPlayers;
  playerId: number;
  filter: GlobalFilter | null;
  playedModes: readonly GameMode[] | null;
  override: GameMode | null;
}
type ReadyMode = Extract<RepresentativeModeState, {kind: 'ready'}>;
const noMode = (data: ReadyMode | null) => data === null;
export function useRepresentativeMode(args: RepresentativeModeArgs): RetryResource<RepresentativeModeState> {
  const { numPlayers, playerId, filter, playedModes, override } = args;
  const key = filter && playedModes ? `${numPlayers}|${playerId}|${filter.modes.join('.')}|${filter.period}|${playedModes.join('.')}|${override ?? ''}` : null;
  const source = useMemo(() => {
    if (!key) return null;
    const [np, id, modes, period, played, selected] = key.split('|');
    let range: ReturnType<typeof resolveRange> | null = null;
    return {
      np: Number(np) as NumPlayers, id: Number(id), period: period as GlobalFilter['period'],
      candidates: resolveCandidates(modes.split('.').map(Number) as GameMode[], played.split('.').map(Number) as GameMode[], Number(np) as NumPlayers),
      override: selected ? Number(selected) as GameMode : null,
      range: () => {
        if (!range) {
          range = resolveRange({kind: 'preset', preset: period as GlobalFilter['period']}, Number(np) as NumPlayers, Number(id));
          void range.catch(() => { range = null; });
        }
        return range;
      },
    };
  }, [key]);
  const load = useCallback(async (): Promise<ReadyMode | null> => {
    if (!source || source.candidates.length === 0) return null;
    const counts: Partial<Record<GameMode, number>> = {};
    if (source.candidates.length > 1) {
      const range = await source.range();
      const results = await Promise.all(source.candidates.map(mode => getPlayerStats(source.np, source.id, range.start, range.end, [mode])));
      results.forEach((stats, i) => { counts[source.candidates[i]] = stats?.gameCount ?? 0; });
      if (results.every(stats => !stats || stats.gameCount === 0)) return null;
    }
    const result = determineRepresentativeMode(source.np, source.candidates, counts, source.override);
    return result ? {kind: 'ready', ...result, candidates: source.candidates, gameCountByMode: counts} : null;
  }, [source]);
  const resource = useRetryResource(key, load, noMode);
  return { ...resource, state: resource.state.kind === 'ready' ? resource.state.data! : resource.state };
}
