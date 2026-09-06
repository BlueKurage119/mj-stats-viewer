# Issue #11 サマリー・カード4: 主要スタッツ（6タイル・卓平均差分）

要件: [docs/requirements.md](../requirements.md) §4.1（カード4）
依存: #3（API層） / #4（ドメイン層） / #6（グローバルフィルタ）— いずれも実装済み
先行カードの設計書: [issue-8-identity-card.md](issue-8-identity-card.md) / [issue-9-rank-donut.md](issue-9-rank-donut.md) / [issue-10-playstyle.md](issue-10-playstyle.md)

---

## §0 統括担当への確認事項（着手前に判断が要るもの）

実装をブロックしない形（すべて「1つの定数テーブル/1つの CSS 変数」を差し替えるだけで反転できる形）で設計しているが、
以下は**設計担当の独断で決めるべきでない**ため、明示して残す。

### R-1 立直率・副露率の「良し悪しの向き」

- 統括担当の事前情報では「和了率・立直率は基本的に上がる方向を『良い』にする想定。確定困難な指標（副露率など）は中立でもよい」。
- 一方 **requirements §4.2 は比較タブの `lowerIsBetter` を「放銃率・平均放銃点・銃点損失・平均和了巡目」の4つと明記**しており、
  裏を返すと立直率・副露率は「higherIsBetter」として扱う建て付けになっている。#13（比較タブ）で上位%の向きを決めるときにここが効く。
- **本設計の既定値**: 立直率・副露率はいずれも `neutral`（差分は出すが色を付けず、`on-surface-variant` で表示）。
  理由: 両者はカード3（打ち筋）で「攻/守」「門前/速度」という**スタイル軸**として扱われており（issue-10 §3）、
  同じ画面の別カードで同じ指標を「良い/悪い」と断ずるのは矛盾する。副露率は高いほど良いとも悪いとも言えない。
- **反転コスト**: `KEY_STAT_METRICS` の `direction` を `'neutral'` → `'higher'` に書き換えるだけ（§3.1）。テストの期待値も同表に対応する2件のみ。
- 統括担当が「§4.2 との整合を優先して higher にする」と判断するなら、そのように指示すること。

### R-2 「良い」を表す色として新トークン `--md-custom-color-delta-good` を追加してよいか

- §1.2 の実測により、**既存トークンで「良い」を安全に表せるものが無い**ことが確定している（雀聖シードの `primary` は `error` とほぼ同色）。
- そのため `src/theme/seeds.ts` に緑1色を追加し `applyTheme.ts` から書き出す設計にした（順位色 `rank-1..4` と同じ手口。§5）。
- 副作用: カード2（成績）の**4位＝緑**（`--md-custom-color-rank-4`）と色相が近い（実測 hue 155.5 vs 145.6）。
  同一ページ内で「緑＝最下位（悪い）」と「緑＝良い」が併存する。
- 代替案は §5.3 に列挙。既定は「採用（arrow グリフと符号が意味を担うので許容）」。統括担当が却下するなら §5.3-c（悪いときだけ着色する片側方式）に切り替える。

---

## §1 実物調査の結果（すべて本作業で実測。推定ではない）

### 1.1 `global_histogram` band 0 の `mean` は API が返す実フィールドである

`src/api/types.ts` L248-262:

```ts
export type HistogramGroup = {
  mean: number;
  histogramFull?: HistogramData;    // band "0" のみ存在
  histogramClamped?: HistogramData; // band "0" かつ回数系6指標以外のみ存在
};
```

`mean` は optional ではない（band 0 でも段位帯 band でも存在する）。Issue 本文の「`global_histogram` band 0 の mean を基準」はこのフィールドを指す。

### 1.2 既存の `MetricLookup` の `mean` を流用してはならない（重要）

`src/filters/useGlobalHistogram.ts` が公開する `lookupFor(mode)` は `createStatsLookup` を返し、その `MetricDistribution.mean` は
**`histogramFull.bins` からビン中央値で再計算した近似値**であって API の `mean` ではない（`src/domain/distribution.ts` `histogramStats`）。

これが「微差」で済まないことは既存設計書に明記されている。[issue-4-domain-logic.md](issue-4-domain-logic.md) L589:

> `mean` フィールドには μ 指定値をそのまま入れる（実 API でも `mean` は真の平均であり bins から再計算した値とは微差がある。ドメイン層が `mean` を使わず bins から算出することを固定するため、両者を微妙に食い違わせる意味がある）

つまり **`src/domain/__fixtures__/global_histogram.json` は両者が意図的に食い違うように作られている**。
実測（`node`）でフィクスチャの `和牌率` を確認: `mean` フィールド = `0.2093` / `bins` から算出した μ = `0.2092998157`。
`平均打点` 相当（`打点效率`）では `mean` = 1250、bins 100 分割・レンジ 0..10000 なので**ビン幅は 100 点**あり、
ビン中央値近似の誤差は最悪 50 点オーダーになる。差分チップが `+312` のような値を出す以上、この誤差は許容できない。

