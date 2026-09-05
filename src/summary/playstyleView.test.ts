import { describe, it, expect } from 'vitest';
import { buildPlaystyleView, radarPointAt, RADAR_MIN, RADAR_RADIUS } from './playstyleView';
import type { MetricLookup } from '../filters/useGlobalHistogram';
import type { MetricDistribution } from '../domain';
import type { PlayerExtendedStats } from '../api';

function dist(mean: number, sd = 1, count = 1000): MetricDistribution {
  return { mean, sd, count };
}

/** 実在プレイヤーの値は使わない。全メトリクスが分布 mean=0/sd=1 の baseline（z が stats 値そのものになる） */
const BASELINE_DISTRIBUTIONS: Record<string, MetricDistribution> = {
  打点效率: dist(0),
  铳点损失: dist(0),
  和牌率: dist(0),
  立直率: dist(0),
  追立率: dist(0),
  放铳率: dist(0),
  默听率: dist(0),
  副露率: dist(0),
  和了巡数: dist(0),
  里宝率: dist(0.15),
  一发率: dist(0.1),
};

function makeLookup(overrides: Partial<Record<string, MetricDistribution | null>> = {}): MetricLookup {
  return (metric: string) => {
    if (metric in overrides) return overrides[metric] ?? null;
    return BASELINE_DISTRIBUTIONS[metric] ?? null;
  };
}

function makeExtended(overrides: Partial<PlayerExtendedStats> = {}): PlayerExtendedStats {
  return {
    roundCount: 100,
    打点效率: 0,
    铳点损失: 0,
    和牌率: 0,
    立直率: 0,
    里宝率: 0.15,
    一发率: 0.1,
    追立率: 0,
    放铳率: 0,
    默听率: 0,
    副露率: 0,
    和了巡数: 0,
    ...overrides,
  } as PlayerExtendedStats;
}

describe('playstyleView: radarPointAt', () => {
  it('U1: index0・半径70は中心の真上 (100,30)', () => {
    const p = radarPointAt(0, 70);
    expect(p.x).toBeCloseTo(100, 6);
    expect(p.y).toBeCloseTo(30, 6);
  });

  it('U2: index1..4 が72°ずつ時計回り', () => {
    const p1 = radarPointAt(1, 70);
    const p2 = radarPointAt(2, 70);
    const p3 = radarPointAt(3, 70);
    const p4 = radarPointAt(4, 70);
    // 時計回り: 右上 → 右下 → 左下 → 左上
    expect(p1.x).toBeGreaterThan(100);
    expect(p1.y).toBeLessThan(100);
    expect(p2.x).toBeGreaterThan(100);
    expect(p2.y).toBeGreaterThan(100);
    expect(p3.x).toBeLessThan(100);
    expect(p3.y).toBeGreaterThan(100);
    expect(p4.x).toBeLessThan(100);
    expect(p4.y).toBeLessThan(100);
  });
});

