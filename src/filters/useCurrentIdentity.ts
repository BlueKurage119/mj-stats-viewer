import { useEffect, useState } from 'react';
import type { CurrentLevelInfo, NumPlayers } from '../api';
import { getCurrentLevel } from '../api';
import { describeStatsError } from './filterErrors';

export type CurrentIdentityState =
  | { kind: 'loading' }
  | { kind: 'ready'; identity: CurrentLevelInfo }
  | { kind: 'notFound' } // getCurrentLevel が null
  | { kind: 'error'; message: string };

/**
 * カード1除外規則: グローバルフィルタと無関係に「全モード・全期間・終端=現在」で取得する。
 * useEffect の deps は [numPlayers, playerId] のみ。filter を絶対に deps に入れないこと。
 */
export function useCurrentIdentity(numPlayers: NumPlayers, playerId: number): CurrentIdentityState {
  const [state, setState] = useState<CurrentIdentityState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    // oxlint-disable-next-line react/set-state-in-effect
    setState({ kind: 'loading' });

    getCurrentLevel(numPlayers, playerId, controller.signal)
      .then((res) => {
        if (!cancelled) {
          if (res === null) {
            setState({ kind: 'notFound' });
          } else {
            setState({ kind: 'ready', identity: res });
          }
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({ kind: 'error', message: describeStatsError(err) });
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [numPlayers, playerId]);

  return state;
}
