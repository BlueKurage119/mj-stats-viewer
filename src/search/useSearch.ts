import { useCallback, useEffect, useState } from 'react';
import type { NumPlayers } from '../api';
import { searchPlayer } from '../api';
import { useRetryResource } from '../feedback/useRetryResource';
import type { RequestIssue } from '../feedback/requestIssue';
import { normalizeQuery, type SearchState } from './searchState';
export interface UseSearch {
  query: string;
  setQuery: (next: string) => void;
  state: SearchState;
  retry: () => void;
  retryingIssue: RequestIssue | null;
}
export function useSearch(numPlayers: NumPlayers, delayMs = 300): UseSearch {
  const [query, setQuery] = useState('');
  const normalized = normalizeQuery(query);
  const latest = normalized ? `${numPlayers}|${normalized}` : null;
  const [settled, setSettled] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(latest), delayMs);
    return () => clearTimeout(timer);
  }, [latest, delayMs]);
  const key = latest === settled ? latest : null;
  const load = useCallback(() => searchPlayer(numPlayers, normalized), [numPlayers, normalized]);
  const resource = useRetryResource(key, load);
  const state: SearchState = latest === null ? {kind: 'idle'} : resource.state.kind === 'ready'
    ? {kind: 'results', items: resource.state.data}
    : resource.state.kind === 'error' ? resource.state : {kind: 'loading'};
  return {query, setQuery, state, retry: resource.retry, retryingIssue: resource.retryingIssue};
}
