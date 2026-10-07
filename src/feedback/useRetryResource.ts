import { useCallback, useEffect, useRef, useState } from 'react';
import { toRequestIssue, type RequestIssue, type ResourceState, type RetryResource } from './requestIssue';

const loading = { kind: 'loading' } as const;
const neverEmpty = () => false;

/** Shared API promises belong to the cache. Unmount invalidates this consumer, not other consumers. */
export function useRetryResource<T>(
  key: string | null,
  load: () => Promise<T>,
  isEmpty: (value: T) => boolean = neverEmpty,
): RetryResource<ResourceState<T>> {
  const [snapshot, setSnapshot] = useState<{
    key: string | null; state: ResourceState<T>; retryingIssue: RequestIssue | null;
  }>({ key: null, state: loading, retryingIssue: null });
  const runner = useRef<{ key: string; retry: () => void } | null>(null);

  useEffect(() => {
    if (key === null) return;
    let active = true;
    let current: ResourceState<T> = loading;
    const run = (retryingIssue: RequestIssue | null) => {
      current = loading; // synchronous gate includes two clicks before React commits
      setSnapshot({ key, state: current, retryingIssue });
      void Promise.resolve().then(load).then((data) => {
        if (!active) return;
        current = isEmpty(data) ? { kind: 'empty' } : { kind: 'ready', data };
        setSnapshot({ key, state: current, retryingIssue: null });
      }, (error: unknown) => {
        if (!active) return;
        const issue = toRequestIssue(error);
        current = { kind: 'error', issue, message: issue.message };
        setSnapshot({ key, state: current, retryingIssue: null });
      });
    };
    runner.current = { key, retry: () => { if (current.kind === 'error') run(current.issue); } };
    run(null);
    return () => { active = false; runner.current = null; };
  }, [key, load, isEmpty]);

  const retry = useCallback(() => {
    if (key !== null && runner.current?.key === key) runner.current.retry();
  }, [key]);
  return {
    state: key !== null && snapshot.key === key ? snapshot.state : loading,
    retry,
    retryingIssue: key !== null && snapshot.key === key ? snapshot.retryingIssue : null,
  };
}
