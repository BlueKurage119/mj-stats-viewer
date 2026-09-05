import { useEffect, useState } from 'react';
import type { GameMode, GlobalHistogram, NumPlayers } from '../api';
import { getGlobalHistogram } from '../api';
import { createStatsLookup, type MetricDistribution } from '../domain';
import { describeStatsError } from './filterErrors';

export type MetricLookup = (metric: string) => MetricDistribution | null;

export type DistributionState =
  | { kind: 'loading' }
  | { kind: 'ready'; histogram: GlobalHistogram; lookupFor: (mode: GameMode) => MetricLookup }
  | { kind: 'error'; message: string };

/**
 * 母集団分布（global_histogram）の取得フック。
 * `numPlayers` にのみ依存する（期間・モードのグローバルフィルタでは再取得しない。
 * `useCurrentIdentity` と同じ規律）。deps に `filter` を入れないこと。
 *
 * `getGlobalHistogram` は AbortSignal を受け取らないため、中断は `cancelled` フラグで
 * setState を抑止するだけにする（AbortController は使わない）。
 *
 * 詳細: docs/design/issue-10-playstyle.md §3.2・§4.1
 */
export function useGlobalHistogram(numPlayers: NumPlayers): DistributionState {
  const [state, setState] = useState<DistributionState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    // oxlint-disable-next-line react/set-state-in-effect
    setState({ kind: 'loading' });

    getGlobalHistogram(numPlayers)
      .then((histogram) => {
        if (cancelled) return;
        // mode ごとに createStatsLookup の結果をメモ化する（レンダごとの再集計を避ける）。
        const cache = new Map<GameMode, MetricLookup>();
        const lookupFor = (mode: GameMode): MetricLookup => {
          const cached = cache.get(mode);
          if (cached) return cached;
          const fn = createStatsLookup(histogram, mode);
          cache.set(mode, fn);
          return fn;
        };
        setState({ kind: 'ready', histogram, lookupFor });
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