→ **本カードは `histogramStats` 系を一切使わず、band 0 の `mean` を直接読む**（§2.2 で新規ヘルパーを1つ追加）。

### 1.3 分布が無くても値は出せる（データ依存の非対称性）

- 6タイルの**値**は `player_extended_stats`（`scope.stats`）だけで決まる。
- 6タイルの**差分**だけが `global_histogram`（`scope.distribution`）に依存する。

カード3（打ち筋）は全軸が分布に依存するため分布 error を致命扱いにしているが、カード4は違う。
→ **分布の error / `mean` 欠損はカード全体の error にせず、チップだけ「—（比較不可）」に縮退させる**（§3.4）。

### 1.4 単位の実測

`src/api/testdata/player_extended_stats.json`（#3 が保存した実レスポンスの匿名化版）:

```
和牌率 0.4536 / 放铳率 0.1237 / 立直率 0.2113 / 副露率 0.3711 / 平均打点 5312 / 平均铳点 4821
```

率系は 0..1 の小数、打点系は点数の整数。既存の `rankView.percentText()` と同じ扱いでよい。

### 1.5 テーマトークンの実測（`node` で `@material/material-color-utilities@0.3.0` を直接叩いて計測）

5シード（雀傑/雀豪/雀聖/魂天/既定）× light/dark、背景は `ElevatedCard` の実背景 `surface-container-low`（neutral tone 96 / 10）:

| トークン | light hex | 対カード背景コントラスト | dark hex | 対カード背景コントラスト |
|---|---|---|---|---|
| `--md-sys-color-error` | `#ba1a1a`（**全5シードで同一**） | 5.83〜5.86 | `#ffb4ab`（**全5シードで同一**） | 10.07〜10.13 |
| `--md-sys-color-primary`（雀聖シード） | **`#ba1a20`** | 6.15 | **`#ffb3ac`** | 10.85 |
| `--md-sys-color-on-surface-variant` | シード依存 | 8.42〜8.47 | シード依存 | 10.01〜10.13 |
| 提案する `delta-good`（`#2E7D32` の tone 40/80） | `#1b6d24` | 5.81〜5.84 | `#88d982` | 10.01〜10.06 |

**決定的な発見**: `--md-sys-color-error` はシードに依存せず一定だが、**雀聖（シード `#D32F2F`）の `primary` は `#ba1a20` で `error` の `#ba1a1a` と実質同色**。
したがって「良い＝primary / 悪い＝error」という一見自然な設計は、**雀聖のプレイヤーで良い差分と悪い差分が同じ赤になって完全に破綻する**。
`tertiary` も雀聖では茶（`#725b2e`）・魂天では紫（`#d8bde3`）とシードで転ぶため「良い」を担えない。

→ §5 で `--md-custom-color-delta-good` を新設する。提案色は error とコントラストがほぼ対称（light 5.8 / dark 10.0 台）になるトーンを選んである。

### 1.6 バンドル基線（本作業の直前に `npm run build` で実測）

```
dist/assets/index-*.css   20.27 kB │ gzip: 3.63 kB
dist/assets/index-*.js   493.89 kB │ gzip: 136.41 kB
```

本Issueは**新規依存ゼロ**（純 React + CSS + 既存 md ラッパー）。受け入れ条件で JS gzip の増分上限を +2 kB とする（§6-13）。

### 1.7 実挙動未確認と明記する箇所

1. **実 API の `global_histogram` に `平均打点` / `平均铳点` の band 0 `mean` が存在すること、およびその単位が `player_extended_stats` と同じ「点」であること**は未確認。
   `src/api/testdata/global_histogram.json` は3 metric しか持たない簡易フィクスチャ、`src/domain/__fixtures__/global_histogram.json` は11 metric で**打点系2キーを含まない**（実測で確認）。
   issue-3 §1.3 差分7 は「band 0 の指標は56個・`PlayerExtendedStats` のキーを含む」と実測記録しているので存在自体は高確度だが、**単位は推定**。
   → 実データでの目視確認は §7-2 の引き継ぎ（UI検証の逆発注候補）に回す。実装側は「欠損なら `—`」で必ず安全側に倒すこと（§3.4）。
2. `histogramFull` の実ビン数（requirements §4.2 は比較タブの描画で「bins 120本」と書くが、これは表示側の値であり API のビン数の実測ではない）。本設計は `histogramFull` を使わないので影響しない。

---

## §2 データ源と差分の定義

### 2.1 入力

カード3と同じく **フックを持たない表示専用コンポーネント**にする（dev ギャラリーから任意状態を流し込めるようにするため。issue-10 §4.6 と同じ規律）。

```ts
export interface KeyStatsCardProps {
  readonly state: FilteredStatsState;        // scope.stats
  readonly distribution: DistributionState;  // scope.distribution
  readonly modes: readonly GameMode[] | null; // scope.filter?.modes ?? null
  readonly numPlayers: NumPlayers;
}
```

