import { describe, it, expect } from 'vitest';
import { normalizePlayerStats, normalizePlayerExtendedStats, normalizePlayerSearchResult } from './normalize';
import type { RawPlayerStats, RawPlayerExtendedStats, RawPlayerSearchResult } from './types';
import playerExtendedStatsFixture from './testdata/player_extended_stats.json';
import playerStatsFixture from './testdata/player_stats.json';
import searchPlayerFixture from './testdata/search_player.json';

const extendedStatsRaw = playerExtendedStatsFixture as unknown as RawPlayerExtendedStats;
const playerStatsRaw = playerStatsFixture as unknown as RawPlayerStats;
const searchPlayerRaw = searchPlayerFixture as unknown as RawPlayerSearchResult[];

describe('normalizePlayerExtendedStats', () => {
  // T1
  it('回数系6キーの欠落フィールドは0で補完され、存在するキーは実値を保持する', () => {
    const result = normalizePlayerExtendedStats(extendedStatsRaw);

    // フィクスチャで省略されているキー → 0 補完
    expect(result.役满).toBe(0);
    expect(result.累计役满).toBe(0);
    expect(result.W立直).toBe(0);
    expect(result.流满).toBe(0);

    // フィクスチャに存在するキー → 実値保持
    expect(result.最大连庄).toBe(2);
    expect(result.最大累计番数).toBe(7);
  });

  // T2 (count 改名 / roundCount)
  it('count が roundCount に改名され、公開型に count フィールドが残らない', () => {
    const result = normalizePlayerExtendedStats(extendedStatsRaw);

    expect(result.roundCount).toBe(extendedStatsRaw.count);
    expect(Object.prototype.hasOwnProperty.call(result, 'count')).toBe(false);
  });

  it('id / played_modes はワイヤに含まれても公開型に含まれない', () => {
    const result = normalizePlayerExtendedStats(extendedStatsRaw);

    expect(Object.prototype.hasOwnProperty.call(result, 'id')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(result, 'played_modes')).toBe(false);
  });

  it('最近大铳の start_time（秒）が recentBigLoss.startedAtMs（ミリ秒 number）に変換される', () => {
    const result = normalizePlayerExtendedStats(extendedStatsRaw);
    const rawStartTimeSec = extendedStatsRaw.最近大铳?.start_time;
    // フィクスチャに実際に値があることを前提にする（無ければこのテストは何も検証しない）
    expect(rawStartTimeSec).toBeDefined();

    expect(result.recentBigLoss).toBeDefined();
    expect(typeof result.recentBigLoss?.startedAtMs).toBe('number');
    // 期待値は実装の式をコピーせず、フィクスチャの実測値から独立に計算する（設計書 §1.3 C）
    expect(result.recentBigLoss?.startedAtMs).toBe(1618494843 * 1000);
    expect(rawStartTimeSec).toBe(1618494843);
    expect(result.recentBigLoss?.id).toBe(extendedStatsRaw.最近大铳?.id);
  });

  it('母数条件により欠落しうるフィールド（平均起手向听子）は0補完せず undefined のまま', () => {
    expect(extendedStatsRaw.平均起手向听子).toBeUndefined();
    const result = normalizePlayerExtendedStats(extendedStatsRaw);
    expect(result.平均起手向听子).toBeUndefined();
  });
});

describe('normalizePlayerStats', () => {
  // T2 (count 改名 / gameCount, latest_timestamp → lastPlayedAtMs は search_player 側だが
  //     PlayerStats.count → gameCount の改名はここで検証する)
  it('count が gameCount に改名され、公開型に count フィールドが残らない', () => {
    const result = normalizePlayerStats(playerStatsRaw);

    expect(result.gameCount).toBe(playerStatsRaw.count);
    expect(Object.prototype.hasOwnProperty.call(result, 'count')).toBe(false);
    expect(result.level).toEqual(playerStatsRaw.level);
    expect(result.played_modes).toEqual(playerStatsRaw.played_modes);
  });
});

describe('normalizePlayerSearchResult', () => {
  // T2 (秒単位 latest_timestamp → ミリ秒 number 化)
  it('latest_timestamp（秒）が lastPlayedAtMs（ミリ秒 number）に正しく変換される', () => {
    const [raw] = searchPlayerRaw;
    expect(raw.latest_timestamp).toBe(1618494843);
    const result = normalizePlayerSearchResult(raw);

    expect(typeof result.lastPlayedAtMs).toBe('number');
    // 期待値は実装の式をコピーせず、フィクスチャの実測値から独立に計算する（設計書 §1.3 C）
    expect(result.lastPlayedAtMs).toBe(1618494843 * 1000);
    expect(result.id).toBe(raw.id);
    expect(result.nickname).toBe(raw.nickname);
  });
});

describe('公開結果の不変性（PR #22 再レビュー指摘2: キャッシュ由来オブジェクトのインスタンス共有）', () => {
  it('normalizePlayerStats の結果はトップレベル・ネストしたオブジェクト・配列とも凍結されている', () => {
    const result = normalizePlayerStats(playerStatsRaw);

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.level)).toBe(true);
    expect(Object.isFrozen(result.rank_rates)).toBe(true);

    // strict mode（ESモジュール）なので、凍結済みへの書き込みは TypeError で即座に落ちる
    expect(() => {
      result.rank_rates.sort();
    }).toThrow(TypeError);
    expect(() => {
      result.level.score = 9999;
    }).toThrow(TypeError);
  });

  it('normalizePlayerExtendedStats の結果は recentBigLoss.fans まで再帰的に凍結されている', () => {
    const result = normalizePlayerExtendedStats(extendedStatsRaw);

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.recentBigLoss)).toBe(true);
    expect(Object.isFrozen(result.recentBigLoss?.fans)).toBe(true);
    expect(Object.isFrozen(result.recentBigLoss?.fans[0])).toBe(true);

    expect(() => {
      result.recentBigLoss?.fans.push({ id: 0, label: 'x', count: 0, 役满: 0 });
    }).toThrow(TypeError);
  });
});
