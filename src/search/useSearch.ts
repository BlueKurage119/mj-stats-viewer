import { useCallback, useEffect, useRef, useState } from 'react';
import type { NumPlayers } from '../api';
import { searchPlayer } from '../api';
import { createDebouncer, type Debouncer } from './debounce';
import { describeError, normalizeQuery, type SearchState } from './searchState';

export interface UseSearch {
  /** 入力欄にそのまま渡す（制御コンポーネント） */
  query: string;
  setQuery: (next: string) => void;
  state: SearchState;
  /** 現在のクエリで即時再検索（デバウンスを挟まない） */
  retry: () => void;
}

export function useSearch(numPlayers: NumPlayers, delayMs = 300): UseSearch {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [state, setState] = useState<SearchState>({ kind: 'idle' });
  const [retryNonce, setRetryNonce] = useState(0);

  const debouncerRef = useRef<Debouncer<string> | null>(null);

  useEffect(() => {
    debouncerRef.current = createDebouncer(delayMs, (value) => {
      setDebouncedQuery(value);
    });
    return () => {
      debouncerRef.current?.cancel();
    };
  }, [delayMs]);

  const handleSetQuery = useCallback((next: string) => {
    setQuery(next);
    const normalized = normalizeQuery(next);
    if (normalized === '') {
      debouncerRef.current?.cancel();
      setDebouncedQuery('');
      setState({ kind: 'idle' });
    } else {
      debouncerRef.current?.schedule(normalized);
    }
  }, []);

  const retry = useCallback(() => {
    const normalized = normalizeQuery(query);
    if (normalized === '') {
      debouncerRef.current?.cancel();
      setDebouncedQuery('');
      setState({ kind: 'idle' });
    } else {
      debouncerRef.current?.cancel();
      setDebouncedQuery(normalized);
      setRetryNonce((n) => n + 1);
    }
  }, [query]);

  useEffect(() => {
    if (debouncedQuery === '') {
      // oxlint-disable-next-line react/set-state-in-effect
      setState({ kind: 'idle' });
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    // oxlint-disable-next-line react/set-state-in-effect
    setState({ kind: 'loading' });

    searchPlayer(numPlayers, debouncedQuery, undefined, controller.signal)
      .then((items) => {
        if (!cancelled) {
          setState({ kind: 'results', items });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({ kind: 'error', message: describeError(err) });
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [debouncedQuery, numPlayers, retryNonce]);

  return {
    query,
    setQuery: handleSetQuery,
    state,
    retry,
  };
}
