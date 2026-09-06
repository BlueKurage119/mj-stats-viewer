import { useEffect, useState } from 'react';
import type { LevelStatistics, NumPlayers } from '../api';
import { getLevelStatistics } from '../api';
import { describeStatsError } from './filterErrors';

export type LevelStatisticsState =
  | { kind: 'loading' }
  | { kind: 'ready'; stats: LevelStatistics }
  | { kind: 'error'; message: string };

/**
 * 段位分布（level_statistics）の取得フック。
 * `numPlayers` にのみ依存する（フィルタ非依存）。
 *
 * 設計書: docs/design/issue-13-comparison-tab.md §5.1
 */
export function useLevelStatistics(numPlayers: NumPlayers): LevelStatisticsState {
  const [state, setState] = useState<LevelStatisticsState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    // oxlint-disable-next-line react/set-state-in-effect
    setState({ kind: 'loading' });

    getLevelStatistics(numPlayers)
      .then((stats) => {
        if (cancelled) return;
        setState({ kind: 'ready', stats });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({ kind: 'error', message: describeStatsError(err) });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [numPlayers]);

  return state;
}