代表モードは `selectRepresentativeMode(numPlayers, modes)`（`src/filters/filterState.ts` L134）をカード3と同じ引数で呼ぶ。
`gameCountByMode` は渡さない（カード3も渡していない。モード別対局数は現状どのフックも持たない）。

### 2.2 ドメイン層に追加する関数（1本だけ）

`src/domain/distribution.ts` に追加し、`src/domain/index.ts` から公開する。

```ts
/**
 * GlobalHistogram から band "0" の API 提供 mean（卓平均）を引く。無ければ null。
 * histogramStats() のビン中央値近似とは別物であり、卓平均の基準にはこちらを使う
 * （issue-11 §1.2）。
 */
export function getBandZeroMean(gh: GlobalHistogram, mode: GameMode, metric: string): number | null {
  const mean = gh[String(mode)]?.['0']?.[metric]?.mean;
  return typeof mean === 'number' && Number.isFinite(mean) ? mean : null;
}
```

- `getBandZeroHistogram` の真横に置き、同じ添字経路（`String(mode)` → `'0'` → metric）を使う。
- `Number.isFinite` ガードを入れる理由: 型上は `mean: number` 必須だが、`GlobalHistogram` はインデックスシグネチャなので
  未知 metric の参照は型上 `HistogramGroup` に見えて実体は `undefined`。ランタイムで必ず潰す。

**`useGlobalHistogram` / `DistributionState` は変更しない。** `kind: 'ready'` は既に `histogram: GlobalHistogram` を公開しており、
`getBandZeroMean` は O(1) のプロパティ参照なので `createStatsLookup` のようなメモ化は不要。フックに `meanFor` を生やす必要はない。

### 2.3 差分の定義

自分の値を `x`、卓平均を `m` とすると `diff = x − m`（生値のまま引く）。

- **率系**: 表示は百分率ポイント。`diffPercentPoints = Math.round((x − m) * 1000) / 10`
- **打点系**: `diffPoints = Math.round(x − m)`

丸め方は `rankView.percentText()` と同じ方針（`(rate*100).toFixed(1)` の二重丸めを避けるため `*1000` を先に丸める。issue-9 §3.5）。

**卓平均そのものはタイルに表示しない。**
理由: 表示値・卓平均をそれぞれ丸めてから引くと「45.4 − 44.2 = 1.2」なのにチップが「1.3」と出る食い違いが可視化される（生値での差分を丸めるため）。
差分だけを出せばこの矛盾は表に出ない。卓平均の併記が欲しくなったら #13（比較タブ）の担当領域として扱う（§7-3）。

---

## §3 ビューモデル（`src/summary/keyStatsView.ts`・React 非依存の純関数）

カード2・カード3と同じく **`*View.ts` に純関数、`*Card.tsx` に描画**の分離を踏襲する。

### 3.1 指標テーブル（この表がこのカードの単一情報源）

```ts
export type MetricDirection = 'higher' | 'lower' | 'neutral';
export type MetricUnit = 'rate' | 'point';

export interface KeyStatMetric {
  readonly key: string;            // React key・data-metric 属性・#13 との対応付けに使う
  readonly label: string;          // 日本語ラベル（CLI版準拠）
  readonly statsKey: keyof PlayerExtendedStats & string; // 自分の値（簡体字キー）
  readonly histogramKey: string;   // global_histogram の metric キー（今回はすべて statsKey と同一）
  readonly unit: MetricUnit;
  readonly direction: MetricDirection;
}

export const KEY_STAT_METRICS: readonly KeyStatMetric[] = [ /* 下表の6件をこの順で */ ];
```

| 表示順 | key | label | statsKey / histogramKey | unit | direction | 根拠 |
|---|---|---|---|---|---|---|
| 1 | `winRate` | 和了率 | `和牌率` | rate | `higher` | 高いほど良い（requirements §4.2 の lowerIsBetter に含まれない） |
| 2 | `dealInRate` | 放銃率 | `放铳率` | rate | `lower` | requirements §4.2 が lowerIsBetter に明記 |
| 3 | `riichiRate` | 立直率 | `立直率` | rate | `neutral` | §0 R-1（暫定。統括判断で `higher` に反転可能） |
| 4 | `callRate` | 副露率 | `副露率` | rate | `neutral` | §0 R-1 |
| 5 | `avgWinScore` | 平均打点 | `平均打点` | point | `higher` | 高いほど良い |
| 6 | `avgDealInScore` | 平均放銃点 | `平均铳点` | point | `lower` | requirements §4.2 が lowerIsBetter に明記 |

**キーは全て簡体字**（`放铳率` の「铳」、`平均铳点` の「铳」）。日本語の「銃」ではない。`src/api/types.ts` の `PlayerExtendedStats` からコピーすること。
`statsKey` と `histogramKey` を別フィールドに分けているのは、将来ズレる metric（`立直好型` / `局收支` 等）が出たときの拡張点を残すため。今回は6件とも同値。

### 3.2 出力型

