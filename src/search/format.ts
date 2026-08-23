import type { LevelWithDelta, NumPlayers } from '../api';
import { formatLevelWithDelta, parseLevelId } from '../domain';

/** ローカル時刻の 'YYYY/MM/DD'。ゼロ埋めする */
export function formatLastPlayedDate(ms: number): string {
  const d = new Date(ms);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  return `${year}/${month}/${date}`;
}

/** ドメインの formatLevelWithDelta をそのまま通す薄いラッパー（例: '雀傑1 684/1200'） */
export function formatLevel(level: LevelWithDelta): string {
  return formatLevelWithDelta(level);
}

/**
 * level が現在選択中の人数と別モードのときだけラベルを返す。同一なら null。
 * 例: crossModeLabel(20301, 4) === '三麻' / crossModeLabel(10301, 4) === null
 */
export function crossModeLabel(
  levelId: number,
  numPlayers: NumPlayers,
): '四麻' | '三麻' | null {
  const parsed = parseLevelId(levelId);
  const targetNumPlayerId = numPlayers === 4 ? 1 : 2;
  if (parsed.numPlayerId === targetNumPlayerId) {
    return null;
  }
  return parsed.numPlayerId === 1 ? '四麻' : '三麻';
}
