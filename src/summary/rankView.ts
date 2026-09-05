/**
 * カード2（成績・順位分布ドーナツ）のビューモデル。React 非依存の純関数。
 * 詳細: docs/design/issue-9-rank-donut.md §4.3
 */

import type { NumPlayers, PlayerExtendedStats, PlayerStats } from '../api';
import type { RankColorKey } from '../theme/seeds';
import { averageScore, lastPlaceRate, rentaiRate } from '../domain';

/** ドーナツの幾何定数。TSX に直書きせずここから読む（§3.3-b） */
export const DONUT_RADIUS = 60;
export const DONUT_STROKE = 24;
export const DONUT_GAP = 4;
export const DONUT_MIN_ARC = 2;
export const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

const RANK_LABELS = ['1位', '2位', '3位', '4位'] as const;

/**
 * 四麻・三麻それぞれの colorToken 割当（§3.2-d 改訂）。
 * 色は「意味（良し悪し）」ではなく「順位という位置」で割り当てる（メダル配色）ため、
 * 三麻も順位インデックスをそのまま rank-1..rank-3 に対応させる。
 * rank-4（緑）はメダル圏外を表すので四麻の4位にしか現れない。
 */
const COLOR_TOKENS_BY_LENGTH: Record<3 | 4, readonly RankColorKey[]> = {
  4: ['rank-1', 'rank-2', 'rank-3', 'rank-4'],
  3: ['rank-1', 'rank-2', 'rank-3'],
};

export interface RankSlice {
  readonly key: string; // React key。'rank-1' 等（色トークン名と同じ）
  readonly label: string; // '1位'
  readonly rate: number; // 0..1（API 値そのまま）
  readonly percentText: string; // '20.4'（% 記号は含めない）
  readonly count: number; // rate * gameCount を最大剰余法で丸めた実回数。合計は gameCount に一致する
  readonly countText: string; // '11'（3桁区切り。回数記号は含めない）
  readonly colorToken: RankColorKey;
  readonly arcLength: number | null; // stroke-dasharray の第1値。rate === 0 のとき null（弧を描かない）
  readonly arcOffset: number; // stroke-dashoffset に入れる値（負値）
}

export interface RankTile {
  readonly key: string; // 'avgRank' | 'rentai' | 'last' | 'negative' | 'avgScore'
  readonly label: string;
  readonly value: string;
}

export interface RankView {
  readonly slices: readonly RankSlice[]; // 長さ = rank_rates.length（3 or 4）
  readonly tiles: readonly RankTile[]; // 常に長さ5・§3.6 の順
  readonly gameCountText: string; // '54'
  readonly roundCountText: string | null; // '194' / extended が null なら null
  readonly ariaLabel: string; // '順位分布 1位 20.4% 2位 14.8% …'
}

/**
 * 0..1 の割合を小数1桁の百分率文字列にする（'20.4' のように % 記号は含めない）。
 *
 * `(rate * 100).toFixed(1)` だと二重丸めの誤差が出る（例: 0.0555 は `0.0555*100` の時点で
 * 5.549999999999999… という二進浮動小数点表現になり、`toFixed(1)` が `'5.5'` を返す。
 * 設計書 issue-9 §3.5・§7.3 B4 は `0.0555 → '5.6%'` を期待値として明記しており、
 * `rate*1000` を先に丸めてから 1/10 することで誤差を避ける）。
 */
function percentText(rate: number): string {
  return (Math.round(rate * 1000) / 10).toFixed(1);
}

/**
 * `rank_rates[i] * gameCount` を実回数に変換する（凡例の「回数表示」§3.5 改訂）。
 *
 * 各順位を単純に四捨五入すると合計が `gameCount` と一致しないことがある
 * （例: rates=[0.15,0.15,0.15,0.55], gameCount=10 → 単純四捨五入だと 2+2+2+6=12 ≠ 10。
 * `0.5` の丸め方向が全て切り上げに転ぶケースで起きる）。
 * ここでは**最大剰余法**（Largest Remainder Method）を使う: まず全員を切り捨て、
 * 端数の大きい順に 1 ずつ配って合計を `gameCount` に一致させる。
 * `rank_rates` の合計が丸めの都合で 1.0 ちょうどにならない場合でも、
 * 配分先が `rank_rates.length` を超えないため破綻しない。
 */
function rankCounts(rates: readonly number[], gameCount: number): readonly number[] {
  const raw = rates.map((rate) => rate * gameCount);
  const floors = raw.map((v) => Math.floor(v));
  const flooredTotal = floors.reduce((sum, v) => sum + v, 0);
  const remainder = Math.max(0, Math.round(gameCount - flooredTotal));

  const orderByFractionDesc = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);

  const counts = [...floors];
  for (let k = 0; k < remainder && k < orderByFractionDesc.length; k++) {
    counts[orderByFractionDesc[k].i] += 1;
  }
  return counts;
}

/**
 * rank_rates が空・長さが 3/4 以外・rank_avg_score と長さが違う場合は null を返す
 * （API の想定外形状。カードは「データを表示できません」を出す）
 */
export function buildRankView(input: {
  readonly stats: PlayerStats;
  readonly extended: PlayerExtendedStats | null;
}): RankView | null {
  const { stats, extended } = input;
  const rates = stats.rank_rates;

  if (rates.length !== 3 && rates.length !== 4) return null;
  if (stats.rank_avg_score.length !== rates.length) return null;

  const colorTokens = COLOR_TOKENS_BY_LENGTH[rates.length as 3 | 4];
  const counts = rankCounts(rates, stats.gameCount);

  let cumulative = 0;
  const slices: RankSlice[] = rates.map((rate, i) => {
    const arcOffset = -(DONUT_CIRCUMFERENCE * cumulative);
    cumulative += rate;
    const arcLength =
      rate === 0
        ? null
        : Math.min(Math.max(DONUT_CIRCUMFERENCE * rate - DONUT_GAP, DONUT_MIN_ARC), DONUT_CIRCUMFERENCE);
    return {
      key: colorTokens[i],
      label: RANK_LABELS[i],
      rate,
      percentText: percentText(rate),
      count: counts[i],
      countText: counts[i].toLocaleString('ja-JP'),
      colorToken: colorTokens[i],
      arcLength,
      arcOffset,
    };
  });

  const tiles: RankTile[] = [
    { key: 'avgRank', label: '平均順位', value: stats.avg_rank.toFixed(2) },
    { key: 'rentai', label: '連対率', value: `${percentText(rentaiRate(rates))}%` },
    { key: 'last', label: 'ラス率', value: `${percentText(lastPlaceRate(rates))}%` },
    { key: 'negative', label: '飛び率', value: `${percentText(stats.negative_rate)}%` },
    {
      key: 'avgScore',
      label: '平均持ち点',
      value: Math.round(averageScore(rates, stats.rank_avg_score)).toLocaleString('ja-JP'),
    },
  ];

  const ariaLabel = `順位分布 ${slices.map((s) => `${s.label} ${s.percentText}%`).join(' ')}`;

  return {
    slices,
    tiles,
    gameCountText: stats.gameCount.toLocaleString('ja-JP'),
    roundCountText: extended === null ? null : extended.roundCount.toLocaleString('ja-JP'),
    ariaLabel,
  };
}

/** loading のプレースホルダが ready と同じ行数になるよう、卓人数だけからスライス数を決める */
export function skeletonSliceCount(numPlayers: NumPlayers): number {
  return numPlayers;
}