```ts
export type DeltaSign = 'up' | 'down' | 'flat';
export type DeltaTone = 'good' | 'bad' | 'neutral';

export interface KeyStatDelta {
  readonly sign: DeltaSign;
  readonly tone: DeltaTone;
  readonly glyph: '▲' | '▼' | '±';   // sign と1対1
  readonly text: string;             // '+1.2%' / '−0.8%' / '±0.0%' / '+312' / '−1,204' / '±0'
}

export interface KeyStatTile {
  readonly key: string;              // KeyStatMetric.key
  readonly label: string;            // '和了率'
  readonly valueText: string;        // '45.4%' / '5,312'
  readonly delta: KeyStatDelta | null; // null = 比較不可（卓平均が引けない）
  readonly ariaLabel: string;
}

export interface KeyStatsView {
  readonly tiles: readonly KeyStatTile[];   // 常に長さ 6・KEY_STAT_METRICS の順
  readonly note: string;                    // '王座の間・半荘の卓全体平均との比較'
  readonly comparable: boolean;             // 1件でも delta !== null なら true
}

export function buildKeyStatsView(input: {
  readonly extended: PlayerExtendedStats;
  readonly meanOf: (metric: string) => number | null; // 卓平均。分布 error 時は () => null を渡す
  readonly mode: GameMode;
}): KeyStatsView;
```

- `meanOf` を関数注入にする理由: テストが `GlobalHistogram` 全体を組まずに `(k) => ({和牌率: 0.42})[k] ?? null` で書ける。
  分布 error / loading 側の縮退も呼び出し側で `() => null` を渡すだけで表現でき、ビュー関数に状態種別を持ち込まずに済む。
- `note` はカード3の `buildModeNote` と**同じ規則**（`MODE_LABELS[mode]` が「東」で終わるなら東風、そうでなければ半荘）で作るが、
  末尾の文言だけ変える: カード3は「…の全体分布との比較」、カード4は「…**の卓全体平均との比較**」。
  `buildModeNote` を共有化するリファクタは**しない**（issue-10 のテストが文言を固定しているため。重複は2箇所に留まるので許容する）。

### 3.3 値・差分のフォーマット規則

| 条件 | valueText | delta.text | glyph | tone |
|---|---|---|---|---|
| rate, 差分 `> 0`（丸め後） | `45.4%` | `+1.2%` | `▲` | direction に従う |
| rate, 差分 `< 0`（丸め後） | `45.4%` | `−0.8%` | `▼` | direction に従う |
| rate, 差分が丸めて `0.0` | `45.4%` | `±0.0%` | `±` | **常に `neutral`** |
| point, 差分 `> 0` | `5,312` | `+312` | `▲` | direction に従う |
| point, 差分 `< 0` | `5,312` | `−1,204` | `▼` | direction に従う |
| point, 差分が `0` | `5,312` | `±0` | `±` | **常に `neutral`** |
| 卓平均が引けない | `45.4%` | （`delta` は `null`。UI は `—` を出す） | — | `neutral` |

- 負号は **U+2212 MINUS SIGN `−`**（ハイフンではない）。桁が揃うため。`+` は ASCII の U+002B でよい。
- 打点系の3桁区切りは `toLocaleString('ja-JP')`（`rankView` の平均持ち点と同じ）。**符号は `toLocaleString` に任せず、絶対値を整形して自分で前置する**
  （`(-1204).toLocaleString('ja-JP')` は ASCII ハイフンの `-1,204` を返し、上記の U+2212 方針と食い違うため）。
- `%` は率系の値・差分の**両方**に付ける（Issue 本文の `▲+1.2%` 表記に合わせる）。
  厳密には「百分率ポイント」だが、本アプリの「pt」は**段位ポイント**を意味しており衝突するので `pt` は使わない。
  正確な意味は aria-label 側で「◯◯ポイント高い」と読み上げて補う。

### 3.4 tone の決定（完了条件2の中核）

```
sign === 'flat'                              → 'neutral'
direction === 'neutral'                      → 'neutral'
direction === 'higher' && sign === 'up'      → 'good'
direction === 'higher' && sign === 'down'    → 'bad'
direction === 'lower'  && sign === 'up'      → 'bad'    ← 放銃率が卓平均より高い = 悪い
direction === 'lower'  && sign === 'down'    → 'good'   ← 放銃率が卓平均より低い = 良い
```

**グリフ（▲/▼）は「値の増減」を表し、色は「良し悪し」を表す**という2軸で固定する。
つまり放銃率が卓平均より低いときは **`▼` かつ緑**になる。これが完了条件2「差分の符号・色が指標の良し悪しと整合（放銃率は下がると良い）」の意図と解釈する。
グリフ自体を良し悪しで反転させない（「放銃率が下がったのに▲」は誤読を招く）。この解釈は設計判断として明記しておく。

### 3.5 aria-label

色に依存しない情報経路を必ず1本通す（色覚多様性・スクリーンリーダー対応。完了条件2は色だけでは満たさない）。

