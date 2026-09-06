import { describe, it, expect } from 'vitest';
import { buildWinLoseView } from './winLoseView';
import type { PlayerExtendedStats } from '../api';

/** 実レスポンス相当の値だけを上書きし、その他は 0 で埋めたテスト用 extended を作る */
function makeExtended(overrides: Partial<PlayerExtendedStats> = {}): PlayerExtendedStats {
  return {
    roundCount: 194,
    最大连庄: 0,
    最大累计番数: 0,
    役满: 0,
    累计役满: 0,
    W立直: 0,
    流满: 0,
    和牌率: 0.4536,
    自摸率: 0,
    默听率: 0,
    放铳率: 0.1237,
    副露率: 0.3711,
    立直率: 0.2113,
    平均打点: 5312,
    和了巡数: 0,
    平均铳点: 4821,
    流局率: 0,
    流听率: 0,
    一发率: 0,
    里宝率: 0,
    被炸率: 0,
    平均被炸点数: 0,
    放铳时立直率: 0,
    放铳时副露率: 0,
    立直后放铳率: 0,
    立直后非瞬间放铳率: 0,
    副露后放铳率: 0,
    立直后和牌率: 0,
    副露后和牌率: 0,
    立直后流局率: 0,
    副露后流局率: 0,
    放铳至立直: 0,
    放铳至副露: 0,
    放铳至默听: 0,
    立直和了: 21,
    副露和了: 29,
    默听和了: 8,
    立直巡目: 0,
    立直收支: 0,
    立直收入: 0,
    立直支出: 0,
    先制率: 0,
    追立率: 0,
    被追率: 0,
    振听立直率: 0,
    立直好型: 0,
    立直好型2: 0,
    立直多面: 0,
    打点效率: 0,
    铳点损失: 0,
    净打点效率: 0,
    平均起手向听: 0,
    ...overrides,
  } as PlayerExtendedStats;
}

