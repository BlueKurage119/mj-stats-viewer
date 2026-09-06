import { describe, it, expect } from 'vitest';
import { DONUT_CIRCUMFERENCE, DONUT_GAP, DONUT_MIN_ARC, percentText, percentTenths, toDonutArcs } from './donutShared';

describe('donutShared: toDonutArcs', () => {
  it('累積オフセットが割合の累積×円周の負値になる', () => {
    const arcs = toDonutArcs([0.2, 0.3, 0.5]);
    expect(arcs[0].arcOffset).toBe(-0);
    expect(arcs[1].arcOffset).toBeCloseTo(-(DONUT_CIRCUMFERENCE * 0.2), 6);
    expect(arcs[2].arcOffset).toBeCloseTo(-(DONUT_CIRCUMFERENCE * 0.5), 6);
  });

  it('arcLength が C*rate - DONUT_GAP になる（GAP・MIN_ARCの範囲内）', () => {
    const arcs = toDonutArcs([0.5, 0.5]);
    expect(arcs[0].arcLength).toBeCloseTo(DONUT_CIRCUMFERENCE * 0.5 - DONUT_GAP, 6);
  });

  it('rate === 0 の要素は arcLength が null', () => {
    const arcs = toDonutArcs([1, 0]);
    expect(arcs[1].arcLength).toBeNull();
  });

  it('極小の rate でも arcLength が DONUT_MIN_ARC を下回らない', () => {
    const arcs = toDonutArcs([0.998, 0.001, 0.001]);
    for (const arc of arcs.slice(1)) {
      expect(arc.arcLength).not.toBeNull();
      expect(arc.arcLength!).toBeGreaterThanOrEqual(DONUT_MIN_ARC);
    }
  });
});

describe('donutShared: percentText', () => {
  it('二重丸め誤差を避ける（0.0555 → 5.6）', () => {
    expect(percentText(0.0555)).toBe('5.6');
  });
});

describe('donutShared: percentTenths', () => {
  it('合計が常に1000（100.0%）になる', () => {
    const tenths = percentTenths([0.362069, 0.5, 0.137931]);
    expect(tenths.reduce((sum, v) => sum + v, 0)).toBe(1000);
    expect(tenths).toEqual([362, 500, 138]);
  });

  it('端数が同値のときは添字の小さい方に先に配分する', () => {
    const tenths = percentTenths([1 / 3, 1 / 3, 1 / 3]);
    expect(tenths).toEqual([334, 333, 333]);
    expect(tenths.reduce((sum, v) => sum + v, 0)).toBe(1000);
  });
});