```
'和了率 45.4%、卓平均より 1.2 ポイント高い（良い）'
'放銃率 12.4%、卓平均より 0.8 ポイント低い（良い）'
'立直率 21.1%、卓平均より 1.6 ポイント高い'          ← direction neutral は良し悪しを言わない
'平均打点 5,312、卓平均より 312 点高い（良い）'
'平均放銃点 4,821、卓平均と同じ'                      ← flat
'和了率 45.4%、卓平均と比較できません'                ← delta === null
```

`（良い）` / `（悪い）` は tone が `good` / `bad` のときだけ付ける。

---

## §4 コンポーネントと CSS

### 4.1 ファイル構成

| パス | 内容 |
|---|---|
| `src/domain/distribution.ts` | `getBandZeroMean` を追加（§2.2） |
| `src/domain/index.ts` | `getBandZeroMean` を export に追加 |
| `src/summary/keyStatsView.ts` | 新規。§3 のビューモデル |
| `src/summary/keyStatsView.test.ts` | 新規。§6 の 1〜8 を満たすユニットテスト |
| `src/summary/KeyStatsCard.tsx` | 新規。表示専用コンポーネント |
| `src/summary/summary.css` | 末尾にカード4のブロックを追記（既存ブロックの後ろ。§4.4 の配置注意） |
| `src/summary/SummaryPanel.tsx` | `<KeyStatsCard>` を `<PlaystyleCard>` の直後に追加 |
| `src/theme/seeds.ts` | `DELTA_GOOD_SOURCE` / `DELTA_GOOD_TONES` を追加（§5） |
| `src/theme/applyTheme.ts` | `--md-custom-color-delta-good` の書き出しを追加（§5） |
| `src/dev/KeyStatsGallery.tsx` | 新規。dev 確認ページ |
| `src/main.tsx` | dev ルート `#/__keystats` を追加（既存の形を崩さない。CLAUDE.md §4） |

`src/components/md` のバレルから `ElevatedCard` のみ import する。新しい md ラッパーの追加は不要。
**CSS 以外の bare import は書かない**（CLAUDE.md §1）。`import './summary.css'` は既存カードと同じく CSS なので可。

### 4.2 DOM 構造

```tsx
<ElevatedCard className="key-stats-card" data-testid="key-stats-card" data-state={cardState}>
  <div className="key-stats-card__inner">
    <h2 className="key-stats-card__title md-typescale-title-medium">主要スタッツ</h2>
    <div className="key-stats-card__body[ --message]">
      <dl className="key-stats-card__tiles" data-testid="key-stats-tiles">
        {/* 6件。loading は tile===null を流して同じ map から skeleton を描く（カード2と同じ手口） */}
        <div className="key-stats-card__tile" data-metric={tile.key}>
          <dt className="md-typescale-label-medium">{tile.label}</dt>
          <dd className="key-stats-card__value md-typescale-headline-small numeric">{tile.valueText}</dd>
          <span className="key-stats-card__delta numeric" data-tone={tone} data-sign={sign} aria-hidden="true">
            <span className="key-stats-card__delta-glyph">{glyph}</span>{deltaText}
          </span>
          <span className="visually-hidden">{tile.ariaLabel}</span>
        </div>
      </dl>
      {message !== null && <p className="key-stats-card__message">{message}</p>}
    </div>
    <p className="key-stats-card__note md-typescale-label-medium">{note}</p>
  </div>
</ElevatedCard>
```

- 数値・差分は `aria-hidden="true"` にして、読み上げは `ariaLabel` 1本に集約する（`▲` や `−` が記号として読まれるのを防ぐ）。
  `visually-hidden` クラスが `src/index.css` に無ければこのカードの CSS 内で定義してよい（`clip-path: inset(50%)` 方式）。
- `delta === null` のときは `glyph` を出さず本文を `—`（U+2014）にし、`data-tone="neutral"` を付ける。
- タイル値の typescale は `headline-small`（カード2のタイルは `title-large`）。Issue の「大きな値」に合わせて1段上げる。
  タイル数が6で1枚あたりの幅が狭いので、`headline-small` を超えると `平均放銃点` の5桁が折り返す恐れがある。実測は §6-11 で確認する。

### 4.3 カード状態（loading / ready / error）

カード3と同じ3状態に畳むが、**分布は致命扱いにしない**（§1.3）。

```
isLoading = state.kind === 'loading' || distribution.kind === 'loading' || modes === null
  → 6タイル分の skeleton（値・差分の両方）。note は空文字（高さは CSS 変数で確保）

state.kind === 'error'          → message = state.message                     （error）
state.kind === 'ready' && state.extended === null
                                → message = '主要スタッツを取得できません'      （error）
state.kind === 'empty'          → 到達しない（SummaryPanel が上流で扱う）。型の網羅性のため loading と同じ描画にする
上記以外                         → ready

ready のとき:
  distribution.kind === 'ready' → meanOf = (k) => getBandZeroMean(distribution.histogram, mode, k)
  distribution.kind === 'error' → meanOf = () => null
  view.comparable === false     → note を '卓全体平均を取得できませんでした' に差し替える
```

`SummaryPanel` 側は現状のまま（`scope.stats.kind === 'empty'` を上流で弾いている）ので、`<KeyStatsCard>` は `<PlaystyleCard>` の直後に置くだけでよい。