describe('winLoseView: buildWinLoseView', () => {
  it('U1: 常に長さ3の donuts を返し、key が winState/dealInState/dealInTarget の順', () => {
    const view = buildWinLoseView(makeExtended());
    expect(view.donuts).toHaveLength(3);
    expect(view.donuts.map((d) => d.key)).toEqual(['winState', 'dealInState', 'dealInTarget']);
  });

  it('U2: winState の percentText が実レスポンス相当の値で36.2/50.0/13.8になり、合計が100.0', () => {
    const view = buildWinLoseView(makeExtended());
    const winState = view.donuts.find((d) => d.key === 'winState')!;
    expect(winState.slices).not.toBeNull();
    const texts = winState.slices!.map((s) => s.percentText);
    expect(texts).toEqual(['36.2', '50.0', '13.8']);
    const total = texts.reduce((sum, t) => sum + Number(t), 0);
    expect(total).toBeCloseTo(100.0, 6);
  });

  it('U3: 端数が均等に割れる入力で最大剰余法の同値端数規則（添字の小さい方が先）が効く', () => {
    const view = buildWinLoseView(makeExtended({ 立直和了: 1, 副露和了: 1, 默听和了: 1 }));
    const winState = view.donuts.find((d) => d.key === 'winState')!;
    const texts = winState.slices!.map((s) => s.percentText);
    expect(texts).toEqual(['33.4', '33.3', '33.3']);
    const total = texts.reduce((sum, t) => sum + Number(t), 0);
    expect(total).toBeCloseTo(100.0, 6);
  });

  it('U4: dealInState が放铳时立直率/副露率から算出され、3スライス目のラベルが「門前」', () => {
    const view = buildWinLoseView(
      makeExtended({ 放铳率: 0.1237, 放铳时立直率: 0.1538, 放铳时副露率: 0.4615 }),
    );
    const dealInState = view.donuts.find((d) => d.key === 'dealInState')!;
    expect(dealInState.slices).not.toBeNull();
    const texts = dealInState.slices!.map((s) => s.percentText);
    expect(texts).toEqual(['15.4', '46.1', '38.5']);
    const total = texts.reduce((sum, t) => sum + Number(t), 0);
    expect(total).toBeCloseTo(100.0, 6);
    expect(dealInState.slices![2].label).toBe('門前');
  });

  it('U5: dealInTarget が放铳至*から算出され、3スライス目のラベルが「黙聴」', () => {
    const view = buildWinLoseView(
      makeExtended({ 放铳至立直: 0.1875, 放铳至副露: 0.5, 放铳至默听: 0.3125 }),
    );
    const dealInTarget = view.donuts.find((d) => d.key === 'dealInTarget')!;
    expect(dealInTarget.slices).not.toBeNull();
    const texts = dealInTarget.slices!.map((s) => s.percentText);
    expect(texts).toEqual(['18.8', '50.0', '31.2']);
    expect(dealInTarget.slices![2].label).toBe('黙聴');
  });

  it('U6: 3枚とも slice の key が hand-riichi/hand-furo/hand-menzen の順で一致する', () => {
    const view = buildWinLoseView(
      makeExtended({
        放铳率: 0.1237,
        放铳时立直率: 0.1538,
        放铳时副露率: 0.4615,
        放铳至立直: 0.1875,
        放铳至副露: 0.5,
        放铳至默听: 0.3125,
      }),
    );
    for (const donut of view.donuts) {
      expect(donut.slices!.map((s) => s.key)).toEqual(['hand-riichi', 'hand-furo', 'hand-menzen']);
    }
  });

  it('U7: 和了0のとき winState.slices が null で他の2枚は null でない', () => {
    const view = buildWinLoseView(
      makeExtended({
        立直和了: 0,
        副露和了: 0,
        默听和了: 0,
        放铳率: 0.1237,
        放铳时立直率: 0.1538,
        放铳时副露率: 0.4615,
        放铳至立直: 0.1875,
        放铳至副露: 0.5,
        放铳至默听: 0.3125,
      }),
    );
    const winState = view.donuts.find((d) => d.key === 'winState')!;
    const dealInState = view.donuts.find((d) => d.key === 'dealInState')!;
    const dealInTarget = view.donuts.find((d) => d.key === 'dealInTarget')!;
    expect(winState.slices).toBeNull();
    expect(dealInState.slices).not.toBeNull();
    expect(dealInTarget.slices).not.toBeNull();
  });

  it('U8: 放铳率0のとき dealInState と dealInTarget が null で winState は描かれる', () => {
    const view = buildWinLoseView(
      makeExtended({
        放铳率: 0,
        放铳时立直率: 0,
        放铳时副露率: 0,
        放铳至立直: 0,
        放铳至副露: 0,
        放铳至默听: 0,
      }),
    );
    const winState = view.donuts.find((d) => d.key === 'winState')!;
    const dealInState = view.donuts.find((d) => d.key === 'dealInState')!;
    const dealInTarget = view.donuts.find((d) => d.key === 'dealInTarget')!;
    expect(winState.slices).not.toBeNull();
    expect(dealInState.slices).toBeNull();
    expect(dealInTarget.slices).toBeNull();
  });

  it('U9: 立直和了に undefined を混ぜた入力で winState.slices が null になる（NaNの弧が出ない）', () => {
    const extended = makeExtended({ 立直和了: undefined as unknown as number });
    const view = buildWinLoseView(extended);
    const winState = view.donuts.find((d) => d.key === 'winState')!;
    expect(winState.slices).toBeNull();
  });

  it('U10: ariaLabelが「タイトル ラベル %値% …」の形になる', () => {
    const view = buildWinLoseView(makeExtended());
    const winState = view.donuts.find((d) => d.key === 'winState')!;
    expect(winState.ariaLabel).toBe('和了時の状態 立直 36.2% 副露 50.0% 黙聴 13.8%');
  });

  it('slices が null のときの ariaLabel は「タイトル データなし」', () => {
    const view = buildWinLoseView(
      makeExtended({ 立直和了: 0, 副露和了: 0, 默听和了: 0 }),
    );
    const winState = view.donuts.find((d) => d.key === 'winState')!;
    expect(winState.ariaLabel).toBe('和了時の状態 データなし');
  });
});
