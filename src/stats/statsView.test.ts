import { describe, expect, it } from 'vitest';
import rawExtendedFixture from '../api/testdata/player_extended_stats.json';
import { normalizePlayerExtendedStats } from '../api/normalize';
import playerStatsFixture from '../domain/__fixtures__/player_stats_4p.json';
import type { PlayerExtendedStats, PlayerStats } from '../api';
import {
  buildStatsView,
  formatDistributionValue,
  formatStatValue,
} from './statsView';

describe('statsView', () => {
  const normExtended = normalizePlayerExtendedStats(rawExtendedFixture as any);
  const baseStats: PlayerStats = {
    ...playerStatsFixture,
    rank_rates: [0.25, 0.25, 0.3, 0.2],
    rank_avg_score: [42000, 27000, 21000, 10000],
    played_modes: [16],
  };

  // A4-1: formatStatValue の各 unit とエッジケース
  it('A4-1: formatStatValue が各 unit に応じて正しくフォーマットする', () => {
    expect(formatStatValue(0.36542, 'rate')).toBe('36.5%');
    expect(formatStatValue(5312.4, 'point')).toBe('5,312');
    expect(formatStatValue(-1234, 'point')).toBe('\u22121,234');
    expect(formatStatValue(9.87, 'turn')).toBe('9.87巡');
    expect(formatStatValue(3, 'count', '回')).toBe('3回');
    expect(formatStatValue(12, 'count', '連荘')).toBe('12連荘');
    expect(formatStatValue(3.21, 'shanten')).toBe('3.21');
    expect(formatStatValue(undefined, 'rate')).toBe('—');
    expect(formatStatValue(NaN, 'point')).toBe('—');
  });

  // A4-2: formatMetricValue の委譲確認（丸め再実装なし）
  it('A4-2: formatStatValue は rate/point/turn を formatMetricValue に委譲している', () => {
    // 負の整数の U+2212 マイナス符号が含まれていること
    expect(formatStatValue(-500, 'point')).toBe('\u2212500');
  });

  // A5-1: 親/子向聴の欠落フォールバック（行は残る）
  it('A5-1: 平均起手向听亲/子 が欠落していても行は消えず値が — になる', () => {
    const extWithoutParentChild: PlayerExtendedStats = {
      ...normExtended,
      平均起手向听亲: undefined,
      平均起手向听子: undefined,
    };
    const views = buildStatsView({
      stats: baseStats,
      extended: extWithoutParentChild,
      growth: null,
      baseMode: 16,
      numPlayers: 4,
    });
    const luckSection = views.find((s) => s.id === 'luck');
    expect(luckSection).toBeDefined();

    const parentRow = luckSection?.rows.find((r) => r.key === 'avgShantenDealer');
    expect(parentRow).toBeDefined();
    expect(parentRow?.valueText).toBe('—');

    const childRow = luckSection?.rows.find((r) => r.key === 'avgShantenNonDealer');
    expect(childRow).toBeDefined();
    expect(childRow?.valueText).toBe('—');
  });

  // A5-2: 必須率キーが実行時欠落しても throw せず — になる
  it('A5-2: 実行時 undefined のキーでも throw せず — になる', () => {
    const extCorrupt = { ...normExtended } as Record<string, unknown>;
    delete extCorrupt['流听率'];

    expect(() => {
      const views = buildStatsView({
        stats: baseStats,
        extended: extCorrupt as any,
        growth: null,
        baseMode: 16,
        numPlayers: 4,
      });
      const overall2 = views.find((s) => s.id === 'overall2');
      const drawTenpaiRow = overall2?.rows.find((r) => r.key === 'drawTenpaiRate');
      expect(drawTenpaiRow?.valueText).toBe('—');
    }).not.toThrow();
  });

  // A5-4: 回数系欠落時 0回（normalize の補完）
  it('A5-4: normalize による回数系補完（0回）が表示される', () => {
    const views = buildStatsView({
      stats: baseStats,
      extended: normExtended,
      growth: null,
      baseMode: 16,
      numPlayers: 4,
    });
    const luckSection = views.find((s) => s.id === 'luck');
    // フィクスチャでは 役满: undefined → normalize で 0
    const yakumanRow = luckSection?.rows.find((r) => r.key === 'yakuman');
    expect(yakumanRow?.valueText).toBe('0回');
  });

  // A6-3: 順位分布行数（四麻4行 / 三麻3行）、総合成績1（常に7行）
  it('A6-3: 順位分布は四麻で4行・三麻で3行、総合成績1は常に7行である', () => {
    const views4 = buildStatsView({
      stats: baseStats,
      extended: normExtended,
      growth: null,
      baseMode: 16,
      numPlayers: 4,
    });
    expect(views4.find((s) => s.id === 'rank')?.rows).toHaveLength(4);
    expect(views4.find((s) => s.id === 'overall1')?.rows).toHaveLength(7);

    const baseStats3: PlayerStats = {
      ...baseStats,
      rank_rates: [0.4, 0.35, 0.25],
      rank_avg_score: [40000, 25000, 15000],
    };
    const views3 = buildStatsView({
      stats: baseStats3,
      extended: normExtended,
      growth: null,
      baseMode: 22,
      numPlayers: 3,
    });
    expect(views3.find((s) => s.id === 'rank')?.rows).toHaveLength(3);
    expect(views3.find((s) => s.id === 'overall1')?.rows).toHaveLength(7);
  });

  // A6-6: 四麻の last 行が「逆連対率」、値が 1 - rentaiRate (50.0%)
  it('A6-6: 四麻の last 行が「逆連対率」で値が 50.0%（20.0%ではない）', () => {
    const views = buildStatsView({
      stats: baseStats, // rank_rates: [0.25, 0.25, 0.3, 0.2]
      extended: normExtended,
      growth: null,
      baseMode: 16,
      numPlayers: 4,
    });
    const overall1 = views.find((s) => s.id === 'overall1');
    const lastRow = overall1?.rows.find((r) => r.key === 'last');

    expect(lastRow?.label).toBe('逆連対率');
    expect(lastRow?.valueText).toBe('50.0%');
    expect(lastRow?.valueText).not.toBe('20.0%');
    expect(lastRow?.note).toBe('3位以下（3位+4位）の割合');
  });

  // A6-7: 三麻の last 行が「ラス率」ラベルで、値は同じ式 (25.0%)
  it('A6-7: 三麻の last 行が「ラス率」ラベルで値が 25.0%', () => {
    const baseStats3: PlayerStats = {
      ...baseStats,
      rank_rates: [0.4, 0.35, 0.25],
      rank_avg_score: [40000, 25000, 15000],
    };
    const views = buildStatsView({
      stats: baseStats3,
      extended: normExtended,
      growth: null,
      baseMode: 22,
      numPlayers: 3,
    });
    const overall1 = views.find((s) => s.id === 'overall1');
    const lastRow = overall1?.rows.find((r) => r.key === 'last');

    expect(lastRow?.label).toBe('ラス率');
    expect(lastRow?.valueText).toBe('25.0%');
    expect(lastRow?.note).toBe('3位（最下位）の割合');
  });

  // A9-1: formatDistributionValue の5ケース
  it('A9-1: formatDistributionValue が5ケース表どおりである', () => {
    expect(formatDistributionValue({ count: 21, rate: 0.362, approximate: false })).toBe(
      '21回 / 36.2%',
    );
    expect(formatDistributionValue({ count: 12, rate: 0.265, approximate: true })).toBe(
      '約12回 / 26.5%',
    );
    expect(formatDistributionValue({ count: null, rate: 0.265, approximate: true })).toBe(
      '— / 26.5%',
    );
    expect(formatDistributionValue({ count: 0, rate: null, approximate: false })).toBe(
      '0回 / —',
    );
    expect(formatDistributionValue({ count: null, rate: null, approximate: true })).toBe('—');
  });

  // A9-3: 和了時の回数が API 生カウントそのまま（実測値）
  it('A9-3: 和了時の回数が API 生カウントそのまま（実測値）である', () => {
    const views = buildStatsView({
      stats: baseStats,
      extended: normExtended,
      growth: null,
      baseMode: 16,
      numPlayers: 4,
    });
    const distSection = views.find((s) => s.id === 'distribution')!;
    const riichiRow = distSection.rows.find((r) => r.key === 'winStateRiichi')!;
    const callRow = distSection.rows.find((r) => r.key === 'winStateCall')!;
    const damatenRow = distSection.rows.find((r) => r.key === 'winStateDamaten')!;

    // 生カウント: 立直和了 21, 副露和了 29, 默听和了 8, 合計 58
    expect(riichiRow.valueText).toBe('21回 / 36.2%');
    expect(callRow.valueText).toBe('29回 / 50.0%');
    expect(damatenRow.valueText).toBe('8回 / 13.8%');

    // 「約」を含まないこと
    expect(riichiRow.valueText).not.toContain('約');
    expect(callRow.valueText).not.toContain('約');
    expect(damatenRow.valueText).not.toContain('約');
  });

  // A9-4: 概算回数が round(放铳率 × roundCount × 各率)
  it('A9-4: 概算回数が round(放铳率 × roundCount × 各率) である', () => {
    const synthExtended: PlayerExtendedStats = {
      ...normExtended,
      放铳率: 0.13,
      roundCount: 400,
      放铳时立直率: 0.1538,
    };
    const views = buildStatsView({
      stats: baseStats,
      extended: synthExtended,
      growth: null,
      baseMode: 16,
      numPlayers: 4,
    });
    const distSection = views.find((s) => s.id === 'distribution')!;
    const riichiDealInRow = distSection.rows.find((r) => r.key === 'dealInStateRiichi')!;

    // D = Math.round(0.13 * 400) = 52. Math.round(52 * 0.1538) = 8.
    expect(riichiDealInRow.valueText).toBe('約8回 / 15.4%');
  });

  // A9-5: 放銃率が 0 / undefined / NaN、または roundCount 欠落時
  it('A9-5: 放銃率が 0/NaN または roundCount 欠落時、概算回数を捏造せず — / 割合 になる', () => {
    const extNoDealIn: PlayerExtendedStats = {
      ...normExtended,
      放铳率: 0,
    };
    const views = buildStatsView({
      stats: baseStats,
      extended: extNoDealIn,
      growth: null,
      baseMode: 16,
      numPlayers: 4,
    });
    const distSection = views.find((s) => s.id === 'distribution')!;
    const riichiDealInRow = distSection.rows.find((r) => r.key === 'dealInStateRiichi')!;
    expect(riichiDealInRow.valueText).toBe('— / 15.4%');
  });

  // A9-7: 概算回数の母数が 放銃率 × roundCount に依存すること
  it('A9-7: 放銃率を2倍にすると概算回数が約2倍になる', () => {
    const ext1: PlayerExtendedStats = {
      ...normExtended,
      放铳率: 0.1,
      roundCount: 1000,
      放铳时立直率: 0.2,
    };
    const ext2: PlayerExtendedStats = {
      ...normExtended,
      放铳率: 0.2,
      roundCount: 1000,
      放铳时立直率: 0.2,
    };
    const views1 = buildStatsView({
      stats: baseStats,
      extended: ext1,
      growth: null,
      baseMode: 16,
      numPlayers: 4,
    });
    const views2 = buildStatsView({
      stats: baseStats,
      extended: ext2,
      growth: null,
      baseMode: 16,
      numPlayers: 4,
    });

    const row1 = views1
      .find((s) => s.id === 'distribution')!
      .rows.find((r) => r.key === 'dealInStateRiichi')!;
    const row2 = views2
      .find((s) => s.id === 'distribution')!
      .rows.find((r) => r.key === 'dealInStateRiichi')!;

    // ext1: D=100 -> 20回. ext2: D=200 -> 40回.
    expect(row1.valueText).toContain('約20回');
    expect(row2.valueText).toContain('約40回');
  });

  // A9-9: 2026-09-07 UI調整 表形式化に伴い注記は不要（空文字）で、回数・割合が分離されていること
  it('A9-9: 和銃分布の各行は表形式用フィールド（countText, percentText, subGroup）を持ち、noteは空文字である', () => {
    const views = buildStatsView({
      stats: baseStats,
      extended: normExtended,
      growth: null,
      baseMode: 16,
      numPlayers: 4,
    });
    const distSection = views.find((s) => s.id === 'distribution')!;

    // 全9行で note は空文字（ツールチップ不要）
    for (const row of distSection.rows) {
      expect(row.note).toBe('');
      expect(row.countText).toBeDefined();
      expect(row.percentText).toBeDefined();
    }

    // 和了時3行: 実測値（約なし）、subGroup = 'winState'
    const winKeys = ['winStateRiichi', 'winStateCall', 'winStateDamaten'];
    for (const k of winKeys) {
      const row = distSection.rows.find((r) => r.key === k)!;
      expect(row.countText).not.toContain('約');
      expect(row.countText).toContain('回');
      expect(row.percentText).toContain('%');
      expect(row.subGroup).toBe('winState');
    }

    // 放銃時3行: 概算値（約あり）、subGroup = 'dealInState'
    const dealInStateKeys = [
      'dealInStateRiichi',
      'dealInStateCall',
      'dealInStateConcealed',
    ];
    for (const k of dealInStateKeys) {
      const row = distSection.rows.find((r) => r.key === k)!;
      expect(row.countText).toContain('約');
      expect(row.countText).toContain('回');
      expect(row.percentText).toContain('%');
      expect(row.subGroup).toBe('dealInState');
    }

    // 放銃相手3行: 実測値（約なし）、subGroup = 'dealInTarget'、合計比率100%
    const dealInTargetKeys = [
      'dealInTargetRiichi',
      'dealInTargetCall',
      'dealInTargetDamaten',
    ];
    const targetExpected: Record<string, { count: string; percent: string; value: string }> = {
      dealInTargetRiichi: { count: '136回', percent: '50.6%', value: '136回 / 50.6%' },
      dealInTargetCall: { count: '102回', percent: '37.9%', value: '102回 / 37.9%' },
      dealInTargetDamaten: { count: '31回', percent: '11.5%', value: '31回 / 11.5%' },
    };
    for (const k of dealInTargetKeys) {
      const row = distSection.rows.find((r) => r.key === k)!;
      expect(row.countText).not.toContain('約');
      expect(row.countText).toBe(targetExpected[k].count);
      expect(row.percentText).toBe(targetExpected[k].percent);
      expect(row.valueText).toBe(targetExpected[k].value);
      expect(row.subGroup).toBe('dealInTarget');
    }
  });

  // A6-5: 2026-09-07 UI調整 順位分布の各行は表形式用フィールド（countText, percentText, avgScoreText）を持ち、noteは空文字
  it('A6-5: 順位分布の各行は表形式用フィールドを持ち、noteは空文字である', () => {
    const views = buildStatsView({
      stats: baseStats,
      extended: normExtended,
      growth: null,
      baseMode: 16,
      numPlayers: 4,
    });
    const rankSection = views.find((s) => s.id === 'rank')!;
    for (const row of rankSection.rows) {
      expect(row.note).toBe('');
      expect(row.countText).toBeDefined();
      expect(row.countText).toContain('回');
      expect(row.percentText).toBeDefined();
      expect(row.percentText).toContain('%');
      expect(row.avgScoreText).toBeDefined();
      expect(row.avgScoreText).toContain('点');
    }
  });

  // A9-10: 行数が9であること
  it('A9-10: 和銃分布セクションの行数が9である', () => {
    const views = buildStatsView({
      stats: baseStats,
      extended: normExtended,
      growth: null,
      baseMode: 16,
      numPlayers: 4,
    });
    const distSection = views.find((s) => s.id === 'distribution')!;
    expect(distSection.rows).toHaveLength(9);
  });
});