describe('playstyleView: buildPlaystyleView (レーダー)', () => {
  it('U3: points は常に長さ5で 攻→守→速→制→運 の順（RADAR_AXIS_ORDER を経由しない独立な期待値）', () => {
    const view = buildPlaystyleView({ extended: makeExtended(), lookup: makeLookup(), mode: 16 });
    expect(view.points.map((p) => p.axis)).toEqual(['攻', '守', '速', '制', '運']);
  });

  it('U4: 全軸有効なら polygonPoints が5点を返す', () => {
    const view = buildPlaystyleView({ extended: makeExtended(), lookup: makeLookup(), mode: 16 });
    expect(view.polygonPoints).not.toBeNull();
    expect(view.polygonPoints!.split(' ')).toHaveLength(5);
  });

  it('U5: 1軸でも null なら polygonPoints は null、当該 RadarPoint.value も null', () => {
    const view = buildPlaystyleView({
      extended: makeExtended(),
      lookup: makeLookup({ 打点效率: null }),
      mode: 16,
    });
    expect(view.polygonPoints).toBeNull();
    const 攻 = view.points.find((p) => p.axis === '攻')!;
    expect(攻.value).toBeNull();
  });

  it('U6: 値95の軸はクランプされ頂点が外周・valueTextはクランプ前の実値', () => {
    const view = buildPlaystyleView({
      extended: makeExtended({ 打点效率: 4.5 }), // dv = 50 + 10*4.5 = 95
      lookup: makeLookup(),
      mode: 16,
    });
    const 攻 = view.points.find((p) => p.axis === '攻')!;
    expect(攻.clamped).toBe(true);
    expect(攻.valueText).toBe('95.0');
    const dist2 = Math.hypot(攻.x - 100, 攻.y - 100);
    expect(dist2).toBeCloseTo(RADAR_RADIUS, 6);
  });

  it('U7: 値5の軸は RADAR_MIN にクランプされ半径0', () => {
    const view = buildPlaystyleView({
      extended: makeExtended({ 打点效率: -4.5 }), // dv = 50 - 45 = 5
      lookup: makeLookup(),
      mode: 16,
    });
    const 攻 = view.points.find((p) => p.axis === '攻')!;
    expect(攻.value).toBeLessThan(RADAR_MIN);
    const dist2 = Math.hypot(攻.x - 100, 攻.y - 100);
    expect(dist2).toBeCloseTo(0, 6);
  });

  it('U8: valueText が小数1桁 (57.216 -> "57.2")', () => {
    const view = buildPlaystyleView({
      extended: makeExtended({ 打点效率: 0.7216 }), // dv = 57.216
      lookup: makeLookup(),
      mode: 16,
    });
    const 攻 = view.points.find((p) => p.axis === '攻')!;
    expect(攻.valueText).toBe('57.2');
  });

  it('U9: 守 は 100 - 偏差値(铳点损失)（铳点损失が μ より小さいと守 > 50）', () => {
    const view = buildPlaystyleView({
      extended: makeExtended({ 铳点损失: -2 }), // dv = 30 → 守 = 70
      lookup: makeLookup(),
      mode: 16,
    });
    const 守 = view.points.find((p) => p.axis === '守')!;
    expect(守.value).toBeCloseTo(70, 6);
    expect(守.value!).toBeGreaterThan(50);
  });
});

describe('playstyleView: buildPlaystyleView (傾向2軸)', () => {
  it('U10: rows は常に長さ2・key が offenseDefense → concealedSpeed の順', () => {
    const view = buildPlaystyleView({ extended: makeExtended(), lookup: makeLookup(), mode: 16 });
    expect(view.rows.map((r) => r.key)).toEqual(['offenseDefense', 'concealedSpeed']);
  });

  it('U11: 極ラベルが軸ごとに正しく、poleEnd 側が band4 の向きである', () => {
    const view = buildPlaystyleView({
      extended: makeExtended({ 立直率: 3, 追立率: 3, 放铳率: 3, 默听率: -3 }),
      lookup: makeLookup(),
      mode: 16,
    });
    const offense = view.rows.find((r) => r.key === 'offenseDefense')!;
    expect(offense.poleStart).toBe('守');
    expect(offense.poleEnd).toBe('攻');
    expect(offense.band).toBe(4);

    const speedView = buildPlaystyleView({
      extended: makeExtended({ 副露率: 3, 默听率: -3, 和了巡数: -3 }),
      lookup: makeLookup(),
      mode: 16,
    });
    const speed = speedView.rows.find((r) => r.key === 'concealedSpeed')!;
    expect(speed.poleStart).toBe('門前');
    expect(speed.poleEnd).toBe('速度');
    expect(speed.band).toBe(4);
  });

  it('U12: 軸が null のとき band === null かつ ariaLabel に「判定できません」が含まれる', () => {
    const view = buildPlaystyleView({
      extended: makeExtended(),
      lookup: makeLookup({ 立直率: null, 追立率: null, 放铳率: null, 默听率: null }),
      mode: 16,
    });
    const offense = view.rows.find((r) => r.key === 'offenseDefense')!;
    expect(offense.band).toBeNull();
    expect(offense.ariaLabel).toContain('判定できません');
  });

  it.each([
    [-2, 0],
    [-1, 1],
    [0, 2],
    [1, 3],
    [2, 4],
  ])('U13: 単一項の z=%d で band=%d、呼称語を含まない ariaLabel', (z, expectedBand) => {
    const view = buildPlaystyleView({
      extended: makeExtended({ 立直率: z }),
      // 立直率以外の offenseDefense 項を欠損させ、単一項（sqrt(1)=1）にする
      lookup: makeLookup({ 追立率: null, 放铳率: null, 默听率: null }),
      mode: 16,
    });
    const offense = view.rows.find((r) => r.key === 'offenseDefense')!;
    expect(offense.band).toBe(expectedBand);
    expect(offense.ariaLabel).toBe(`守 ⇔ 攻: 5段階のうち守側から${expectedBand + 1}番目`);
    expect(offense.ariaLabel).not.toMatch(/バランス型|攻撃寄り|守備寄り|鉄壁|フルアタック|門前主義|速攻|タイプ/);
  });
});

