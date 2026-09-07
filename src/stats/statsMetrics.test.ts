import { describe, expect, it } from 'vitest';
import { KEY_STAT_METRICS } from '../summary/keyStatsView';
import { COMPARE_METRICS } from '../compare/compareMetrics';
import {
  STAT_SECTIONS,
  STATS_KEY_COVERAGE,
  type StatMetricSpec,
  type StatsKey,
} from './statsMetrics';

describe('statsMetrics', () => {
  // A1-3: 52件・重複なし・Object.keys(STATS_KEY_COVERAGE) と一致・立直好型不在
  it('A1-3: STAT_SECTIONS の statsKey はちょうど52件・重複なしで COVERAGE と一致し、立直好型を含まない', () => {
    const metricRows = STAT_SECTIONS.flatMap((s) => s.rows).filter(
      (r): r is StatMetricSpec => r.kind === 'metric',
    );
    const keys = metricRows.map((r) => r.statsKey);

    expect(keys).toHaveLength(52);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(52);

    const coverageKeys = Object.keys(STATS_KEY_COVERAGE);
    expect(coverageKeys).toHaveLength(52);
    expect(new Set(coverageKeys)).toEqual(uniqueKeys);

    // 立直好型（2なし）がどこにも現れないこと
    expect(keys).not.toContain('立直好型');
    expect(coverageKeys).not.toContain('立直好型');
  });

  // A1-4: 各 statsKey の所属セクションが STATS_KEY_COVERAGE と一致
  it('A1-4: 各 statsKey の所属セクションが STATS_KEY_COVERAGE と一致する', () => {
    for (const section of STAT_SECTIONS) {
      for (const row of section.rows) {
        if (row.kind === 'metric') {
          expect(STATS_KEY_COVERAGE[row.statsKey]).toBe(section.id);
        }
      }
    }
  });

  // A1-8: CLI 準拠の配置
  it('A1-8: CLI 準拠の配置になっている', () => {
    expect(STATS_KEY_COVERAGE['立直率']).toBe('riichi');
    expect(STATS_KEY_COVERAGE['副露率']).toBe('overall2');
    expect(STATS_KEY_COVERAGE['一发率']).toBe('riichi');
    expect(STATS_KEY_COVERAGE['平均起手向听']).toBe('luck');
    expect(STATS_KEY_COVERAGE['平均打点']).toBe('efficiency');
  });

  // A1-9: 立直好型が除外されていること
  it('A1-9: 立直好型2 の行だけが存在し、立直好型（2なし）は存在しない', () => {
    const metricRows = STAT_SECTIONS.flatMap((s) => s.rows).filter(
      (r): r is StatMetricSpec => r.kind === 'metric',
    );
    const riichiGoodShape2Row = metricRows.find((r) => r.statsKey === '立直好型2');
    expect(riichiGoodShape2Row).toBeDefined();
    expect(riichiGoodShape2Row?.label).toBe('立直良形率');

    const rawKeys = metricRows.map((r) => r.statsKey as string);
    expect(rawKeys.filter((k) => k === '立直好型')).toHaveLength(0);
  });

  // A2-1: note の前後に空白を含まないこと、空文字許容、注記あり行の検証
  it('A2-1: 全行の note が trim 済みであり、注記が必要な行では非空である', () => {
    const allRows = STAT_SECTIONS.flatMap((s) => s.rows);
    for (const row of allRows) {
      expect(row.note).toBe(row.note.trim());
    }

    // §2.2 由来で注記が不要なキー（空文字）の集合
    const noNoteKeys = new Set([
      'avgWinTurn',
      'avgWinScore',
      'avgDealInScore',
      'riichiTurn',
      'maxRenchan',
      'yakuman',
      'countedYakuman',
      'maxFan',
      'nagashiMangan',
      'doubleRiichi',
      'avgShanten',
      'avgShantenDealer',
      'avgShantenNonDealer',
    ]);

    for (const row of allRows) {
      if (noNoteKeys.has(row.key)) {
        expect(row.note).toBe('');
      } else {
        expect(row.note.length).toBeGreaterThan(0);
      }
    }
  });

  // A2-9: CLI 実物準拠のラベル訂正
  it('A2-9: CLI 実物準拠のラベル訂正が反映されている', () => {
    const metricRows = STAT_SECTIONS.flatMap((s) => s.rows).filter(
      (r): r is StatMetricSpec => r.kind === 'metric',
    );
    const byKey = new Map(metricRows.map((r) => [r.statsKey, r.label]));

    expect(byKey.get('最大累计番数')).toBe('最大合計飜数');
    expect(byKey.get('平均被炸点数')).toBe('痛い親かぶり平均');
    expect(byKey.get('立直多面')).toBe('立直多面率');
    expect(byKey.get('平均起手向听')).toBe('配牌平均向聴');
    expect(byKey.get('立直后和牌率')).toBe('立直成功率');
    expect(byKey.get('被追率')).toBe('立直後追っかけられ率');
  });

  // A2-10: CLI が明記していた分母注記
  it('A2-10: CLI 明記の分母注記が原文どおりである', () => {
    const metricRows = STAT_SECTIONS.flatMap((s) => s.rows).filter(
      (r): r is StatMetricSpec => r.kind === 'metric',
    );
    const byKey = new Map(metricRows.map((r) => [r.statsKey, r.note]));

    expect(byKey.get('立直收支')).toBe('立直後の収支(供託含む) / 立直回数');
    expect(byKey.get('立直收入')).toBe('立直和了収入(供託含む) / 立直後の和了回数');
    expect(byKey.get('立直支出')).toBe('立直後の放銃支出(供託含む) / 立直後の放銃回数');
    expect(byKey.get('振听立直率')).toBe('立直後の見逃しは含まない');
    expect(byKey.get('立直多面')).toBe('2面待ち以上');
  });

  // A2-12: 既存カードとのラベル一致（表記ゆれ防止）
  it('A2-12: KEY_STAT_METRICS および COMPARE_METRICS とラベルが文字列一致する', () => {
    const metricRows = STAT_SECTIONS.flatMap((s) => s.rows).filter(
      (r): r is StatMetricSpec => r.kind === 'metric',
    );
    const byKey = new Map(metricRows.map((r) => [r.statsKey, r]));

    // KEY_STAT_METRICS との一致
    const keyStatKeys: StatsKey[] = ['和牌率', '放铳率', '副露率', '平均打点', '平均铳点'];
    for (const k of keyStatKeys) {
      const existing = KEY_STAT_METRICS.find((m) => m.statsKey === k);
      expect(existing).toBeDefined();
      expect(byKey.get(k)?.label).toBe(existing?.label);
    }

    // COMPARE_METRICS との一致
    const compareKeys: StatsKey[] = [
      '自摸率',
      '默听率',
      '打点效率',
      '铳点损失',
      '净打点效率',
      '和了巡数',
      '里宝率',
      '一发率',
    ];
    for (const k of compareKeys) {
      const existing = COMPARE_METRICS.find((m) => m.statsKey === k);
      expect(existing).toBeDefined();
      expect(byKey.get(k)?.label).toBe(existing?.label);
    }

    // 立直率は KEY_STAT_METRICS とラベル一致だが所属は riichi
    const riichiRow = byKey.get('立直率');
    const riichiKeyMetric = KEY_STAT_METRICS.find((m) => m.statsKey === '立直率');
    expect(riichiRow?.label).toBe(riichiKeyMetric?.label);
    expect(STATS_KEY_COVERAGE['立直率']).toBe('riichi');
  });

  // A2-14: 未確定項目が被炸率のみ
  it('A2-14: tentative: true の行が被炸率の1件のみである', () => {
    const metricRows = STAT_SECTIONS.flatMap((s) => s.rows).filter(
      (r): r is StatMetricSpec => r.kind === 'metric',
    );
    const tentativeRows = metricRows.filter((r) => r.tentative === true);
    expect(tentativeRows).toHaveLength(1);
    expect(tentativeRows[0].statsKey).toBe('被炸率');
  });

  // A2-15: 分母が実測で確定した4キーの注記
  it('A2-15: 実測で確定した4キーの注記が正しい', () => {
    const metricRows = STAT_SECTIONS.flatMap((s) => s.rows).filter(
      (r): r is StatMetricSpec => r.kind === 'metric',
    );
    const byKey = new Map(metricRows.map((r) => [r.statsKey, r.note]));

    expect(byKey.get('一发率')).toBe('一発回数 / 立直和了回数');
    expect(byKey.get('里宝率')).toBe('裏ドラのある和了回数 / 立直和了回数');
    expect(byKey.get('追立率')).toBe('追っかけ立直をした回数 / 立直回数');
    expect(byKey.get('被追率')).toBe('他家に追いかけ立直された回数 / 立直回数');
  });
});
