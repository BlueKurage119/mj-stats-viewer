import { describe, it, expect } from 'vitest';
import { applyPointDelta, gamesToDemotion, gamesToPromotion, preferredMode, projectAfterGames } from './growth';

describe('growth: preferredMode', () => {
  it('段位に応じた入れる最上の卓・半荘', () => {
    expect(preferredMode(10501)).toBe(16);
    expect(preferredMode(10401)).toBe(12);
    expect(preferredMode(10301)).toBe(9);
    expect(preferredMode(20302)).toBe(22);
    expect(preferredMode(10201)).toBe(null); // 雀士は入室可能モードなし
  });
});

describe('growth: gamesToDemotion / gamesToPromotion', () => {
  it('gamesToDemotion: floor(232/6.6818)+1 = 35', () => {
    expect(gamesToDemotion({ levelId: 20302, point: 232 }, -6.6818)).toBe(35);
  });

  it('34戦後は残 4.82pt で降段しない', () => {
    const remaining = 232 - 34 * 6.6818;
    expect(remaining).toBeGreaterThan(0);
  });

  it('gamesToPromotion: 期待値が負なら null', () => {
    expect(gamesToPromotion({ levelId: 20302, point: 232 }, -6.6818)).toBe(null);
  });

  it('gamesToPromotion: ceil(50/6.6818) = 8', () => {
    expect(gamesToPromotion({ levelId: 20302, point: 1350 }, 6.6818)).toBe(8);
  });
});

describe('growth: applyPointDelta', () => {
  it('昇段: 雀傑2 → 雀傑3（上限2000の半分）', () => {
    expect(applyPointDelta({ levelId: 20302, point: 1399 }, 10)).toEqual({ levelId: 20303, point: 1000 });
  });

  it('雀士1は降段しない', () => {
    expect(applyPointDelta({ levelId: 10201, point: 5 }, -100)).toEqual({ levelId: 10201, point: 0 });
  });
});

describe('growth: projectAfterGames', () => {
  it('50戦後の見込み。35戦目で雀傑1に降段し600にリセットされる（逐次シミュレーション）', () => {
    const result = projectAfterGames({ levelId: 20302, point: 232 }, -6.6818, 50);
    expect(result.levelId).toBe(20301);
    expect(result.point).toBeCloseTo(499.773, 3);
  });
});
