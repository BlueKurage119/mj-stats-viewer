/**
 * 代表モードの決定フックおよび純粋ロジック。
 *
 * 設計書: docs/design/issue-13-comparison-tab.md §6.3
 */

import { useEffect, useState } from 'react';
import type { GameMode, NumPlayers } from '../api';
import { getPlayerStats, resolveRange } from '../api';
import { describeStatsError } from '../filters/filterErrors';
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
  | { kind: 'error'; message: string };

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

export function useRepresentativeMode(args: {
  numPlayers: NumPlayers;
  playerId: number;
  filter: GlobalFilter | null;
  playedModes: readonly GameMode[] | null;
  override: GameMode | null;
}): RepresentativeModeState {
  const { numPlayers, playerId, filter, playedModes, override } = args;

  const [state, setState] = useState<RepresentativeModeState>({ kind: 'loading' });

  useEffect(() => {
    if (!filter || !playedModes) {
      // oxlint-disable-next-line react/set-state-in-effect
      setState({ kind: 'loading' });
      return;
    }

    const candidates = resolveCandidates(filter.modes, playedModes, numPlayers);
    if (candidates.length === 0) {
      // oxlint-disable-next-line react/set-state-in-effect
      setState({ kind: 'empty' });
      return;
    }

    // 候補が1つの場合は追加APIリクエスト0本で即座に決定（A4-2）
    if (candidates.length === 1) {
      const determined = determineRepresentativeMode(numPlayers, candidates, {}, override);
      if (determined) {
        // oxlint-disable-next-line react/set-state-in-effect
        setState({
          kind: 'ready',
          mode: determined.mode,
          candidates,
          gameCountByMode: {},
          auto: determined.auto,
        });
      }
      return;
    }

    // 候補が2つ以上の場合は各モードの player_stats を並列発行（R-3）
    let cancelled = false;
    const controller = new AbortController();
    // oxlint-disable-next-line react/set-state-in-effect
    setState({ kind: 'loading' });

    async function fetchCounts() {
      try {
        const range = await resolveRange(
          { kind: 'preset', preset: filter!.period },
          numPlayers,
          playerId,
        );
        if (cancelled) return;

        const results = await Promise.all(
          candidates.map((mode) =>
            getPlayerStats(
              numPlayers,
              playerId,
              range.start,
              range.end,
              [mode],
              controller.signal,
            ),
          ),
        );
        if (cancelled) return;

        const gameCountByMode: Partial<Record<GameMode, number>> = {};
        for (let i = 0; i < candidates.length; i++) {
          const stats = results[i];
          if (stats) {
            gameCountByMode[candidates[i]] = stats.gameCount;
          }
        }

        const determined = determineRepresentativeMode(
          numPlayers,
          candidates,
          gameCountByMode,
          override,
        );
        if (!determined) {
          setState({ kind: 'empty' });
          return;
        }

        setState({
          kind: 'ready',
          mode: determined.mode,
          candidates,
          gameCountByMode,
          auto: determined.auto,
        });
      } catch (err: unknown) {
        if (!cancelled) {
          setState({ kind: 'error', message: describeStatsError(err) });
        }
      }
    }

    void fetchCounts();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [numPlayers, playerId, filter, playedModes, override]);

  return state;
}
