/**
 * GameMode ID の定義と "全モード" クエリの明示列挙。
 *
 * 実 API は `mode` パラメータを必須とし、空文字は 400 `mode_is_required` を返す
 * （docs/design/issue-3-api-layer.md §1.3 差分1）。「全モード」を表現する呼び出しは
 * 常にここで定義した全 GameMode ID を明示列挙して送る。
 */

/** 四麻: 王座16/玉12/金9/王東15/玉東11/金東8。三麻: 26/24/22/25/23/21 */
export type GameMode = 8 | 9 | 11 | 12 | 15 | 16 | 21 | 22 | 23 | 24 | 25 | 26;
export type NumPlayers = 3 | 4;

/** 表示順を兼ねた全モードリスト（上位卓・半荘優先）。「全モード」クエリはこれを明示列挙する */
export const ALL_MODES_4: readonly GameMode[] = [16, 12, 9, 15, 11, 8];
export const ALL_MODES_3: readonly GameMode[] = [26, 24, 22, 25, 23, 21];

export function allModes(numPlayers: NumPlayers): readonly GameMode[] {
  return numPlayers === 4 ? ALL_MODES_4 : ALL_MODES_3;
}

/**
 * '.' 連結。空配列は Error を throw する（mode_is_required を型より手前で防ぐ）。
 */
export function joinModes(modes: readonly GameMode[]): string {
  if (modes.length === 0) {
    throw new Error('joinModes: modes must not be empty (would send mode= and trigger mode_is_required)');
  }
  return modes.join('.');
}
