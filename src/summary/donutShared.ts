/**
 * ドーナツ描画の共有部品（幾何定数・弧計算・percentText・最大剰余法によるパーセント配分）。
 * カード2（`rankView.ts`）から抽出した。抽出にあたり既存の弧計算・`percentText` の
 * 振る舞いは1ビットも変えていない（`rankView.test.ts` が無改変で通ることで担保する）。
 * 詳細: docs/design/issue-12-win-lose-donuts.md §4.3-a
 */

/** ドーナツの幾何定数。TSX に直書きせずここから読む（issue-9 §3.3-b） */
export const DONUT_RADIUS = 60;
export const DONUT_STROKE = 24;
export const DONUT_GAP = 4;
export const DONUT_MIN_ARC = 2;
export const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

export interface DonutArc {
  readonly arcLength: number | null; // stroke-dasharray の第1値。rate === 0 のとき null（弧を描かない）
  readonly arcOffset: number; // stroke-dashoffset に入れる値（負値）
}

/**
 * 0..1 の割合の配列 → 各スライスの弧長・オフセット。
 * `buildRankView` 内の累積オフセット計算・`DONUT_GAP` 減算・`DONUT_MIN_ARC` クランプの
 * 忠実な抽出（振る舞いを変えていない）。
 */
export function toDonutArcs(rates: readonly number[]): readonly DonutArc[] {
  let cumulative = 0;
  return rates.map((rate) => {
    const arcOffset = -(DONUT_CIRCUMFERENCE * cumulative);
    cumulative += rate;
    const arcLength =
      rate === 0
        ? null
        : Math.min(Math.max(DONUT_CIRCUMFERENCE * rate - DONUT_GAP, DONUT_MIN_ARC), DONUT_CIRCUMFERENCE);
    return { arcLength, arcOffset };
  });
}

/**
 * 0..1 の割合を小数1桁の百分率文字列にする（'20.4' のように % 記号は含めない）。
 *
 * `(rate * 100).toFixed(1)` だと二重丸めの誤差が出る（例: 0.0555 は `0.0555*100` の時点で
 * 5.549999999999999… という二進浮動小数点表現になり、`toFixed(1)` が `'5.5'` を返す。
 * 設計書 issue-9 §3.5・§7.3 B4 は `0.0555 → '5.6%'` を期待値として明記しており、
 * `rate*1000` を先に丸めてから 1/10 することで誤差を避ける）。
 */
export function percentText(rate: number): string {
  return (Math.round(rate * 1000) / 10).toFixed(1);
}

/**
 * 合計1の比率配列 → 0.1%単位の整数配列（最大剰余法。合計は常に 1000）。
 * カード2の `rankCounts`（回数の最大剰余配分）と同じ考え方で、配分単位を
 * 「1回」から「0.1%」に置き換えたもの。
 *
 * 端数が同値のときは**添字の小さい方**に先に配分する（配列の安定ソートで担保。
 * issue-12 §6-11/13 の期待値がこの規則に依存するので変えないこと）。
 */
export function percentTenths(rates: readonly number[]): readonly number[] {
  const raw = rates.map((rate) => rate * 1000);
  const floors = raw.map((v) => Math.floor(v));
  const flooredTotal = floors.reduce((sum, v) => sum + v, 0);
  const remainder = Math.max(0, Math.round(1000 - flooredTotal));

  const orderByFractionDesc = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);

  const tenths = [...floors];
  for (let k = 0; k < remainder && k < orderByFractionDesc.length; k++) {
    tenths[orderByFractionDesc[k].i] += 1;
  }
  return tenths;
}
