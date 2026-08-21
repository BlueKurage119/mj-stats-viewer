/**
 * 公開結果の不変化ユーティリティ（docs/design/issue-3-api-layer.md §5.2「公開結果は不変である」契約）。
 *
 * apiGet は Promise をキャッシュするため、同一 URL への複数回の呼び出しは同一の
 * 解決値インスタンスを共有する。呼び出し側が `stats.rank_rates.sort()` のような
 * in-place 操作を行うと、以前はエラーも警告も出ずにキャッシュ全体が破損した。
 * この契約は endpoints.ts の**全6公開関数の戻り値**に適用する
 * （normalize.ts を経由する searchPlayer / getPlayerStats / getPlayerExtendedStats /
 * getGlobalStatistics だけでなく、ワイヤ形状のまま返す getGlobalHistogram /
 * getLevelStatistics も対象。当初この2つは対象外だったが、検収担当が実際に
 * 汚染が伝播することを実証したため適用範囲を拡大した）。
 */

/**
 * 値（オブジェクト・配列）を再帰的に Object.freeze する。
 *
 * 注意: Date インスタンスに対する Object.freeze は、setFullYear 等の日時セッターが
 * 通常のプロパティではなく内部スロットを操作するため、実行時の書き込み防止としては
 * 効かない（呼んでも例外にならず、値が変わってしまう）。`lastPlayedAt` /
 * `recentBigLoss.startedAt` はこの限界の対象であり、公開型を Date から数値に
 * 変える等の対応は後続 Issue で扱う（今回のスコープ外）。
 */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as Record<string, unknown>)) {
      deepFreeze(v);
    }
  }
  return value;
}
