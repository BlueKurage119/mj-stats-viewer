# Issue #12 設計書 — サマリー・カード5: 和銃分布（ドーナツ3枚）

対象 Issue: [#12](https://github.com/BlueKurage119/mj-stats-viewer/issues/12)
参照要件: `docs/requirements.md` §4.1（カード5）
前提設計書: [issue-4](issue-4-domain-logic.md)（ドメイン）/ [issue-6](issue-6-global-filter.md)（グローバルフィルタ）/ [issue-9](issue-9-rank-donut.md)（ドーナツ描画・順位色の実測）/ [issue-11](issue-11-key-stats.md)（`@container` ブレークポイント・新トークン追加の作法）
ベースコミット: `1d78d2e`（`main`。#10 マージ済み）

---

## §0 統括担当への確認事項（着手前に判断が要るもの）

### R-1 凡例に「回数」を出すか（推奨: **出さない。% のみ**）

カード2（順位ドーナツ）の凡例は `11回 (20.4%)` と回数を併記している。しかし本カードでは**3枚のうち回数が存在するのはドーナツ1だけ**である（§1.1 の実測: ドーナツ2・3の元データは回数ではなく率）。

| 案 | 内容 | トレードオフ |
|---|---|---|
| a（**推奨**） | 3枚とも **% のみ** | 3枚が同じ書式に揃う。母数（和了回数・放銃回数）が画面に出ない |
| b | ドーナツ1だけ `21回 (36.2%)`、2・3は % のみ | 情報量は増えるが、同一カード内で凡例の書式が割れる。しかも §1.4 の不一致（内訳合計 58 が「和了率×局数 = 88」と合わない）を画面に持ち込むことになる |

**a を前提に以降を記述する。** b を採る場合の差分は §4.5 の注記に記した（凡例に `21回` を足すだけで、他の設計は変わらない）。

### R-2 スライス色に新トークン系統 `--md-custom-color-hand-*` を3つ追加してよいか（推奨: **追加する**）

既存トークンの流用は §2.3 の実測により**いずれも破綻する**。追加する場合の実測値は §5、バンドル増分は **+0.38 kB / gzip +0.12 kB**（§1.6 実測）。

### R-3 `src/api/normalize.ts` の `?? 0` 補完対象に回数系6キーを追加してよいか（推奨: **追加する**）

Issue 本文の「回数系が0省略される場合の `?? 0` 補完」を満たすには api 層に触る必要がある（§1.3）。api 層は #3 / #23 の担当範囲であり、既存テスト（`normalize.test.ts`）も動く。影響は §4.1 に限定して記した。

---

## §1 実物調査の結果（すべて本作業で実測。推定は §8 に隔離した）

### 1.1 **ドーナツ3の元データは「回数」ではなく「率」である**（統括担当の事前情報の訂正）

`src/api/testdata/player_extended_stats.json`（#3 が実 API から保存したレスポンス）を実読した。

| キー | 実値 | 3つの合計 | 判定 |
|---|---|---|---|
| `立直和了` / `副露和了` / `默听和了` | `21` / `29` / `8` | **58** | **回数**（整数） |
| `放铳至立直` / `放铳至副露` / `放铳至默听` | `0.1875` / `0.5` / `0.3125` | **1.0000** | **率（0..1）** |
| `放铳时立直率` / `放铳时副露率` | `0.1538` / `0.4615` | 0.6153（≤1） | 率（0..1） |

キー名に「率」が付かない `放铳至*` が率であることは名前からは分からない。**`0.1875` のような小数値と合計 1.0 がその証拠である。**

**設計への影響**

- 既存の `dealInBreakdown()` は「各値 ÷ 3値の合計」なので、**入力が率でも正しい構成比を返す**（合計 1 で割るので恒等変換になる）。関数の改修は不要。ただし**ドキュメンテーションコメントは実態と食い違っており修正が要る**（§4.2）。
- Issue 本文の「各内訳% は 回数÷合計」は**ドーナツ1にのみ当てはまる**。
- **ドーナツ3では凡例に回数を出せない**（R-1 の根拠）。

`src/api/testdata/global_statistics_2.json`（卓平均用フィクスチャ）でも `放铳至*` の3値の合計は 1.0000 だった（ただしこのファイルは手作りフィクスチャなので独立した証拠にはならない）。

### 1.2 ドーナツ2は「率2つ＋残り」で構成比になる。ただし**空判定を自力でできない**

`放铳时立直率 + 放铳时副露率 = 0.6153 ≤ 1`。門前（残り）= `1 - 0.1538 - 0.4615 = 0.3847`。3値の合計は定義上ちょうど 1 になる。

**ここに設計上の罠がある。**

- `放铳时立直率 = 0` かつ `放铳时副露率 = 0` は、**「放銃が1回も無い」と「放銃したが常に門前だった」の両方**を意味しうる。ドーナツ1・3の `winBreakdown` / `dealInBreakdown` は「3値の合計が 0 なら null」で空を判定できるが、ドーナツ2は同じ手が使えない（残りを足すと必ず合計 1 になるため、常に「門前 100%」になってしまう）。
- したがって**ドーナツ2の空判定には別の入力が要る**。本設計では **`放铳率 === 0` を空の判定に使う**（§4.2）。

### 1.3 回数系6キーは `?? 0` 補完されていない（`normalize.ts` を実読）

`src/api/normalize.ts` の `normalizePlayerExtendedStats` が `?? 0` を当てているのは
`最大连庄` / `最大累计番数` / `役满` / `累计役满` / `W立直` / `流满` の**6キーだけ**で、
`立直和了` / `副露和了` / `默听和了` / `放铳至立直` / `放铳至副露` / `放铳至默听` は `...rest` で素通しである。
`src/api/types.ts` の `RawPlayerExtendedStats` でもこの6キーは**必須 `number`** として宣言されている（`?` が付いていない）。

→ **API がこれらを 0 省略した場合、公開型で `number` と宣言された位置に `undefined` が入り、`riichi + furo + moten` が `NaN` になる。** `NaN === 0` は false なので既存の null 判定もすり抜け、ドーナツは**弧が1本も描かれない無言の空表示**になる（例外もエラーも出ない）。Issue 本文が `?? 0` 補完を要求しているのはこの穴である。§4.1 で塞ぐ。

`放铳时立直率` / `放铳时副露率` は「率」であり、`?? 0` 補完の根拠（issue-3 §1.3 差分8「回数系6キーは値0のときキー自体が省略される」）の対象外である。**0 省略が起きるかは実挙動未確認**（§8）。本設計では api 層を触らず、ビューモデル側で `Number.isFinite` ガードを入れる（§4.3）。

### 1.4 ドーナツ1の内訳合計は「和了率 × 局数」と一致しない（**画面に出さない根拠**）

実レスポンスで検算した結果:

| 検算 | 値 |
|---|---|
| `立直和了 + 副露和了 + 默听和了` | **58** |
| `和牌率 (0.4536) × count (194)` | **88.0** |
| `立直率 × count × 立直后和牌率` | 19.6（実値 `立直和了 = 21` とほぼ一致） |
| `副露率 × count × 副露后和牌率` | 29.6（実値 `副露和了 = 29` とほぼ一致） |

個別のキーは「その状態での和了回数」として整合するが、**3つの合計は `和牌率 × count` と合わない**（58 vs 88）。原因は特定できていない（`和牌率` の分母が `count` ではない可能性が高い）。

**設計判断**: 本カードは**各ドーナツの内部でのみ正規化する**（3値の合計を 100% とする）。`和牌率`・`放铳率`・`roundCount` など**カード外の値と突き合わせて母数を表示・検算しない**。受け入れ条件の「各カテゴリの合計と内訳が整合する」も、**ドーナツ内部の整合**（表示 % の合計がちょうど 100.0%）として定義する（§6）。

### 1.5 描画基盤は #9 の資産をそのまま使える（実読）

- `src/summary/Donut.tsx` は既にカード非依存の汎用部品として切り出されている（コメントに「#12 で再利用するため」と明記）。`segments` / `ariaLabel` / `children` / `placeholder` を受ける。
- ただし `data-testid="rank-donut"` が**ハードコード**されている。ドーナツが3枚並ぶと同一 testid が4個（カード2の1個＋本カードの3個）になり、検収の `getAllByTestId` が曖昧になる。**`testId` プロップ（既定値 `'rank-donut'`）の追加が必要**（§4.4）。既定値を維持するので issue-9 の受け入れ条件は壊れない。
- 弧の幾何（`DONUT_RADIUS=60` / `DONUT_STROKE=24` / `DONUT_GAP=4` / `DONUT_MIN_ARC=2` / `DONUT_CIRCUMFERENCE`）と累積オフセット計算、および `percentText()`（二重丸め回避のため `rate*1000` を先に丸める）は `src/summary/rankView.ts` にある。`percentText` は**モジュール private で export されていない**。
- `.donut` の CSS（`max-width: 240px` / `aspect-ratio: 1` / `.donut__track` / `.donut__seg` のトランジション）は `summary.css` にあり、そのまま効く。

### 1.6 新トークン3系統のバンドル増分（実測。計測後に `git checkout` で復元済み）

`src/theme/seeds.ts` に `HAND_COLOR_SOURCES` / `HAND_COLOR_TONES` を、`applyTheme.ts` に `TonalPalette` 経由の3行の `setProperty` を一時的に足して `npm run build` した。

| 構成 | modules | JS | 増分 | gzip | gzip 増分 |
|---|---|---|---|---|---|
| ベースライン（`1d78d2e`） | 318 | 498.80 kB | — | 137.62 kB | — |
| ＋ `--md-custom-color-hand-*` 3トークン | 318 | **499.18 kB** | **+0.38 kB** | 137.74 kB | **+0.12 kB** |

CSS は 22.15 kB のまま変化なし。計測後に両ファイルを `git checkout` し、`git status --porcelain` が空であることを確認済み。

### 1.7 `FilteredStatsState` と上流（実読・#9 §1.6 の再確認）

`SummaryPanel` は `scope.stats.kind === 'empty'` を上流で処理してカード群ごと出さないため、**本カードに `empty` は到達しない**（`KeyStatsCard.tsx` L90 のコメントと同じ前提）。`ready` でも `state.extended === null` はありうる。

---

## §2 設計判断

### 2.1 3枚のドーナツは**同一のカテゴリ軸**を共有する

| # | タイトル | 区分1 | 区分2 | 区分3 | 元データ |
|---|---|---|---|---|---|
| 1 | 和了時の状態 | 立直 | 副露 | 黙聴 | `立直和了` / `副露和了` / `默听和了`（回数） |
| 2 | 放銃時の状態 | 立直 | 副露 | **門前** | `放铳时立直率` / `放铳时副露率` / 残り（率） |
| 3 | 放銃相手の状態 | 立直 | 副露 | 黙聴 | `放铳至立直` / `放铳至副露` / `放铳至默听`（率） |

3枚とも「立直 / 副露 / それ以外（門前系）」という**同じ軸**である。したがって:

- **色は3枚で共通**（区分1=立直色・区分2=副露色・区分3=門前色）。カードを横断して「紫＝立直」が一貫する。
- ドーナツ2の第3区分だけラベルが **`門前`**。理由: `放铳时*` は放銃した局面の自分の状態であり、聴牌しているとは限らないので「黙聴（＝門前聴牌でダマ）」と言い切れない。**ラベルを嘘にしない。**

### 2.2 描画は #9 の `Donut` を再利用する。`recharts` は検討しない

issue-9 §1.1 で `recharts` は最小構成でも +274.83 kB と実測済み。再測定しない。

### 2.3 スライス色は新トークン系統を立てる（既存トークンの流用は全て破綻する）

| 流用候補 | 却下理由（根拠） |
|---|---|
| セクション色 `--md-custom-color-{win,dealin,riichi,luck}` | MD3 の customColor ロールは **light 40 / dark 80 に正規化**され、色同士のコントラストが 1.00 になる（issue-9 §1.2 実測）。グレースケールで3スライスが区別できない。加えて CLAUDE.md「保留中の設計判断」でセクション色は**廃止の可能性**がある |
| 順位色 `--md-custom-color-rank-1..3`（金・銀・銅） | 同一ページのカード2で「1位・2位・3位」を表す色。同じ画面で「金＝1位」と「金＝立直」が同居し、issue-11 §5.3 案 b を却下したのと同じ理由で破綻する |
| `--md-sys-color-primary` / `secondary` / `tertiary` | primary は**段位シード依存**なので、プレイヤーの段位が変わると「立直の色」が変わる。secondary は primary と同色相の低彩度で、隣接スライスとして識別できない |

→ **順位色と同じ手口**（`TonalPalette.fromInt(source).tone(t)` を段位シードから独立に叩き、区分ごとに**違うトーン**を当てて輝度差を作る）で3トークンを新設する。実測値は §5。

### 2.4 パーセント表示は**最大剰余法で 0.1% 単位に配分**し、合計をちょうど 100.0% にする

単純に各値を `toFixed(1)` すると、3値の合計が 99.9% や 100.1% になる（例: 1/3 ずつ → 33.3×3 = 99.9）。受け入れ条件「各カテゴリの合計と内訳が整合する」を**機械的に検証可能**にするため、`千分率の整数（tenths）`に最大剰余法（カード2の `rankCounts` と同じ手法）で配分し、**表示 % の合計が常に 1000 tenths = 100.0%** になるようにする。

弧の長さには丸め前の生の比率を使う（表示と描画で 0.05% 未満の差は視認できない）。

### 2.5 各ドーナツは**独立に空になりうる**

「和了 0 回だが放銃はある」「放銃 0 回だが和了はある」は実在する（短期間フィルタで容易に起きる）。カード全体を空にせず、**ドーナツ単位で空表示**にする。カード全体のメッセージは `error` と `extended === null` のときだけ（§4.5）。

---

## §3 モジュール構成

```
src/domain/derived.ts          既存 winBreakdown / dealInBreakdown はそのまま使う（改修は型 export と
                               コメント修正のみ）。dealInStateBreakdown を1本追加する（§4.2）
src/api/types.ts               RawPlayerExtendedStats の回数系6キーを optional にする（§4.1）
src/api/normalize.ts           同6キーに ?? 0 を当てる（§4.1）
src/summary/donutShared.ts     新規。幾何定数・弧計算・percentText・最大剰余法を集約（§4.3-a）
src/summary/rankView.ts        上記を donutShared から import して再 export（振る舞いは不変）
src/summary/Donut.tsx          testId プロップを追加（§4.4）
src/summary/winLoseView.ts     新規。カード5のビューモデル（React 非依存の純関数）
src/summary/WinLoseCard.tsx    新規。表示コンポーネント（フックを使わない）
src/summary/summary.css        .win-lose-card__* を追記
src/summary/SummaryPanel.tsx   KeyStatsCard の直後に <WinLoseCard state={scope.stats}/> を追加
src/theme/seeds.ts             HAND_COLOR_SOURCES / HAND_COLOR_TONES を追加（§5）
src/theme/applyTheme.ts        --md-custom-color-hand-* を3本書き出す（§5）
src/dev/WinLoseGallery.tsx     新規。dev 専用 #/__winlose（受け入れ条件の実行基盤）
src/main.tsx                   dev ルート追加（既存の literal 分岐 + 動的 import の形を崩さない）
```

新規テスト: `src/summary/winLoseView.test.ts`、`src/summary/donutShared.test.ts`。
既存テストで追記が要るもの: `src/domain/derived.test.ts`（`dealInStateBreakdown`）、`src/api/normalize.test.ts`（0 省略の補完）。

---

## §4 詳細設計

### 4.1 api 層: 回数系6キーの `?? 0` 補完（§0 R-3）

`src/api/types.ts` の `RawPlayerExtendedStats` で以下6キーに `?` を付ける:

```ts
  放铳至立直?: number;
  放铳至副露?: number;
  放铳至默听?: number;
  立直和了?: number;
  副露和了?: number;
  默听和了?: number;
```

`src/api/normalize.ts` の `normalizePlayerExtendedStats` の分割代入に6キーを足し、既存6キーと同じ形で `?? 0` を当てる。

- **公開型 `PlayerExtendedStats` は `number` のまま変えない**（`?` を付けない）。既存の消費側（`keyStatsView` 等）に影響しない。
- 型コメント（`RawPlayerExtendedStats` の docstring「回数系6キーは値0のときキー自体が省略される」）を「回数系12キー」に更新し、`放铳至*` は**率だが 0 省略の実挙動が未確認のため予防的に補完している**旨を書く。
- **`放铳时立直率` / `放铳时副露率` は触らない**（§1.3。率であり補完根拠が無い）。代わりに §4.3 でランタイムガードする。

### 4.2 domain 層

**変更（最小限）**

1. `type Breakdown` を `export type Breakdown` にする（ビューモデルが戻り値の型を名指しするため）。
2. `winBreakdown` の docstring `/** 和了の相手内訳 */` は誤り（相手ではなく**自分の和了時の状態**）。`/** 和了時の自分の状態内訳（立直/副露/黙聴） */` に直す。
3. `dealInBreakdown` の docstring に「**入力は回数ではなく率（合計 1）で来る。合計で割るので率でも回数でも正しい構成比になる**」を追記する（§1.1 の実測を関数の脇に残す）。

**追加（1本だけ）**

```ts
/**
 * 放銃時の自分の状態内訳（立直/副露/門前）。
 * 放铳时立直率・放铳时副露率は API が率(0..1)で返すので、門前 = 1 - 立直 - 副露 として合成する。
 *
 * 空判定に放铳率を使う理由（issue-12 §1.2）:
 * 立直率0・副露率0 は「放銃が無い」と「放銃したが常に門前」の両方を意味しうるため、
 * 3値の合計では空を判定できない。放铳率 === 0 のときだけ null を返す。
 */
export function dealInStateBreakdown(
  s: Pick<PlayerExtendedStats, '放铳率' | '放铳时立直率' | '放铳时副露率'>,
): Breakdown | null;
```

振る舞い:

| 入力 | 戻り値 |
|---|---|
| `放铳率 === 0` | `null` |
| `放铳率 > 0`, 立直 0.1538 / 副露 0.4615 | `{ 立直: 0.1538, 副露: 0.4615, 默听: 0.3847 }` |
| `放铳率 > 0`, 立直 0 / 副露 0 | `{ 立直: 0, 副露: 0, 默听: 1 }`（門前 100%。**null にしない**） |
| 立直 + 副露 > 1（異常値） | 門前を 0 にクランプし、立直・副露を `(立直+副露)` で正規化して合計 1 を保つ |
| いずれかが有限数でない（`undefined` / `NaN`） | `null` |

- 戻り値の3つ目のキーは既存 `Breakdown` に合わせて `默听` のままにする（型を分けない）。**ラベル「門前」はビュー側で当てる**（§4.3-c）。既存 `winBreakdown` / `dealInBreakdown` のテストと型を壊さないための判断。
- `src/domain/index.ts` に `dealInStateBreakdown` と `type Breakdown` を追加 export する。

### 4.3 `src/summary/donutShared.ts`（新規）と `winLoseView.ts`（新規）

**a. `donutShared.ts` — カード2から抽出する共有部品**

`rankView.ts` から以下を**移動**し、`rankView.ts` は `donutShared` から import して同名で再 export する（`Donut.tsx` は import 元を `./donutShared` に付け替える）。

```ts
export const DONUT_RADIUS = 60;
export const DONUT_STROKE = 24;
export const DONUT_GAP = 4;
export const DONUT_MIN_ARC = 2;
export const DONUT_CIRCUMFERENCE: number;

/** 0..1 の割合の配列 → 各スライスの弧長・オフセット。rate===0 は arcLength=null（描かない） */
export function toDonutArcs(rates: readonly number[]): readonly { arcLength: number | null; arcOffset: number }[];

/** 0..1 → '20.4'（% 記号なし）。rate*1000 を先に丸めて二重丸めを避ける */
export function percentText(rate: number): string;

/**
 * 合計1の比率配列 → 0.1%単位の整数配列（最大剰余法。合計は常に 1000）。
 * 端数が同値のときは**添字の小さい方**に先に配分する（配列の安定ソートで担保。
 * 受け入れ条件 §6-11/13 の期待値がこの規則に依存するので変えないこと）。
 */
export function percentTenths(rates: readonly number[]): readonly number[];
```

- `toDonutArcs` は `rankView.ts` 内の累積オフセット計算・`DONUT_GAP` 減算・`DONUT_MIN_ARC` クランプの**忠実な抽出**とする。**振る舞いを一切変えないこと。**`rankView.test.ts` と `#/__rank` の受け入れ条件が全て不変で通ることを製造担当が確認する（§6 の回帰項目）。
- `percentTenths` は `rankView.ts` の `rankCounts`（最大剰余法）と同じ考え方で、配分単位を「1回」から「0.1%」に置き換えたもの。`rankCounts` は回数を返す別関数なので**統合しない**（カード2の凡例の回数表示はそのまま）。

**b. `winLoseView.ts` の出力型**

```ts
export type DonutKey = 'winState' | 'dealInState' | 'dealInTarget';
export type HandColorKey = 'hand-riichi' | 'hand-furo' | 'hand-menzen'; // theme/seeds から import

export interface WinLoseSlice {
  readonly key: HandColorKey;      // React key 兼 色トークン名
  readonly label: string;          // '立直' | '副露' | '黙聴' | '門前'
  readonly rate: number;           // 0..1（丸め前）
  readonly percentText: string;    // '36.2'（% 記号なし。3枚合計は常に '100.0' 相当）
  readonly arcLength: number | null;
  readonly arcOffset: number;
}

export interface WinLoseDonut {
  readonly key: DonutKey;
  readonly title: string;                        // '和了時の状態' 等
  readonly slices: readonly WinLoseSlice[] | null; // null = このドーナツはデータ無し
  readonly ariaLabel: string;                    // slices が null なら '和了時の状態 データなし'
}

export interface WinLoseView {
  readonly donuts: readonly WinLoseDonut[]; // 常に長さ3・上表の順
}

/** extended が null のときは呼ばない（カード側でメッセージを出す） */
export function buildWinLoseView(extended: PlayerExtendedStats): WinLoseView;
```

**c. ラベルと色の対応（この表がこのカードの単一情報源）**

| DonutKey | title | slice1 | slice2 | slice3 | 元の Breakdown |
|---|---|---|---|---|---|
| `winState` | 和了時の状態 | 立直 | 副露 | 黙聴 | `winBreakdown(extended)` |
| `dealInState` | 放銃時の状態 | 立直 | 副露 | **門前** | `dealInStateBreakdown(extended)` |
| `dealInTarget` | 放銃相手の状態 | 立直 | 副露 | 黙聴 | `dealInBreakdown(extended)` |

- slice の `key` は3枚とも `hand-riichi` / `hand-furo` / `hand-menzen` の順で固定。
- `Number.isFinite` ガード: `winBreakdown` / `dealInBreakdown` に渡す前に3値が全て有限数か検査し、そうでなければそのドーナツを `slices: null` にする（§4.1 の `?? 0` が効かなかった場合の二重の守り。`dealInStateBreakdown` は関数内で同じ検査をする）。
- `ariaLabel`: `` `${title} ${slices.map(s => `${s.label} ${s.percentText}%`).join(' ')}` ``。

### 4.4 `Donut.tsx` の変更（1点だけ）

```ts
export interface DonutProps {
  // …既存…
  readonly testId?: string; // 既定 'rank-donut'（issue-9 の受け入れ条件を壊さないため）
}
```

`data-testid={testId}` にする。本カードは `testId={`win-lose-donut-${donut.key}`}` を渡す。**それ以外は変更しない。**

### 4.5 `WinLoseCard.tsx`

DOM 構造:

```
<ElevatedCard class="win-lose-card" data-testid="win-lose-card" data-state={loading|ready|error}>
  <div class="win-lose-card__inner">           ← container-type: inline-size
    <h2 class="win-lose-card__title">和銃分布</h2>
    <div class="win-lose-card__body[ --message]">
      <div class="win-lose-card__donuts" data-testid="win-lose-donuts">
        <section class="win-lose-card__item" data-donut="winState">
          <h3 class="win-lose-card__item-title md-typescale-label-large">和了時の状態</h3>
          <Donut … testId="win-lose-donut-winState" placeholder={slices===null} />
          <ul class="win-lose-card__legend">  ← 常に3行（loading/空はスケルトン or ダッシュ）
            <li><span class="win-lose-card__swatch" style="--swatch: var(--md-custom-color-hand-riichi)"/>
                <span …>立直</span><span class="numeric">36.2%</span></li>
            …
          </ul>
          <p class="win-lose-card__empty">…</p>   ← slices===null のときだけ
        </section>
        …（dealInState / dealInTarget）
      </div>
      <p class="win-lose-card__message">…</p>     ← カード全体のエラー時だけ
    </div>
  </div>
</ElevatedCard>
```

状態の決定（`KeyStatsCard` と同じ書き方に揃える）:

| `state` | 表示 |
|---|---|
| `loading` | 3枚とも `placeholder` ドーナツ＋凡例3行のスケルトン。`data-state="loading"` |
| `ready` かつ `extended === null` | 枠を残したまま `和銃分布を表示できません` を重ねる。`data-state="error"` |
| `ready` かつ `extended` あり | `buildWinLoseView` の結果を描画。個々のドーナツが `slices === null` なら**そのセルだけ**プレースホルダ＋`データがありません`（凡例は3行のまま値を `—` にする） |
| `error` | `state.message` を重ねる。`data-state="error"` |
| `empty` | 到達しない（§1.7） |

- 中央の穴には**何も置かない**（§1.4 の理由で母数を出さない。R-1=b を採る場合はここではなく凡例に回数を足す）。
- **フックを使わない純粋な表示コンポーネント**にする（dev ギャラリーから任意の状態を流し込むため）。

### 4.6 レイアウト

```css
.win-lose-card__inner { container-type: inline-size; container-name: win-lose-card; }

/* 既定（狭い側）: 3枚を縦に積み、各枚は「ドーナツ左・凡例右」の横並び */
.win-lose-card__donuts { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; }
.win-lose-card__item {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  align-items: center;
  column-gap: 12px;
}
.win-lose-card__item-title { grid-column: 1 / -1; }
.win-lose-card__item .donut { max-width: 120px; }

/* 【配置上の注意】このブロックは .win-lose-card__* の基本ルールより後ろに置くこと。
   詳細度が同じなので、基本ルールが後ろにあると後勝ちでコンテナクエリが打ち消される
   （issue-9 で実際に起きた。summary.css L500 付近のコメント参照）。 */
@container win-lose-card (min-width: 600px) {
  .win-lose-card__donuts { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .win-lose-card__item { grid-template-columns: minmax(0, 1fr); justify-items: center; }
  .win-lose-card__item .donut { max-width: 160px; }
}
```

- ブレークポイント **600px** はカード2・3・4と同一値（`@container rank-card|playstyle-card|key-stats-card (min-width: 600px)`）。
- `@media` ではなく `@container` を使う理由は `summary.css` L243 のコメントに既述。
- 高さ一致（R1）: 3状態でドーナツ枠・凡例3行・タイトルの構造が同一なので行数が変動しない。空セルの `.win-lose-card__empty` は**凡例の値を `—` に差し替える形**にして行を増やさない（別行のメッセージを足さない）。
- 色は `.win-lose-card__swatch { background: var(--swatch); }` と `.donut__seg` の `stroke` のみ。**CSS に色リテラルを書かない。`@media (prefers-color-scheme)` も書かない**（CLAUDE.md 制約5）。

---

## §5 テーマトークンの追加（§0 R-2 の対象）

### 5.1 `src/theme/seeds.ts`

```ts
/** 和銃分布ドーナツの区分色（立直/副露/門前）。3枚のドーナツで共通。issue-12 §2.3 */
export type HandColorKey = 'hand-riichi' | 'hand-furo' | 'hand-menzen';

export const HAND_COLOR_SOURCES: Record<HandColorKey, string> = {
  'hand-riichi': '#9C5BD1', // 立直: パープル（SECTION_COLORS.riichi と同値。ただし customColor 経由ではない）
  'hand-furo': '#00897B',   // 副露: ティール
  'hand-menzen': '#78909C', // 門前・黙聴: スレート（残余カテゴリなので最も低彩度）
};

/**
 * 区分ごとに違うトーンを当てる。MD3 の customColor ロール（light 40 / dark 80 固定）だと
 * 3色の輝度が揃い、隣接コントラストが 1.00 になってグレースケールで区別できなくなる
 * （issue-9 §1.2 実測）。順位色と同じ手口。
 */
export const HAND_COLOR_TONES: Record<'light' | 'dark', Record<HandColorKey, number>> = {
  light: { 'hand-riichi': 48, 'hand-furo': 40, 'hand-menzen': 56 },
  dark: { 'hand-riichi': 78, 'hand-furo': 70, 'hand-menzen': 88 },
};
```

### 5.2 `src/theme/applyTheme.ts`

順位色の書き出しの直後、`--md-custom-color-delta-good` の直前に、順位色と同じ手口で3本追加する（`TonalPalette.fromInt` はモジュールスコープで一度だけ作る）。**段位シードから独立**なので `themeFromSourceColor` は通さない。

### 5.3 実測値（`node` で `@material/material-color-utilities@0.3.0` を直接叩いて計測。5シード × light/dark）

背景 = `ElevatedCard` の地色（`surface-container-low` = neutral tone 96 / 10）。

| モード | hand-riichi | hand-furo | hand-menzen | 背景コントラスト | 相互コントラスト |
|---|---|---|---|---|---|
| light | `#9453c9` | `#006b5f` | `#728a96` | **4.36–4.39 / 5.80–5.83 / 3.27–3.29** | 立直/副露 1.33・立直/門前 1.33・副露/門前 1.77 |
| dark | `#ddafff` | `#52bcac` | `#c8e1ee` | **9.48–9.54 / 7.44–7.49 / 12.58–12.66** | 立直/副露 1.27・立直/門前 1.33・副露/門前 1.69 |

判明した事実:

- **全3色・両モードで背景コントラスト 3:1 以上**（WCAG 1.4.11 非テキストコントラストを満たす）。5シード間の振れ幅は ±0.03 以内で、実質シード非依存。
- `hand-menzen` の light トーンは **56 が下限**。58 で 3.06、60 で **2.87** と 3:1 を割る（実測: tone 50→4.02 / 52→3.75 / 54→3.50 / 56→3.27 / 58→3.06 / 60→2.87）。「門前は淡く」を優先して 60 にすると基準を割るため、**56 が上限側の限界値**である。
- **色相の化けは起きない**（`hand-menzen` は彩度 17.4 の低彩度だが色相 227.6→226.6/227.4 を保持）。issue-9 の customColor 経路で起きた「低彩度が高彩度色相に化ける」現象は `TonalPalette` 直叩きでは起きない。
- **相互コントラストの最小は 1.27**（順位色の 1.22 と同水準）。したがって**カード2と同様、スライス間の隙間（`DONUT_GAP = 4`）は必須**であり、**色を唯一の伝達手段にしない**（凡例に `立直 36.2%` とテキストで書く）。
- カード2の `rank-2`（銀・light `#50585f`）と `hand-menzen`（light `#728a96`）は同系のスレートだが、明度が離れている（コントラスト比 1.9）うえ別カード・別凡例なので混同のリスクは低い。**UI 検証で最終確認する**（§7）。

---

## §6 受け入れ条件（検収担当がそのまま1項目ずつ実行する）

### ビルド・静的検証

1. `npm run build` が型エラー無しで通り、JS バンドルが **502.0 kB 以下**（ベースライン 498.80 kB ＋ トークン実測 0.38 kB ＋ カード実装分の余裕 2.8 kB）であること。超過したら数値と内訳を報告する。
2. `npm run lint` がエラー 0 で通ること。
3. `grep -rnE "#[0-9a-fA-F]{3,8}" src/summary/summary.css` が**0 件**であること（色リテラルの直書き禁止）。
4. `grep -n "prefers-color-scheme" src/summary/summary.css` が**0 件**であること。
5. `grep -rn "md-" src/summary/WinLoseCard.tsx | grep -v "components/md\|md-typescale\|md-sys-color\|md-custom-color"` が **`<md-*>` の生タグを含まない**こと（CLAUDE.md 制約3）。

### api / domain 層

6. `npm run test -- src/api/normalize.test.ts` が通ること。**回数系6キー（`立直和了` `副露和了` `默听和了` `放铳至立直` `放铳至副露` `放铳至默听`）を全て省略した raw** を `normalizePlayerExtendedStats` に通し、6キーが全て `0` になるテストが存在し通ること。
7. `npm run test -- src/domain/derived.test.ts` が通り、既存の `winBreakdown` / `dealInBreakdown` の4テストが**無改変で**通ること。
8. `dealInStateBreakdown` について、§4.2 の表の5ケース（`放铳率=0` → null / 通常 / 立直0・副露0 → 門前1 / 合計>1 のクランプ / 非有限 → null）がテストされ通ること。特に「`放铳率 > 0` かつ立直率0・副露率0 → `{立直:0, 副露:0, 默听:1}`（**null ではない**）」を明示的に検証していること。

### ビューモデル（`npm run test -- src/summary/winLoseView.test.ts`）

9. `buildWinLoseView` が**常に長さ3**の `donuts` を返し、`key` が `winState` / `dealInState` / `dealInTarget` の順であること。
10. 実レスポンス相当の入力（`立直和了:21, 副露和了:29, 默听和了:8`）で `winState` の `percentText` が `['36.2','50.0','13.8']` になり、**3値の和が正確に `100.0`** であること（`percentText` を数値化して合計する形で検証する）。
11. 端数が割れる入力（`立直和了:1, 副露和了:1, 默听和了:1`）で `percentText` が `['33.4','33.3','33.3']`（合計ちょうど `100.0`）になること。`['33.3','33.3','33.3']`（合計 99.9）なら不合格＝最大剰余法と同値端数の配分規則（§4.3-a）が効いていない。
12. `dealInState` の入力 `放铳率:0.1237, 放铳时立直率:0.1538, 放铳时副露率:0.4615` で3スライスが `['15.4','46.1','38.5']`（合計 100.0）になり、3スライス目の `label` が **`門前`** であること。
13. `dealInTarget` の入力 `放铳至立直:0.1875, 放铳至副露:0.5, 放铳至默听:0.3125` で `['18.8','50.0','31.2']`（合計 100.0）になり、3スライス目の `label` が **`黙聴`** であること。
14. 3枚とも slice の `key` が `['hand-riichi','hand-furo','hand-menzen']` の順で一致すること（色の一貫性）。
15. `和了 0`（`立直和了:0, 副露和了:0, 默听和了:0`）のとき `winState.slices === null` かつ**他の2枚は `null` でない**こと。
16. `放铳率:0` のとき `dealInState.slices === null` かつ `dealInTarget.slices === null`（`放铳至*` も 0 のため）で、`winState` は描かれること。
17. `立直和了` に `undefined` を混ぜた入力（`as unknown as PlayerExtendedStats`）で `winState.slices === null` になること（`NaN` の弧が出ないこと）。
18. `ariaLabel` が `和了時の状態 立直 36.2% 副露 50.0% 黙聴 13.8%` の形であること。

### 共有部品の回帰

19. `npm run test -- src/summary/rankView.test.ts` が**1行も変更せずに**全て通ること（`toDonutArcs` 抽出が振る舞いを変えていない証明）。
20. `#/__rank` を開き、issue-9 の受け入れ条件のうちドーナツ描画に関する項目（スライスの角度・隙間・0% の非描画）が**見た目で不変**であること。スクリーンショットで確認する。
21. `document.querySelectorAll('[data-testid="rank-donut"]').length === 1` が `#/__rank` で成り立つこと（`testId` 既定値が維持されている証明）。

### 画面（dev ページ `#/__winlose` で確認。API は叩かない）

22. `npm run dev` で `#/__winlose` を開くと、`和銃分布` カードにドーナツが**3枚**表示され、各ドーナツの上にタイトル `和了時の状態` / `放銃時の状態` / `放銃相手の状態` が出ること。
23. `document.querySelectorAll('[data-testid^="win-lose-donut-"]').length === 3` であること。
24. 各ドーナツの `circle.donut__seg` が**3本**（0% の区分がある場合はその本数だけ減る）描かれ、`stroke` が `--md-custom-color-hand-riichi` / `-furo` / `-menzen` の順で当たっていること（DevTools の computed style で確認）。
25. 凡例の % を3枚それぞれ合計すると **100.0** になること（画面の表示値を読んで検算する）。
26. ギャラリーの状態切替で `loading` / `error` / `extended=null` / 「和了0」/「放銃0」の各状態を選び、**カードの高さが `ready` と一致**すること（`getBoundingClientRect().height` を比較し、差が 1px 以内）。
27. ブラウザ幅を変えてカード幅が 600px を跨ぐとき、**3枚縦積み（ドーナツ左・凡例右）↔ 横3列**が切り替わること。両方の幅で横スクロールが出ないこと。

### テーマ（完了条件3）

28. ギャラリーの light / dark 切替で、3色のスウォッチとドーナツの弧の色が**両方とも変わる**こと（`getComputedStyle(document.documentElement).getPropertyValue('--md-custom-color-hand-riichi')` が light `#9453c9` / dark `#ddafff` を返す）。
29. 段位シードを5種（既定・雀傑・雀豪・雀聖・魂天）に切り替えても、`--md-custom-color-hand-*` の3値が**変化しない**こと（段位シードから独立している証明）。
30. dark で `--md-custom-color-hand-menzen` が `#c8e1ee` であり、カードの地色に対して視認できること（目視）。

### アクセシビリティ

31. 各ドーナツの `svg` に `role="img"` と `aria-label`（§6-18 の形式）が付いていること。
32. 凡例が**色だけに依存していない**こと（各行にラベル文字列と % テキストがある）。

### 回帰

33. `npm run test` 全体が通ること。
34. `#/__rank` `#/__playstyle` `#/__keystats` `#/__identity` が引き続き描画できること（`donutShared` 抽出と `summary.css` 追記の巻き添えが無いこと）。
35. `npm run build` 後、`grep -r "__winlose" dist/assets/*.js` が **0 件**であること（dev ルートが本番バンドルに混入していない。CLAUDE.md 制約4）。

---

## §7 UI 検証の逆発注（`docs/ui-verification/`）

エージェントが原理的に判断できないものを1件だけ挙げる。製造・検収では判定しない。

- **V-?: 3区分色（紫・ティール・スレート）の見た目**。特に (1) light の `hand-menzen` `#728a96` がカード2の `rank-2`（銀 `#50585f`）と混同されないか、(2) dark の `hand-riichi` `#ddafff` が段位シード（雀聖=赤 / 魂天=青）の primary と喧嘩しないか、(3) 3枚のドーナツで同じ色が同じ意味に読めるか。手順書は検収フェーズで作成した: [docs/ui-verification/2026-09-06-issue-12-win-lose-donuts.md](../ui-verification/2026-09-06-issue-12-win-lose-donuts.md)。

---

## §8 実挙動未確認（推定で書いた箇所を隠さない）

1. **`立直和了` 等が実際に 0 省略されるか未確認。** issue-3 §1.3 差分8 が列挙した「回数系6キー」に本 Issue の6キーは含まれていない。§4.1 の `?? 0` は**予防的**であり、省略が起きる証拠は無い。ただし省略が起きた場合の壊れ方が「無言の空ドーナツ」なので、コストの低い保険として入れる。
2. **`放铳时立直率` / `放铳时副露率` の 0 省略の有無は未確認。** §4.3 の `Number.isFinite` ガードで無言の破綻だけは防ぐ。
3. **放銃 0 回・和了 0 回のプレイヤーに API が何を返すか未確認**（`放铳至*` が `0,0,0` で返るのか、キーごと省略されるのか、`0.333…` 等の既定値が入るのか）。外部 API へのアクセスは行っていない。§4.2 の空判定は両方（合計 0 と `放铳率 === 0`）を見ているので、どちらの返し方でも空表示になる。
4. **`立直和了 + 副露和了 + 默听和了` が `和牌率 × roundCount` と一致しない理由は未特定**（58 vs 88。§1.4）。本カードはこの不一致に依存しない設計にしてあるが、**スタッツタブ（#14）で母数を表示する際には再調査が要る**。
5. **`放铳至*` が率であることの証拠は実レスポンス1件のみ**（合計 1.0000、値が小数）。回数である可能性は値が小数であることから否定できるが、全プレイヤーで率であることまでは1件では言い切れない。`dealInBreakdown` は合計で割るので**どちらでも正しい構成比を返す**設計であり、この不確実性はドーナツの表示には波及しない（波及するのは「凡例に回数を出す」案 b のみ。R-1 で a を推奨する理由でもある）。
6. **light / dark の見た目そのもの**（§7 の逆発注）。数値上のコントラストは実測したが、美的判断はしていない。

---

## §9 後続 Issue への引き継ぎ

- **`src/summary/donutShared.ts` が今後のドーナツの共有基盤になる。** 弧計算・パーセント配分をここに集約したので、比較タブ等で新しいドーナツを作るときは `toDonutArcs` / `percentTenths` を使う。カード2の `rankCounts`（回数の最大剰余配分）は `rankView.ts` に残す（回数表示はカード2固有）。
- **`--md-custom-color-hand-*` は「立直 / 副露 / 門前」という意味の色である。** スタッツタブの「和銃分布」章（requirements §4.3）でも同じ意味で使えば画面全体の一貫性が取れる。**別の意味に流用しないこと**（issue-11 §5.3 案 b を却下したのと同じ理由）。
- **`?? 0` 補完の対象キーは api 層で管理する。** 新しい回数系キーを画面で使う Issue は、まず `normalize.ts` の補完リストを確認すること。
- **母数（和了回数・放銃回数）の表示は本カードでは意図的に見送っている**（§1.4）。スタッツタブ（#14）で扱う際は、まず `和牌率` の分母を特定すること。
- **セクション色4系統（`--md-custom-color-{win,dealin,riichi,luck}`）は本カードでは使っていない。** CLAUDE.md「保留中の設計判断」どおり、廃止されても本カードは影響を受けない。
