import { describe, it, expect } from 'vitest';
import { estimateStableLevel, estimateStableLevel2, splitStableLevelNumber, type StableLevelInput } from './stableLevel';
import { allModes } from '../api';
import player4p from './__fixtures__/player_stats_4p.json';
import player3p from './__fixtures__/player_stats_3p.json';

function inputFrom(fixture: typeof player4p): StableLevelInput {
  return {
    levelId: fixture.level.id,
    score: fixture.level.score,
    delta: fixture.level.delta,
    rankRates: fixture.rank_rates,
    rankAvgScores: fixture.rank_avg_score,
  };
}

describe('stableLevel: estimateStableLevel2（玉/王座）', () => {
  it('四麻フィクスチャ / mode16: number kind', () => {
    const result = estimateStableLevel2(inputFrom(player4p), 16);
    expect(result.kind).toBe('number');
    if (result.kind === 'number') {
      expect(result.value).toBeCloseTo(3.005556, 5);
    }
  });

  it('rank_rates[3] が 0 の四麻入力は unavailable', () => {
    const input = { ...inputFrom(player4p), rankRates: [0.26, 0.25, 0.25, 0] };
    expect(estimateStableLevel2(input, 16)).toEqual({ kind: 'unavailable' });
  });
});

describe('stableLevel: splitStableLevelNumber', () => {
  it('4未満は雀豪。切り捨てであること', () => {
    expect(splitStableLevelNumber(3.00555)).toEqual({ majorRank: 4, value: 3.00555, text: '雀豪3.00' });
    expect(splitStableLevelNumber(3.0099)).toEqual({ majorRank: 4, value: 3.0099, text: '雀豪3.00' });
  });

  it('4以上は雀聖', () => {
    expect(splitStableLevelNumber(4.5)).toEqual({ majorRank: 5, value: 1.5, text: '雀聖1.50' });
  });
});

describe('stableLevel: estimateStableLevel（フォールバック）', () => {
  it('mode12/16以外はフォールバックする', () => {
    const result = estimateStableLevel2(inputFrom(player3p), 22);
    expect(result.kind).toBe('level');
  });

  it('三麻フィクスチャ / mode22: 雀傑2 → 雀傑1 で下降停止', () => {
    const result = estimateStableLevel(inputFrom(player3p), 22);
    expect(result).toEqual({ kind: 'level', levelId: 20301, bound: 'exact', expectedPoint: expect.closeTo(0.5142, 4) });
  });

  it('32反復以内で必ず停止する: 全15段位 × mode 16/12/9', () => {
    const modes = [16, 12, 9] as const;
    for (let majorRank = 1; majorRank <= 5; majorRank++) {
      for (let minorRank = 1; minorRank <= 3; minorRank++) {
        const levelId = 10000 + majorRank * 100 + minorRank;
        for (const mode of modes) {
          const input: StableLevelInput = {
            levelId,
            score: 0,
            delta: 0,
            rankRates: [0.26, 0.25, 0.25, 0.24],
            rankAvgScores: [42000, 27000, 21000, 10000],
          };
          expect(() => estimateStableLevel(input, mode)).not.toThrow();
        }
      }
    }
  });
});

describe('stableLevel: allModes を消費できる（型整合の確認）', () => {
  it('4p全モードで例外が出ない', () => {
    for (const mode of allModes(4)) {
      expect(() => estimateStableLevel(inputFrom(player4p), mode)).not.toThrow();
    }
  });
});
