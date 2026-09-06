import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import type { GameMode, PlayerStats } from '../api';
import * as api from '../api';
import {
  determineRepresentativeMode,
  resolveCandidates,
  shouldResetOverride,
  useRepresentativeMode,
} from './useRepresentativeMode';
import type { GlobalFilter } from '../filters/filterState';

// Node 環境で React hook を実行するための軽量テストハーネス
function createHookHarness() {
  const hookStates: any[] = [];
  let hookIndex = 0;
  const cleanups: Array<(() => void) | void> = [];
  const prevDeps: Array<any[] | undefined> = [];

  const mockDispatcher = {
    useState(initial: any) {
      const idx = hookIndex++;
      if (hookStates[idx] === undefined) {
        hookStates[idx] = typeof initial === 'function' ? initial() : initial;
      }
      const setState = (next: any) => {
        hookStates[idx] = typeof next === 'function' ? next(hookStates[idx]) : next;
      };
      return [hookStates[idx], setState];
    },
    useEffect(effect: () => (() => void) | void, deps?: any[]) {
      const idx = hookIndex++;
      const last = prevDeps[idx];
      const changed =
        !last || !deps || deps.length !== last.length || deps.some((d, i) => d !== last[i]);
      if (changed) {
        if (typeof cleanups[idx] === 'function') {
          cleanups[idx]!();
        }
        cleanups[idx] = effect();
        prevDeps[idx] = deps;
      }
    },
  };

  const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  if (internals) {
    internals.H = mockDispatcher;
  }

  return {
    run<T>(hookFn: () => T): T {
      hookIndex = 0;
      return hookFn();
    },
    cleanup() {
      for (const cleanup of cleanups) {
        if (typeof cleanup === 'function') {
          cleanup();
        }
      }
    },
  };
}

