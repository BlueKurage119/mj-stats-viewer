/**
 * Raw → 公開型変換（docs/design/issue-3-api-layer.md §4.1）。
 *
 * 変換内容はこの3点だけ:
 *   1. count の改名（gameCount / roundCount。§4.2）
 *   2. 回数系6キーの ?? 0 補完（§4.4）
 *   3. 秒単位時刻の Date 化（§4.3）
 * それ以外のキー名は中国語キー含めワイヤのまま維持する。
 *
 * 加えて、ここで構築する公開型オブジェクトは返す前に再帰的に Object.freeze する
 * （§5.2「公開結果は不変である」契約。PR #22 再レビュー指摘: apiGet は Promise を
 * キャッシュするため、同一 URL への複数回の呼び出しは同一インスタンスを共有する。
 * 呼び出し側が `stats.rank_rates.sort()` のような in-place 操作を行うと、
 * エラーも警告も出ずにキャッシュ全体が破損する。ES モジュールは常に strict mode
 * なので、凍結済みオブジェクトへの書き込みは代わりに TypeError で即座に落ちる）。
 */

import type {
  RawPlayerSearchResult,
  RawPlayerStats,
  RawPlayerExtendedStats,
  RawGlobalStatistics,
  RawGlobalStatisticsEntry,
  PlayerSearchResult,
  PlayerStats,
  PlayerExtendedStats,
  GlobalStatistics,
  GlobalStatisticsEntry,
} from './types';
import type { GameMode } from './gameMode';

/**
 * 値（オブジェクト・配列）を再帰的に Object.freeze する。
 *
 * 注意: Date インスタンスに対する Object.freeze は、setFullYear 等の日時セッターが
 * 通常のプロパティではなく内部スロットを操作するため、実行時の書き込み防止としては
 * 効かない（呼んでも例外にならず、値が変わってしまう）。Date を含むフィールドは
 * 呼び出し側で書き換えず、必要なら新しい Date を組み立てて使うこと（§6.4 の
 * dataMinDate() と同じ方針）。
 */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as Record<string, unknown>)) {
      deepFreeze(v);
    }
  }
  return value;
}

export function normalizePlayerSearchResult(raw: RawPlayerSearchResult): PlayerSearchResult {
  return deepFreeze({
    id: raw.id,
    nickname: raw.nickname,
    level: raw.level,
    lastPlayedAt: new Date(raw.latest_timestamp * 1000),
  });
}

export function normalizePlayerStats(raw: RawPlayerStats): PlayerStats {
  return deepFreeze({
    id: raw.id,
    nickname: raw.nickname,
    gameCount: raw.count,
    level: raw.level,
    max_level: raw.max_level,
    rank_rates: raw.rank_rates,
    rank_avg_score: raw.rank_avg_score,
    avg_rank: raw.avg_rank,
    negative_rate: raw.negative_rate,
    played_modes: raw.played_modes as GameMode[],
  });
}

export function normalizePlayerExtendedStats(raw: RawPlayerExtendedStats): PlayerExtendedStats {
  const {
    count,
    最大连庄,
    最大累计番数,
    役满,
    累计役满,
    W立直,
    流满,
    最近大铳,
    id: _id,
    played_modes: _playedModes,
    ...rest
  } = raw;

  return deepFreeze({
    roundCount: count,
    最大连庄: 最大连庄 ?? 0,
    最大累计番数: 最大累计番数 ?? 0,
    役满: 役满 ?? 0,
    累计役满: 累计役满 ?? 0,
    W立直: W立直 ?? 0,
    流满: 流满 ?? 0,
    ...rest,
    recentBigLoss: 最近大铳
      ? {
          id: 最近大铳.id,
          startedAt: new Date(最近大铳.start_time * 1000),
          fans: 最近大铳.fans,
        }
      : undefined,
  });
}

function normalizeGlobalStatisticsEntry(raw: RawGlobalStatisticsEntry): GlobalStatisticsEntry {
  return deepFreeze({
    basic: {
      gameCount: raw.basic.count,
      rank_rates: raw.basic.rank_rates,
      avg_rank: raw.basic.avg_rank,
      negative_rate: raw.basic.negative_rate,
    },
    extended: normalizePlayerExtendedStats(raw.extended),
  });
}

/**
 * ワイヤの「mode 文字列キーの1段」を剥がして返す（§1.3 差分2）。
 * modeKey はリクエスト時に自分が渡した mode 文字列（呼び出し側は endpoints.ts）。
 */
export function normalizeGlobalStatistics(raw: RawGlobalStatistics, modeKey: string): GlobalStatistics {
  const levelMap = raw[modeKey] ?? {};
  const result: GlobalStatistics = {};
  for (const [levelId, entry] of Object.entries(levelMap)) {
    result[levelId] = normalizeGlobalStatisticsEntry(entry);
  }
  return deepFreeze(result);
}