### 4.4 レイアウト（完了条件1・Issue の「3×2、モバイル2×3」）

`.key-stats-card__inner` に `container-type: inline-size; container-name: key-stats-card;` を置き、
**既定（狭い側）を 2 列、`@container key-stats-card (min-width: 600px)` で 3 列**にする。

```css
.key-stats-card__tiles {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr)); /* モバイル 2×3 */
  gap: 12px;
  margin: 0;
}

/* 【配置上の注意】このブロックは .key-stats-card__* の基本ルールより後ろに置くこと。
   詳細度が同じなので、基本ルールが後ろにあると後勝ちでコンテナクエリが打ち消される
   （issue-9 で実際に起きた。summary.css L500 付近のコメント参照）。 */
@container key-stats-card (min-width: 600px) {
  .key-stats-card__tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); } /* 3×2 */
}
```

- **`auto-fit` を使わない**。Issue が「3×2 / 2×3」と列数を指定しているので、`repeat(2|3, ...)` で列数を固定する
  （カード2の `auto-fit` は「5枚を幅なりに割る」要件だったので事情が違う）。
- ブレークポイント 600px はカード2・カード3と同一値に揃える（`@container rank-card (min-width: 600px)` / `@container playstyle-card (min-width: 600px)`）。
- `@media` ではなく `@container` を使う理由は summary.css L243 のコメントに既述（カード自身の実効幅で切り替える）。

### 4.5 高さ一致（R1）

カード2・カード3で守っている「loading / ready / error の3状態でカード高さが一致する」規律をカード4でも守る。
実測値の焼き付けはしない（issue-9 で2回壊れている）。共有 CSS 変数で担保する:

```css
.key-stats-card {
  --key-stats-value-height: 32px;  /* 値行の min-height。skeleton も同じ高さ */
  --key-stats-delta-height: 20px;  /* 差分行の min-height */
  --key-stats-note-height: 20px;   /* 脚注の min-height（loading では文言が空になる） */
}
```

- error 時は `.key-stats-card__body--message > .key-stats-card__tiles { visibility: hidden; }` で枠を残したままメッセージを重ねる
  （カード2 `.rank-card__body--message` / カード3 `.playstyle-card__body--message` と同じ手口）。
- タイル数は状態によらず常に6なので、行数は変動しない。

### 4.6 色（完了条件3）

```css
.key-stats-card__delta[data-tone='neutral'] { color: var(--md-sys-color-on-surface-variant); }
.key-stats-card__delta[data-tone='bad']     { color: var(--md-sys-color-error); }
.key-stats-card__delta[data-tone='good']    { color: var(--md-custom-color-delta-good); }
```

- 背景塗り（container 系）は使わない。**文字色のみ**にする。理由: 6タイルに塗りチップが並ぶと面が騒がしくなるうえ、
  塗り方式だと `on-*` トークンの追加が必要になりテーマ側の変更が増える。§1.5 の実測はすべて「文字色 vs カード背景」で取ってある。
- light / dark はトークン側が切り替わるので、CSS に `@media (prefers-color-scheme)` を書かない（CLAUDE.md §5）。
- 色をハードコードしない。上の3行以外に色の指定を書かない。

---

## §5 テーマトークンの追加（§0 R-2 の対象）

### 5.1 `src/theme/seeds.ts` への追加

```ts
/**
 * 差分チップの「良い」側の色。
 *
 * 段位シードから独立させる理由（issue-11 §1.5 実測）:
 * 雀聖シード（#D32F2F）の --md-sys-color-primary は light `#ba1a20` / dark `#ffb3ac` で、
 * シード非依存の --md-sys-color-error（`#ba1a1a` / `#ffb4ab`）とほぼ同色になる。
 * primary / tertiary を「良い」に使うと、雀聖のプレイヤーで良い差分と悪い差分が同色になり破綻する。
 *
 * トーンは error とのコントラスト対称性で選んだ（ElevatedCard 背景 = surface-container-low に対し
 * 全5シードで light 5.81〜5.84 / dark 10.01〜10.06。error は light 5.83〜5.86 / dark 10.07〜10.13）。
 * MD3 の customColor ロール（light 40 / dark 80）と同値だが、customColors 経由にすると
 * on-color / container まで4トークン増えるため、順位色と同じく TonalPalette から1トークンだけ出す。
 */
