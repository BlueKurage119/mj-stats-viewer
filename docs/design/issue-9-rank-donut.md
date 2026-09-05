# Issue #9 設計書 — サマリー・カード2: 成績（順位分布ドーナツ）

対象 Issue: [#9](https://github.com/BlueKurage119/mj-stats-viewer/issues/9)
参照要件: `docs/requirements.md` §4.1（カード2）・§3・§5
前提設計書: [issue-4](issue-4-domain-logic.md)（ドメイン）/ [issue-6](issue-6-global-filter.md)（グローバルフィルタ）/ [issue-8](issue-8-identity-card.md)（層側カードの流儀・ヒーロー高さの規律）
ベースコミット: `c00b2db`（`main`。#8 マージ済み）

---

## 0. スコープ

**やること**

- サマリータブの層側に**カード2「成績」**（`RankCard`）を追加する
- 順位分布ドーナツ（三麻3スライス / 四麻4スライス）＋凡例
- タイル5枚: 平均順位・連対率・ラス率・飛び率・平均持ち点
- 試合数・局数の併記（ドーナツ中央に `54戦 / 194局`）
- **順位色の CSS 変数系統**（`--md-custom-color-rank-1..4`）を `src/theme/` に新設する
- dev 専用ギャラリー `#/__rank`（受け入れ条件の実行基盤。API を叩かない）

**やらないこと**

- `recharts` の導入（§3.1 の実測により**不採用**）
- カード3〜5（#10〜#12）、比較タブのヒストグラム（#13）
- スケルトン・空・エラーの作り込み（#15）。本 Issue は「高さが跳ねない最小表示」まで
- 卓平均との差分チップ（カード4 / #11 の担当）
- **順位色の最終確定**（§3.2。暫定値を置き、オーナー確認を逆発注する）

---

## 1. 実物調査の結果

「憶測でAPIを書かない」に従い、以下はすべてソースの実読と実行による確認結果である。推定で書いた箇所は §10 に列挙する。

### 1.1 `recharts` のバンドル増分（実測。**本設計の最大の判断材料**）

ベースライン（`c00b2db`、309 modules）: **`481.09 kB` / gzip `132.17 kB`**、CSS `14.60 kB`。

一時ファイル `src/summary/__probe.tsx` を作って `SummaryPanel` から描画し `npm run build` で計測した。計測後に削除し、**ベースラインと同一ハッシュ `index-BITEbCH3.js` に戻ることを確認済み**。

| 構成 | modules | JS | 増分 | gzip | gzip 増分 |
|---|---|---|---|---|---|
| ベースライン | 309 | 481.09 kB | — | 132.17 kB | — |
| `recharts` から `PieChart` + `Pie` **のみ** | 883 | **755.92 kB** | **+274.83 kB** | **215.37 kB** | **+83.20 kB** |
| ＋ `Cell` / `Tooltip` / `ResponsiveContainer` | 883 | **798.32 kB** | **+317.23 kB** | **225.80 kB** | **+93.63 kB** |
| **自前 SVG ドーナツ**（`stroke-dasharray` の `<circle>` ＋凡例＋タイル相当） | 310 | **482.16 kB** | **+1.07 kB** | 132.61 kB | **+0.44 kB** |

**`recharts` は最小構成でもバンドルを 1.57 倍（gzip 1.63 倍）にする。** モジュール数が 309 → 883 に跳ねることから、`PieChart` 1つでも `recharts` のコア（スケール・アニメーション・イベント系）が丸ごと引き込まれると分かる。ツリーシェイクは効いていない。

**判断: 自前 SVG を採用する（§3.1）。**

### 1.2 MD3 の customColor パイプラインは**カテゴリ配色に使えない**（実行して確認）

`@material/material-color-utilities@0.3.0` を Node から直接叩き、`applyTheme.ts` と同じ手順（`themeFromSourceColor(seed, [{value, name, blend:false}, …])`）で順位色4つをカスタムカラーとして生成し、WCAG コントラスト比を計算した（5シード × light/dark）。

| light の出力 | rank1 `#F5A623`→ | rank2 `#4A90D9`→ | rank3 `#7A8B99`→ | rank4 `#D0454C`→ |
|---|---|---|---|---|
| 生成されたロール色 | `#835500` | `#0061a5` | **`#006590`** | `#af2d37` |
| 背景（surface-container-low）とのコントラスト | 5.81 | 5.83 | 5.81 | 5.83 |
| **隣接スライス間のコントラスト** | — | **1.00** | **1.00** | **1.00** |

**判明した事実（憶測では出てこない）**

1. **customColor のロール色は必ずトーン40（light）/ 80（dark）に正規化される。** 結果、4色の**輝度がほぼ完全に一致**し、隣接コントラストが **1.00〜1.01** になる。グレースケールでは4スライスが区別できない。
2. **低彩度の色は最寄りの高彩度の色相に化ける。** スレートグレー `#7A8B99` はロール化で `#006590`（シアンブルー）になり、rank2 のブルー `#0061a5` と**ほぼ同じ色**になった。
3. この性質はシードに依存しない（`blend:false` のため5シードで同一の出力）。

→ **順位色を `themeFromSourceColor` の customColors に載せてはならない。** §3.2 で別系統を設計する。

### 1.3 順位色の代替設計とコントラスト実測

`TonalPalette.fromInt(hue).tone(t)` を**順位ごとに違うトーン**で叩く方式を試し、5シード × light/dark で実測した。採用値:

| キー | 色相ソース | light トーン | light HEX | dark トーン | dark HEX |
|---|---|---|---|---|---|
| `rank-1` | `#F5A623`（金） | 56 | `#b87900` | 87 | `#ffd39b` |
| `rank-2` | `#3D7BC4`（青） | 37 | `#04589f` | 66 | `#69a3ef` |
| `rank-3` | `#2A9D8F`（青緑） | 50 | `#008679` | 80 | `#6fd8c8` |
| `rank-4` | `#D0454C`（赤） | 43 | `#b9343d` | 73 | `#ff9695` |

実測コントラスト（背景 = `surface-container-low` = `ElevatedCard` の地色。5シードでの振れ幅は ±0.03 以内）:

| | rank-1 | rank-2 | rank-3 | rank-4 | 4色の**相互**最小 |
|---|---|---|---|---|---|
| light | **3.29** | 6.54 | 4.05 | 5.24 | **1.23** |
| dark | **12.31** | 6.62 | 10.09 | 8.22 | **1.22** |

**設計に効く事実**

- 背景に対しては全色・両モードで **3:1 以上**（WCAG 1.4.11「非テキストのコントラスト」を満たす）。
- **4色すべてが同一背景に対して 3:1 以上であることと、4色が互いに 3:1 以上であることは同時に成立しない**（輝度レンジが足りない）。上の表の相互最小 1.23 が、トーンを振っても得られる現実的な上限に近い。
- したがって **「隣接スライス同士を直接接触させない」設計が必須**である（§3.3-c: カード地色で 4 単位の隙間を空ける）。隙間を入れれば各弧の比較対象は背景だけになり 1.4.11 を満たす。
- さらに**色を唯一の伝達手段にしない**（凡例に `1位 20.4%` とテキストで直接書く）。

### 1.4 API 実データの形（保存済みレスポンスで確認）

`src/api/testdata/player_stats.json`（issue-3 が実 API から保存したもの）と `src/domain/__fixtures__/player_stats_{3p,4p}.json` を実読・実行した。

| フィールド | 四麻（実レスポンス） | 三麻（fixture） | 型・意味 |
|---|---|---|---|
| `count` → `gameCount` | `54` | — | 試合数 |
| `rank_rates` | `[0.2037, 0.1481, 0.3888, 0.2592]` | `[0.3002, 0.34, 0.3598]` | **0..1 の割合**。合計 1。長さ = 卓人数 |
| `rank_avg_score` | `[37718, 27250, 21357, 11079]` | `[62500, 35700, 6800]` | 順位別平均最終素点。長さ = 卓人数 |
| `avg_rank` | `2.7037` | `2.0596` | 平均順位 |
| `negative_rate` | `0.0555` | `0.09` | **飛び率。0..1 の割合** |

`src/api/testdata/player_extended_stats.json` の `count` = `194` → `PlayerExtendedStats.roundCount`（**局数**）。`player_stats` の `count`（試合数）とは別物である。

`normalize.ts:46-49` は `rank_rates` / `rank_avg_score` / `avg_rank` / `negative_rate` を**素通し**する（改名も単位変換もしない）。したがって公開型 `PlayerStats` のこれらの値はワイヤそのままである。

### 1.5 ドメイン層の既存関数（実読）

`src/domain/derived.ts` に必要なものが**すべて揃っている**。自前で再実装しない。

```ts
export function averageScore(rankRates: readonly number[], rankAvgScores: readonly number[]): number;
export function rentaiRate(rankRates: readonly number[]): number;      // rankRates[0] + rankRates[1]
export function lastPlaceRate(rankRates: readonly number[]): number;   // rankRates[rankRates.length - 1]
```

- 3つとも `src/domain/index.ts` から公開済み（`export { averageScore, …, lastPlaceRate, rentaiRate, … } from './derived'`）。
- **`averageScore` が Issue 本文の「平均持ち点 = Σ順位率×順位別平均点」そのもの**である。`rank_avg_score` の実フィールドを使う専用関数を新設する必要はない。実行確認: 実レスポンス値で `averageScore([0.2037,0.1481,0.3888,0.2592], [37718,27250,21357,11079]) = 22894.16`（配給原点 25000 を下回る。妥当）。
- `rentaiRate` / `lastPlaceRate` は**配列長に依存しない書き方**なので三麻でもそのまま正しい（`rentaiRate` = 1位率+2位率、`lastPlaceRate` = 最終要素）。
- **`avg_rank` / `negative_rate` は API がそのまま返すので導出しない。** `avg_rank` を `Σ(i+1)×rank_rates[i]` で再計算しないこと（丸め差で API 値とズレる）。

**本 Issue で `src/domain/` に追加・変更するものは無い。**

### 1.6 `FilteredStatsState` と `PlayerScope`（実読）

`src/filters/useFilteredStats.ts`:

```ts
export type FilteredStatsState =
  | { kind: 'loading' }
  | { kind: 'empty' }   // player_stats が null
  | { kind: 'ready'; stats: PlayerStats; extended: PlayerExtendedStats | null }
  | { kind: 'error'; message: string };
```

- **`extended` は `ready` でも `null` になりうる**。局数（`roundCount`）はこれ由来なので、`null` のとき「◯局」を出さない分岐が要る（§3.5）。
- フィルタ変更のたびに `setState({kind:'loading'})` が走る（`useFilteredStats.ts` の第3 `useEffect` 冒頭）。つまり **loading ↔ ready の往復はユーザー操作のたびに起きる**。ここで高さが跳ねると、下に並ぶカード3〜5がその都度動く（§3.4）。
- `usePlayerScope()` は issue-8 §3.5 のランタイムガード済み。`scope.stats` / `scope.numPlayers` を `?.` 無しで使える。

### 1.7 `SummaryPanel` の現状（実読）

`empty` のときは `NO_GAMES_IN_PERIOD_MESSAGE` を1つ出し、順位グラフ枠を出さない構造になっている。**この `empty` のパネル単位の扱いを本 Issue でも維持する**（§3.4）。

### 1.8 順位色プラミングのバンドル増分（実測）

`applyTheme.ts` に `TonalPalette` の import と4色ぶんの `setProperty` を一時的に追加して計測（計測後に `git checkout` で復元。ベースラインと同一ハッシュに戻ることを確認済み）。

| 構成 | JS | 増分 | gzip 増分 |
|---|---|---|---|
| ベースライン | 481.09 kB | — | — |
| ＋ `TonalPalette` 経由の順位色4トークン | **481.40 kB** | **+0.31 kB** | +0.12 kB |

`@material/material-color-utilities` は既にバンドル済みなので、`TonalPalette` の追加 import は実質ゼロコスト。

### 1.9 実物確認できなかったもの

- **amae-koromo（本家）の順位色の実際の値**。CLAUDE.md「API利用の方針」と本 Issue の指示により**外部アクセスを行っていない**ため、リポジトリ内に情報源が無い（`docs/` を全文検索したが順位色の記述は無い）。§3.2 の値は**本設計の独自判断**であり、「本家準拠」の要件は**未充足のまま暫定値で進める**。§8.4 V1 でオーナーに確認を委託する。

---

## 2. データの流れ

```
PlayerLayoutInner
  └ useFilteredStats(...) ──► scope.stats: FilteredStatsState   ← カード2の唯一のデータ源
       └ SummaryPanel
            ├ <LevelDetailCard state={scope.identity}/>      （カード1・層側。#8。触らない）
            ├ 順位グラフ枠                                    （カード1の尾。#8。触らない）
            └ <RankCard state={scope.stats} numPlayers={scope.numPlayers}/>   ← 本 Issue
```

**カード1と逆に、カード2はグローバルフィルタの影響を受ける。** `scope.identity` を一切参照しない（`identity.gameCount` は全期間の通算値なので、期間フィルタ下の「◯戦」と混ぜると嘘になる）。

**禁止事項（静的検証 S9 で担保）**: `rankView.ts` / `RankCard.tsx` が `useCurrentIdentity` / `CurrentIdentityState` / `identityView` を import しないこと。

---

## 3. 設計判断

### 3.1 グラフ描画は自前 SVG（`recharts` を採用しない）

**結論: `recharts` を使わない。ドーナツは `<circle>` の `stroke-dasharray` で描く。**

根拠:

1. **§1.1 の実測。** `PieChart` + `Pie` だけで **+274.83 kB / gzip +83.20 kB**。同等の見た目が自前 SVG で **+1.07 kB / gzip +0.44 kB** で作れる。**250倍以上の差**であり、判断の余地が無い。
2. ドーナツに必要な機能は「割合に応じた弧」「色」「隙間」だけで、`recharts` の価値（スケール・軸・凡例レイアウト・レスポンシブ計測・アニメーション）は1つも使わない。
3. **色の統制の問題。** `recharts` の `<Cell fill>` に CSS 変数を渡せても、`recharts` 自身が内部で持つ既定色やツールチップの配色は MD3 トークン外になる。CLAUDE.md 制約5（色は CSS 変数）を守る手当てが別途要る。
4. `recharts` は React コンポーネントとして DOM を組み立てるため、`data-testid` を狙った位置に置きにくく、受け入れ条件が書きにくい。

**後続 Issue への影響（判断の射程）**

| Issue | 影響 |
|---|---|
| **#12（和了/放銃ドーナツ3枚）** | 本 Issue の `Donut` コンポーネントを**そのまま再利用する**。§4.3 で `Donut` を `RankCard` から分離した汎用部品として切る理由がこれ。追加コスト 0 |
| **#13（ヒストグラム14枚）** | ヒストグラムは軸・目盛・比較線（自分/卓平均/段位平均）が要り、ドーナツより要求が重い。**本 Issue の判断を自動適用しない。** ただし「120本の矩形＋3本の縦線」も自前 SVG で描ける公算が高く、#13 の設計時に**同じ手順で実測してから決める**こと（`recharts` を入れると gzip +83 kB がその Issue に丸ごと乗る） |
| **#17（順位グラフ）** | 折れ線。同上、#17 の設計時に実測する |

**`package.json` から `recharts` を削除するか**: 本 Issue では**削除しない**（#13・#17 の判断が済んでいないため）。`devDependencies` でもないので `npm ci` の時間以外にコストは無く、`src/` から import しない限りバンドルは 0 kB のまま（受け入れ条件 S8 が守る）。

### 3.2 順位色 — `src/theme/seeds.ts` を単一情報源とする新系統

**（a）どこに置くか**

CLAUDE.md 制約5 のとおり「配色は `src/theme/` がランタイムに生成し `:root` の CSS 変数として供給する」。順位色もこれに従い、**`src/theme/seeds.ts` に定数、`src/theme/applyTheme.ts` に書き出しを置く**。CSS ファイルや TSX に色を書かない。

**セクション色4系統（`SECTION_COLORS`）とは別系統にする。** 理由:

- CLAUDE.md「保留中の設計判断」がセクション色について「**色分けそのものを行わない可能性がある**」としている。順位色をセクション色に相乗りさせると、セクション色の廃止判断が順位ドーナツを壊す。
- 順位色は「1位〜4位」という**順序尺度**で、和了/放銃/立直/運という**名義尺度**とは意味が違う。

**（b）customColor パイプラインに載せない**

§1.2 の実測により、`themeFromSourceColor` の customColors は4色の輝度を揃えてしまい、低彩度の色相を潰す。代わりに `TonalPalette.fromInt(色相ソース).tone(順位ごとに違うトーン)` を直接使う（§1.3 の表）。

```ts
// src/theme/seeds.ts に追加
export type RankColorKey = 'rank-1' | 'rank-2' | 'rank-3' | 'rank-4';

/** 順位色の色相ソース。差し替えはこのオブジェクトの編集のみで完結する */
export const RANK_COLOR_SOURCES: Record<RankColorKey, string> = {
  'rank-1': '#F5A623', // 1位: 金
  'rank-2': '#3D7BC4', // 2位: 青
  'rank-3': '#2A9D8F', // 3位（四麻のみ）: 青緑
  'rank-4': '#D0454C', // ラス: 赤
};

/**
 * 順位ごとに違うトーンを当てる。
 * MD3 の customColor ロール（light 40 / dark 80 固定）を使うと4色の輝度が揃い、
 * 隣接コントラストが 1.00 になってグレースケールで区別できなくなる（設計書 §1.2 実測）。
 */
export const RANK_COLOR_TONES: Record<'light' | 'dark', Record<RankColorKey, number>> = {
  light: { 'rank-1': 56, 'rank-2': 37, 'rank-3': 50, 'rank-4': 43 },
  dark: { 'rank-1': 87, 'rank-2': 66, 'rank-3': 80, 'rank-4': 73 },
};
```

`applyTheme.ts` は末尾（`colorScheme` の設定より前）で4トークンを書き出す:

```
--md-custom-color-rank-1 … --md-custom-color-rank-4
```

`on-*` / `*-container` は**作らない**（順位色の上に文字を載せる設計にしないため。§3.3-d）。トークンを増やさない。

**（c）「本家準拠」の未充足を明示する**

Issue 本文は「順位色は本家準拠」と書いているが、**リポジトリ内に本家の順位色の情報源が無く、外部アクセスは行っていない**（§1.9）。上の値は「1位=金・ラス=赤・中間は寒色」という順序尺度としての独自判断である。**オーナー確認（§8.4 V1）で実際の本家配色との照合を委託し、差し替えが必要なら `RANK_COLOR_SOURCES` の4行を書き換えるだけで完結する構造にしてある。**

**（d）三麻の色割当**

**順位インデックスではなく「意味」で割り当てる。**

| 卓 | スライス | 使うトークン |
|---|---|---|
| 四麻（`rank_rates.length === 4`） | 1位 / 2位 / 3位 / 4位 | `rank-1` / `rank-2` / `rank-3` / `rank-4` |
| 三麻（`rank_rates.length === 3`） | 1位 / 2位 / **3位（＝ラス）** | `rank-1` / `rank-2` / **`rank-4`** |

三麻の3位に `rank-3`（青緑）を当てると「ラスが赤くない」ことになり、四麻と並べたときに意味が反転する。**最下位は常に `rank-4`（赤）**とする。この規則は `rankView.ts` の純関数で表現し、ユニットテスト U5 で固定する。

### 3.3 ドーナツの描き方

**（a）技法**: `viewBox="0 0 160 160"` の SVG に、順位ごとに1つずつ `<circle cx=80 cy=80 r=60 fill=none stroke-width=24>` を重ね、`stroke-dasharray` / `stroke-dashoffset` で弧を切り出す。`transform="rotate(-90 80 80)"` で 12 時開始・時計回り。

- 円周 `C = 2π × 60 = 376.99112`（`rankView.ts` が `DONUT_CIRCUMFERENCE` として export し、テストで固定する）
- スライス `i` の開始位置 `start_i = C × Σ_{j<i} rate_j`、`stroke-dashoffset = -start_i`
- `stroke-dasharray = "L_i (C - L_i)"`、`L_i = clamp(C × rate_i - GAP, MIN_ARC, C)`

**（b）定数**（`rankView.ts` に置き、`.tsx` に直書きしない）

| 定数 | 値 | 意味 |
|---|---|---|
| `DONUT_RADIUS` | 60 | 中心線半径（viewBox 単位） |
| `DONUT_STROKE` | 24 | 弧の太さ。内半径 48 → 中央の穴の直径 96 |
| `DONUT_GAP` | 4 | スライス間の隙間（§1.3 の結論。**0 にしない**） |
| `DONUT_MIN_ARC` | 2 | 極端に小さい割合でも弧が消えないための下限 |

**（c）隙間は必須**（§1.3）。`stroke-linecap` は既定の `butt` のままにする（`round` にすると隙間が埋まり、§1.3 の前提が崩れる）。

**（d）割合 0 のスライス**: 弧を**描かない**（`<circle>` 自体を出さない）。凡例には `0.0%` として残す。

**（e）中央の穴**: SVG の上に HTML を絶対配置し、`54` `戦` / `194局` を出す（§3.5）。SVG の `<text>` を使わないのは、typescale クラス（`md-typescale-*`）と `.numeric`（`tabular-nums`）をそのまま使うため。

**（f）アクセシビリティ**

- `<svg role="img" aria-label="順位分布 1位 20.4% 2位 14.8% 3位 38.9% 4位 25.9%">`（`rankView` が `ariaLabel` を組み立てる）
- 凡例は `<ul>`。各項目は「色見出しの小さな四角（`aria-hidden`）＋ `1位` ＋ `20.4%`」。**色を唯一の伝達手段にしない**（§1.3）
- `@media (prefers-reduced-motion: reduce)` で弧の `transition` を切る

### 3.4 4状態の扱いと「高さが跳ねない」規律

**`empty` はパネル単位、それ以外はカード単位で扱う。**

| `scope.stats.kind` | どこで扱うか | 表示 |
|---|---|---|
| `empty` | **`SummaryPanel`**（issue-8 の現行構造を維持） | `NO_GAMES_IN_PERIOD_MESSAGE` を1つ出し、**カード2も順位グラフ枠も描かない** |
| `loading` | `RankCard` | ドーナツと5タイルの位置にプレースホルダ矩形（`surface-container-highest`、アニメーションなし） |
| `ready` | `RankCard` | 本表示 |
| `error` | `RankCard` | カード内にメッセージ（`--md-sys-color-error`）。`state.message` をそのまま出す |

**`empty` をカード側に持たせない理由**: #10〜#12 でカードが増えたとき、各カードが「この期間の対局はありません」を重複表示することになる。パネル単位で1回出すのが正しい。

**高さの規律（issue-8 §5.3 H1 を層側にも適用する）**

カード2は sticky ではないが、**`loading` ↔ `ready` はフィルタ操作のたびに往復する**（§1.6）。ここで高さが変わると、下に並ぶカード3〜5（#10〜#12）が操作のたびに上下する。したがって:

> **R1: `RankCard` の高さは `loading` / `ready` / `error` で同一でなければならない**（同じ卓人数・同じ幅において）。

- 卓人数が違えば凡例の行数が違うので高さは違ってよい（三麻と四麻で別の値でよい）。ただし**同一卓人数の中では3状態が完全一致**すること。
- そのため `RankCard` は `numPlayers` を受け取り、**`loading` のプレースホルダも卓人数ぶんの凡例行を出す**（`ready` の行数と一致させる）。
- `error` はメッセージ枠に `min-height` を与えて `ready` の本文高さに一致させる。**エラー文言が長くなると破れる**（issue-8 §10-9 と同じ制約）。`describeStatsError` の現行文言は2行に収まる。
- 具体的な px 値は本設計では**指定しない**（issue-8 は px を指定して2回外した）。受け入れ条件 B3 は「3状態の実測値が**全一致**すること」で判定し、絶対値は記録するだけにする。

`empty` はパネル構造そのものが変わる状態なので R1 の対象外。

### 3.5 数値の書式

| 値 | 書式 | 例 | 根拠 |
|---|---|---|---|
| 順位率（凡例） | `(rate * 100).toFixed(1)` ＋ `%` | `20.4%` | 小数1桁。牌譜屋の慣用 |
| 平均順位 | `avg_rank.toFixed(2)` | `2.70` | 順位は2桁ないと差が見えない |
| 連対率 / ラス率 / 飛び率 | `(x * 100).toFixed(1)` ＋ `%` | `35.2%` `25.9%` `5.6%` | 凡例と揃える |
| 平均持ち点 | `Math.round(x).toLocaleString('ja-JP')` | `22,894` | 素点は3桁区切り（issue-8 §3.7 と統一）。小数は出さない |
| 試合数 | `toLocaleString('ja-JP')` ＋ `戦` | `54戦` | |
| 局数 | `toLocaleString('ja-JP')` ＋ `局` | `194局` | `extended === null` のときは**この行ごと出さない**（§1.6） |

- 数値要素にはすべて `.numeric`（`tabular-nums`。`src/index.css` の既存クラス）を付ける。
- **順位率の合計は丸めの結果 100.0% にならないことがある**（例 `[0.2037,0.1481,0.3888,0.2592]` → 20.4+14.8+38.9+25.9 = 100.0 だが、常に成立するとは限らない）。合計を表示しないので実害は無い。**合計を 100 に合わせる補正を入れないこと**（値が API と食い違う方が害が大きい）。
- タイルの単位（`%` / `pt` 相当）は値と同じ要素に入れ、`aria` 上も読み上げが自然になるようにする。

### 3.6 タイルは5枚・固定順

要件 §4.1 とおりの順で並べる。**順序を変えない**（受け入れ条件が index で読む）。

| # | ラベル | 値 | 出どころ |
|---|---|---|---|
| 1 | 平均順位 | `2.70` | `stats.avg_rank`（**再計算しない**。§1.5） |
| 2 | 連対率 | `35.2%` | `rentaiRate(stats.rank_rates)` |
| 3 | ラス率 | `25.9%` | `lastPlaceRate(stats.rank_rates)` |
| 4 | 飛び率 | `5.6%` | `stats.negative_rate`（**再計算しない**） |
| 5 | 平均持ち点 | `22,894` | `averageScore(stats.rank_rates, stats.rank_avg_score)` |

レイアウトは `grid-template-columns: repeat(auto-fit, minmax(96px, 1fr))`。375px 幅では 3列＋2列に落ちる。**5枚が2行に割れること自体は許容する**（R1 は状態間の一致を要求するだけで、行数の固定は要求しない）。ただし `loading` のプレースホルダも同じ grid に同じ5枚を置くこと。

### 3.7 `@material/web` の追加コンポーネントを増やさない

土台は `ElevatedCard`（`src/components/md` のバレル経由。issue-8 で取り込み済み・追加コスト0）。`md-divider` / `md-chip` 等を新たに使わない。区切りが要るところは `border-top: 1px solid var(--md-sys-color-outline-variant)` で描く（issue-8 §1.7 の実測により `outline` はテキストに使わず罫線専用）。

---

## 4. モジュール構成と公開シグネチャ

### 4.1 `src/theme/seeds.ts`（変更）

§3.2 の `RankColorKey` / `RANK_COLOR_SOURCES` / `RANK_COLOR_TONES` を追加する。**既存の `RANK_SEEDS` / `SECTION_COLORS` / `rankFromLevelId` / `seedForRank` は1文字も変えない。**

### 4.2 `src/theme/applyTheme.ts`（変更）

`TonalPalette` を import し、`applyMd3Theme` の末尾（`root.style.colorScheme` の設定より**前**）で順位色4トークンを書き出す。

```ts
/** 色相ソースごとの TonalPalette をメモ化する（取りうるソースは4種のみ） */
const rankPaletteCache = new Map<string, TonalPalette>();
```

- **既存の29キー書き出し・surface-container 合成・customColors のロジックは1行も変えない。**
- 色のリテラルを `applyTheme.ts` に書かない（`seeds.ts` から読む）。

### 4.3 `src/summary/rankView.ts`（新規・純関数・React 非依存）

```ts
import type { NumPlayers, PlayerExtendedStats, PlayerStats } from '../api';

/** ドーナツの幾何定数。TSX に直書きせずここから読む（§3.3-b） */
export const DONUT_RADIUS = 60;
export const DONUT_STROKE = 24;
export const DONUT_GAP = 4;
export const DONUT_MIN_ARC = 2;
export const DONUT_CIRCUMFERENCE: number; // 2 * Math.PI * DONUT_RADIUS

export interface RankSlice {
  readonly key: string;        // React key。'rank-1' 等（色トークン名と同じ）
  readonly label: string;      // '1位'
  readonly rate: number;       // 0..1（API 値そのまま）
  readonly percentText: string;// '20.4'（% 記号は含めない）
  readonly colorToken: RankColorKey; // 'rank-1' | 'rank-2' | 'rank-3' | 'rank-4'（§3.2-d）
  readonly arcLength: number | null; // stroke-dasharray の第1値。rate === 0 のとき null（弧を描かない）
  readonly arcOffset: number;  // stroke-dashoffset に入れる値（負値）
}

export interface RankTile {
  readonly key: string;   // 'avgRank' | 'rentai' | 'last' | 'negative' | 'avgScore'
  readonly label: string; // '平均順位'
  readonly value: string; // '2.70' / '35.2%' / '22,894'
}

export interface RankView {
  readonly slices: readonly RankSlice[];   // 長さ = rank_rates.length（3 or 4）
  readonly tiles: readonly RankTile[];     // 常に長さ5・§3.6 の順
  readonly gameCountText: string;          // '54'
  readonly roundCountText: string | null;  // '194' / extended が null なら null
  readonly ariaLabel: string;              // '順位分布 1位 20.4% 2位 14.8% …'
}

/**
 * rank_rates が空・長さが 3/4 以外・rank_avg_score と長さが違う場合は null を返す
 * （API の想定外形状。カードは「データを表示できません」を出す）
 */
export function buildRankView(input: {
  readonly stats: PlayerStats;
  readonly extended: PlayerExtendedStats | null;
}): RankView | null;

/** loading のプレースホルダが ready と同じ行数になるよう、卓人数だけからスライス数を決める */
export function skeletonSliceCount(numPlayers: NumPlayers): number; // 4 → 4, 3 → 3
```

`buildRankView` の手順（この順序で実装する）:

1. `rates = stats.rank_rates`。`rates.length !== 3 && rates.length !== 4` なら `null`
2. `stats.rank_avg_score.length !== rates.length` なら `null`
3. `colorToken`: 長さ4 → `['rank-1','rank-2','rank-3','rank-4']`、長さ3 → `['rank-1','rank-2','rank-4']`（§3.2-d）
4. `arcOffset_i = -(DONUT_CIRCUMFERENCE * Σ_{j<i} rate_j)`
5. `arcLength_i = rate_i === 0 ? null : Math.min(Math.max(DONUT_CIRCUMFERENCE * rate_i - DONUT_GAP, DONUT_MIN_ARC), DONUT_CIRCUMFERENCE)`
6. タイル5枚を §3.6 の順・§3.5 の書式で組む。**`avg_rank` と `negative_rate` は API 値をそのまま使う**
7. `roundCountText = extended === null ? null : extended.roundCount.toLocaleString('ja-JP')`

**import 禁止**: `react` / `../filters/useCurrentIdentity` / `./identityView` / `recharts`。

### 4.4 `src/summary/Donut.tsx`（新規・汎用部品）

**#12（和了/放銃ドーナツ3枚）で再利用するため、`RankCard` から分離する**（§3.1）。

```ts
export interface DonutSegment {
  readonly key: string;
  readonly colorVar: string;         // 'var(--md-custom-color-rank-1)' 形式の完成した CSS 値
  readonly arcLength: number | null; // null なら描かない
  readonly arcOffset: number;
}
export interface DonutProps {
  readonly segments: readonly DonutSegment[];
  readonly ariaLabel: string;
  readonly children?: ReactNode;     // 中央の穴に置く内容
  readonly placeholder?: boolean;    // true なら全周を surface-container-highest で1本描く（loading 用）
}
export function Donut(props: DonutProps): ReactElement;
```

- フックを使わない純粋な表示コンポーネント
- `colorVar` は**呼び出し側が完成した CSS 値を渡す**。`Donut` の中に色名を持たない（#12 は別トークンを渡す）
- 描画結果の DOM:

```html
<div class="donut">
  <svg class="donut__svg" viewBox="0 0 160 160" role="img" aria-label="順位分布 …" data-testid="rank-donut">
    <circle class="donut__track" cx="80" cy="80" r="60" fill="none" stroke-width="24"/>
    <circle class="donut__seg" data-seg="rank-1" … stroke="var(--md-custom-color-rank-1)"
            stroke-dasharray="72.793 304.198" stroke-dashoffset="-0" transform="rotate(-90 80 80)"/>
    …
  </svg>
  <div class="donut__center"> {children} </div>
</div>
```

### 4.5 `src/summary/RankCard.tsx`（新規・表示専用）

```ts
export interface RankCardProps {
  readonly state: FilteredStatsState;
  readonly numPlayers: NumPlayers;
}
export function RankCard(props: RankCardProps): ReactElement;
```

`LevelDetailCard` と同じ流儀: **フックを使わない純粋な表示コンポーネント**（dev ギャラリーから任意の状態を流し込める）。`import './summary.css'` のみ副作用 import を許す。

描画結果の DOM（`data-testid` は受け入れ条件が読むので**この名前で固定**）:

```html
<md-elevated-card class="rank-card" data-testid="rank-card" data-state="ready">
  <div class="rank-card__inner">
    <h2 class="rank-card__title md-typescale-title-medium">成績</h2>

    <div class="rank-card__chart">
      <!-- Donut。中央の穴 -->
      <div class="rank-card__center">
        <span class="rank-card__games md-typescale-headline-small numeric" data-testid="rank-games">54</span>
        <span class="rank-card__games-unit md-typescale-label-small">戦</span>
        <span class="rank-card__rounds md-typescale-label-small numeric" data-testid="rank-rounds">194局</span>
      </div>

      <ul class="rank-card__legend" data-testid="rank-legend">
        <li class="rank-card__legend-item" data-rank="1">
          <span class="rank-card__swatch" aria-hidden="true" style="--swatch: var(--md-custom-color-rank-1)"></span>
          <span class="rank-card__legend-label">1位</span>
          <span class="rank-card__legend-value numeric">20.4%</span>
        </li>
        …
      </ul>
    </div>

    <dl class="rank-card__tiles" data-testid="rank-tiles">
      <div class="rank-card__tile"><dt class="md-typescale-label-medium">平均順位</dt>
        <dd class="md-typescale-title-large numeric">2.70</dd></div>
      … （5枚・§3.6 の順）
    </dl>
  </div>
</md-elevated-card>
```

- **`data-state` 属性に `state.kind` を出す**（受け入れ条件が状態を機械判定するため）。`empty` は `SummaryPanel` が扱うので `RankCard` には来ない（来た場合は `loading` と同じ描画にしてよいが、経路は無い）
- `style="--swatch: …"` はインラインの**カスタムプロパティ受け渡し**であり色リテラルではない。`background: var(--swatch)` は CSS 側に書く
- `buildRankView` が `null` を返したとき: `data-state="ready"` のまま、本文の位置に `順位データを表示できません` を出す（`error` と同じ枠を使う）

**状態別**

| `state.kind` | 表示 | 高さの作り方（R1） |
|---|---|---|
| `ready` | 上記 | 基準 |
| `loading` | `Donut placeholder` ＋ 中央は空 ＋ 凡例は `skeletonSliceCount(numPlayers)` 行のプレースホルダ ＋ タイル5枚のプレースホルダ | 各プレースホルダの高さを ready の対応要素と**同じ typescale 由来の高さ**にする |
| `error` | タイトル ＋ `.rank-card__message`（`state.message`） | `.rank-card__message { min-height: … }` で ready の本文高さに一致させる。**具体値は製造時に実測して決める**（§3.4） |

### 4.6 `src/summary/SummaryPanel.tsx`（変更）

`empty` 以外のとき、順位グラフ枠の**後ろ**に `<RankCard state={scope.stats} numPlayers={scope.numPlayers} />` を追加する。

```
LevelDetailCard（カード1・層側）
  → 順位グラフ枠（カード1の尾）
  → RankCard（カード2）   ← 追加
```

順位グラフ枠がカード1に属する（要件 §4.1）ため、カード2はその後ろに来る。`empty` の分岐は**現行のまま**（メッセージ1つ。カード2も描かない。§3.4）。

### 4.7 `src/summary/summary.css`（変更）

`.rank-card*` / `.donut*` の規則を追記する。**既存の `.identity*` / `.level-detail*` / `.summary-panel*` の規則は1行も変えない。**

- `.donut { position: relative; width: 100%; max-width: 200px; aspect-ratio: 1; }`
- `.donut__svg { display: block; width: 100%; height: 100%; }`
- `.donut__track { stroke: var(--md-sys-color-surface-container-highest); }`
- `.donut__seg { transition: stroke-dasharray 300ms cubic-bezier(0.05,0.7,0.1,1); }` ＋ `@media (prefers-reduced-motion: reduce)` で `transition: none`
- `.donut__center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; }`
- `.rank-card__chart { display: flex; gap: 16px; align-items: center; }` — 375px 幅ではドーナツ左・凡例右の2カラムに収まる（ドーナツ 200px 上限＋凡例最小 96px）。収まらない場合は `flex-wrap: wrap`
- `.rank-card__swatch { width: 12px; height: 12px; border-radius: 3px; background: var(--swatch); flex: 0 0 auto; }`
- `.rank-card__tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); gap: 8px; margin: 0; }`
- `.rank-card__title` / `dt`: `--md-sys-color-on-surface-variant`、`dd`: `--md-sys-color-on-surface`
- `.rank-card__message { color: var(--md-sys-color-error); min-height: …; margin: 0; }`
- `.rank-card__skeleton { background: var(--md-sys-color-surface-container-highest); border-radius: 4px; }`（アニメーションなし。#15 が担当）

**`summary.css` に16進カラーリテラルを1つも書かないこと**（CLAUDE.md 制約5。静的検証 S7）。

### 4.8 `src/dev/RankGallery.tsx`（新規・dev 専用）

`main.tsx` の `devRoutes` に `'#/__rank'` を追加する。**CLAUDE.md 制約4 の形（`import.meta.env.DEV` のリテラル分岐の内側に動的 `import()` を直書き）を崩さないこと。**

`RankCard` に以下の固定 `FilteredStatsState` を流し込む（**API を1回も叩かない**）。`nickname` に実在プレイヤー名を使わない。

| # | 状態 | 値 |
|---|---|---|
| 1 | loading（四麻） | `{kind:'loading'}` / `numPlayers=4` |
| 2 | loading（三麻） | `{kind:'loading'}` / `numPlayers=3` |
| 3 | error | `{kind:'error', message:'ネットワークに接続できませんでした。'}` / `numPlayers=4` |
| 4 | ready 四麻 | `rank_rates:[0.2037,0.1481,0.3888,0.2592]` / `rank_avg_score:[37718,27250,21357,11079]` / `avg_rank:2.7037` / `negative_rate:0.0555` / `gameCount:54` / `roundCount:194`（`src/api/testdata/player_stats.json` の実値） |
| 5 | ready 三麻 | `rank_rates:[0.3002,0.34,0.3598]` / `rank_avg_score:[62500,35700,6800]` / `avg_rank:2.0596` / `negative_rate:0.09` / `gameCount:120` / `roundCount:500` |
| 6 | ready・`extended === null` | 4 と同じ、`extended:null`（「◯局」が出ないこと） |
| 7 | ready・0% を含む | `rank_rates:[0.6,0.4,0,0]` / `gameCount:5`（弧が2本、凡例は4行 `0.0%`） |
| 8 | ready・極端に小さい率 | `rank_rates:[0.997,0.001,0.001,0.001]`（`DONUT_MIN_ARC` が効いて弧が消えないこと） |
| 9 | ready・大きな試合数 | `gameCount:12345` / `roundCount:56789`（中央の穴からあふれないこと） |
| 10 | 想定外形状 | `rank_rates:[0.5,0.5]`（`buildRankView` が `null` → 「順位データを表示できません」） |

**高さ計測プローブ**: ページ先頭に、実ページと同じ幅条件で `RankCard` を「四麻 loading / 四麻 ready / 四麻 error」の3枚、「三麻 loading / 三麻 ready」の2枚並べたブロックを置き、`data-testid="rank-height-probe"` を付ける（受け入れ条件 B3 が測る）。**横パディングを持つ祖先の外側に置くこと**（issue-8 §4.6 で計測器が壊れた原因）。

カラーモード切替は `#/__theme` と同じ `useTheme().setModeSetting` を使う。

### 4.9 変更・追加ファイル一覧

| ファイル | 種別 | 内容 |
|---|---|---|
| `src/theme/seeds.ts` | 変更 | `RankColorKey` / `RANK_COLOR_SOURCES` / `RANK_COLOR_TONES` 追加（§4.1） |
| `src/theme/applyTheme.ts` | 変更 | 順位色4トークンの書き出し（§4.2） |
| `src/summary/rankView.ts` | 新規 | 純関数のビューモデル（§4.3） |
| `src/summary/rankView.test.ts` | 新規 | §7 の U1〜U12 |
| `src/summary/Donut.tsx` | 新規 | 汎用ドーナツ（§4.4） |
| `src/summary/RankCard.tsx` | 新規 | カード2（§4.5） |
| `src/summary/SummaryPanel.tsx` | 変更 | `RankCard` を1行追加（§4.6） |
| `src/summary/summary.css` | 変更 | `.rank-card*` / `.donut*` を**追記のみ**（§4.7） |
| `src/dev/RankGallery.tsx` | 新規（dev 専用） | §4.8 |
| `src/main.tsx` | 変更 | dev ルート `#/__rank` 追加 |

**触らない**: `src/domain/**`（§1.5。追加不要）/ `src/api/**` / `src/filters/**` / `src/shell/**` / `src/components/md/**` / `src/summary/IdentityCard.tsx` / `LevelDetailCard.tsx` / `identityView.ts` / `identityView.test.ts` / `src/theme/ThemeProvider.tsx` / `useRankTheme.ts` / `package.json`。

---

## 5. 想定される取り違え（製造担当向け）

1. **`avg_rank` / `negative_rate` を自分で計算しない。** API が返す値をそのまま出す（§1.5）。`Σ(i+1)×rate` で再計算すると API 値と小数第2位がズレる。
2. **`gameCount` を `scope.identity` から取らない。** カード2はフィルタ適用後の試合数を出す。`identity.gameCount` は全期間の通算値（§2）。
3. **局数は `extended.roundCount`。** `stats.gameCount` と混同しない（実データで 54 戦 / 194 局。§1.4）。
4. **`extended` は `ready` でも `null` になりうる**（§1.6）。
5. **三麻の3位に `rank-3` を当てない。** 最下位は常に `rank-4`（§3.2-d）。
6. **`stroke-linecap: round` にしない。** 隙間が埋まり §1.3 のコントラスト前提が崩れる。
7. **`recharts` を import しない**（§3.1。静的検証 S8）。
8. **`summary.css` の既存規則を書き換えない。** 追記のみ。
9. **色を TSX / CSS に直書きしない。** 順位色は `--md-custom-color-rank-*`、それ以外は `--md-sys-color-*`。
10. **`<md-elevated-card>` を直書きしない。** `src/components/md` の `ElevatedCard` を使う（CLAUDE.md 制約3）。
11. **`loading` のプレースホルダを「小さく」作らない。** ready と同寸にするのが目的（§3.4 R1）。issue-8 はここで検収を1回落としている。
12. **`import './summary.css'` 以外の bare import を書かない**（CLAUDE.md 制約1）。

---

## 6. ユニットテストの計画（`src/summary/rankView.test.ts`）

jsdom / `@testing-library/react` は未導入なので**React コンポーネントのテストは書けない**（issue-8 §1.8）。検証は「純関数のユニットテスト」＋「ブラウザ実測」に分ける。

| # | ケース名（この名前で作る） | 検証内容 |
|---|---|---|
| U1 | 四麻の実レスポンス値でスライスが4つ・順位ラベルが 1位〜4位 になる | `src/api/testdata/player_stats.json` の値を入力 |
| U2 | 三麻でスライスが3つになる | fixture `player_stats_3p.json` の値 |
| U3 | 四麻の色トークンが rank-1..rank-4 の順になる | §3.2-d |
| U4 | **三麻の3スライス目の色トークンが rank-4 になる** | §3.2-d。**rank-3 でないこと**を明示的に assert |
| U5 | arcOffset が累積割合 × 円周の負値になる | 先頭は `-0`、2番目は `-(C*rates[0])` |
| U6 | arcLength が `C*rate - DONUT_GAP` になる | `toBeCloseTo` で比較 |
| U7 | rate が 0 のスライスの arcLength が null になる | `[0.6,0.4,0,0]` |
| U8 | 極小の rate でも arcLength が DONUT_MIN_ARC を下回らない | `[0.997,0.001,0.001,0.001]` |
| U9 | タイルが常に5枚・§3.6 の順・key が固定 | `['avgRank','rentai','last','negative','avgScore']` |
| U10 | タイルの値が domain の関数と一致する | `rentaiRate` / `lastPlaceRate` / `averageScore` を**テスト側でも呼んで**突き合わせる（Issue 完了条件「導出値が #4 のロジックと一致」の機械的な担保） |
| U11 | 平均順位・飛び率が API 値をそのまま整形した文字列になる | `2.7037 → '2.70'` / `0.0555 → '5.6%'` |
| U12 | 平均持ち点が3桁区切りの整数になる | `22894.16 → '22,894'` |
| U13 | `extended` が null のとき `roundCountText` が null | §1.6 |
| U14 | `rank_rates.length` が 2 のとき `buildRankView` が null を返す | 想定外形状 |
| U15 | `rank_avg_score` の長さが `rank_rates` と違うとき null を返す | 同上 |
| U16 | `ariaLabel` に全順位の割合が含まれる | `'順位分布 1位 20.4% …'` |
| U17 | `skeletonSliceCount(4) === 4` / `skeletonSliceCount(3) === 3` | §3.4 |

**red 先行の確認**（受け入れ条件 T3）: (a) 三麻の色割当を `rank-3` に戻す → U4 が FAIL、(b) `DONUT_GAP` の減算を外す → U6 が FAIL、(c) `DONUT_MIN_ARC` の clamp を外す → U8 が FAIL。各改変後に戻し、`npm test` が全パスに復帰することを確認する。

---

## 7. 受け入れ条件

検収担当は以下を**1項目ずつ実行**して結果を記録する。

### 7.1 静的検証

| # | 実行すること | 合格条件 |
|---|---|---|
| S1 | `npm run build` | 成功。型エラー0。`dist/assets/index-*.js` が **485.0 kB 以下 / gzip 133.5 kB 以下**（**実測値をレポートに記載する**）<br>**上限の根拠**: ベースライン `c00b2db` = 481.09 kB / gzip 132.17 kB（実測）。本 Issue の追加分は ①順位色プラミング **+0.31 kB / gzip +0.12**（§1.8 実測）②自前 SVG ドーナツ＋凡例＋タイル相当 **+1.07 kB / gzip +0.44**（§1.1 実測）＝ **+1.38 kB / gzip +0.56**。実装は計測用プローブより richer（4状態分岐・`Donut` の分離・skeleton）なので **+3.9 kB / gzip +1.33** の枠を与える。新しい `@material/web` コンポーネント・新しい依存は1つも増えない（§3.7） |
| S2 | `npm run lint` | 新規エラー0（既存の警告水準を悪化させない） |
| S3 | `npm test` | 全パス。`rankView.test.ts` が実行され、テスト数がベースラインより増えている |
| S4 | `grep -rn "<md-" src/ --include='*.tsx'` | 0件 |
| S5 | `grep -rn "^import '" src/ \| grep -v "\.css'"` | 0件 |
| S6 | `grep -rn "all\.js" src/` | 0件 |
| S7 | `grep -rniE "#[0-9a-f]{3,8}([^0-9a-f]\|$)" src/summary/ src/theme/applyTheme.ts` | **0件**（色リテラルは `src/theme/seeds.ts` にしか無い） |
| S8 | `grep -rn "recharts" src/` | **0件**（§3.1。本 Issue でも 0 kB を維持する） |
| S9 | `grep -rn "useCurrentIdentity\|CurrentIdentityState\|identityView" src/summary/rankView.ts src/summary/RankCard.tsx src/summary/Donut.tsx` | 0件（カード2がカード1のデータ源に触れていない。§2） |
| S10 | `grep -c "RankGallery" dist/assets/*.js` | 0（dev 専用コードが本番バンドルに入っていない） |
| S11 | `grep -n "rank-3" src/summary/rankView.ts` | 1件以上、かつ**三麻の分岐に現れない**ことをコードで確認（§3.2-d） |
| S12 | `git diff --stat c00b2db -- src/domain/ src/api/ src/filters/ src/shell/ src/components/ package.json src/summary/identityView.ts src/summary/IdentityCard.tsx src/summary/LevelDetailCard.tsx` | **出力が空**（§4.9 の「触らない」が守られている） |
| S13 | `git diff c00b2db -- src/summary/summary.css \| grep "^-" \| grep -v "^---"` | **出力が空**（`summary.css` は追記のみ。既存行を削除・変更していない） |

### 7.2 ユニットテスト

| # | 実行すること | 合格条件 |
|---|---|---|
| T1 | `npx vitest run src/summary/rankView.test.ts` | 全パス。§6 の U1〜U17 が**すべて存在する**（ケース名で照合） |
| T2 | `npx vitest run src/domain/ src/summary/` | 全パス。既存の `identityView.test.ts` / `domain/*.test.ts` が**無改変で**通っている |
| T3 | red 先行の確認（3件） | §6 末尾の (a)(b)(c) をそれぞれ実施し、**対応するケースだけが FAIL** することを確認する。各改変後に戻して `npm test` が全パスに復帰すること |

### 7.3 ブラウザ実測

`npm run dev` を起動し、ブラウザペインで確認する。**実 API を叩く操作は B5・B6 の1プレイヤー分に限る**（CLAUDE.md「1画面表示あたり数リクエスト以内」）。B1〜B4・B7・B8 は dev ギャラリーで行い、API を消費しない。

**ビューポートの作り方を必ず揃えること**（issue-8 §8.3 と同じ手順）:

- `resize_window({ preset: 'mobile' })`（375×812・デバイスエミュレーション有効）→ **`document.documentElement.clientWidth === 375` をレポートに記録する**
- `clientWidth` が 375 でない（＝スクロールバーが出ている）なら計測をやり直す

| # | 実行すること | 合格条件 |
|---|---|---|
| B1 | `#/__rank` を開く | 10状態すべてが描画され、**コンソールエラー0**。状態4に `[data-testid="rank-card"]`（`data-state="ready"`）、その中に `rank-donut` / `rank-legend` / `rank-tiles` がある |
| B2<br>三麻・四麻 | 状態4（四麻）と状態5（三麻）で `document.querySelectorAll('[data-testid="rank-donut"] .donut__seg').length` と凡例 `li` の数を数える | 四麻 = **4 / 4**、三麻 = **3 / 3**。さらに三麻の最終スライスの `stroke` が `getComputedStyle(document.documentElement).getPropertyValue('--md-custom-color-rank-4')` と一致する（§3.2-d）。四麻の3番目は `rank-3` と一致する |
| **B3**<br>高さ不変（R1） | `[data-testid="rank-height-probe"]` 内の `[data-testid="rank-card"]` の `getBoundingClientRect().height` を配列で取る | **四麻の3枚（loading / ready / error）が完全一致**（`new Set(...).size === 1`）。**三麻の2枚（loading / ready）が完全一致**。実測値をレポートに記録する（絶対値の上限は課さない。§3.4） |
| B4<br>導出値 | 状態4のタイル5枚の `textContent` を順に読む | `['2.70', '35.2%', '25.9%', '5.6%', '22,894']`。凡例は `['1位 20.4%','2位 14.8%','3位 38.9%','4位 25.9%']` 相当。中央は `54` `戦` と `194局`。**この値は `src/api/testdata/player_stats.json` の実レスポンスから §1.4・§1.5 の式で手計算したもの** |
| B5 | `#/4/player/<実在ID>/summary` を開く | `[data-testid="rank-card"]` が層側に描画され、**`[data-testid="level-detail-card"]` と `rank-graph-placeholder` の後ろ**にある（`compareDocumentPosition` で確認）。コンソールエラー0。ページ本体に水平スクロールが無い（`scrollWidth <= clientWidth`） |
| B6<br>フィルタ連動 | B5 の状態でタイルと中央の `textContent` を記録 → 期間チップを「7日」に変更 | **値が変わる**（＝カード2はフィルタの影響を受ける）。かつ `[data-testid="identity-level"]` と `identity-meta` は**1文字も変わらない**（カード1の非連動が壊れていない）。**さらに操作中に `rank-card` の高さが変わらない**（loading を挟むため。R1 の実ページ確認） |
| B7<br>色トークン | `#/__rank` の状態4で、4本の `.donut__seg` の `getComputedStyle(el).stroke` と `:root` の `--md-custom-color-rank-1..4` を突き合わせる | 4本とも一致。**トークン外の色が1つも無い**。凡例スウォッチの `background-color` も同様 |
| B8<br>dark | `#/__rank` で `localStorage.setItem('mjsv:color-mode','dark')` → リロード | 全10状態が dark で描画され、弧が背景に埋もれない。`getComputedStyle(document.documentElement).colorScheme === 'dark'`。`--md-custom-color-rank-1..4` が §1.3 の dark 値（`#ffd39b` / `#69a3ef` / `#6fd8c8` / `#ff9695`）と一致する。※ `prefers-color-scheme` のエミュレーションは `matchMedia` の `change` を発火しないため**必ず localStorage 経由で切り替える**（CLAUDE.md 既知の制約） |
| B9<br>light | 同上を `localStorage.setItem('mjsv:color-mode','light')` で | `--md-custom-color-rank-1..4` が §1.3 の light 値（`#b87900` / `#04589f` / `#008679` / `#b9343d`）と一致する |
| B10<br>段位シード非依存 | `#/__rank` を開いた状態で `useTheme().setRank()` 相当の操作（ギャラリーに段位切替を置く）または `#/4/player/<雀傑のID>/summary` と `<雀豪のID>/summary` を比較 | **`--md-custom-color-rank-1..4` の値がシードによって変わらない**（順位色は段位テーマから独立。§3.2）。API を消費しないギャラリー側での確認を優先する |
| B11<br>0%・極小 | `#/__rank` の状態7・状態8 | 状態7: `.donut__seg` が **2本**、凡例は4行で `0.0%` が2つ。状態8: `.donut__seg` が **4本**（極小の3本が消えていない）。各弧の描画長 > 0 |
| B12<br>あふれ | `#/__rank` の状態9（`12345戦 / 56789局`） | 中央のテキストがドーナツの穴からはみ出さない（`.rank-card__center` の `scrollWidth <= clientWidth`）。状態10 で `順位データを表示できません` が出る |
| B13<br>`empty` | `#/4/player/<実在ID>/summary` で期間を「対局が無い期間」にできる場合のみ | `NO_GAMES_IN_PERIOD_MESSAGE` が1つだけ出て、`rank-card` も `rank-graph-placeholder` も出ない（§3.4）。**再現できなければ「未確認」と記録してよい**（API 消費を増やしてまで再現しない） |

### 7.4 UI検証の逆発注（オーナーへ委託）

`docs/ui-verification/TEMPLATE.md` を複製して手順書を作る（統括担当の作業）。**機械で測れる項目を混ぜないこと**。

| # | 委託内容 | 種別 |
|---|---|---|
| **V1** | **牌譜屋（amae-koromo）の順位分布グラフを実際に開き、本アプリの順位色（`#/__rank` の状態4・5）と見比べて、色の対応が納得できるかを書く。** 違う場合は「本家では何位が何色か」を記録する | **§3.2-c の未充足事項。オーナー決定事項**（外部アクセスはオーナーのみが行う） |
| V2 | 実機スマホで `#/4/player/<ID>/summary` を開き、ドーナツと5タイルのバランス（ドーナツが大きすぎ／小さすぎないか、凡例が読めるか）を書く | ハードウェア依存＋主観 |
| V3 | OS のダークモードを**実際に切り替えて**、ドーナツ4色の識別しやすさを light/dark で比較して書く。「隣り合う2色が同じに見える」組み合わせがあれば記録する | エージェント環境で再現不能。§1.3 の隣接コントラスト 1.23 が実用に足るかの検証 |
| V4 | 色覚特性のシミュレーション（OS のカラーフィルタ等）を使えるなら、1型・2型で4色が区別できるかを書く。使えない場合は「未実施」でよい | ハードウェア/OS 依存 |
| V5 | 期間フィルタを何度か切り替え、カード2が読み込み中と表示中で**動かない**か（下のカードが上下しないか）を体感で書く | §3.4 R1 の主観確認 |
| V6 | 「平均持ち点 22,894」という数値が、配給原点 25000 との対比なしで意味が伝わるか。「25000 との差」を出したほうがよいと感じるかを書く | 仕様の当否。**#11（カード4）の設計入力になる** |

各項目に「判断保留」欄と保留理由欄を置くこと。V1 は「金・青・青緑・赤でよいですか」のような正解を示唆する聞き方をしない。

---

## 8. 後続 Issue への引き継ぎ

| Issue | 引き継ぎ |
|---|---|
| **#12（和了/放銃ドーナツ3枚）** | `src/summary/Donut.tsx`（§4.4）を**そのまま再利用する**。`colorVar` を呼び出し側から渡す設計なので、セクション色（`--md-custom-color-win` 等）でも順位色でも動く。**追加のバンドルコストは 0**。ただし CLAUDE.md「保留中の設計判断」により**セクション色4系統は廃止されうる**ので、色分けの是非は #12 の設計時に再確認すること |
| **#13（ヒストグラム14枚）・#17（順位グラフ）** | §3.1 の `recharts` 不採用は**ドーナツについての判断**である。軸・目盛・比較線が要るグラフでは事情が違いうるので、**同じ手順（一時プローブ → `npm run build` → 削除）で必ず実測してから決める**こと。実測値の基準は本設計 §1.1 の表 |
| **#10・#11（カード3・4）** | `SummaryPanel` に追加していく。`scope.stats` から取る。**§3.4 R1（loading / ready / error で高さを一致させる）を同じく適用すること。** `empty` はパネル単位で1回だけ扱う（カード側に持たせない） |
| **#15（ローディング・空・エラー）** | 本 Issue の `loading` は「跳ねない」ことだけを満たす最小実装（アニメーションなし）。`.rank-card__skeleton` のモーション設計は #15 |
| **順位色の確定** | §3.2-c のとおり **「本家準拠」は未充足**。V1 の結果で `src/theme/seeds.ts` の `RANK_COLOR_SOURCES` を差し替える。差し替え時は §1.3 の手順（`TonalPalette` でトーンを振ってコントラストを実測）を再実行し、`RANK_COLOR_TONES` も見直すこと |
| **`recharts` の依存** | `package.json` に残したまま（§3.1）。#13・#17 の判断が済んだ時点で、使わないと確定したら削除を検討する |
| **`docs/requirements.md` §4.1** | カード2の内容は要件どおり実装した。要件表の「ビジュアル」欄に書かれた「ドーナツ」を **`recharts` ではなく自前 SVG で実現**した旨を追記するかは統括担当の判断 |

---

## 9. 実挙動未確認・推定で書いた箇所

1. **本家（amae-koromo）の順位色を確認していない。** 外部アクセスを行っていないため（§1.9）。§3.2 の4色は本設計の独自判断であり、**Issue 完了条件の「順位色は本家準拠」は現時点で未充足**。V1 で確認し、必要なら `RANK_COLOR_SOURCES` を差し替える。
2. **実 API レスポンスでの動作確認をしていない。** 入力値は `src/api/testdata/player_stats.json`（issue-3 が保存した実レスポンス）と `src/domain/__fixtures__` に限られる。`rank_rates` が3・4以外の長さになる実例、`extended` が `null` になる実例は観測していない（型定義上は起こりうるので分岐を書いた）。B5・B6 で初めて実データにあたる。
3. **カードの高さの絶対値を実測していない。** issue-8 は px 値を先に決めて2回外したので、本設計は**絶対値を指定せず「3状態が一致すること」だけを要求する**方針にした（§3.4）。ただし `.rank-card__message` の `min-height` は製造時に実測して決める必要があり、**その値は設計書に無い**。
4. **`.rank-card__chart` が 375px 幅で2カラムに収まるかは机上計算**（ドーナツ 200px 上限 ＋ gap 16 ＋ 凡例最小 96 = 312 ≤ カード内幅 311〜343）。境界に近いので `flex-wrap: wrap` を保険に入れてある。**実測は B5 で初めて行われる。**
5. **`stroke-dasharray` の `transition` がスライス数の変わる遷移（四麻↔三麻）で破綻しないかは未確認。** プレイヤーページの `numPlayers` 切替時に起きうる。破綻したら `transition` を外す（見た目の劣化のみで機能は保たれる）。
6. **§1.3 の隣接コントラスト 1.22〜1.23 が実用に足るかは主観判断。** 隙間（`DONUT_GAP`）と凡例のテキストで補う設計にしたが、**実機での見え方は V3・V4 で初めて評価される**。
7. **`--md-custom-color-rank-*` のトークン名が MD3 の慣習に沿うかは確認していない。** 既存の `--md-custom-color-win` 等と同じ接頭辞に揃えただけである。
8. **`Donut` の `#12` での再利用可能性は設計上の見通しであり、実際に #12 の要求（3枚並べる・中央に別の内容）を満たすかは未検証。**
