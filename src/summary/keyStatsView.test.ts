import { describe, it, expect } from 'vitest';
import { buildKeyStatsView, KEY_STAT_METRICS } from './keyStatsView';
import type { PlayerExtendedStats } from '../api';
import extendedFixture from '../api/testdata/player_extended_stats.json';

const extended = extendedFixture as unknown as PlayerExtendedStats;

function makeExtended(overrides: Partial<PlayerExtendedStats> = {}): PlayerExtendedStats {
  return {
    roundCount: 100,
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
    ...overrides,
  } as PlayerExtendedStats;
}

describe('KEY_STAT_METRICS: 順序・件数', () => {
  it('6件・厳密な順序', () => {
    const view = buildKeyStatsView({ extended: makeExtended(), meanOf: () => null, mode: 16 });
    expect(view.tiles.map((t) => t.key)).toStrictEqual([
      'winRate',
      'dealInRate',
      'riichiRate',
      'callRate',
      'avgWinScore',
      'avgDealInScore',
    ]);
  });

  it('meanOf が全て null を返しても長さ6のまま', () => {
    const view = buildKeyStatsView({ extended: makeExtended(), meanOf: () => null, mode: 16 });
    expect(view.tiles).toHaveLength(6);
  });

  it('KEY_STAT_METRICS 自体も6件', () => {
    expect(KEY_STAT_METRICS).toHaveLength(6);
  });
});

describe('buildKeyStatsView: 値の整形', () => {
  it('実フィクスチャの値がそのまま整形される', () => {
    const view = buildKeyStatsView({ extended, meanOf: () => null, mode: 16 });
    expect(view.tiles.map((t) => t.valueText)).toStrictEqual([
      '45.4%',
      '12.4%',
      '21.1%',
      '37.1%',
      '5,312',
      '4,821',
    ]);
  });
});

describe('buildKeyStatsView: 率系の差分', () => {
  it('和了率が卓平均より高い→▲・good', () => {
    const view = buildKeyStatsView({
      extended: makeExtended({ 和牌率: 0.4536 }),
      meanOf: (k) => (k === '和牌率' ? 0.4412 : null),
      mode: 16,
    });
    const tile = view.tiles.find((t) => t.key === 'winRate')!;
    expect(tile.delta?.text).toBe('+1.2%');
    expect(tile.delta?.glyph).toBe('▲');
    expect(tile.delta?.sign).toBe('up');
    expect(tile.delta?.tone).toBe('good');
  });
});

describe('buildKeyStatsView: 放銃率の向き（完了条件2の核）', () => {
  it('放銃率が卓平均より低い→▼だが良い(good)', () => {
    const view = buildKeyStatsView({
      extended: makeExtended({ 放铳率: 0.1237 }),
      meanOf: (k) => (k === '放铳率' ? 0.132 : null),
      mode: 16,
    });
    const tile = view.tiles.find((t) => t.key === 'dealInRate')!;
    expect(tile.delta?.glyph).toBe('▼');
    expect(tile.delta?.tone).toBe('good');
  });

  it('放銃率が卓平均より高い→▲だが悪い(bad)', () => {
    const view = buildKeyStatsView({
      extended: makeExtended({ 放铳率: 0.1237 }),
      meanOf: (k) => (k === '放铳率' ? 0.115 : null),
      mode: 16,
    });
    const tile = view.tiles.find((t) => t.key === 'dealInRate')!;
    expect(tile.delta?.glyph).toBe('▲');
    expect(tile.delta?.tone).toBe('bad');
  });
});

describe('buildKeyStatsView: 打点系の差分', () => {
  it('平均打点: +312・good', () => {
    const view = buildKeyStatsView({
      extended: makeExtended({ 平均打点: 5312 }),
      meanOf: (k) => (k === '平均打点' ? 5000 : null),
      mode: 16,
    });
    const tile = view.tiles.find((t) => t.key === 'avgWinScore')!;
    expect(tile.delta?.text).toBe('+312');
    expect(tile.delta?.tone).toBe('good');
  });

  it('平均放銃点: マイナス表記はU+2212・3桁区切り・good', () => {
    const view = buildKeyStatsView({
      extended: makeExtended({ 平均铳点: 4821 }),
      meanOf: (k) => (k === '平均铳点' ? 6025 : null),
      mode: 16,
    });
    const tile = view.tiles.find((t) => t.key === 'avgDealInScore')!;
    expect(tile.delta?.text).toBe('−1,204');
    expect(tile.delta?.text.charCodeAt(0)).toBe(0x2212);
    expect(tile.delta?.tone).toBe('good');
  });
});

