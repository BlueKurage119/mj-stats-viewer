/**
 * 公開6関数 + getCurrentLevel（docs/design/issue-3-api-layer.md §6）。
 */

import type { NumPlayers, GameMode } from './gameMode';
import { allModes, joinModes } from './gameMode';
import { apiGet } from './client';
import {
  normalizePlayerSearchResult,
  normalizePlayerStats,
  normalizePlayerExtendedStats,
  normalizeGlobalStatistics,
} from './normalize';
import type {
  RawPlayerSearchResult,
  RawPlayerStats,
  RawPlayerExtendedStats,
  RawGlobalStatistics,
  PlayerSearchResult,
  PlayerStats,
  PlayerExtendedStats,
  GlobalHistogram,
  GlobalStatistics,
  LevelStatistics,
  LevelStatisticsItem,
  LevelWithDelta,
} from './types';
import { DATA_MIN_DATE, currentHourEnd } from './range';

function apiPrefix(numPlayers: NumPlayers): string {
  return numPlayers === 4 ? 'api/v2/pl4' : 'api/v2/pl3';
}

/** player_stats / player_extended_stats の tag（1時間粒度。§5.3） */
function hourTag(): number {
  return Math.floor(Date.now() / 3_600_000);
}

/** 省略時・空配列時は allModes(numPlayers) を明示列挙して送る（空 mode は 400。§1.3 差分1） */
function modeParam(numPlayers: NumPlayers, modes?: readonly GameMode[]): string {
  const effectiveModes = modes && modes.length > 0 ? modes : allModes(numPlayers);
  return joinModes(effectiveModes);
}

export async function searchPlayer(
  numPlayers: NumPlayers,
  prefix: string,
  limit = 20,
): Promise<PlayerSearchResult[]> {
  const trimmed = prefix.trim();
  if (trimmed === '') {
    return [];
  }
  const path = `${apiPrefix(numPlayers)}/search_player/${encodeURIComponent(trimmed)}?limit=${limit}&tag=all`;
  const raw = await apiGet<RawPlayerSearchResult[]>(path);
  return raw.map(normalizePlayerSearchResult);
}

export async function getPlayerStats(
  numPlayers: NumPlayers,
  playerId: number,
  start: Date,
  end: Date,
  modes?: readonly GameMode[],
): Promise<PlayerStats | null> {
  const path =
    `${apiPrefix(numPlayers)}/player_stats/${playerId}/${start.getTime()}/${end.getTime()}` +
    `?mode=${modeParam(numPlayers, modes)}&tag=${hourTag()}`;
  const raw = await apiGet<RawPlayerStats | null>(path, { nullOn404: true });
  return raw ? normalizePlayerStats(raw) : null;
}

export async function getPlayerExtendedStats(
  numPlayers: NumPlayers,
  playerId: number,
  start: Date,
  end: Date,
  modes?: readonly GameMode[],
): Promise<PlayerExtendedStats | null> {
  const path =
    `${apiPrefix(numPlayers)}/player_extended_stats/${playerId}/${start.getTime()}/${end.getTime()}` +
    `?mode=${modeParam(numPlayers, modes)}&tag=${hourTag()}`;
  const raw = await apiGet<RawPlayerExtendedStats | null>(path, { nullOn404: true });
  return raw ? normalizePlayerExtendedStats(raw) : null;
}

export async function getGlobalHistogram(numPlayers: NumPlayers): Promise<GlobalHistogram> {
  const path = `${apiPrefix(numPlayers)}/global_histogram`;
  return apiGet<GlobalHistogram>(path);
}

export async function getGlobalStatistics(
  numPlayers: NumPlayers,
  modes?: readonly GameMode[],
): Promise<GlobalStatistics> {
  const mode = modeParam(numPlayers, modes);
  const path = `${apiPrefix(numPlayers)}/global_statistics_2?mode=${mode}`;
  const raw = await apiGet<RawGlobalStatistics>(path);
  return normalizeGlobalStatistics(raw, mode);
}

export async function getLevelStatistics(numPlayers: NumPlayers): Promise<LevelStatistics> {
  const path = `${apiPrefix(numPlayers)}/level_statistics`;
  const raw = await apiGet<LevelStatisticsItem[]>(path);
  return [...raw].sort((a, b) => a[1] - b[1]);
}

export type CurrentLevelInfo = {
  level: LevelWithDelta; // 現在段位。現在pt = score + delta
  maxLevel: LevelWithDelta; // 生涯最高
  nickname: string;
  gameCount: number; // 生涯試合数
  playedModes: GameMode[];
};

/**
 * player_stats.level は「クエリ範囲内の最終対局時点のスナップショット」なので、現在段位は
 * 全モード・全期間・終端=現在で引く必要がある（§6.3）。getPlayerStats の薄いラッパーであり、
 * 独自の fetch はしない。フィルタが全期間・全モードのときはキャッシュが完全に共有される。
 */
export async function getCurrentLevel(
  numPlayers: NumPlayers,
  playerId: number,
): Promise<CurrentLevelInfo | null> {
  const stats = await getPlayerStats(numPlayers, playerId, DATA_MIN_DATE, currentHourEnd(), allModes(numPlayers));
  if (!stats) {
    return null;
  }
  return {
    level: stats.level,
    maxLevel: stats.max_level,
    nickname: stats.nickname,
    gameCount: stats.gameCount,
    playedModes: stats.played_modes,
  };
}
