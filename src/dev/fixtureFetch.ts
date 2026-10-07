import rawStats from '../api/testdata/player_stats.json';
import rawExtended from '../api/testdata/player_extended_stats.json';
import histogram from '../domain/__fixtures__/global_histogram.json';
import { allModes } from '../api/gameMode';
import levelStats from '../api/testdata/level_statistics.json';

export const SCENARIOS = [
  'success', 'slow-basic', 'slow-extended', 'slow-identity', 'slow-distribution', 'slow-level',
  'empty-basic', 'empty-basic-error-extended', 'empty-identity', 'empty-extended', 'empty-search', 'zero-rounds', 'zero-breakdown',
  'both-errors', 'error-search', 'slow-search', 'error-basic', 'error-extended', 'error-distribution', 'error-level', 'error-identity',
  'error-representative', 'error-mode-basic', 'error-mode-extended', 'empty-candidates',
  'empty-distribution', 'empty-level', 'all-mirrors', 'maintenance', 'race', 'race-error',
] as const;
export type Scenario = typeof SCENARIOS[number];
export interface FixtureRequest {
  path: string; endpoint: string; mode: string | null; start: string | null; end: string | null;
  outcome: string; aborted: boolean;
}
export interface FixtureSession {
  readonly requests: FixtureRequest[];
  readonly pending: ReadonlyMap<string, () => void>;
  release: () => void;
  restore: () => void;
  retain: () => () => void;
  subscribe: (listener: () => void) => () => void;
}
/** Test-only transport. No unrecognised request can reach the real API. */
export function installFixtureFetch(scenario: Scenario): FixtureSession {
  const original = globalThis.fetch;
  const requests: FixtureRequest[] = [];
  const listeners = new Set<() => void>();
  const pending = new Map<string, () => void>();
  const failures = new Map<string, number>();
  const notify = () => listeners.forEach(listener => listener());
  let restored = false;
  let leases = 0;
  const mock: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.origin);
    const segments = url.pathname.split('/');
    const endpoint = segments[4];
    if (!['player_stats', 'player_extended_stats', 'search_player', 'global_histogram', 'level_statistics'].includes(endpoint)) throw new Error('State fixture rejected unknown endpoint');
    const np = segments[3] === 'pl3' ? 3 : 4;
    const mode = url.searchParams.get('mode');
    const identity = endpoint === 'player_stats' && (mode?.split('.').length ?? 0) === 6;
    const multiple = (mode?.split('.').length ?? 0) > 1;
    const single = !identity && !multiple;
    const start = segments[6] ?? null;
    const end = segments[7] ?? null;
    const entry: FixtureRequest = {path: url.pathname + url.search, endpoint, mode, start, end, outcome: 'pending', aborted: false};
    requests.push(entry); notify();
    const role = identity ? 'identity' : endpoint === 'player_stats' ? multiple ? 'basic' : 'mode-basic' : endpoint === 'player_extended_stats' ? multiple ? 'extended' : 'mode-extended' : endpoint === 'global_histogram' ? 'distribution' : endpoint === 'level_statistics' ? 'level' : 'search';
    const matching = (target: string) => role === target || (target === 'basic' && endpoint === 'player_stats' && !identity) || (target === 'extended' && endpoint === 'player_extended_stats');
    const oldPeriod = start && end && Number(end) - Number(start) < 8 * 86400000;
    const hold = scenario.startsWith('slow-') && matching(scenario.slice(5)) || (scenario === 'race' || scenario === 'race-error') && !!oldPeriod;
    if (hold) await new Promise<void>((resolve, reject) => {
      const token = `${role}-${requests.length}`;
      const signal = init?.signal;
      const onAbort = () => { entry.aborted = true; pending.delete(token); entry.outcome = 'aborted'; notify(); reject(new DOMException('Aborted', 'AbortError')); };
      pending.set(token, () => { signal?.removeEventListener('abort', onAbort); pending.delete(token); resolve(); notify(); });
      if (signal?.aborted) onAbort(); else signal?.addEventListener('abort', onAbort, {once: true});
      notify();
    });
    // Keep retry observable without relying on long network timeouts.
    await new Promise(resolve => setTimeout(resolve, failures.has(role) ? 350 : 80));
    const respond = (data: unknown, status = 200) => { entry.outcome = String(status); notify(); return new Response(JSON.stringify(data), {status, headers: {'Content-Type': 'application/json'}}); };
    const allFailed = scenario === 'all-mirrors';
    const failTarget = scenario.startsWith('error-') ? scenario.slice(6) : null;
    const representative = scenario === 'error-representative' && endpoint === 'player_stats' && single && !failures.has('representative');
    const failed = !failures.has(role) && ((failTarget !== 'representative' && failTarget && matching(failTarget)) || (scenario === 'both-errors' && (role === 'basic' || endpoint === 'player_extended_stats')) || (scenario === 'empty-basic-error-extended' && endpoint === 'player_extended_stats'));
    if (allFailed && (failures.get(role) ?? 0) < 4) {
      failures.set(role, (failures.get(role) ?? 0) + 1); entry.outcome = 'network'; notify(); throw new TypeError('Fixture network failure');
    }
    if (representative) { failures.set('representative', 1); return respond({}, 500); }
    if (failed) { failures.set(role, 1); return respond({}, 500); }
    if (scenario === 'race-error' && oldPeriod) return respond({}, 500);
    if (scenario === 'maintenance' && !failures.has(role)) { failures.set(role, 1); return respond({maintenance: 'STATE_FIXTURE_MAINTENANCE'}); }
    if (scenario.startsWith('empty-basic') && !identity && endpoint === 'player_stats') return respond({error: 'id_not_found'}, 404);
    if (scenario === 'empty-identity' && identity) return respond({}, 404);
    if (scenario === 'empty-extended' && endpoint === 'player_extended_stats') return respond({error: 'id_not_found'}, 404);
    if (endpoint === 'search_player') return respond(scenario === 'empty-search' ? [] : [{id: 1, nickname: '状態確認プレイヤー', level: {id: np === 4 ? 10301 : 20301, score: 695, delta: 0}, latest_timestamp: 1600000000}]);
    if (endpoint === 'player_stats') return respond({...rawStats, id: 1, nickname: '状態確認プレイヤー', level: {...rawStats.level, id: np === 4 ? 10301 : 20301}, max_level: {...rawStats.max_level, id: np === 4 ? 10301 : 20301}, played_modes: scenario.startsWith('error-mode-') ? [np === 4 ? 16 : 26] : np === 4 ? [16,12,9] : [26,24,22], rank_rates: np === 4 ? rawStats.rank_rates : [.3,.3,.4], rank_avg_score: np === 4 ? rawStats.rank_avg_score : [60000,35000,10000], count: scenario === 'empty-candidates' && single ? 0 : (oldPeriod ? 7 : rawStats.count)});
    if (endpoint === 'player_extended_stats') {
      const data = {...rawExtended};
      if (scenario === 'zero-rounds') data.count = 0;
      if (scenario === 'zero-breakdown') for (const key of ['立直和了','副露和了','默听和了','放铳至立直','放铳至副露','放铳至默听']) (data as Record<string, unknown>)[key] = 0;
      return respond(data);
    }
    if (endpoint === 'global_histogram') return respond(scenario === 'empty-distribution' ? {} : Object.fromEntries(allModes(np).map(mode => [String(mode), histogram['16']])));
    return respond(scenario === 'empty-level' ? [] : levelStats.map(([zone,id,count])=>[zone,np === 3 ? id + 10000 : id,count]));
  };
  globalThis.fetch = mock;
  return {requests, pending, retain() { leases++; return () => { leases--; queueMicrotask(() => { if (leases === 0 && globalThis.fetch === mock) {globalThis.fetch = original; restored = true;} }); }; }, subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    release() { [...pending.values()].forEach(resolve => resolve()); },
    restore() { if (!restored && globalThis.fetch === mock) globalThis.fetch = original; restored = true; },
  };
}
