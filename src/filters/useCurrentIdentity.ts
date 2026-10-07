import { useCallback } from 'react';
import type { CurrentLevelInfo, NumPlayers } from '../api';
import { getCurrentLevel } from '../api';
import { useRetryResource } from '../feedback/useRetryResource';
import type { RequestIssue, RetryResource } from '../feedback/requestIssue';
export type CurrentIdentityState =
  | { kind: 'loading' }
  | { kind: 'ready'; identity: CurrentLevelInfo }
  | { kind: 'notFound' }
  | { kind: 'error'; message: string; issue: RequestIssue };
const notFound = (data: CurrentLevelInfo | null) => data === null;
export function useCurrentIdentity(numPlayers: NumPlayers, playerId: number): RetryResource<CurrentIdentityState> {
  const load = useCallback(() => getCurrentLevel(numPlayers, playerId), [numPlayers, playerId]);
  const resource = useRetryResource(`${numPlayers}|${playerId}`, load, notFound);
  const state: CurrentIdentityState = resource.state.kind === 'ready'
    ? { kind: 'ready', identity: resource.state.data! }
    : resource.state.kind === 'empty' ? { kind: 'notFound' } : resource.state;
  return { ...resource, state };
}
