import { describe, expect, it, vi } from 'vitest';
import playerStatsFixture from '../domain/__fixtures__/player_stats_4p.json';
import {
  expectedPointPerGame,
  formatAdjustedScore,
  gamesToDemotion,
  gamesToPromotion,
  getLevelTagFromId,
  parseLevelId,
  preferredMode,
  projectAfterGames,
} from '../domain';
import * as domainModule from '../domain';
import { effectiveLevelPoint } from '../summary/identityView';
import {
  buildGrowthView,
  PROJECTION_GAMES,
  type GrowthInput,
} from './growthView';

describe('growthView', () => {
  const baseFixture = playerStatsFixture;
  const defaultInput: GrowthInput = {
    level: baseFixture.level,
    rankRates: baseFixture.rank_rates,
    rankAvgScores: baseFixture.rank_avg_score,
    numPlayers: 4,
    selectedModeCount: 1,
    selectedModes: [16],
    maxLevel: baseFixture.max_level,
  };

  // A3-2: expectedPointPerGame の直接呼び出しと一致
  it('A3-2: expectedPointPerGame を直接呼んだ値と buildGrowthView の生値が一致する', () => {
    const eff = effectiveLevelPoint(defaultInput.level);
    const effLevel = parseLevelId(eff.levelId);
    const mode = preferredMode(eff.levelId)!;

    const directExpected = expectedPointPerGame(
      defaultInput.rankRates,
      defaultInput.rankAvgScores,
      mode,
      effLevel,
    );

    const view = buildGrowthView(defaultInput);
    expect(view.expectedPoint).not.toBeNull();
    expect(view.expectedPoint!).toBeCloseTo(directExpected, 10);

    const row = view.rows.find((r) => r.key === 'expectedPoint');
    expect(row).toBeDefined();
    expect(row?.valueText).toContain('pt/戦');
  });

  // A3-3: gamesToBoundary 行の検証
  it('A3-3: gamesToBoundary 行が期待値正/負/0/null に応じて正しく分岐する', () => {
    // 期待値 > 0 のとき: 昇段まで
    const positiveRates = [0.4, 0.3, 0.2, 0.1];
    const viewPositive = buildGrowthView({
      ...defaultInput,
      rankRates: positiveRates,
    });
    const epPos = viewPositive.expectedPoint!;
    expect(epPos).toBeGreaterThan(0);
    const rowPos = viewPositive.rows.find((r) => r.key === 'gamesToBoundary');
    expect(rowPos?.label).toBe('昇段まで');
    const eff = effectiveLevelPoint(defaultInput.level);
    const expectedProm = gamesToPromotion(eff, epPos);
    expect(rowPos?.valueText).toBe(`${expectedProm}戦`);

    // 期待値 < 0 のとき: 降段まで
    const negativeRates = [0.1, 0.1, 0.2, 0.6]; // 4位率が極めて高い
    const viewNegative = buildGrowthView({
      ...defaultInput,
      rankRates: negativeRates,
    });
    const epNeg = viewNegative.expectedPoint!;
    expect(epNeg).toBeLessThan(0);
    const rowNeg = viewNegative.rows.find((r) => r.key === 'gamesToBoundary');
    expect(rowNeg?.label).toBe('降段まで');
    const expectedDem = gamesToDemotion(eff, epNeg);
    expect(rowNeg?.valueText).toBe(`${expectedDem}戦`);

    // 期待値 === null のとき: 昇降段まで / —
    const viewInvalid = buildGrowthView({
      ...defaultInput,
      rankRates: [0.25, 0.25, 0.5], // 長さ不整合
    });
    const rowInvalid = viewInvalid.rows.find((r) => r.key === 'gamesToBoundary');
    expect(rowInvalid?.label).toBe('昇降段まで');
    expect(rowInvalid?.valueText).toBe('—');
  });

  // A3-4: 50戦後の見込み（段位Ptは小数点以下四捨五入）
  it('A3-4: projection50 が projectAfterGames(eff, delta, 50) の四捨五入結果と一致し PROJECTION_GAMES が 50', () => {
    expect(PROJECTION_GAMES).toBe(50);

    const view = buildGrowthView(defaultInput);
    const eff = effectiveLevelPoint(defaultInput.level);
    const expectedProj = projectAfterGames(eff, view.expectedPoint!, 50);
    const projLevel = parseLevelId(expectedProj.levelId);
    const expectedText = `${getLevelTagFromId(expectedProj.levelId)} ${formatAdjustedScore(projLevel, Math.round(expectedProj.point))}`;

    const row = view.rows.find((r) => r.key === 'projection50');
    expect(row?.valueText).toBe(expectedText);
    expect(row?.note).toContain('50戦');

    // 小数点を含む期待値で確実に四捨五入されて整数になることを検証
    // defaultInput (expectedPoint が小数を含むケース) で「.」がスコア部に含まれないこと（魂天以外）
    const scorePart = row?.valueText.split(' ')[1]; // 例: '1074/2000'
    const currentPtStr = scorePart?.split('/')[0];
    expect(currentPtStr).not.toContain('.');
  });

  // A3-5: estimateStableLevel2 に渡す引数が生の id/score/delta であること
  it('A3-5: estimateStableLevel2 に渡す引数が生の identity.level (id/score/delta) である', () => {
    const spy = vi.spyOn(domainModule, 'estimateStableLevel2');

    // score + delta が上限を超えるケースを用意（正規化すると id が変わるもの）
    // 雀聖1(10501) 上限2000 に対し score=1900, delta=200
    const rawLevel = { id: 10501, score: 1900, delta: 200 };
    buildGrowthView({
      ...defaultInput,
      level: rawLevel,
    });

    expect(spy).toHaveBeenCalled();
    const lastCall = spy.mock.calls[spy.mock.calls.length - 1];
    const passedInput = lastCall[0];
    expect(passedInput.levelId).toBe(10501);
    expect(passedInput.score).toBe(1900);
    expect(passedInput.delta).toBe(200);

    spy.mockRestore();
  });

  // A3-6: StableLevel 4種の表示
  it('A3-6: StableLevel 4種の表示が仕様どおりフォーマットされる', () => {
    const spy = vi.spyOn(domainModule, 'estimateStableLevel2');

    // 1. kind: 'number'
    spy.mockReturnValueOnce({ kind: 'number', value: 4.07 });
    const v1 = buildGrowthView(defaultInput);
    expect(v1.rows.find((r) => r.key === 'stableLevel')?.valueText).toBe('雀聖1.07');

    // 2. kind: 'level', bound: 'plus'
    spy.mockReturnValueOnce({ kind: 'level', levelId: 10503, bound: 'plus', expectedPoint: 10 });
    const v2 = buildGrowthView(defaultInput);
    expect(v2.rows.find((r) => r.key === 'stableLevel')?.valueText).toBe('雀聖3+');

    // bound: 'minus'
    spy.mockReturnValueOnce({ kind: 'level', levelId: 10101, bound: 'minus', expectedPoint: -5 });
    const v2m = buildGrowthView(defaultInput);
    expect(v2m.rows.find((r) => r.key === 'stableLevel')?.valueText).toBe('初心1\u2212');

    // 3. kind: 'konten'
    spy.mockReturnValueOnce({ kind: 'konten', levelId: 10701, expectedPoint: 20 });
    const v3 = buildGrowthView(defaultInput);
    expect(v3.rows.find((r) => r.key === 'stableLevel')?.valueText).toBe('魂天+');

    // 4. kind: 'unavailable'
    spy.mockReturnValueOnce({ kind: 'unavailable' });
    const v4 = buildGrowthView(defaultInput);
    expect(v4.rows.find((r) => r.key === 'stableLevel')?.valueText).toBe('—');

    spy.mockRestore();
  });

  // A3-7: 例外を投げないこと（ガード検証）
  it('A3-7: 不正な入力でも例外を投げず、全行 — の GrowthView を返す', () => {
    // 1. 長さ不一致（長さ3でnumPlayers=4）
    expect(() => {
      const v = buildGrowthView({
        ...defaultInput,
        rankRates: [0.3, 0.3, 0.4],
        rankAvgScores: [30000, 20000, 10000],
      });
      expect(v.expectedPoint).toBeNull();
      expect(v.rows.find((r) => r.key === 'expectedPoint')?.valueText).toBe('—');
    }).not.toThrow();

    // 2. NaN 混入
    expect(() => {
      const v = buildGrowthView({
        ...defaultInput,
        rankRates: [NaN, 0.25, 0.25, 0.25],
      });
      expect(v.expectedPoint).toBeNull();
      expect(v.rows.find((r) => r.key === 'expectedPoint')?.valueText).toBe('—');
    }).not.toThrow();

    // 3. preferredMode が null（存在しない levelId）
    expect(() => {
      const v = buildGrowthView({
        ...defaultInput,
        level: { id: 99999, score: 0, delta: 0 },
      });
      expect(v.expectedPoint).toBeNull();
      expect(v.rows.find((r) => r.key === 'expectedPoint')?.valueText).toBe('—');
    }).not.toThrow();
  });

  // A3-9: 基準卓の注記
  it('A3-9: 基準卓の注記が複数選択・単一不一致・単一致で正しく出る', () => {
    // 複数選択: [16, 12] → 注記あり（王座を含む）
    const vMulti = buildGrowthView({
      ...defaultInput,
      selectedModeCount: 2,
      selectedModes: [16, 12],
    });
    expect(vMulti.note).not.toBeNull();
    expect(vMulti.note).toContain('王座');

    // 単一選択かつ基準卓（16）と一致 → 注記なし
    const vSingleMatch = buildGrowthView({
      ...defaultInput,
      selectedModeCount: 1,
      selectedModes: [16],
    });
    expect(vSingleMatch.note).toBeNull();

    // 単一選択だが基準卓（16）と不一致（12） → 注記あり
    const vSingleMismatch = buildGrowthView({
      ...defaultInput,
      selectedModeCount: 1,
      selectedModes: [12],
    });
    expect(vSingleMismatch.note).not.toBeNull();
    expect(vSingleMismatch.note).toContain('王座');
  });

  // A3-11: 最高段位行
  it('A3-11: 最高段位行が maxLevel から取得され、行数が常に5行である', () => {
    const v = buildGrowthView(defaultInput);
    expect(v.rows).toHaveLength(5);
    const maxRow = v.rows.find((r) => r.key === 'maxLevel');
    expect(maxRow?.valueText).toBe('雀聖1');

    const vNull = buildGrowthView({
      ...defaultInput,
      maxLevel: null,
    });
    expect(vNull.rows.find((r) => r.key === 'maxLevel')?.valueText).toBe('—');
  });
});
