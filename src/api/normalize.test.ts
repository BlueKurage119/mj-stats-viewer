import { describe, it, expect } from 'vitest';
import { normalizePlayerStats, normalizePlayerExtendedStats, normalizePlayerSearchResult } from './normalize';
import type { RawPlayerStats, RawPlayerExtendedStats, RawPlayerSearchResult } from './types';
import { loadFixture } from './testFixtures';

describe('normalizePlayerExtendedStats', () => {
  // T1
  it('回数系6キーの欠落フィールドは0で補完され、存在するキーは実値を保持する', () => {
    const raw = loadFixture<RawPlayerExtendedStats>('player_extended_stats.json');
    const result = normalizePlayerExtendedStats(raw);

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
    const raw = loadFixture<RawPlayerExtendedStats>('player_extended_stats.json');
    const result = normalizePlayerExtendedStats(raw);

    expect(result.roundCount).toBe(raw.count);
    expect(Object.prototype.hasOwnProperty.call(result, 'count')).toBe(false);
  });

  it('id / played_modes はワイヤに含まれても公開型に含まれない', () => {
    const raw = loadFixture<RawPlayerExtendedStats>('player_extended_stats.json');
    const result = normalizePlayerExtendedStats(raw);

    expect(Object.prototype.hasOwnProperty.call(result, 'id')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(result, 'played_modes')).toBe(false);
  });

  it('最近大铳の start_time（秒）が recentBigLoss.startedAt（Date）に変換される', () => {
    const raw = loadFixture<RawPlayerExtendedStats>('player_extended_stats.json');
    const result = normalizePlayerExtendedStats(raw);

    expect(result.recentBigLoss).toBeDefined();
    expect(result.recentBigLoss?.startedAt).toBeInstanceOf(Date);
    expect(result.recentBigLoss?.startedAt.getTime()).toBe((raw.最近大铳?.start_time ?? 0) * 1000);
    expect(result.recentBigLoss?.id).toBe(raw.最近大铳?.id);
  });

  it('母数条件により欠落しうるフィールド（平均起手向听子）は0補完せず undefined のまま', () => {
    const raw = loadFixture<RawPlayerExtendedStats>('player_extended_stats.json');
    expect(raw.平均起手向听子).toBeUndefined();
    const result = normalizePlayerExtendedStats(raw);
    expect(result.平均起手向听子).toBeUndefined();
  });
});

describe('normalizePlayerStats', () => {
  // T2 (count 改名 / gameCount, latest_timestamp → lastPlayedAt は search_player 側だが
  //     PlayerStats.count → gameCount の改名はここで検証する)
  it('count が gameCount に改名され、公開型に count フィールドが残らない', () => {
    const raw = loadFixture<RawPlayerStats>('player_stats.json');
    const result = normalizePlayerStats(raw);

    expect(result.gameCount).toBe(raw.count);
    expect(Object.prototype.hasOwnProperty.call(result, 'count')).toBe(false);
    expect(result.level).toEqual(raw.level);
    expect(result.played_modes).toEqual(raw.played_modes);
  });
});

describe('normalizePlayerSearchResult', () => {
  // T2 (秒単位 latest_timestamp → Date 化)
  it('latest_timestamp（秒）が lastPlayedAt（Date）に正しく変換される', () => {
    const [raw] = loadFixture<RawPlayerSearchResult[]>('search_player.json');
    const result = normalizePlayerSearchResult(raw);

    expect(result.lastPlayedAt).toBeInstanceOf(Date);
    expect(result.lastPlayedAt.getTime()).toBe(raw.latest_timestamp * 1000);
    expect(result.id).toBe(raw.id);
    expect(result.nickname).toBe(raw.nickname);
  });
});
