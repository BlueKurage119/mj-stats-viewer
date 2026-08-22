import { describe, it, expect } from 'vitest';
import { calculateDeltaPoint, expectedPointPerGame, rankDeltaPoints } from './points';
import { parseLevelId } from './level';

describe('points: rankDeltaPoints', () => {
  it('三麻 雀傑2 / mode22（Issue 実測値）', () => {
    expect(rankDeltaPoints([62500, 35700, 6800], 22, parseLevelId(20302))).toEqual([148, 1, -143]);
  });

  it('四麻 雀聖1 / mode16（Issue 実測値）', () => {
    expect(rankDeltaPoints([42000, 27000, 21000, 10000], 16, parseLevelId(10501))).toEqual([152, 67, -9, -240]);
  });

  it('人数不一致は Error を throw する', () => {
    expect(() => rankDeltaPoints([1, 2, 3], 16, parseLevelId(10501))).toThrow();
  });
});

describe('points: expectedPointPerGame', () => {
  it('三麻 雀傑2 / mode22', () => {
    expect(expectedPointPerGame([0.3002, 0.34, 0.3598], [62500, 35700, 6800], 22, parseLevelId(20302))).toBeCloseTo(
      -6.68,
      2,
    );
  });

  it('四麻 雀聖1 / mode16', () => {
    expect(
      expectedPointPerGame([0.26, 0.25, 0.25, 0.24], [42000, 27000, 21000, 10000], 16, parseLevelId(10501)),
    ).toBeCloseTo(-3.58, 2);
  });
});

describe('points: DeltaOptions', () => {
  it('includePenalty:false でラスペナが引かれない', () => {
    const result = rankDeltaPoints([42000, 27000, 21000, 10000], 16, parseLevelId(10501), { includePenalty: false });
    expect(result).toEqual([152, 67, -9, -30]);
  });

  it('trimNumber:false でも同じ結果（値が既に整数のため）', () => {
    const result = rankDeltaPoints([42000, 27000, 21000, 10000], 16, parseLevelId(10501), {
      includePenalty: false,
      trimNumber: false,
    });
    expect(result).toEqual([152, 67, -9, -30]);
    const expected = expectedPointPerGame([0.26, 0.25, 0.25, 0.24], [42000, 27000, 21000, 10000], 16, parseLevelId(10501), {
      includePenalty: false,
      trimNumber: false,
    });
    expect(expected).toBeCloseTo(46.82, 2);
  });
});

describe('points: 魂天は素点非依存', () => {
  it('KONTEN_DELTA のあるモード（mode16）: score を変えても結果が同じ', () => {
    const level = parseLevelId(10701);
    expect(calculateDeltaPoint(0, 0, 16, level)).toBe(50);
    expect(calculateDeltaPoint(120000, 0, 16, level)).toBe(50);
    expect(calculateDeltaPoint(0, 3, 16, level)).toBe(-50);
    expect(calculateDeltaPoint(120000, 3, 16, level)).toBe(-50);
  });

  it('KONTEN_DELTA の無いモード（mode9）: 雀聖3のペナルティ表で計算される', () => {
    const level = parseLevelId(10701);
    // ceil((0-25000)/1000 + (-15)) + 0 - LEVEL_PENALTY[14] = -40 - 240 = -280
    expect(calculateDeltaPoint(0, 3, 9, level)).toBe(-280);
  });
});