describe('buildKeyStatsView: 中立指標（立直率・副露率）', () => {
  it('立直率: 差分が正でもneutral', () => {
    const view = buildKeyStatsView({
      extended: makeExtended({ 立直率: 0.2113 }),
      meanOf: (k) => (k === '立直率' ? 0.19 : null),
      mode: 16,
    });
    expect(view.tiles.find((t) => t.key === 'riichiRate')?.delta?.tone).toBe('neutral');
  });

  it('立直率: 差分が負でもneutral', () => {
    const view = buildKeyStatsView({
      extended: makeExtended({ 立直率: 0.2113 }),
      meanOf: (k) => (k === '立直率' ? 0.23 : null),
      mode: 16,
    });
    expect(view.tiles.find((t) => t.key === 'riichiRate')?.delta?.tone).toBe('neutral');
  });

  it('副露率: 差分が正でも負でもneutral', () => {
    const up = buildKeyStatsView({
      extended: makeExtended({ 副露率: 0.3711 }),
      meanOf: (k) => (k === '副露率' ? 0.3 : null),
      mode: 16,
    });
    const down = buildKeyStatsView({
      extended: makeExtended({ 副露率: 0.3711 }),
      meanOf: (k) => (k === '副露率' ? 0.4 : null),
      mode: 16,
    });
    expect(up.tiles.find((t) => t.key === 'callRate')?.delta?.tone).toBe('neutral');
    expect(down.tiles.find((t) => t.key === 'callRate')?.delta?.tone).toBe('neutral');
  });
});

describe('buildKeyStatsView: ゼロ差分', () => {
  it('率系: sign=flat・glyph=±・text=±0.0%・tone=neutral（directionがlowerでも）', () => {
    const view = buildKeyStatsView({
      extended: makeExtended({ 放铳率: 0.1237 }),
      meanOf: (k) => (k === '放铳率' ? 0.1237 : null),
      mode: 16,
    });
    const tile = view.tiles.find((t) => t.key === 'dealInRate')!;
    expect(tile.delta?.sign).toBe('flat');
    expect(tile.delta?.glyph).toBe('±');
    expect(tile.delta?.text).toBe('±0.0%');
    expect(tile.delta?.tone).toBe('neutral');
  });

  it('打点系: sign=flat・glyph=±・text=±0・tone=neutral（directionがlowerでも）', () => {
    const view = buildKeyStatsView({
      extended: makeExtended({ 平均铳点: 4821 }),
      meanOf: (k) => (k === '平均铳点' ? 4821 : null),
      mode: 16,
    });
    const tile = view.tiles.find((t) => t.key === 'avgDealInScore')!;
    expect(tile.delta?.sign).toBe('flat');
    expect(tile.delta?.glyph).toBe('±');
    expect(tile.delta?.text).toBe('±0');
    expect(tile.delta?.tone).toBe('neutral');
  });
});

describe('buildKeyStatsView: 比較不可', () => {
  it('meanOf が常にnullなら全6タイルのdeltaがnull・comparable=false・aria末尾が固定文言', () => {
    const view = buildKeyStatsView({ extended, meanOf: () => null, mode: 16 });
    expect(view.tiles.every((t) => t.delta === null)).toBe(true);
    expect(view.comparable).toBe(false);
    for (const tile of view.tiles) {
      expect(tile.ariaLabel.endsWith('卓平均と比較できません')).toBe(true);
    }
    // 値は通常どおり出ている
    expect(view.tiles.map((t) => t.valueText)).toStrictEqual([
      '45.4%',
      '12.4%',
      '21.1%',
      '37.1%',
      '5,312',
      '4,821',
    ]);
  });
});