export const DELTA_GOOD_SOURCE = '#2E7D32';
export const DELTA_GOOD_TONES: Record<'light' | 'dark', number> = { light: 40, dark: 80 };
```

### 5.2 `src/theme/applyTheme.ts` への追加

順位色の書き出し（L144-149）の直後に、同じ手口で1行追加する。

```ts
// 差分チップの「良い」色 → --md-custom-color-delta-good（段位シードから独立。issue-11 §5）
root.style.setProperty(
  '--md-custom-color-delta-good',
  hexFromArgb(deltaGoodPalette.tone(dark ? DELTA_GOOD_TONES.dark : DELTA_GOOD_TONES.light)),
);
```

`deltaGoodPalette` はモジュールスコープで一度だけ `TonalPalette.fromInt(argbFromHex(DELTA_GOOD_SOURCE))` を作る
（`rankPaletteCache` と同じ趣旨だが、1色しかないのでキャッシュ Map は不要）。

**「悪い」側は既存の `--md-sys-color-error` を使い、新トークンを作らない。** §1.5 でシード非依存かつコントラスト十分と実測済み。

### 5.3 代替案（統括担当が §0 R-2 を却下する場合）

| 案 | 内容 | トレードオフ |
|---|---|---|
| a（**採用**） | `--md-custom-color-delta-good` を新設 | theme 2ファイルに触る。カード2の4位（緑 `#00753e` / `#67c686`、hue 155.5）と色相が近い（提案色 hue 145.6） |
| b | 「良い」に `--md-custom-color-rank-4` を流用 | theme 変更ゼロ。ただし **rank-4 はカード2で「4位＝最下位」を表す色**であり、同一ページで「緑＝最悪」「緑＝良い」が同居する。a より悪い |
| c | 「良い」に色を付けず、`bad` のときだけ `error` で着色（片側方式） | theme 変更ゼロ・緑の衝突なし。ただし「良い差分が目立たない」ため製品紹介的なトーン（requirements §4.1）から後退する |

---

## §6 受け入れ条件（検収担当がそのまま1項目ずつ実行する）

前提: すべて `/Users/yuta/claudeworks/mj-stats-viewer/mj-stats-viewer` をカレントとして実行する。

### ビューモデル（`npm run test -- src/summary/keyStatsView.test.ts` で確認）

1. **タイルが常に6件・順序固定**: `buildKeyStatsView` の戻り値 `tiles.map(t => t.key)` が
   `['winRate','dealInRate','riichiRate','callRate','avgWinScore','avgDealInScore']` と厳密一致する。
   `meanOf` が全 metric で `null` を返す場合も長さ6のままであること。
2. **値の整形**: `src/api/testdata/player_extended_stats.json` を `extended` として渡したとき、
   `valueText` が順に `'45.4%'`, `'12.4%'`, `'21.1%'`, `'37.1%'`, `'5,312'`, `'4,821'` になる。
3. **率系の差分**: `和牌率 = 0.4536`、`meanOf('和牌率') = 0.4412` のとき、`delta.text === '+1.2%'`、`delta.glyph === '▲'`、`delta.sign === 'up'`、`delta.tone === 'good'`。
4. **放銃率の向き（完了条件2の核）**: `放铳率 = 0.1237`、`meanOf('放铳率') = 0.1320` のとき、
   `delta.glyph === '▼'`（値が低いので下向き）かつ **`delta.tone === 'good'`**（放銃率は下がると良い）。
   逆に `meanOf('放铳率') = 0.1150` のときは `delta.glyph === '▲'` かつ `delta.tone === 'bad'`。
5. **打点系の差分**: `平均打点 = 5312`、`meanOf('平均打点') = 5000` → `'+312'` / `tone === 'good'`。
   `平均铳点 = 4821`、`meanOf('平均铳点') = 6025` → `'−1,204'`（**U+2212 の負号・3桁区切り**）/ `tone === 'good'`。
   テストは `expect(text.charCodeAt(0)).toBe(0x2212)` で負号の文字コードを直接確認する。
6. **中立指標**: 立直率・副露率は差分が正でも負でも `delta.tone === 'neutral'`（§0 R-1 で `higher` に変更された場合はこの2件の期待値を差し替える）。
7. **ゼロ差分**: `meanOf` が自分の値と厳密一致するとき、`sign === 'flat'`、`glyph === '±'`、`text === '±0.0%'`（率）/ `'±0'`（点）、`tone === 'neutral'`。
   direction が `lower` の指標でも `neutral` であること。
8. **比較不可**: `meanOf: () => null` のとき、全6タイルの `delta === null`、`view.comparable === false`、
   各 `ariaLabel` が `'卓平均と比較できません'` で終わる。値（`valueText`）は通常どおり出ていること。

### ドメイン層

9. `getBandZeroMean` が `src/domain/__fixtures__/global_histogram.json` の mode 16 / `和牌率` に対して **`0.2093` を厳密に返す**
   （`toBe(0.2093)`。`histogramStats(...).mean` は `0.2092998157…` なので `not.toBe` で両者が異なることも同じテストで確認する。
   これが §1.2 の「API の mean を使う」設計を固定する）。
   未知 metric（`'存在しない指標'`）・未知 mode（`8`）・存在しない band で `null` を返すこと。
10. `git grep -n "histogramStats\|createStatsLookup\|lookupFor" -- src/summary/keyStatsView.ts src/summary/KeyStatsCard.tsx` が **0件**
    （卓平均をビン近似から取っていないことの機械的確認）。

### 画面（dev ページ `#/__keystats` で確認）