describe('useRepresentativeMode', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('pure logic functions (A4-1)', () => {
    it('resolves candidates as intersection in canonical order', () => {
      const candidates = resolveCandidates([12, 16, 9], [16, 9, 8], 4);
      expect(candidates).toEqual([16, 9]);
    });

    it('returns empty when intersection is empty', () => {
      const candidates = resolveCandidates([16], [9, 8], 4);
      expect(candidates).toEqual([]);
      expect(determineRepresentativeMode(4, candidates, {}, null)).toBeNull();
    });

    // A4-1: 候補 [16,12]・gameCountByMode {16:10, 12:99} → 代表 12
    it('selects mode with most games played (A4-1)', () => {
      const candidates: GameMode[] = [16, 12];
      const counts = { 16: 10, 12: 99 };
      const res = determineRepresentativeMode(4, candidates, counts, null);
      expect(res).toEqual({ mode: 12, auto: true });
    });

    // A4-1: 候補 [16,12]・同数 → 代表 16 (上位卓優先)
    it('breaks ties using higher table priority (A4-1)', () => {
      const candidates: GameMode[] = [16, 12];
      const counts = { 16: 50, 12: 50 };
      const res = determineRepresentativeMode(4, candidates, counts, null);
      expect(res).toEqual({ mode: 16, auto: true });
    });

    it('respects user override (A4-3)', () => {
      const candidates: GameMode[] = [16, 12];
      const counts = { 16: 100, 12: 10 };
      const res = determineRepresentativeMode(4, candidates, counts, 12);
      expect(res).toEqual({ mode: 12, auto: false });
    });

    it('ignores override if not in candidates', () => {
      const candidates: GameMode[] = [16, 12];
      const counts = { 16: 10, 12: 99 };
      const res = determineRepresentativeMode(4, candidates, counts, 9 as GameMode);
      expect(res).toEqual({ mode: 12, auto: true });
    });

    // A4-4: filter の変更で override がリセットされること
    describe('shouldResetOverride (A4-4)', () => {
      it('returns false when filters are identical or have same values', () => {
        const f1: GlobalFilter = { modes: [16, 12], period: 'all' };
        const f2: GlobalFilter = { modes: [16, 12], period: 'all' };
        expect(shouldResetOverride(f1, f1)).toBe(false);
        expect(shouldResetOverride(f1, f2)).toBe(false);
      });

      it('returns true when period changes', () => {
        const f1: GlobalFilter = { modes: [16, 12], period: 'all' };
        const f2: GlobalFilter = { modes: [16, 12], period: '30d' };
        expect(shouldResetOverride(f1, f2)).toBe(true);
      });

      it('returns true when modes change', () => {
        const f1: GlobalFilter = { modes: [16], period: 'all' };
        const f2: GlobalFilter = { modes: [16, 12], period: 'all' };
        expect(shouldResetOverride(f1, f2)).toBe(true);

        const f3: GlobalFilter = { modes: [12, 16], period: 'all' };
        expect(shouldResetOverride(f2, f3)).toBe(true);
      });

      it('returns true when transitions between null and non-null', () => {
        const f: GlobalFilter = { modes: [16], period: 'all' };
        expect(shouldResetOverride(null, f)).toBe(true);
        expect(shouldResetOverride(f, null)).toBe(true);
      });

      it('returns false when both are null', () => {
        expect(shouldResetOverride(null, null)).toBe(false);
      });
    });
  });

  describe('hook execution & request count (A4-2)', () => {
    it('makes 0 additional API requests when candidate count is 1 (A4-2)', () => {
      const getPlayerStatsSpy = vi.spyOn(api, 'getPlayerStats');
      const resolveRangeSpy = vi.spyOn(api, 'resolveRange');

      const harness = createHookHarness();

      const filter: GlobalFilter = { modes: [16], period: 'all' };
      // 1回目のレンダー（useEffect が走る）
      harness.run(() =>
        useRepresentativeMode({
          numPlayers: 4,
          playerId: 12345,
          filter,
          playedModes: [16],
          override: null,
        }),
      );
      // setState 後の2回目レンダー
      const res = harness.run(() =>
        useRepresentativeMode({
          numPlayers: 4,
          playerId: 12345,
          filter,
          playedModes: [16],
          override: null,
        }),
      );

      expect(res).toEqual({
        kind: 'ready',
        mode: 16,
        candidates: [16],
        gameCountByMode: {},
        auto: true,
      });

      // A4-2: 候補1つのとき getPlayerStats は呼ばれない
      expect(getPlayerStatsSpy).toHaveBeenCalledTimes(0);
      expect(resolveRangeSpy).toHaveBeenCalledTimes(0);

      harness.cleanup();
    });

    it('fetches player_stats for each candidate when candidate count >= 2', async () => {
      vi.spyOn(api, 'resolveRange').mockResolvedValue({
        start: new Date('2025-01-01'),
        end: new Date('2025-12-31'),
      });
      const getPlayerStatsSpy = vi.spyOn(api, 'getPlayerStats').mockImplementation(
        async (_np, _id, _start, _end, modes) =>
          ({
            gameCount: modes?.[0] === 12 ? 99 : 10,
          }) as unknown as PlayerStats,
      );

      const harness = createHookHarness();

      const filter: GlobalFilter = { modes: [16, 12], period: 'all' };
      // 1回目のレンダリング（effect が走る）
      harness.run(() =>
        useRepresentativeMode({
          numPlayers: 4,
          playerId: 12345,
          filter,
          playedModes: [16, 12],
          override: null,
        }),
      );

      // 非同期解決を待つ
      await new Promise((r) => setTimeout(r, 10));

      // 状態が更新された後のレンダリング
      const res = harness.run(() =>
        useRepresentativeMode({
          numPlayers: 4,
          playerId: 12345,
          filter,
          playedModes: [16, 12],
          override: null,
        }),
      );

      expect(getPlayerStatsSpy).toHaveBeenCalledTimes(2);
      expect(res).toEqual({
        kind: 'ready',
        mode: 12,
        candidates: [16, 12],
        gameCountByMode: { 16: 10, 12: 99 },
        auto: true,
      });

      harness.cleanup();
    });
  });
});
