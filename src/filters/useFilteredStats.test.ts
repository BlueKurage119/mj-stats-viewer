import {afterEach,describe,it,expect,vi} from 'vitest';
import * as api from '../api';
import type {PlayerStats,PlayerExtendedStats} from '../api';
import {createHookHarness,deferred,flush} from '../testUtils/hookHarness';
import {useFilteredStats} from './useFilteredStats';
const basic={gameCount:54} as PlayerStats;
const detailed={roundCount:194} as PlayerExtendedStats;
const filter={modes:[16] as const,period:'30d' as const};
afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers();});
function setup(){vi.spyOn(api,'resolveRange').mockResolvedValue({start:new Date('2025-01-01T00:00:00Z'),end:new Date('2025-02-01T00:00:00Z')});return createHookHarness();}
describe('independent player acquisition',()=>{
  it('renders basic data before details and retries only failed details',async()=>{
    const h=setup();const first=deferred<PlayerExtendedStats|null>();const second=deferred<PlayerExtendedStats|null>();
    const stats=vi.spyOn(api,'getPlayerStats').mockResolvedValue(basic);
    const ext=vi.spyOn(api,'getPlayerExtendedStats').mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const run=()=>h.run(()=>useFilteredStats(4,1,filter));run();await flush();
    expect(run().state).toEqual({kind:'ready',stats:basic,extended:null,extendedState:{kind:'loading'}});
    first.reject(new Error('details'));await flush();const failed=run();expect(failed.state.kind).toBe('ready');
    failed.retry();failed.retry();await flush();expect(stats).toHaveBeenCalledTimes(1);expect(ext).toHaveBeenCalledTimes(2);
    expect(run().retryingIssues.extended?.kind).toBe('unknown');second.resolve(detailed);await flush();
    expect(run().state).toEqual({kind:'ready',stats:basic,extended:detailed,extendedState:{kind:'ready',data:detailed}});
    expect(api.resolveRange).toHaveBeenCalledTimes(1);expect(ext.mock.calls[1]).toEqual([4,1,new Date('2025-01-01T00:00:00Z'),new Date('2025-02-01T00:00:00Z'),[16]]);h.cleanup();
  });
  it('preserves successful details when the basic acquisition is retried',async()=>{
    const h=setup();const stats=vi.spyOn(api,'getPlayerStats').mockRejectedValueOnce(new Error('basic')).mockResolvedValueOnce(basic);const ext=vi.spyOn(api,'getPlayerExtendedStats').mockResolvedValue(detailed);
    const run=()=>h.run(()=>useFilteredStats(4,1,filter));run();await flush();expect(run().state.kind).toBe('error');run().retry();await flush();
    expect(stats).toHaveBeenCalledTimes(2);expect(ext).toHaveBeenCalledTimes(1);expect(run().state).toEqual({kind:'ready',stats:basic,extended:detailed,extendedState:{kind:'ready',data:detailed}});h.cleanup();
  });
  it('uses the latest filter during debounce and never accepts an old retry',async()=>{
    vi.useFakeTimers();const h=setup();vi.spyOn(api,'getPlayerStats').mockRejectedValue(new Error('basic'));const ext=vi.spyOn(api,'getPlayerExtendedStats').mockResolvedValue(detailed);
    h.run(()=>useFilteredStats(4,1,filter));await flush();const old=h.run(()=>useFilteredStats(4,1,filter));
    const next={...filter,period:'7d' as const};expect(h.run(()=>useFilteredStats(4,1,next)).state).toEqual({kind:'loading'});old.retry();await flush();expect(api.getPlayerStats).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(250);h.run(()=>useFilteredStats(4,1,next));await flush();expect(api.getPlayerStats).toHaveBeenCalledTimes(2);expect(ext).toHaveBeenCalledTimes(2);h.cleanup();
  });
  it('distinguishes absent details from no games',async()=>{
    const h=setup();vi.spyOn(api,'getPlayerStats').mockResolvedValue(basic);vi.spyOn(api,'getPlayerExtendedStats').mockResolvedValue(null);
    const run=()=>h.run(()=>useFilteredStats(4,1,filter));run();await flush();expect(run().state).toEqual({kind:'ready',stats:basic,extended:null,extendedState:{kind:'empty'}});h.cleanup();
  });
});