11. `npm run dev` → `http://localhost:5173/#/__keystats` を開き、ready 状態のカードで
    **6タイルが 3列×2行**（カード幅 600px 以上）で並び、各タイルに「ラベル / 大きな値 / 差分」の3行が見えること。
    ブラウザ幅を狭めてカード実効幅を 600px 未満にすると **2列×3行**に切り替わること。
    `平均放銃点` の値（5桁）がどの幅でも折り返さない（1行に収まる）ことを目視で確認する。
12. 同ページで loading / ready / error / 比較不可（分布 error）の4状態を並べ、
    `document.querySelectorAll('[data-testid="key-stats-card"]')` の各 `getBoundingClientRect().height` が
    **loading・ready・error で一致する**こと（比較不可は ready と同じ高さ）。
    計測は `await document.fonts.ready` の後に行う（`docs` のUI寸法計測の注意事項）。
13. **バンドル**: `npm run build` が成功し（`tsc -b` の型エラー0）、`dist/assets/*.js` の gzip が
    基線 **136.41 kB** に対し **+2 kB 以内**、`dist/assets/*.css` の gzip が基線 **3.63 kB** に対し **+1 kB 以内**。
14. `npm run lint` が 0 件。

### テーマ（完了条件3）

15. `#/__keystats` を **light と dark の両方**で開き（`ThemeProvider` のモード切替 or OS 設定）、
    `getComputedStyle(document.documentElement).getPropertyValue('--md-custom-color-delta-good')` が
    light で `#1b6d24`、dark で `#88d982` を返すこと（`.trim()` して比較）。
16. 同じく light / dark 両方で、`good` の差分文字が緑・`bad` が赤・`neutral` が地味色で表示され、
    **どの段位シード（雀傑/雀豪/雀聖/魂天）に切り替えても good と bad が別色に見える**こと。
    とくに **雀聖シード**で good（緑）と bad（赤）が判別できることを必ず確認する（§1.5 の破綻ケース）。
17. `git grep -nE "#[0-9a-fA-F]{6}" -- src/summary/summary.css src/summary/KeyStatsCard.tsx src/summary/keyStatsView.ts` が 0件（色のハードコードなし）。

### アクセシビリティ

18. ready 状態で `document.querySelector('[data-metric="dealInRate"]').textContent` を読み、
    aria 用テキストに **「（良い）」または「（悪い）」** が含まれること（放銃率が卓平均より低ければ「低い（良い）」）。
    色を無効化（`data-tone` を全て `neutral` に書き換え）しても良し悪しの情報が失われないことを確認する。

### 回帰

19. `npm run test` 全件グリーン（既存のドメイン・カード2・カード3のテストを壊していない）。
20. **red の確認**: 受け入れ条件4（放銃率の tone）について、`KEY_STAT_METRICS` の `dealInRate.direction` を
    `'lower'` → `'higher'` に一時的に書き換えるとそのテストが**落ちる**ことを確認してから戻す。
    受け入れ条件9についても `getBandZeroMean` の `?.['0']` を `?.['10301']` に一時改変して落ちることを確認する。
    改変を戻したあと `git diff` が空であることを確認する。

---

## §7 後続Issueへの引き継ぎ

1. **比較タブへのタップ導線は今回実装しない**（Issue 本文も「実装可能なら」）。#13（比較タブ）が未着手で遷移先が存在しないため、
   リンク先URLもアンカーも決められない。代わりに **`KeyStatTile.key` を `data-metric` 属性として DOM に出しておく**（§4.2）。
   #13 の実装時は、`.key-stats-card__tile` を
   `/player/:np/:id/compare#metric-<key>` へのリンクでラップし、比較タブ側の各カードに同じ `id` を振れば導線が成立する。
   **今回はダミーのリンク要素やハンドラを置かない**（到達先の無い導線は作らない）。
2. **実データでの単位確認（UI検証の逆発注候補）**: §1.7-1 のとおり、`平均打点` / `平均铳点` の band 0 `mean` が
   実 API に存在するか・単位が「点」かは未確認。実プレイヤーで `#/player/...` を開き、
   打点系2タイルの差分が数百点オーダー（0.x や数万ではない）であることをオーナーに1回だけ目視確認してもらうのが確実。
   欠損時は `—` に縮退する設計なので、外れても画面は壊れない。
3. **卓平均の併記**: 本カードは差分のみを出し卓平均の実値は出さない（§2.3）。「自分 44.2% / 卓 43.0%」の併記は #13 の役割。
4. **`buildModeNote` の重複**: カード3（`playstyleView.ts`）とカード4で同型の関数が2つになる。3枚目が出たら共通化を検討する
   （今回は issue-10 のテストが文言を固定しているため統合しない）。
5. **`--md-custom-color-delta-good` の再利用**: 比較タブの上位%チップ（requirements §4.2）でも「良い/悪い」の色が要る見込み。
   本トークンをそのまま使えるよう、名前を `win`/`section` 系ではなく汎用の `delta-good` にしてある。
6. **セクション色4系統には一切依存していない**（CLAUDE.md「保留中の設計判断」に従う）。色分けを取りやめる判断が出ても本カードは影響を受けない。