describe('playstyleView: buildPlaystyleView (typeName の不在・aria・注記)', () => {
  it('U14: PlaystyleView に typeName プロパティが存在しない', () => {
    const view = buildPlaystyleView({ extended: makeExtended(), lookup: makeLookup(), mode: 16 });
    expect('typeName' in view).toBe(false);
  });

  it('U15: radarAriaLabel に5軸すべての名前が 攻→守→速→制→運 の順で現れ、null の軸は「データなし」', () => {
    const view = buildPlaystyleView({
      extended: makeExtended(),
      lookup: makeLookup({ 打点效率: null }),
      mode: 16,
    });
    // RADAR_AXIS_ORDER を経由しない独立な期待順（軸の並び替えバグを検知するため）
    const order = ['攻', '守', '速', '制', '運'];
    const positions = order.map((axis) => view.radarAriaLabel.indexOf(axis));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(view.radarAriaLabel).toContain('データなし');
  });

  it('U16: modeNote に MODE_LABELS[mode] の文言が含まれる（mode 16 → 王座の間・半荘）', () => {
    const view16 = buildPlaystyleView({ extended: makeExtended(), lookup: makeLookup(), mode: 16 });
    expect(view16.modeNote).toBe('王座の間・半荘の全体分布との比較');

    const view12 = buildPlaystyleView({ extended: makeExtended(), lookup: makeLookup(), mode: 12 });
    expect(view12.modeNote).toBe('玉の間・半荘の全体分布との比較');
  });

  it('U17: 全軸 null（lookup が常に null）で allAxesMissing === true、例外を投げない', () => {
    let view;
    expect(() => {
      view = buildPlaystyleView({ extended: makeExtended(), lookup: () => null, mode: 16 });
    }).not.toThrow();
    expect(view!.allAxesMissing).toBe(true);
  });

  /*
   * 検収（2026-09-06）で「テストの次元が欠けている」と指摘された分。
   * `allAxesMissing` は「レーダー全軸 null **かつ** 傾向全軸 null」の AND で、
   * `&&` を `||` に変えるミューテーションが SURVIVED した（U17 が全 null しか見ていないため）。
   * 三麻では「レーダーの分布だけ欠ける」混在ケースが実際に起こりうるので、両向きを固定する。
   */
  it('U19: レーダー全軸 null でも傾向が出せるなら allAxesMissing === false', () => {
    // レーダーが使う 6 metric だけ分布を落とす。傾向は 追立率/放铳率/默听率/副露率/和了巡数 で成立する
    const view = buildPlaystyleView({
      extended: makeExtended(),
      lookup: makeLookup({ 打点效率: null, 铳点损失: null, 和牌率: null, 立直率: null, 里宝率: null, 一发率: null }),
      mode: 16,
    });

    expect(view.points.every((p) => p.value === null)).toBe(true);
    expect(view.rows.some((r) => r.band !== null)).toBe(true);
    expect(view.allAxesMissing).toBe(false);
  });

  it('U20: 傾向2軸が null でもレーダーが出せるなら allAxesMissing === false', () => {
    // 傾向が使う 6 metric だけ分布を落とす。レーダーは 打点效率/铳点损失/和牌率/里宝率/一发率 で成立する
    const view = buildPlaystyleView({
      extended: makeExtended(),
      lookup: makeLookup({ 立直率: null, 追立率: null, 放铳率: null, 默听率: null, 副露率: null, 和了巡数: null }),
      mode: 16,
    });

    expect(view.rows.every((r) => r.band === null)).toBe(true);
    expect(view.points.some((p) => p.value !== null)).toBe(true);
    expect(view.allAxesMissing).toBe(false);
  });

  it('U18: 一部 metric だけ返るとき calcTendency の項が減っても値が出る（副露率のみ）', () => {
    const view = buildPlaystyleView({
      extended: makeExtended({ 副露率: 2 }),
      lookup: makeLookup({ 默听率: null, 和了巡数: null }),
      mode: 16,
    });
    const speed = view.rows.find((r) => r.key === 'concealedSpeed')!;
    expect(speed.band).toBe(4); // 単一項 z=2 → sqrt(1) で割るのでそのまま2 → band4
  });
});
