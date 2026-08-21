/**
 * Raw → 公開型変換（docs/design/issue-3-api-layer.md §4.1）。
 *
 * 変換内容はこの3点だけ:
 *   1. count の改名（gameCount / roundCount。§4.2）
 *   2. 回数系6キーの ?? 0 補完（§4.4）
 *   3. 秒単位時刻の Date 化（§4.3）
 * それ以外のキー名は中国語キー含めワイヤのまま維持する。
 *
 * 加えて、ここで構築する公開型オブジェクトは返す前に freeze.ts の deepFreeze で
 * 再帰的に不変化する（§5.2「公開結果は不変である」契約。normalize.ts を経由しない
 * getGlobalHistogram / getLevelStatistics への適用は endpoints.ts 側で行う）。
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
import { deepFreeze } from './freeze';

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
