import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import rawExtendedFixture from '../api/testdata/player_extended_stats.json';
import { normalizePlayerExtendedStats } from '../api/normalize';
import playerStatsFixture from '../domain/__fixtures__/player_stats_4p.json';
import type { PlayerStats } from '../api';
import { buildGrowthView } from './growthView';
import { buildStatsView } from './statsView';
import { StatsSection } from './StatsSection';

describe('StatsSection & DOM structure', () => {
  const normExtended = normalizePlayerExtendedStats(rawExtendedFixture as any);
  const baseStats: PlayerStats = {
    ...playerStatsFixture,
    rank_rates: [0.26, 0.25, 0.25, 0.24],
    rank_avg_score: [42000, 27000, 21000, 10000],
    played_modes: [16],
  };

  const growth = buildGrowthView({
    level: baseStats.level,
    rankRates: baseStats.rank_rates,
    rankAvgScores: baseStats.rank_avg_score,
    numPlayers: 4,
    selectedModeCount: 1,
    selectedModes: [16],
    maxLevel: baseStats.max_level,
  });

  const sections4p = buildStatsView({
    stats: baseStats,
    extended: normExtended,
    growth,
    baseMode: 16,
    numPlayers: 4,
  });

  // A1-6 & A1-7: 全9セクション・順序・行数（四麻70行）
  it('A1-6 & A1-7: セクションが9個・Issue順序どおりで、四麻の行数が70である', () => {
    const expectedSections = [
      'rank',
      'overall1',
      'overall2',
      'efficiency',
      'growth',
      'riichi',
      'call',
      'distribution',
      'luck',
    ];
    expect(sections4p.map((s) => s.id)).toEqual(expectedSections);

    const totalRows = sections4p.reduce((sum, s) => sum + s.rows.length, 0);
    // 4 + 7 + 8 + 6 + 5 + 16 + 3 + 9 + 12 = 70
    expect(totalRows).toBe(70);
  });

  // A1-7': セクション別の行数
  it('A1-7\': 各セクションの行数が仕様どおりである', () => {
    const counts = sections4p.map((s) => [s.id, s.rows.length]);
    expect(counts).toEqual([
      ['rank', 4],
      ['overall1', 7],
      ['overall2', 8],
      ['efficiency', 6],
      ['growth', 5],
      ['riichi', 16],
      ['call', 3],
      ['distribution', 9],
      ['luck', 12],
    ]);
  });

  // 三麻の行数（69行・rankが3行）
  it('三麻の場合、順位分布が3行で合計69行になる', () => {
    const baseStats3p: PlayerStats = {
      ...baseStats,
      rank_rates: [0.4, 0.35, 0.25],
      rank_avg_score: [40000, 25000, 10000],
    };
    const growth3p = buildGrowthView({
      level: { id: 20501, score: 800, delta: 150 },
      rankRates: baseStats3p.rank_rates,
      rankAvgScores: baseStats3p.rank_avg_score,
      numPlayers: 3,
      selectedModeCount: 1,
      selectedModes: [22],
      maxLevel: baseStats3p.max_level,
    });
    const sections3p = buildStatsView({
      stats: baseStats3p,
      extended: normExtended,
      growth: growth3p,
      baseMode: 22,
      numPlayers: 3,
    });
    expect(sections3p.find((s) => s.id === 'rank')?.rows).toHaveLength(3);
    const total3p = sections3p.reduce((sum, s) => sum + s.rows.length, 0);
    expect(total3p).toBe(69);
  });

  // A1-6': 各セクションが ElevatedCard で包まれていること
  it('A1-6\': 各セクションが ElevatedCard で包まれ、data-section 属性を持つ', () => {
    for (const section of sections4p) {
      const html = renderToStaticMarkup(<StatsSection section={section} />);
      expect(html).toContain(`class="stats-section-card"`);
      expect(html).toContain(`data-section="${section.id}"`);
    }
  });

  // A2-2 & A2-6: 注記の有無と DOM 要素・aria-describedby の整合（修正2・修正3対応）
  it('A2-2 & A2-6: リスト形式セクションでは注記がある行のみ info ボタンと tip 要素が生成され、aria-describedby と role=tooltip が付与される', () => {
    const listSections = sections4p.filter(
      (s) => s.id !== 'rank' && s.id !== 'distribution',
    );

    for (const section of listSections) {
      const html = renderToStaticMarkup(<StatsSection section={section} />);

      for (const row of section.rows) {
        const hasNote = row.note.length > 0;
        const tipId = `tip-${section.id}-${row.key}`;

        // data-row と data-has-note の確認
        expect(html).toContain(`data-row="${row.key}"`);
        expect(html).toContain(
          `data-row="${row.key}" data-has-note="${hasNote ? 'true' : 'false'}"`,
        );

        if (hasNote) {
          // info ボタンが存在し、aria-describedby が付与されている
          expect(html).toContain('stats-row__info-btn');
          expect(html).toContain(`aria-describedby="${tipId}"`);
          expect(html).toContain('stats-row__info-icon');
          // tip 要素が存在し、role="tooltip" と id が付与されている
          expect(html).toContain(`id="${tipId}"`);
          expect(html).toContain(`role="tooltip"`);
          expect(html).toContain(row.note);
        } else {
          // tip 要素も aria-describedby も存在しない
          expect(html).not.toContain(`id="${tipId}"`);
          expect(html).not.toContain(`aria-describedby="${tipId}"`);
        }
      }
    }
  });

  // 修正2: 順位分布と和銃分布は表形式であり注記（ツールチップ）を持たない
  it('修正2: 順位分布と和銃分布は表形式で描画され、ツールチップを持たない', () => {
    const rankSection = sections4p.find((s) => s.id === 'rank')!;
    const rankHtml = renderToStaticMarkup(<StatsSection section={rankSection} />);
    expect(rankHtml).toContain('stats-table--rank');
    expect(rankHtml).toContain('平均点数');
    expect(rankHtml).not.toContain('stats-row__tip');
    expect(rankHtml).not.toContain('stats-row__info-btn');

    const distSection = sections4p.find((s) => s.id === 'distribution')!;
    const distHtml = renderToStaticMarkup(<StatsSection section={distSection} />);
    expect(distHtml).toContain('stats-table--dist');
    expect(distHtml).toContain('和了時の状態');
    expect(distHtml).toContain('放銃時の状態');
    expect(distHtml).toContain('放銃相手の状態');
    expect(distHtml).not.toContain('stats-row__tip');
    expect(distHtml).not.toContain('stats-row__info-btn');
  });

  // A2-8: 要件 §8 の明示例
  it('A2-8: tsumoRate, damatenRate, drawTenpaiRate, riichiGoodShape2 の表示が正しい', () => {
    const html = sections4p.map((s) => renderToStaticMarkup(<StatsSection section={s} />)).join('');

    // ツモ率
    expect(html).toContain('data-row="tsumoRate"');
    expect(html).toContain('和了回数比');

    // 闇聴率
    expect(html).toContain('data-row="damatenRate"');

    // 流局聴牌率
    expect(html).toContain('data-row="drawTenpaiRate"');
    expect(html).toContain('流局回数比');

    // 立直良形率
    expect(html).toContain('data-row="riichiGoodShape2"');
    expect(html).toContain('立直良形率');
    expect(html).toContain('宣言時に待ちが自分から見て6枚以上');
  });

  // A2-11: 立直統計セクションに注記がある
  it('A2-11: 立直統計セクションに警告注記が表示される', () => {
    const riichiSection = sections4p.find((s) => s.id === 'riichi')!;
    const html = renderToStaticMarkup(<StatsSection section={riichiSection} />);

    expect(html).toContain('stats-section__note');
    expect(html).toContain('立直収入と立直支出の差とは必ずしも一致しない');
  });

  // A9-2: 和銃分布セクションの回数表示（和了時3行は約なし、残り6行は約あり）
  it('A9-2: 和銃分布の表内で実測値（約なし）と概算値（約あり）が区別される', () => {
    const distSection = sections4p.find((s) => s.id === 'distribution')!;
    const html = renderToStaticMarkup(<StatsSection section={distSection} />);

    // 実測3行: winStateRiichi, winStateCall, winStateDamaten
    const winKeys = ['winStateRiichi', 'winStateCall', 'winStateDamaten'];
    for (const key of winKeys) {
      const row = distSection.rows.find((r) => r.key === key)!;
      expect(row.countText).not.toContain('約');
      expect(row.countText).toContain('回');
      expect(row.percentText).toContain('%');
      expect(html).toContain(`data-row="${key}"`);
      expect(html).toContain(row.countText!);
      expect(html).toContain(row.percentText!);
    }

    // 概算6行: dealInStateRiichi, dealInStateCall, dealInStateConcealed, dealInTargetRiichi, dealInTargetCall, dealInTargetDamaten
    const estKeys = [
      'dealInStateRiichi',
      'dealInStateCall',
      'dealInStateConcealed',
      'dealInTargetRiichi',
      'dealInTargetCall',
      'dealInTargetDamaten',
    ];
    for (const key of estKeys) {
      const row = distSection.rows.find((r) => r.key === key)!;
      expect(row.countText).toContain('約');
      expect(row.countText).toContain('回');
      expect(row.percentText).toContain('%');
      expect(html).toContain(`data-row="${key}"`);
      expect(html).toContain(row.countText!);
      expect(html).toContain(row.percentText!);
    }
  });
});
