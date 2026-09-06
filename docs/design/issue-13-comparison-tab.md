# Issue #13 設計書: 比較タブ（分布ヒストグラム14枚＋段位分布）

対象 Issue: [#13 比較タブ: 分布ヒストグラム14枚＋段位分布](https://github.com/BlueKurage119/mj-stats-viewer/issues/13)
依存: #4（ドメイン計算）・#6（グローバルフィルタ）— いずれも実装済み
参照: `docs/requirements.md` §4.2・§5.3・§6.1・§6.3・§7 / `docs/design/issue-3-api-layer.md` §1.3 / `issue-4-domain-logic.md` §1.8・§6 / `issue-9`・`issue-10`・`issue-11`・`issue-12`

本設計書は3部構成に分ける。

- **第I部（§2〜§4）**: 基盤 — 汎用ヒストグラム部品・指標設定テーブル・ビューモデル
- **第II部（§5）**: 段位分布カード
- **第III部（§6）**: コンテキストバー・代表モード選択・データ取得
- **§7〜§9**: 画面構成 / 受け入れ条件 / 引き継ぎ

---

## 0. 統括担当に判断を仰ぐ事項

実物調査で判明した事実により、Issue 本文の記述をそのまま実装できない箇所がある。**R-1〜R-4 は着手前に判断が要る。**

| # | 論点 | 設計担当の推奨 | 根拠 |
|---|---|---|---|
| **R-1** | **`.layered-sheet__layer` の `overflow-x: hidden` を `clip` に変える**必要がある。現状のままでは Issue が要求する sticky コンテキストバーが**エラーも警告も出さずに機能しない**。共有 CSS（全タブに効く）の変更になる | **変更する**（`overflow-x: clip; overflow-clip-margin: 0`） | §6.1 に実測。`overflow-x:hidden` は `overflow-y` の使用値を `auto` に格上げし、`.layered-sheet__layer` がスクロールポートになるため内部の sticky が効かない。ブラウザで測定し `clip` なら効くことも確認済み |
| **R-2** | **中立指標の「上位%」の扱い**。Issue が反転対象に挙げるのは4指標だけだが、残り10のうち 立直率・副露率・ツモ率・闇聴率 は**良し悪しが定義できない**（#11 §0 R-1 で `direction: 'neutral'` として統括承認済み） | 全14枚に「上位X%」チップを出す。`neutral` の4指標は**値が大きい側を上位**として計算しつつ、チップの配色は neutral（`surface-container-highest`）にし、注記に「値の大きい順」を添える | #11 の `MetricDirection` を踏襲する。良し悪しの色を付けないことで #11 の判断と矛盾しない |
| **R-3** | **代表モード決定のための追加 API リクエスト**。モード別対局数は `player_stats` 1本からは取得できない（`played_modes` は「打ったモードの一覧」だけで件数を持たない） | 候補を `選択モード ∩ played_modes` に絞り、候補が2つ以上のときだけ候補数ぶんの `player_stats` を追加発行する（候補1つなら追加0本）。比較タブを開いたときのみ発行。**タブ全体の新規リクエストは最悪 7 本**（§6.3 に内訳） | 要件 §7「1画面表示あたり数リクエスト以内」。厳密な「対局数最多」を守るには他に手段がない。妥協案（上位卓・半荘優先のヒューリスティック、追加0本）も §6.3 に併記した |
| **R-4** | **分布の表示レンジを自動クロップする**。`打点效率` は `min:0 / max:10000` に対して母集団の実体は 600〜1900 に集中しており、素の全域を描くと**左端の針のような山**にしかならない | 表示だけ両裾 0.05% を切り落として拡大する。**パーセンタイル計算は必ず `histogramFull` の全域で行う**（#4 の `percentile` をそのまま使う）ので完了条件「上位%が#4の計算と一致」は保たれる | §3.2 に11指標の実測窓を掲載。`和了巡数` は 0..20 のうち 9.6..12.8 の16ビンにしか実体がない |
| R-5 | 段位分布カードの「上位%」の定義（自分の段位帯を上位に数えるか） | `1 − levelDistributionPosition()`（自分の帯は上位に数えない）。魂天は 0.0% になるので `上位0.1%未満` と表示する | #4 の既存関数をそのまま使う。定義を注記に明示する |
| R-6 | `bins` は Issue 本文が「120本」と書くが、`src/domain/__fixtures__/global_histogram.json` は **100本**。実 API の本数は本 Issue では確認できない | **本数をコードに書かない**。常に `bins.length` から算出する。受け入れ条件も本数を問わない書き方にする | §3.1 |

---

## 1. 実物調査の結果（設計判断の根拠）

### 1.1 既に実装済みで、作り直してはならないもの

| 必要な機能 | 既存実装 | 本 Issue での扱い |
|---|---|---|
| パーセンタイル（bins 累積和の線形補間） | `src/domain/distribution.ts` `percentile(x, h)` | **そのまま使う。** lowerIsBetter の反転は呼び出し側（`compareMetrics` の `direction`）の責務 |
| band 0 の histogramFull / mean | `getBandZeroHistogram` / `getBandZeroMean` | そのまま使う |
| `global_histogram` の1回取得・キャッシュ | `apiGet` の URL 単位メモリキャッシュ + `useGlobalHistogram`（deps は `numPlayers` のみ）。`PlayerLayout` が `scope.distribution` として全タブに配っている | **新しいキャッシュ機構は作らない。** 完了条件「1回取得しセッションキャッシュ」は `scope.distribution` を読むだけで満たされる（§8 の受け入れ条件で実測検証する） |
| 代表モードの選択関数 | `src/filters/filterState.ts` `selectRepresentativeMode(numPlayers, selected, gameCountByMode?)` | **既にシグネチャが用意されている。** 本 Issue は `gameCountByMode` を実際に埋める側を作る |
| 段位分布内の自分の位置 | `src/domain/derived.ts` `levelDistributionPosition(stats, levelId)` | そのまま使う（ただし §5.2 の levelId 正規化を通してから渡すこと） |
| 段位ラベル | `getLevelTagFromId(levelId)` | 使う。ただし `10799` は §5.2 の特別扱いが要る |
| 単一モードの自分の値の取得 | `useFilteredStats(numPlayers, playerId, filter)` | 代表モード1つだけの `filter` を合成して**もう一度呼ぶ**（§6.4。`useMemo` 必須） |
| 汎用 SVG 部品の作法 | `src/summary/Donut.tsx`（フックを持たない純表示部品＋`donutShared.ts` の定数） | 同じ形にする（`Histogram.tsx` + `histogramView.ts`） |

### 1.2 `global_histogram` の実形状（issue-3 §1.3 差分7 の実測記録）

- トップキー = **単一モード**文字列（pl4: `"8" "9" "11" "12" "15" "16"`）
- その下の band キー = `"0"`（卓全体）＋ **そのモードに入れる段位帯だけ**（例: mode 8 は `10301`〜`10403`、mode 16 は `10501`〜`10503` と **`10799`**＝魂天合算）
- **band 0 のみ** `mean` + `histogramFull` + `histogramClamped` を持つ。**段位帯 band は `mean` のみ**
- 指標は56個。`PlayerExtendedStats` のキーに `count` `对局数` `局收支` `立直好型` を加えたもの

→ **「段位平均線」は段位帯 band の `mean` を1本引くだけで作れる**（分布は引けない）。これは Issue の要求（線1本）と一致する。band キーの粒度は minorRank まで含む levelId 文字列である。

### 1.3 フィクスチャで確認できた分布の実体（§3.2 の設計根拠）

`src/domain/__fixtures__/global_histogram.json`（pl4 / mode `"16"` / band `"0"` / 11 metric / N≈100万）を Node で読んで実測した。**このフィクスチャは #4 §7.4 のとおり `和牌率` 以外が合成値**なので分布の形そのものは実データではないが、**`min`/`max`/`bins.length` の桁感は本物のレンジ設計を反映している**。

| metric | min..max | bins | step | 非ゼロ bin 数 | 両裾0.05%を切った窓 |
|---|---|---|---|---|---|
| 和牌率 | 0..1 | 100 | 0.010 | 24 | 0.130..0.290（16 bin） |
| 放铳率 | 0..1 | 100 | 0.010 | 18 | 0.060..0.190（13 bin） |
| 立直率 | 0..1 | 100 | 0.010 | 29 | 0.100..0.290（19 bin） |
| 副露率 | 0..1 | 100 | 0.010 | 66 | 0.080..0.560（48 bin） |
| 默听率 | 0..1 | 100 | 0.010 | 42 | 0.010..0.350（34 bin） |
| 打点效率 | **0..10000** | 100 | 100 | 19 | **600..1900**（13 bin） |
| 铳点损失 | **0..10000** | 100 | 100 | 11 | 200..1000（8 bin） |
| 和了巡数 | **0..20** | 100 | 0.200 | 22 | **9.600..12.800**（16 bin） |
| 里宝率 | 0..1 | 100 | 0.010 | 23 | 0.050..0.220（17 bin） |
| 一发率 | 0..1 | 100 | 0.010 | 16 | 0.040..0.150（11 bin） |

**結論: クロップ無しでは商品にならない。** 全域を描くと 打点效率 は横幅の 6〜19% にしか山が無く、和了巡数 は 48〜64% の位置に幅16%の針が立つだけになる。→ R-4。

### 1.4 フィクスチャに存在しない4指標

14指標のうち **`自摸率` `平均打点` `平均铳点` `净打点效率` はフィクスチャの band 0 に存在しない**（フィクスチャが11 metric しか持たないため）。実 API には存在するはず（issue-3 §1.3 差分7「指標は56個・`PlayerExtendedStats` のキーを含む」）だが、**本 Issue でも実データで確認できない**（実 API アクセス禁止）。加えて #11 §1.7-1 が `平均打点` / `平均铳点` の band 0 `mean` の**単位が未確認**であることを記録している。

→ 設計上の帰結:
1. **指標ごとに分布が引けない経路を必ず持つ**（カードは出すが分布領域を「卓全体分布なし」に縮退。§4.4）
2. **自分の値がヒストグラムのレンジ外に落ちる経路を持つ**（単位不一致が起きた場合の見え方。マーカーを端にクランプし `範囲外` 表示。§3.4）
3. テスト用フィクスチャを4指標ぶん追加する（§8.0）

### 1.5 `overflow-x: hidden` が sticky を殺す（ブラウザ実測）

`src/shell/shell.css` の `.layered-sheet__layer` は `overflow-x: hidden` を持つ（タブ遷移の translateX が水平スクロールバーを出す問題への対策としてコメント付きで入っている）。CSS 仕様上、片軸が `hidden` で他軸が `visible` のとき、`visible` の使用値は `auto` に格上げされる。

実際に `.layered-sheet__layer` と同一の宣言を持つプローブページを `http://localhost:5173/` 配下に置いてブラウザで測定した（測定後に削除済み）:

```
overflow-x: hidden  → getComputedStyle(layer).overflowY === "auto"
                      sticky 子要素の rect.top: scrollY=0 で 60 → scrollY=600 で **-540**（＝全く貼り付かない）
overflow-x: clip    → getComputedStyle(layer).overflowY === "visible"
（overflow-clip-margin:0） sticky 子要素の rect.top: scrollY=0 で 64 → scrollY=600 で **64**（正しく貼り付く）
```

→ R-1。`clip` はスクロールコンテナを作らないため、元の目的（translateX のはみ出しを止める）はむしろ `hidden` より確実に達成される。`.tab-transition` は `animation` しか持たず `overflow` / `contain` を持たないので、間に挟まっても sticky を阻害しない（実挙動は §8 の受け入れ条件で実測させる）。

### 1.6 バンドルサイズの実測ベースライン

```
（現状 main）                dist/assets/index.js 503.51 kB / gzip 138.77 kB, index.css 24.50 kB / gzip 4.12 kB
（SummaryPanel を空にして）  dist/assets/index.js 477.79 kB / gzip 131.46 kB, index.css 24.50 kB（同一）
```

→ **サマリー5カード＋Donut＋Radar＋ビューモジュール5本の合計が JS 25.7 kB raw / 7.31 kB gzip。** 比較タブは「汎用カード1種＋指標表14件＋段位分布カード＋コンテキストバー」で、コンポーネント種類数はサマリーより少ない。素の見積りは **JS +10 kB raw / +3 kB gzip** 程度。

ただし過去4回連続で見積りを超過している（MEMORY の「バンドル見積りの不足」）ため、**枠は素の見積りの3倍とする**:

> **バンドル予算: JS +36 kB raw / +10 kB gzip、CSS +7 kB raw / +2 kB gzip 以内。外部チャートライブラリは使わない（recharts 不採用は確定事項）。**

製造担当は完了時に `npm run build` の実数値を報告すること。なお現状で既に「chunks are larger than 500 kB」警告が出ているが、これは本 Issue 以前からの状態であり本 Issue の責務ではない（§9 に引き継ぐ）。

---

# 第I部 — 基盤

## 2. モジュール構成

```
src/compare/
  ComparePanel.tsx          タブ本体。フック配線と状態の集約のみ
  CompareContextBar.tsx     sticky コンテキストバー（モードチップ・母集団n・凡例・注記）
  compareMetrics.ts         ★14指標の設定テーブル（このタブの単一情報源）
  histogramView.ts          純関数。クロップ・SVG パス生成・上位%整形
  Histogram.tsx             SVG 描画だけの純表示部品（フック無し。Donut.tsx と同格）
  HistogramCard.tsx         汎用ヒストグラムカード（14枚がこれ1つを再利用）
  levelDistributionView.ts  純関数。段位分布のビューモデル
  LevelDistributionCard.tsx
  useRepresentativeMode.ts  モード別対局数の取得＋代表モード決定
  compare.css
src/filters/
  useLevelStatistics.ts     ★新規（他タブでも使える位置に置く）
src/dev/
  CompareGallery.tsx        ★新規。`#/__compare`
```

テストは既存規約どおり同ディレクトリに `*.test.ts`（`compareMetrics.test.ts` / `histogramView.test.ts` / `levelDistributionView.test.ts` / `useRepresentativeMode.test.ts(x)`）。

**CLAUDE.md 制約の再掲（製造担当へ）**: 副作用だけの bare import 禁止（`compare.css` の import は CSS なので可）。`<md-*>` 生タグ禁止（`src/components/md` バレル経由）。色は CSS 変数のみ。dev ルートは `import.meta.env.DEV` のリテラル分岐内に動的 `import()` を直書き。

## 3. ヒストグラム描画の設計

### 3.1 なぜ自前 SVG か

- 外部ライブラリは不採用確定（recharts）。§1.6 の予算内に収めるには自前しかない
- **要素数**: 素朴に `<rect>` を bin ごとに置くと最悪 14カード × bins 本。bins は実 API 120 本想定・フィクスチャ100本で、クロップ後は 8〜48 本（§1.3）だが、クロップが効かないデータが来る可能性を残したくない。→ **分布は `<path>` 1本（階段状の閉多角形）で描く。** 1カードあたりの SVG 子要素は「分布 path 1 + マーカー線 最大3 + 自分マーカーの三角 1 = 最大5」に固定される
- **`bins.length` をコードに書かない**（R-6）。すべて `h.bins.length` から導出する

### 3.2 表示レンジのクロップ（R-4）

```ts
/** 表示窓。bin インデックスの閉区間 [lo, hi] と、それに対応する値域 */
export interface HistogramWindow {
  readonly lo: number;      // bin index (inclusive)
  readonly hi: number;      // bin index (inclusive)
  readonly xMin: number;    // h.min + step*lo
  readonly xMax: number;    // h.min + step*(hi+1)
  readonly peak: number;    // 窓内の最大 bin 度数（y スケール用）
  readonly total: number;   // 全域の度数合計（母集団n の算出にも使う）
}

export const CROP_TAIL_RATIO = 0.0005; // 両裾それぞれ 0.05%

/**
 * 両裾から CROP_TAIL_RATIO ずつ度数を切り落とした表示窓を返す。
 * marks に与えた値（自分・卓平均・段位平均）が窓の外に出る場合は、その値を含むまで窓を広げる。
 * 度数合計が 0、または bins が空なら null。
 */
export function cropHistogram(h: HistogramData, marks: readonly number[]): HistogramWindow | null;
```

規則:
1. 左から累積が `total * CROP_TAIL_RATIO` を**超える手前まで**の bin を捨てて `lo` を決める。右も対称に `hi` を決める（実装は §1.3 の実測に使ったのと同じ手順）
2. `hi < lo` になった場合（度数が1ビンに集中）は `lo = hi` にそろえ、さらに左右に1ビンずつ広げる
3. `marks` の各値 `m`（`null` は無視）について `binOf(m) = floor((m - h.min)/step)` を求め、窓に含まれなければ `lo`/`hi` を広げる。ただし **`m` が `[h.min, h.max]` の外にある場合は広げない**（§3.4 のクランプ表示に回す）
4. 最終的に窓幅が3ビン未満なら左右に足して3ビン以上にする（潰れ防止）

**クロップは表示専用。** `percentile()` には常に `h` 全体を渡す（完了条件「上位%が#4の計算と一致」の担保）。

### 3.3 SVG の描き方

```
viewBox="0 0 320 72"、width="100%" height は CSS 変数 --hist-height（既定 72px）
preserveAspectRatio="none"（横は伸ばす）
```

- 横 `preserveAspectRatio="none"` によりストローク幅が横方向に歪むため、**マーカー線には必ず `vector-effect="non-scaling-stroke"` を付ける**（これが無いと線の太さがカード幅で変わる）
- 分布 path: `x_i = 320 * (i - lo) / (hi - lo + 1)`、`y_i = 72 - 72 * bins[i] / peak`。`M x_lo,72 L` で階段を作り最後に `Z`。`fill` のみでストロークは無し
- **アニメーション**: 要件 §3「チャートは左→右アニメ」。`clip-path: inset(0 100% 0 0)` → `inset(0 0 0 0)` の 400ms トランジションを分布 path のラッパー `<g>` に当てる。`@media (prefers-reduced-motion: reduce)` で無効化（既存カードと同じ規律）
- **色**（すべて CSS 変数。セクション色4系統には依存しない — CLAUDE.md「保留中の設計判断」）:

| 要素 | 色 | 線種 |
|---|---|---|
| 分布 | `--md-sys-color-surface-container-highest` | 塗りのみ |
| 卓平均線 | `--md-sys-color-on-surface-variant` | 破線 `stroke-dasharray="4 3"` |
| 段位平均線 | `--md-sys-color-tertiary` | 点線 `stroke-dasharray="1 3"` |
| 自分マーカー | `--md-sys-color-primary` | 実線 `stroke-width=2` ＋ 上端に一辺6の三角 |

線種を3種に分けているのは**色だけに依存させない**ため（light/dark 両対応とアクセシビリティ）。

### 3.4 マーカーが窓外・レンジ外のとき

| 状況 | 表示 |
|---|---|
| 値が `[xMin, xMax]` の外だが `[h.min, h.max]` の内 | §3.2-3 で窓を広げるので起きない |
| 値が `[h.min, h.max]` の外（単位不一致・極端な外れ値。§1.4-2） | マーカーを窓の端に**クランプ**して描き、`data-clamped="low"\|"high"` を付ける。カードの注記に「卓全体の分布レンジ外」を追記。上位% は `percentile()` が返す 0 / 1 をそのまま使う（0.0% / 100.0% 表示ではなく §4.3 の下限表記になる） |
| 卓平均・段位平均が取れない（`null`） | その線を描かない。凡例側は変えない（凡例はタブ共通のため） |

## 4. 指標設定テーブルと汎用カード

### 4.1 `compareMetrics.ts`（このタブの単一情報源）

`src/summary/keyStatsView.ts` の `MetricDirection` / `MetricUnit` の考え方をそのまま拡張する（型は `compareMetrics.ts` 側で独自に定義してよい。summary からの import は避け、依存方向を作らない）。

```ts
export type CompareCategory = 'rate' | 'point' | 'speed' | 'luck';
export type MetricDirection = 'higher' | 'lower' | 'neutral';
export type MetricUnit = 'rate' | 'point' | 'turn';

export interface CompareMetric {
  readonly key: string;                                  // 'winRate' 等の安定キー（data-metric / テスト用）
  readonly label: string;                                // '和了率'
  readonly category: CompareCategory;
  readonly statsKey: keyof PlayerExtendedStats & string; // '和牌率'
  readonly histogramKey: string;                         // '和牌率'（global_histogram 側のキー）
  readonly unit: MetricUnit;
  readonly direction: MetricDirection;
  readonly denominatorNote?: string;                     // 分母注記（要件 §8）。無ければ表示しない
}

export const COMPARE_CATEGORY_LABELS: Readonly<Record<CompareCategory, string>> = {
  rate: '率系', point: '打点系', speed: '速度', luck: '運',
};

export const COMPARE_METRICS: readonly CompareMetric[] = [ /* ↓の14件をこの順で */ ];
```

| # | key | label | category | statsKey / histogramKey | unit | direction | 分母注記 |
|---|---|---|---|---|---|---|---|
| 1 | `winRate` | 和了率 | rate | `和牌率` | rate | higher | — |
| 2 | `dealInRate` | 放銃率 | rate | `放铳率` | rate | **lower** | — |
| 3 | `riichiRate` | 立直率 | rate | `立直率` | rate | neutral | — |
| 4 | `callRate` | 副露率 | rate | `副露率` | rate | neutral | — |
| 5 | `tsumoRate` | ツモ率 | rate | `自摸率` | rate | neutral | 和了回数比 |
| 6 | `damatenRate` | 闇聴率 | rate | `默听率` | rate | neutral | 和了回数比 |
| 7 | `avgWinScore` | 平均打点 | point | `平均打点` | point | higher | — |
| 8 | `avgDealInScore` | 平均放銃点 | point | `平均铳点` | point | **lower** | — |
| 9 | `winEfficiency` | 打点効率 | point | `打点效率` | point | higher | — |
| 10 | `lossEfficiency` | 銃点損失 | point | `铳点损失` | point | **lower** | — |
| 11 | `netEfficiency` | 調整打点効率 | point | `净打点效率` | point | higher | — |
| 12 | `avgWinTurn` | 平均和了巡目 | speed | `和了巡数` | turn | **lower** | — |
| 13 | `uradoraRate` | 裏ドラ率 | luck | `里宝率` | rate | higher | — |
| 14 | `ippatsuRate` | 一発率 | luck | `一发率` | rate | higher | — |

> Issue 本文の並び「率系(6): 和了率・放銃率・立直率・副露率・ツモ率・闇聴率」をそのまま採用。カテゴリ見出しはこの表の `category` の切り替わりで自動生成する（見出しをハードコードしない）。

**表記の注意**: Issue 本文（GitHub）は「黙聴率」、`docs/requirements.md` §4.2 は「闇聴率」。要件 §8 が「日本語ラベルはCLI版準拠（闇聴率…）」と明記しているので **`闇聴率` を採用**する。

### 4.2 値のフォーマット

`src/summary/keyStatsView.ts` の作法（二重丸め回避・U+2212 MINUS SIGN）を踏襲する。

| unit | 表示 | 例 |
|---|---|---|
| `rate` | `(Math.round(v*1000)/10).toFixed(1)` + `%` | `22.8%` |
| `point` | `Math.round(v).toLocaleString('ja-JP')` | `1,380` |
| `turn` | `v.toFixed(2)` + `巡` | `11.00巡` |

### 4.3 上位%（`histogramView.ts`）

```ts
export interface TopPercent {
  readonly ratio: number;   // 0..1。0 に近いほど上位
  readonly text: string;    // '上位 21.8%' 等
  readonly tone: 'good' | 'bad' | 'neutral';
}

/** direction に従って percentile() の結果を「上位%」へ変換する。 */
export function toTopPercent(percentileValue: number, direction: MetricDirection): TopPercent;
```

- `direction === 'lower'` → `ratio = percentileValue`（小さい値ほど上位）
- それ以外 → `ratio = 1 - percentileValue`
- 文言: `上位 ${(ratio*100).toFixed(1)}%`。ただし `ratio*100 < 0.1` は `上位 0.1%未満`、`> 99.9` は `上位 99.9%超`
- `tone`: `direction === 'neutral'` なら常に `neutral`（R-2）。それ以外は `ratio <= 0.5 ? 'good' : 'bad'`

**検算値（フィクスチャ mode 16 band0 × `extended_stats_4p.json`）** — 受け入れ条件で使う:

| metric | 自分の値 | `percentile()` | 上位% |
|---|---|---|---|
| 和牌率 | 0.228 | 0.781633 | **21.8%** |
| 放铳率（lower） | 0.115 | 0.352436 | **35.2%** |
| 立直率 | 0.22 | 0.806861 | 19.3% |
| 副露率 | 0.29 | 0.333982 | 66.6% |
| 默听率 | 0.16 | 0.344230 | 65.6% |
| 打点效率 | 1380 | 0.762770 | 23.7% |
| 铳点损失（lower） | 600 | 0.353026 | 35.3% |
| 和了巡数（lower） | 11 | 0.327016 | **32.7%** |
| 里宝率 | 0.145 | 0.665632 | 33.4% |
| 一发率 | 0.105 | 0.663864 | 33.6% |

### 4.4 `HistogramCard.tsx`（14枚で共有する唯一のカード）

```tsx
export interface HistogramCardProps {
  readonly metric: CompareMetric;
  readonly value: number | null;          // 自分の値。null = 自分の統計が無い
  readonly histogram: HistogramData | null; // band 0 の histogramFull
  readonly tableMean: number | null;        // 卓平均（band 0 の mean）
  readonly levelMean: number | null;        // 段位平均（段位帯 band の mean）
  readonly loading?: boolean;
}
```

- フックを持たない純表示コンポーネントにする（dev ギャラリーから全状態を流し込めるようにするため。#9〜#12 と同じ規律）
- 縮退段階:

| 条件 | 表示 |
|---|---|
| `loading` | ラベルは出す（設定テーブル由来なので既知）。値・チップ・分布を skeleton |
| `value === null` | 値を `—`、チップ無し、分布は描くが自分マーカー無し |
| `histogram === null` | 値とラベルは出す。分布領域を「卓全体の分布データがありません」の1行に置換。上位%チップ無し |
| `tableMean === null` / `levelMean === null` | その線だけ描かない |

- DOM 契約（検収・テストが掴む）: ルートに `data-testid="histogram-card"` と `data-metric={metric.key}`、`data-state="loading"|"ready"|"nodist"`。上位%チップに `data-testid="top-percent"` と `data-tone`。SVG に `data-testid="histogram"`、`role="img"`、`aria-label` に「（指標名）の分布。自分 22.8%、卓平均 20.9%、段位平均 21.5%、上位 21.8%」相当の文を入れる（視覚要素は `aria-hidden`）
- **高さ一致**: MEMORY「UI寸法計測の罠 — 高さは共有変数で」に従い、SVG 高さ・値の行の高さは `compare.css` の CSS 変数（`--hist-height` / `--hist-value-height`）で与える。カード個別に px を書かない

### 4.5 グリッド

`@container` を使う（`.compare-grid { container-type: inline-size }`。理由は `summary.css` の既存コメントと同じ「カード自身の実効幅で切り替える」）。

| コンテナ幅 | 列 |
|---|---|
| < 560px | 1 |
| 560〜899px | 2 |
| ≥ 900px | 3 |

`.layered-sheet__layer` の `--content-max-width: 1040px` の内側なので、3列時の1カード幅は約 320px。§3.3 の viewBox 幅 320 はこれに合わせてある。

---

# 第II部 — 段位分布カード

## 5. 段位分布（スコープE）

### 5.1 データ

`getLevelStatistics(numPlayers)` → `LevelStatistics = [zone, levelId, count][]`。新規フック:

```ts
// src/filters/useLevelStatistics.ts
export type LevelStatisticsState =
  | { kind: 'loading' }
  | { kind: 'ready'; stats: LevelStatistics }
  | { kind: 'error'; message: string };

export function useLevelStatistics(numPlayers: NumPlayers): LevelStatisticsState;
```

`useGlobalHistogram` と同じ規律で書く: deps は `[numPlayers]` のみ（フィルタに依存しない）、`getLevelStatistics` は `AbortSignal` を受け取らないので中断は `cancelled` フラグのみ、エラー文言は `describeStatsError`。

### 5.2 levelId の正規化（**既存関数の落とし穴**）

`level_statistics` は魂天を **`10799`（pl4）に合算**して返す（issue-3 §9・#4 §491）。一方プレイヤーの現在段位 `level.id` は `10701` 等の個別 levelId で来る。

`levelDistributionPosition(stats, 10701)` をそのまま呼ぶと、内部の `id <= levelId` 判定で **`10799` バケット（＝自分自身が属する帯）が丸ごと「自分より上」に数えられる**。魂天プレイヤーの上位%が実際より悪く出る。

→ **呼び出し側で正規化してから渡す。** `levelDistributionView.ts` に置く:

```ts
/** level_statistics のバケット levelId へ正規化する。魂天(majorRank>=6) は numPlayerId*10000+799 に畳む */
export function levelStatBucketId(levelId: number): number;

/** バケット levelId の表示ラベル。799 は '魂天'（getLevelTagFromId は '魂天99' を返してしまう） */
export function levelBucketLabel(bucketId: number): string;
```

`getLevelTagFromId(10799)` は `parseLevelId` → majorRank 7 / minorRank 99 → **`'魂天99'`** を返す（`src/domain/level.ts` を読んで確認）。段位分布カードのラベルにそのまま使ってはならない。`minorRank === 99` のときだけ `getLevelMajorTag` 相当（`'魂天'`）にフォールバックする。

### 5.3 ビューモデル

```ts
export interface LevelDistributionBar {
  readonly bucketId: number;
  readonly label: string;       // '雀傑2' / '魂天'
  readonly count: number;
  readonly ratio: number;       // count / total（0..1）
  readonly isSelf: boolean;
}

export interface LevelDistributionView {
  readonly bars: readonly LevelDistributionBar[]; // levelId 昇順
  readonly total: number;
  readonly selfBucketId: number | null;
  readonly topPercent: TopPercent | null;         // 1 - levelDistributionPosition()
  readonly note: string;
}

export function buildLevelDistributionView(args: {
  stats: LevelStatistics;
  numPlayers: NumPlayers;
  selfLevelId: number | null;   // scope.identity（全期間・全モードの現在段位）
}): LevelDistributionView;
```

規則:
- `numPlayerId`（`Math.floor(levelId/10000)`）が `numPlayers === 4 ? 1 : 2` のエントリだけを採用（`level_statistics` は 1xxxx/2xxxx が混在しうる — #4 §491）
- 全 zone を合算（zone は捨てる）。同一 levelId は加算
- `bucketId` 昇順に並べる。バーは**存在する levelId ぶんだけ**（欠けている段位を 0 で補完しない。実データに無い帯を勝手に作らない）
- `topPercent` は `1 - levelDistributionPosition(stats, levelStatBucketId(selfLevelId))`、`direction` は `higher` 扱い（上の段位ほど上位）。R-5 の定義を `note` に明記する:
  > 「同じ段位帯の人は上位に数えません（`level_statistics` 全ゾーン合算）」
- `selfLevelId === null`（identity が loading/notFound/error）のときは `isSelf` を全て false、`topPercent` を null にして分布だけ出す

### 5.4 描画

横並びの縦棒（16本前後）。ヒストグラム部品は流用しない（x が連続値ではないため）。CSS grid + `<div>` の高さ比で描く（SVG 不要・要素数16なので問題にならない）。自分の帯は `--md-sys-color-primary`、他は `--md-sys-color-surface-container-highest`。ラベルは棒の下に縦書きせず、`初心/雀士/雀傑/雀豪/雀聖/魂天` の主要部が変わるところにだけ出す（16本すべてにラベルを出すと 320px 幅で潰れる）。自分の帯には常にラベルを出す。

---

# 第III部 — コンテキストバー・データ取得

## 6. タブ全体の配線

### 6.1 sticky コンテキストバー

- `position: sticky; top: var(--app-header-height, 64px); z-index: 2;`
- **前提として `.layered-sheet__layer` の `overflow-x: hidden` を `overflow-x: clip; overflow-clip-margin: 0;` に変更する（R-1・§1.5）。** 既存コメント（translateX 対策の経緯）は残し、`clip` に変えた理由と実測値を追記すること
- 背景は `--md-sys-color-surface`（層の地色と同じ）。スクロール時に下のカードが透けないよう不透明にし、下端に `1px` の `--md-sys-color-outline-variant`
- 中身（横1行、狭いときは2行に折り返す）:
  1. **モードチップ**: `ChipSet` + `FilterChip`（`src/components/md` バレル）。候補モードぶん。選択中が代表モード。`MODE_LABELS` を使う
  2. **母集団n**: `n = 1,000,001人`（§6.2）
  3. **凡例**: 自分 / 卓平均 / 段位平均 の3つ。§3.3 と同じ色・線種のミニ SVG（12×12）＋ラベル
  4. **注記**（`label-medium`・`on-surface-variant`）: 期間フィルタが `all` 以外のときだけ
     > 「直近◯◯の自分 vs 卓全体（全期間）。母集団の分布は期間で絞り込めません」
     `all` のときは「卓全体（全期間）との比較」だけ出す

### 6.2 母集団 n

```ts
/** band 0 の histogramFull の度数合計。metric を跨ぐと僅かに違う（フィクスチャで 999,849〜1,000,001）ため
 *  基準を1つに決める: 'count'（対局数の分布）→ 無ければ COMPARE_METRICS の先頭から最初に引けたもの */
export function populationSize(gh: GlobalHistogram, mode: GameMode): number | null;
```

`count` は band 0 の56指標に含まれる（issue-3 §1.3 差分7）が、**実データで `count` の `histogramFull` を目視確認してはいない（実挙動未確認）**。そのためフォールバックを持たせる。

### 6.3 代表モードの決定（R-3）

```ts
// src/compare/useRepresentativeMode.ts
export type RepresentativeModeState =
  | { kind: 'loading' }
  | { kind: 'empty' }        // 候補が0（この期間・選択モードでの対局が無い）
  | { kind: 'ready'; mode: GameMode; candidates: readonly GameMode[];
      gameCountByMode: Readonly<Partial<Record<GameMode, number>>>; auto: boolean }
  | { kind: 'error'; message: string };

export function useRepresentativeMode(args: {
  numPlayers: NumPlayers; playerId: number;
  filter: GlobalFilter | null;
  playedModes: readonly GameMode[] | null;  // scope.stats.kind === 'ready' の stats.played_modes
  override: GameMode | null;                // チップでユーザーが選んだモード
}): RepresentativeModeState;
```

アルゴリズム:
1. `candidates = filter.modes ∩ playedModes`（`canonicalizeModes` の順序＝上位卓・半荘優先）。**`played_modes` はフィルタ期間内の `player_stats` 由来なので、期間内に打っていないモードは自動的に外れる**
2. `candidates.length === 0` → `empty`
3. `candidates.length === 1` → 追加リクエスト **0本**。`gameCountByMode = { [c0]: scope.stats.stats.gameCount }`
4. `candidates.length >= 2` → 候補ぶんの `getPlayerStats(numPlayers, playerId, start, end, [mode])` を `Promise.all` で発行し `gameCount` を集める（**追加 k 本**。うち代表モードぶんは §6.4 の取得と URL が一致するのでキャッシュヒットになり実質 k−1 本）
5. `selectRepresentativeMode(numPlayers, candidates, gameCountByMode)` で決定（同数なら上位卓・半荘優先＝既存実装のまま）
6. `override !== null && candidates.includes(override)` なら `override` を採用し `auto: false`
7. `override` は `filter` が変わったらリセットする（別モードのチップが消えたまま残らないように）

**リクエスト本数の内訳（比較タブを開いたとき）**

| 呼び出し | 本数 |
|---|---|
| `global_histogram` | 0（`scope.distribution` を再利用。`apiGet` の URL キャッシュ） |
| `player_stats`（複数モード集計。`scope.stats`） | 0（既にサマリーで発行済み。タブ切替では再発行されない） |
| モード別 `player_stats` | 候補数 k（k=1 なら 0） |
| 代表モードの `player_stats` | 0（上でキャッシュ済み） |
| 代表モードの `player_extended_stats` | 1 |
| `level_statistics` | 1 |
| **合計（新規）** | **k=1 → 2本 / k=6（全モード選択かつ全部打っている）→ 7本** |

**代替案（R-3 で「追加リクエストを認めない」と判断された場合）**: `gameCountByMode` を渡さずに `selectRepresentativeMode(numPlayers, candidates)` を呼ぶ。既存実装は上位卓・半荘優先の先頭を返すので追加0本で動く。ただし要件 §4.2 の「対局数最多を代表として自動採用」を満たさなくなるため、**要件書 §4.2 の該当文を「入れる最上の卓を代表とする」に改訂する必要がある**（設計担当が勝手に決めない）。

### 6.4 自分の値（単一モード）の取得

`useFilteredStats` をもう一度、代表モード1つだけの filter で呼ぶ。**新しいフックを書かない。**

```tsx
const singleModeFilter = useMemo(
  () => (rep.kind === 'ready' && filter ? { modes: [rep.mode], period: filter.period } : null),
  [rep.kind === 'ready' ? rep.mode : null, filter?.period],
);
const modeStats = useFilteredStats(numPlayers, playerId, singleModeFilter);
```

> **`useMemo` を外すと無限フェッチループになる。** `useFilteredStats` の副作用 deps に `filter` オブジェクトそのものが入っており、毎レンダで新しい object literal を渡すと debounce 経由で `debouncedFilter` の identity が更新され続け、取得 effect が回り続ける。製造担当はここを必ず `useMemo` にすること（§8 の受け入れ条件で実測検証する）。

### 6.5 段位平均線の band 解決

```ts
/** 段位帯 band の mean を引く。band キーは levelId 文字列。魂天は numPlayerId*10000+799 に畳む */
export function getLevelBandMean(
  gh: GlobalHistogram, mode: GameMode, levelId: number, metric: string,
): number | null;
```

解決順:
1. `gh[mode]?.[String(levelId)]?.[metric]?.mean`
2. 魂天（`parseLevelId(levelId).majorRank >= 6`）なら `String(numPlayerId*10000 + 799)` で再試行
3. どちらも無ければ `null`（線を描かない）

使う levelId は **`scope.identity`（全期間・全モードの現在段位）の `level.id`**。要件 §5.3 のとおり `player_stats.level` は期間内スナップショットなので使わない。

**実挙動未確認**: 三麻（pl3）の band キーが `2xxxx` 系であること、魂天合算バンドが `20799` であることは**未検証**（#4 §9 のとおり pl3 の `global_histogram` は一度も取得していない）。解決できなければ線が消えるだけなので致命的な縮退にはならない。

### 6.6 `ComparePanel.tsx` の状態

```
loading:  scope.filter === null | scope.distribution.kind==='loading' | rep.kind==='loading'
          | modeStats.kind==='loading' | levelStats.kind==='loading'
empty:    rep.kind==='empty' または modeStats.kind==='empty'
          → NO_GAMES_IN_PERIOD_MESSAGE（`filterState.ts` の既存定数）
error:    それぞれのカード側で縮退させる。タブ全体を潰すのは scope.stats.kind==='error' のときだけ
```

`scope.distribution.kind === 'error'` はタブを潰さない（#11 の規律と同じ）。分布が無い状態で「値だけ出る」カード群になる（§4.4 の `histogram === null` 縮退）。段位分布カードは `global_histogram` に依存しないので独立に表示される。

---

## 7. 画面構成（上から）

```
[コンテキストバー(sticky)]  モードチップ / 母集団n / 凡例 / 期間注記
[段位分布カード]            全段位帯の棒 + 自分ハイライト + 上位%
[見出し「率系」]            HistogramCard × 6
[見出し「打点系」]          HistogramCard × 5
[見出し「速度」]            HistogramCard × 1
[見出し「運」]              HistogramCard × 2
```

カテゴリ見出しは `md-typescale-title-small` + `on-surface-variant`。`COMPARE_METRICS` の `category` が切り替わったところで挿入する（ハードコードしない）。

`src/shell/AppRouter.tsx` の `compare` タブを `PlaceholderPanel` から `ComparePanel` に差し替える。

dev ギャラリー `#/__compare`（`src/dev/CompareGallery.tsx`）に最低限そろえる状態:
1. `HistogramCard` ready（フィクスチャの `和牌率`）
2. 同 lowerIsBetter（`放铳率`）
3. 同 loading
4. 同 `histogram === null`（分布なし縮退）
5. 同 マーカーがレンジ外（`value` に極端値を流す。§3.4 のクランプ確認）
6. 同 段位平均線なし
7. `LevelDistributionCard` ready（自分＝雀傑1）／自分＝魂天（`10799` 畳み込みとラベル `魂天` の確認）／自分不明
8. `CompareContextBar` 候補1つ／候補3つ／期間フィルタ有り

`src/main.tsx` の dev ルート追加は **`import.meta.env.DEV` のリテラル分岐内に動的 `import()` を直書き**する既存の形を崩さないこと（CLAUDE.md 制約4）。

---

## 8. 受け入れ条件

検収担当は上から順に1項目ずつ実行する。**各項目は「実行手順」と「合格の見え方」を持つ。**

### 8.0 前提（製造担当が用意するもの）

- [ ] **A0-1** `src/domain/__fixtures__/global_histogram.json` の mode `"16"` band `"0"` に **`自摸率` `平均打点` `平均铳点` `净打点效率` の4 metric を追加**（`mean` + `histogramFull`。`bins.length` は既存と同じ100、レンジは 率=0..1 / 点=0..20000 を目安に合成値でよい）。**追加は加算のみ**で既存 metric の値を変更しない。
  実行: `git diff src/domain/__fixtures__/global_histogram.json` で既存11 metric のオブジェクトに差分が無いこと。`npm test` が既存の #4/#10/#11 のテストを1件も落とさないこと
- [ ] **A0-2** 同ファイルに **段位帯 band `"10503"`**（`mean` のみ・14 metric ぶん）を追加。段位平均線の経路を実データ形状で試験できるようにする
  実行: `node -e "const g=require('./src/domain/__fixtures__/global_histogram.json'); console.log(Object.keys(g['16']))"` → `[ '0', '10503' ]`

### 8.1 上位%が #4 の計算と一致する（Issue 完了条件1）

- [ ] **A1-1** `histogramView.test.ts` が §4.3 の検算表10件を検証する。実行: `npm test -- histogramView` → 10件とも `toBeCloseTo` で合格。とくに `和牌率 → '上位 21.8%'` / `放铳率 → '上位 35.2%'` / `和了巡数 → '上位 32.7%'`
- [ ] **A1-2** `toTopPercent` が `percentile()` の戻り値をそのまま使っていること（独自の累積和を再実装していないこと）。実行: `grep -n "percentile" src/compare/*.ts` で `src/domain` からの import 経由の呼び出しだけが出ること。`histogramView.ts` に `bins.reduce` による累積和の再実装が**無い**こと（`cropHistogram` の度数合計は別物なので可）
- [ ] **A1-3** **red 確認**: `toTopPercent` の `direction === 'lower'` 分岐を `1 - percentileValue` に書き換えると A1-1 が落ちる。確認後に戻す

### 8.2 lowerIsBetter の反転（Issue 完了条件2）

- [ ] **A2-1** `COMPARE_METRICS` の `direction === 'lower'` が **放銃率・平均放銃点・銃点損失・平均和了巡目 のちょうど4件**。実行: `npm test -- compareMetrics`（テーブルの件数・キー・direction を検証するテストを置くこと）
- [ ] **A2-2** dev ギャラリー `#/__compare` を開き、`放铳率`（自分が卓平均より**低い**＝良い）のカードの上位%チップが `data-tone="good"`、`和牌率`（自分が卓平均より高い）も `good` であること。実行: ブラウザで `document.querySelectorAll('[data-metric="dealInRate"] [data-testid="top-percent"]')[0].dataset.tone` → `"good"`
- [ ] **A2-3** `neutral` 4指標（立直率・副露率・ツモ率・闇聴率）のチップが `data-tone="neutral"`

### 8.3 分布の描画

- [ ] **A3-1** `cropHistogram` が §1.3 の表の窓を再現する。実行: `npm test -- histogramView` で `打点效率 → xMin=600, xMax=1900`、`和了巡数 → xMin=9.6, xMax=12.8` が合格
- [ ] **A3-2** クロップ後も `percentile` は全域で計算されている。実行: A1-1 が合格していること＋`HistogramCard` が `percentile` に窓ではなく `histogram` を渡していることをコードで確認
- [ ] **A3-3** マーカーが窓外に出るケースで窓が広がる。実行: `cropHistogram(和牌率のヒストグラム, [0.45])` の `xMax >= 0.45`
- [ ] **A3-4** レンジ外クランプ。実行: dev ギャラリーの状態5で SVG 内の自分マーカーに `data-clamped="high"` が付き、線が右端に描かれ、カード注記に「レンジ外」の文言が出ること
- [ ] **A3-5** SVG の要素数。実行: ブラウザで比較タブ（または dev ギャラリー14枚相当）を開き
  `[...document.querySelectorAll('[data-testid="histogram"]')].map(s=>s.children.length)` → **全て 6 以下**
- [ ] **A3-6** マーカー線の太さがカード幅で変わらない。実行: ウィンドウ幅 1400px と 500px で `document.querySelector('[data-testid="histogram"] [data-marker="self"]').getBoundingClientRect().width` を比較 → **差が 0.5px 以内**（`vector-effect="non-scaling-stroke"` が効いている証拠）
- [ ] **A3-7** `bins.length` がコードにハードコードされていない。実行: `grep -rn "120\|100" src/compare/*.ts src/compare/*.tsx` の結果に bin 本数として使われている数値が無いこと

### 8.4 代表モード（Issue 完了条件3）

- [ ] **A4-1** 単体テスト: 候補 `[16,12]`・`gameCountByMode {16:10, 12:99}` → 代表 `12`。候補 `[16,12]`・同数 → 代表 `16`（上位卓優先）。候補0 → `empty`
- [ ] **A4-2** 追加リクエストが候補1つのとき0本であること。実行: `useRepresentativeMode` のテストで `getPlayerStats` のモックが**呼ばれない**こと（`toHaveBeenCalledTimes(0)`）
- [ ] **A4-3** チップ切替。dev ギャラリー（候補3つ）で別モードのチップをクリック → 選択状態が移り、`auto: false` になり、代表モードが切り替わること
- [ ] **A4-4** `filter` の変更で `override` がリセットされること（テスト）

### 8.5 `global_histogram` の取得回数（Issue 完了条件4）

- [ ] **A5-1** 実行: dev サーバーで比較タブを開き（**この検証には実 API アクセスが伴うため、統括担当の許可を得てから行う。許可が出なければ A5-2 のコードレビューで代替する**）、DevTools Network で `global_histogram` が **1回だけ**であること。サマリー↔比較のタブ往復・期間フィルタ変更・モードチップ切替のいずれでも増えないこと
- [ ] **A5-2** 代替検証（API を叩かない）: `grep -rn "getGlobalHistogram\|useGlobalHistogram" src/compare/` が **0件**であること（比較タブは `scope.distribution` しか読まない）。かつ `src/filters/useGlobalHistogram.ts` の `useEffect` deps が `[numPlayers]` のままであること

### 8.6 段位分布カード（Issue 完了条件1の前半）

- [ ] **A6-1** `buildLevelDistributionView` の単体テスト。`src/domain/__fixtures__/level_statistics.json` を入力に `numPlayers: 4` で
  `bars` が `[10101, 10301, 10501, 10799]` の4本、度数が `[21411, 20302, 1604, 87]`、`total === 43404`。
  **zone 1/2/3 をすべて合算し（`[3,10101,1000]` と `[2,10301,5000]` を落とさない）、`2xxxx`（`[2,20302,900]`）だけを除外する**のが要点。
  実行: `npm test -- levelDistributionView`
- [ ] **A6-2** 上位%（R-5 の定義）。`selfLevelId: 10301` → `topPercent.ratio ≈ 0.038960` → 表示 `上位 3.9%`。
  `selfLevelId: 10501` → `上位 0.2%`
- [ ] **A6-2b** 魂天の畳み込み。`selfLevelId: 10701` → `selfBucketId === 10799`、`bars` の `10799` が `isSelf === true`、
  `topPercent.ratio === 0` → 表示 **`上位 0.1%未満`**（自分の帯は上位に数えないため。畳み込みを忘れると
  `levelDistributionPosition` が `10799` を「自分より上」に数えて `上位 0.2%` になってしまう）
- [ ] **A6-3** ラベル。`levelBucketLabel(10799) === '魂天'`（**`'魂天99'` ではない**）。`levelBucketLabel(10501) === '雀聖1'`（雀豪1なら `levelBucketLabel(10401) === '雀豪1'`）
- [ ] **A6-4** `selfLevelId: null` で `topPercent === null`・全 `isSelf === false`・分布は描かれる
- [ ] **A6-5** **red 確認**: `levelStatBucketId` を恒等関数に書き換えると A6-2b が落ちる（`上位 0.1%未満` → `上位 0.2%`）。確認後に戻す

### 8.7 sticky コンテキストバー

- [ ] **A7-1** `src/shell/shell.css` の `.layered-sheet__layer` が `overflow-x: clip` になっており、変更理由のコメントがあること
- [ ] **A7-2** **実測**: dev サーバーで比較タブを開き（許可が要る場合は dev ギャラリーに `.layered-sheet__layer` 相当の器を用意して代替）、
  ```js
  const b=document.querySelector('[data-testid="compare-context-bar"]');
  const t0=b.getBoundingClientRect().top; window.scrollTo(0,800);
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  ({t0, t1:b.getBoundingClientRect().top});
  ```
  → **`t1` がアプリヘッダ高さ（64px）にとどまる**こと（`t0` から大きく負に振れたら不合格）
- [ ] **A7-3** タブ遷移アニメーション後に水平スクロールバーが出ないこと（`clip` 変更の副作用が無いことの確認）。実行: サマリー↔比較を3往復し `document.documentElement.scrollWidth <= document.documentElement.clientWidth`
- [ ] **A7-4** 期間フィルタが `all` 以外のとき、注記に「全期間」の断り書きが出ること（`all` のときは出ないこと）

### 8.8 light/dark 両対応（Issue 完了条件5）

- [ ] **A8-1** dev ギャラリーを light / dark 双方で開き、分布の塗り・3種のマーカー線・上位%チップが背景に対して判別できること。**`prefers-color-scheme` のエミュレーションは `matchMedia` の change を発火しない**（CLAUDE.md 既知の制約）ので、`localStorage['mjsv:color-mode']` を切り替えてリロードして確認する
- [ ] **A8-2** `grep -rniE "#[0-9a-f]{3,8}|rgb\(|hsl\(" src/compare/compare.css` が 0 件（色のハードコードなし）
- [ ] **A8-3** マーカー3種は色を消しても線種で区別できること（実行: DevTools で3本の `stroke` を同一色にしても実線/破線/点線で判別できる）

### 8.9 リグレッションと予算

- [ ] **A9-1** `npm run build` が型エラー無しで通り、`dist/assets/index.js` の増分が **raw +36 kB / gzip +10 kB 以内**、CSS の増分が **raw +7 kB / gzip +2 kB 以内**。ベースラインは §1.6（503.51 kB / gzip 138.77 kB、CSS 24.50 kB / gzip 4.12 kB）。**実数値を報告すること**
- [ ] **A9-2** `npm run lint` が clean
- [ ] **A9-3** `npm test` が全件合格（既存テストを1件も壊していない）
- [ ] **A9-4** 本番バンドルに dev コードが混入していないこと。実行: `grep -c "CompareGallery" dist/assets/index-*.js` → 0
- [ ] **A9-5** **対照実験（ミューテーション判定の前に必ず行う）**: `HistogramCard` の中で意味を変えないダミー改変（例: 変数名変更、等価な三項演算子への書き換え）を1つ入れて `npm test` が **合格したまま（SURVIVED）**であることを確かめる。ここが KILLED になるなら以降のミューテーション判定は信用できない
- [ ] **A9-6** ミューテーション: `COMPARE_METRICS` の `和了巡数` の `direction` を `'lower'` → `'higher'` に変えると A2-1 が落ちること。確認後に戻す

---

## 9. 後続 Issue への引き継ぎ

- **#14（スタッツタブ）**: `compareMetrics.ts` の `CompareMetric`（`statsKey` / `unit` / `direction` / `denominatorNote`）と `histogramView.ts` のフォーマッタは**そのまま流用できる形にしてある**。スタッツタブは全指標のリスト表示なので、テーブルを `src/compare/` から共通の場所（`src/metrics/` 等）へ引き上げるのは #14 の判断でよい。本 Issue では移動しない（早すぎる抽象化を避ける）
- **`Histogram.tsx` / `HistogramCard.tsx`** はフックを持たない純表示部品なので、他タブから任意のデータで再利用できる
- **`useLevelStatistics`** は `src/filters/` に置いたので #14 からも使える
- **要件書との食い違い**: `docs/requirements.md` §4.2 は「闇聴率」、GitHub Issue #13 本文は「黙聴率」。本設計は要件書 §8（CLI版準拠）に従い **闇聴率**を採用した。Issue 本文の表記ゆれは統括担当が必要に応じて修正のこと
- **R-3 で「追加リクエスト不可」と判断された場合**、要件書 §4.2 の「対局数最多を代表として自動採用」の記述を改訂する必要がある
- **`overflow-x: clip` 変更は全タブに効く共有 CSS 変更**。#14 以降で層内に sticky を置きたくなったとき、この変更が前提になる（本設計書 §1.5 を参照させること）
- **500 kB チャンク警告**は本 Issue 以前から出ている。コード分割（タブ単位の lazy import）は別 Issue に切り出す価値がある

## 10. 実挙動未確認の一覧（推定で書いた箇所）

| 箇所 | 内容 |
|---|---|
| §1.4 | `自摸率` / `平均打点` / `平均铳点` / `净打点效率` の band 0 `histogramFull` の存在・レンジ・単位。**フィクスチャに無く、実 API でも未確認**。#11 §1.7-1 が単位未確認を既に記録している |
| §1.3 | 実 API の `bins.length`（Issue 本文は120、フィクスチャは100）。フィクスチャの分布形状は `和牌率` 以外**合成値** |
| §6.2 | band 0 の `count` metric に `histogramFull` があるか（issue-3 §1.3 差分7 からの推定。高確度だが目視していない） |
| §6.5 | pl3 の段位帯 band キー（`2xxxx` 系か、魂天合算が `20799` か）。#4 §9 のとおり pl3 の `global_histogram` は一度も取得していない |
| §5.2 | `level_statistics` が実際にどの levelId 粒度で返すか（フィクスチャは 8 件のみ）。minorRank 込みの levelId が来る前提で設計した |
| §1.5 | プローブページでの測定であり、実際の `PlayerLayout` + `TabTransition` + `FilterBar` を積んだ状態での sticky 挙動は未確認（A7-2 で検収時に実測させる） |
