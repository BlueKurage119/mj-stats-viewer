import {describe,it,expect,vi} from 'vitest';
import {createHookHarness,deferred,flush} from '../testUtils/hookHarness';
import {useRetryResource} from './useRetryResource';

describe('retry resource',()=>{
  it('accepts one retry before React renders and preserves the prior issue while pending',async()=>{
    const h=createHookHarness();const pending=deferred<number>();
    const load=vi.fn().mockRejectedValueOnce(new Error('failed')).mockReturnValueOnce(pending.promise);
    const run=()=>h.run(()=>useRetryResource('a',load));
    run();await flush();const failed=run();expect(failed.state.kind).toBe('error');
    failed.retry();failed.retry();await flush();const loading=run();
    expect(load).toHaveBeenCalledTimes(2);expect(loading.state).toEqual({kind:'loading'});expect(loading.retryingIssue?.kind).toBe('unknown');
    pending.resolve(17);await flush();expect(run().state).toEqual({kind:'ready',data:17});expect(run().retryingIssue).toBeNull();h.cleanup();
  });
  it('ignores obsolete responses and invalidates old values before the new effect starts',async()=>{
    const h=createHookHarness();const old=deferred<number>();const fresh=deferred<number>();const loadOld=()=>old.promise;const loadFresh=()=>fresh.promise;
    h.run(()=>useRetryResource('old',loadOld));await flush();
    expect(h.run(()=>useRetryResource('new',loadFresh)).state).toEqual({kind:'loading'});await flush();
    fresh.resolve(42);await flush();old.reject(new Error('obsolete'));await flush();
    expect(h.run(()=>useRetryResource('new',loadFresh)).state).toEqual({kind:'ready',data:42});h.cleanup();
  });
  it('does not refetch successful or empty data',async()=>{
    const h=createHookHarness();const load=vi.fn().mockResolvedValue(0);const empty=(value:number)=>value===0;
    const run=()=>h.run(()=>useRetryResource('a',load,empty));run();await flush();const result=run();expect(result.state).toEqual({kind:'empty'});result.retry();await flush();expect(load).toHaveBeenCalledTimes(1);h.cleanup();
  });
});
