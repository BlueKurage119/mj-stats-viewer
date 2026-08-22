import { describe, it, expect } from 'vitest';
import { demotionConditions, promotionConditions } from './transitions';
import { calculateDeltaPoint, parseLevelId } from '../domain';

describe('transitions: promotionConditions（三麻）', () => {
  const lv = { id: 20302, score: 1350, delta: 0 }; // 残 50pt

  it('1位は always（旧実装の誤り「70000点以上」にならない）', () => {
    expect(promotionConditions(lv, 22)[0]).toEqual({ rank: 0, kind: 'always' });
  });

  it('2位は atLeast 84100、3位は never（境界が卓総素点を超える）', () => {
    const conditions = promotionConditions(lv, 22);
    expect(conditions[1]).toEqual({ rank: 1, kind: 'atLeast', score: 84100 });
    expect(conditions[2]).toEqual({ rank: 2, kind: 'never' });
  });

  it('境界の厳密性: 2位の境界を calculateDeltaPoint で直接確認する', () => {
    const level = parseLevelId(20302);
    expect(calculateDeltaPoint(84100, 1, 22, level)).toBeGreaterThanOrEqual(50);
    expect(calculateDeltaPoint(84000, 1, 22, level)).toBeLessThan(50);
  });
});

describe('transitions: promotionConditions（四麻）', () => {
  it('残100ptの雀聖1 / mode16', () => {
    const lv = { id: 10501, score: 3900, delta: 0 };
    const conditions = promotionConditions(lv, 16);
    expect(conditions).toEqual([
      { rank: 0, kind: 'always' },
      { rank: 1, kind: 'atLeast', score: 59100 },
      { rank: 2, kind: 'never' },
      { rank: 3, kind: 'never' },
    ]);
  });
});

describe('transitions: demotionConditions（四麻）', () => {
  it('雀聖1 / mode16: 1〜3位 never・4位 always', () => {
    const lv = { id: 10501, score: 100, delta: 0 };
    const conditions = demotionConditions(lv, 16);
    expect(conditions).toEqual([
      { rank: 0, kind: 'never' },
      { rank: 1, kind: 'never' },
      { rank: 2, kind: 'never' },
      { rank: 3, kind: 'always' },
    ]);
  });
});

describe('transitions: 魂天は always/never のみ', () => {
  const lv = { id: 10701, score: 1960, delta: 0 }; // 魂天1・上限2000・残40pt

  it('promotionConditions', () => {
    const conditions = promotionConditions(lv, 16);
    expect(conditions).toEqual([
      { rank: 0, kind: 'always' }, // +50 >= 40
      { rank: 1, kind: 'never' }, // +20
      { rank: 2, kind: 'never' }, // -20
      { rank: 3, kind: 'never' }, // -50
    ]);
    for (const c of conditions) expect(c.kind === 'always' || c.kind === 'never').toBe(true);
  });

  it('demotionConditions は4つとも never', () => {
    const conditions = demotionConditions(lv, 16);
    expect(conditions).toEqual([
      { rank: 0, kind: 'never' },
      { rank: 1, kind: 'never' },
      { rank: 2, kind: 'never' },
      { rank: 3, kind: 'never' },
    ]);
  });
});

describe('transitions: 旧魂天（majorRank 6）はバージョン補正後のptで判定する', () => {
  // score=6871 は旧スケール。補正後 ceil(6871/100)*10+200 = 890（上限2000・残1110pt）。
  // 生スコアのまま比較すると needed = 2000-6871 = -4871 になり全て always に化ける（バグ）。
  const lv = { id: 10601, score: 6871, delta: 0 };

  it('promotionConditions は全て never（残1110ptに対し最大delta 50は届かない）', () => {
    const conditions = promotionConditions(lv, 16);
    expect(conditions).toEqual([
      { rank: 0, kind: 'never' },
      { rank: 1, kind: 'never' },
      { rank: 2, kind: 'never' },
      { rank: 3, kind: 'never' },
    ]);
  });
});

describe('transitions: 上限0の魂天20', () => {
  const lv = { id: 10720, score: 0, delta: 0 };

  it('promotionConditions は全て never', () => {
    const conditions = promotionConditions(lv, 16);
    expect(conditions.every((c) => c.kind === 'never')).toBe(true);
  });

  it('demotionConditions も全て never', () => {
    const conditions = demotionConditions(lv, 16);
    expect(conditions.every((c) => c.kind === 'never')).toBe(true);
  });
});
