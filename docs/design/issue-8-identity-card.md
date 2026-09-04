# Issue #8 設計書 — サマリー・カード1: アイデンティティ（段位・pt・昇降条件）

対象 Issue: [#8](https://github.com/BlueKurage119/mj-stats-viewer/issues/8)
参照要件: `docs/requirements.md` §3・§4.1・§5.3・§6.4・§6.6・§8
前提設計書: [issue-4](issue-4-domain-logic.md)（ドメイン）/ [issue-5](issue-5-app-shell.md)（シェル）/ [issue-6](issue-6-global-filter.md)（フィルタ）

**改訂**: 2026-09-05 — 検収差し戻し（B5 未達・loading/ready の高さ跳ね）に対する是正。**§0.1 を先に読むこと。**

---

## 0. スコープ

**やること**

- プレイヤーページのヒーロー領域を、暫定表示（issue-6 §3.10）から正式なカード1へ差し替える
- 名前 / 段位（`雀傑★★` 形式）/ 現在pt・上限pt / 次段位までの残pt をヒーローに置く
- 昇降条件（成立時のみ）と通算試合数を、サマリータブ本体（層側）の `LevelDetailCard` に置く【2026-09-05 是正・§3.1】
- 順位グラフの表示枠（#17 承諾後機能のプレースホルダ）をサマリータブ本体に置く
- 段位に応じたテーマシード切替（`useTheme().setRank()`）の初回配線
- dev 専用の状態ギャラリー `#/__identity`（受け入れ条件と UI 検証の実行基盤）

**やらないこと**

- 順位グラフ本体（#17 / 承諾後）
- スケルトン・空・エラー状態の作り込み（#15 が担当。本 Issue は最小の非跳ね表示のみ）
- サマリーカード2〜5（#9〜#12）
- **シード色そのものの調整**（CLAUDE.md「保留中の設計判断」。本 Issue は色を一切ハードコードしない）

---

## 0.1 検収差し戻しによる是正（2026-09-05）

検収で **B5（ヒーロー高さ）が未達**、加えて **loading と ready で高さが 44px 跳ねる**欠陥が報告された。本節は差分設計の要約であり、以下の節が是正済みである: **§1.9（新規・レイアウト実測）／§3.1（全面書き換え）／§3.8（新規）／§4.3／§4.4／§4.6／§4.7／§5.1〜§5.3／§8（受け入れ条件）／§9／§10**。

### 何が起きていたか（実測で確定した原因）

1. **可変高のブロックを sticky なヒーローに入れていた。** 昇降条件ブロック（0〜92px、条件成立時のみ）と `identity__meta`（32px）と loading プレースホルダの寸法不一致により、ヒーロー高さが **382 / 386 / 494px** と状態ごとに揺れていた（§1.9-2 の実測）。高さが状態依存であること自体が欠陥であり、上限値を下げても再発する。
2. **上限 365px の見積りが甘かった。** ヒーローの 244px（パディング72＋ギャップ16＋`FilterBar` 156）は本 Issue が動かせない固定費で、`.identity` を 121px 以下にしないと 365 に入らない。旧 §5.3 の是正策（typescale を1段落とす）は最大 −8px にしかならない（§1.9-3）。
3. **検収の実測値には計測条件の差が混じっていた。** 報告された 426 / 566 / 322px は、ブラウザに**クラシックスクロールバー（15px）がある状態**（＝ビューポート 375px でコンテンツ幅 360px）での値である。実機相当（デバイスエミュレーション、コンテンツ幅 375px）では **386 / 494 / 290px** になる。**15px の幅差で期間チップ行が1行↔2行に飛び、ヒーローが ±40px 動く**（§1.9-4）。受け入れ条件は計測条件を固定しないと再現しない。

### 何をどう変えるか

| # | 変更 | 理由 |
|---|---|---|
| A | **ヒーローは固定4行に限定する**（名前行 / 段位・pt 行 / 進捗バー / 残pt 行）。行数が状態で変わる要素を一切置かない | 統括担当の論点1に同意。sticky 要素の高さを状態非依存の定数にする。§3.1 の「順位グラフ枠は層側」という前例を昇降条件へ広げる |
| B | **昇降条件ブロックと通算試合数を層側の新カード `LevelDetailCard` へ移す** | 上と同じ。条件は「常態が非表示」（§1.2-1）＝ヒーローに置くと必ず高さが揺れる |
| C | **「フィルタ非適用」注記はヒーローに残す**が、名前行の右端に置いて**行を増やさない** | 注記の目的は「直下の `FilterBar` がカード1に効かない」誤解の防止（要件 §5.3）。層側へ動かすと目的を果たさない |
| D | **loading / notFound / error の高さを ready と 1px の差もなく一致させる** | 報告された 44px 跳ねの是正。プレースホルダの寸法を ready の実寸に合わせ、メッセージ枠に `min-height` を与える |
| E | **`.identity` の `gap` を 16 → 8 に詰める** | 4行構成では 16px ギャップが3つで 48px を占め、内容（102px）に対して過大。詰めても情報の塊は崩れない |
| F | **上限そのものを改訂する**（§5.3・B5） | 365 は「ビューポート高の45%」という根拠の薄い数値だった。是正後の**実測値 + 14px** を回帰上限として採る（§5.3） |

**実測（本節の設計を DOM で組んで計測。§1.9-5）**

| 構成 | ビューポート375（実機相当・コンテンツ343） | ビューポート360（コンテンツ328） |
|---|---|---|
| `main`（issue-6 の暫定ヒーロー） | 272px | 312px |
| 現状 `dd758f8`（是正前） | 386px | 426px ← 検収の報告値 |
| **是正後（本設計）** | **330px** | **370px** |
| 是正後 `.identity`（全状態・全幅） | **126px（不変）** | **126px（不変）** |

### 製造担当が触るファイル / 触らないファイル

**触る（5ファイル）**

| ファイル | 変更 |
|---|---|
| `src/summary/IdentityCard.tsx` | 4行構成へ再編。名前行に `identity__scope` を追加。昇降条件ブロックと `identity__meta` を削除。loading/notFound/error の高さを ready に一致させる |
| `src/summary/LevelDetailCard.tsx` | **新規**。層側カード（昇降条件＋通算試合数＋フィルタ非適用の説明文） |
| `src/summary/SummaryPanel.tsx` | `LevelDetailCard` を順位グラフ枠の前に描画する |
| `src/summary/summary.css` | 上記に対応する規則。`.identity` の `gap` 8、`identity__head`、`identity__message` の `min-height`、`.identity__level` の `nowrap`、`.level-detail` 系 |
| `src/dev/IdentityGallery.tsx` | 各状態で `IdentityCard` と `LevelDetailCard` を並べる。**ヒーロー実寸プローブ**（`data-testid="gallery-hero"`）を追加し、B5 を API なしで測れるようにする |

**触らない（是正前の実装を1行も変えない）**

- `src/summary/identityView.ts` / `identityView.test.ts` — **ビューモデルは一切変えない**。`promotions` / `demotions` / `gameCount` の消費者が移動するだけ
- `src/domain/**` / `src/theme/**` / `src/main.tsx` / `src/shell/**`（`PlayerLayout` の hero は `IdentityCard` のままでよい）/ `src/filters/**`
- **特に `src/filters/filters.css` と `FilterBar.tsx` は触らない。** §9 に挙げた `FilterBar` の折り返し欠陥（80px 相当）は Issue #6 の実装不備であり、本 Issue の是正はそれに**依存しないで**成立する

---

## 1. 実物調査の結果

「憶測でAPIを書かない」に従い、以下はすべて実物のソース読解と実行による確認結果である。推定で書いた箇所は §10 に列挙する。

### 1.1 `useCurrentIdentity` / `CurrentLevelInfo`（実物確認）

`src/filters/useCurrentIdentity.ts` / `src/api/endpoints.ts:119-155`

```ts
export type CurrentIdentityState =
  | { kind: 'loading' }
  | { kind: 'ready'; identity: CurrentLevelInfo }
  | { kind: 'notFound' }                    // getCurrentLevel が null
  | { kind: 'error'; message: string };

export type CurrentLevelInfo = {
  level: LevelWithDelta;      // 現在段位。現在pt = score + delta
  maxLevel: LevelWithDelta;   // 生涯最高
  nickname: string;
  gameCount: number;          // 生涯試合数
  playedModes: GameMode[];
};
```

`getCurrentLevel` は `getPlayerStats(numPlayers, playerId, dataMinDate(), currentHourEnd(), allModes(numPlayers))` の薄いラッパーで、**グローバルフィルタを参照する経路が構造的に存在しない**。`useCurrentIdentity` の `useEffect` deps も `[numPlayers, playerId]` のみ。したがって「フィルタを変えてもカード1が変わらない」ことはフックの実装で既に保証されており、本 Issue の責務は **`useFilteredStats` 由来の値を混ぜないこと**だけである。

### 1.2 昇降条件 API の実挙動（実行して確認）

`src/domain/transitions.ts` を実際に呼んで出力を採取した（一時テストファイルで実行、採取後に削除）。代表的な結果:

| 入力（levelId / score+delta） | mode | `promotionConditions` | `demotionConditions` |
|---|---|---|---|
| 雀傑2 `10302` 232 | 9 | 全 `never` | 全 `never` |
| 雀傑3 `10303` 1990 | 9 | `[always, always, atLeast 39100, never]` | 全 `never` |
| 雀聖3 `10503` 8950 | 16 | `[always, atLeast 9100, atLeast 79100, never]` | 全 `never` |
| 雀豪1 `10401` 20 | 12 | 全 `never` | `[never, never, atMost 9000, always]` |
| 魂天1 `10701` 1960 | 16 | `[always, never, never, never]` | 全 `never` |
| 魂天20 `10720` 5000 | 16 | 全 `never` | 全 `never` |
| 三麻 雀聖2 `20502` 5950 | 26 | `[always, atLeast 84100, never]` | 全 `never` |
| 三麻 雀豪1 `20401` 40 | 24 | 全 `never` | `[never, never, always]` |

**設計に効く事実**

1. **通常のプレイヤーはほぼ全 `never`**。条件が1つでも成立するのは「上限pt の直前」または「0pt の直前」に限られる。Issue の「条件成立時のみ表示」は、実際には**条件ブロック全体が非表示であることが常態**という意味になる。ブロックの出現・消滅でレイアウトが跳ねない設計が必須（§4.4）。
2. 配列の**添字がそのまま 0 基点の順位**であり、長さは卓人数（四麻4 / 三麻3）と一致する。
3. 魂天は `KONTEN_DELTA` により素点非依存なので `always` / `never` しか返らない。

### 1.3 到達不能な素点境界が返る（実行して確認）

`transitions.ts` の探索域上限は「卓の総素点」（四麻 100000 / 三麻 105000、`totalFor`）であり、issue-4 §4.2 は「これを超える境界は `never` と報告する」と決めている。しかし**個人が到達しうる素点は順位に依存して更に小さい**ため、探索域内であっても実戦上ありえない境界がそのまま返る:

- 雀聖3 の 3位 `atLeast 79100`（3位が 79100 点を持つには上位2人がそれ以上必要 → 不可能）
- 三麻 雀聖2 の 2位 `atLeast 84100`（同上）
- 雀傑3 の 3位 `atLeast 39100`

これらをそのまま「3位で79,100点以上なら昇段」と表示すると不具合に見える。**表示層で到達可能性による足切りが要る**（§3.3）。

なお先行CLI版ツールは非公開でリポジトリ内に存在せず（要件 §10）、表示規則を参照できなかった。本設計の足切り規則は**独自判断**である。

### 1.4 現在pt が段位境界を跨いでいるケース（実行して確認）

`level.score + level.delta` は上限pt 以上や負値になりうる（`formatAdjustedScore` / `getAdjustedLevel` が両分岐を持つことが根拠）。実測:

| 入力 | `formatLevelWithDelta` の表示 | 正規化しない `promotionConditions` |
|---|---|---|
| `10302` score 1400 delta 0 | **雀傑3 1000/2000**（昇段後） | `[always, always, atLeast 29100, never]` |
| `10401` score 10 delta −100 | **雀傑3 1000/2000**（降段後） | `demotion` が `[never, atMost 54000, always, always]` |

つまり**表示は「昇段済み」なのに条件は「1位なら昇段」と出る**という自己矛盾が起きる。条件計算の前に現在ptを正規化しなければならない。

**正規化関数は新規に書く必要がない。** `growth.ts` の `applyPointDelta(lp, 0)` が `formatAdjustedScore` と同一の分岐（上限超え → 次段位の初期pt / 負値 → 前段位の初期pt もしくは 0）を実装済みであることをソースで確認した（`growth.ts:33-53` と `level.ts:166-186` の突き合わせ）。実行して一致も確認した:

- `applyPointDelta({levelId:10302, point:1400}, 0)` → `{levelId:10303, point:1000}` = 表示「雀傑3 1000/2000」と一致
- `applyPointDelta({levelId:10401, point:-90}, 0)` → `{levelId:10303, point:1000}` = 表示と一致
- 正規化後に条件を計算し直すと両ケースとも全 `never` になる（＝直後の1戦では昇降しない。正しい）

また `applyPointDelta` は内部で `getVersionAdjustedLevel` を通すため、**戻り値の levelId は majorRank 6（旧魂天）を含まない**（常に 7 に正規化される）。表示・条件計算の下流で旧魂天分岐を考えなくてよい。

### 1.5 `preferredMode` の実挙動（実行して確認）

`growth.ts:23-30` + `levelConstants.ts` の `LEVEL_ALLOWED_MODES` を実読・実行した。

1. **`majorRank` 1（初心）・2（雀士）は `LEVEL_ALLOWED_MODES` が空配列で、`preferredMode` は `null` を返す。** 雀傑1 は降段可能（`cannotDemote` は `majorRank===1 || (majorRank===2 && minorRank===1)`）なので、牌譜屋に記録があるプレイヤーでも現在段位が雀士になりうる。**`null` を必ず扱うこと。**
2. **正規化前と正規化後で戻り値が変わる。** `10401` score 10 delta −100 は正規化前 `12`（玉）/ 正規化後 `9`（金）。条件計算は**正規化後の levelId から求めたモード**を使う。
3. 非空の `LEVEL_ALLOWED_MODES` 全8キー（103/104/105/106/107/203/204/205/206/207 のうち非空の8つ）について、`allModes` の並び上の先頭は**必ず半荘モード**（四麻 16/12/9・三麻 26/24/22）になることを確認した。注記に「半荘」と書いてよい（§3.3）。

### 1.6 バンドル実測（`npm run build`）

ベースライン（main、303 modules）: **`468.16 kB` / gzip `128.24 kB`**、CSS `11.53 kB`。

一時的にコードを追加して計測し、その後 `git checkout -- src/` で復元（復元後のビルドがベースラインと同一ハッシュ `index-CEFVXy45.js` になることを確認済み）。

| 追加した要素 | JS | 増分 | gzip 増分 |
|---|---|---|---|
| （ベースライン） | 468.16 kB | — | — |
| `ElevatedCard`（`src/components/md` 既存ラッパー） | 470.81 kB | **+2.65 kB** | +0.45 kB |
| ＋ `AssistChip`（新規ラッパーが必要） | 477.00 kB | **+6.19 kB** | +0.57 kB |
| `LinearProgress`（`src/components/md` 既存ラッパー） | 480.19 kB | **+12.03 kB** | +2.57 kB |

→ 進捗バーに `md-linear-progress` を使うと **12 kB** かかる。自前 CSS なら 0 kB（§3.6）。昇降条件を `md-assist-chip` にすると 6.2 kB かかるうえ、非対話の状態表示に対話用チップを使うのは MD3 のセマンティクスに反する。→ 不採用。

`recharts@3.10.1` は `package.json` にあるが `src/` から一度も import されておらず、現状バンドルに入っていない（`grep -rn "recharts" src/` が 0 件）。**順位グラフのプレースホルダで recharts を import しないこと**（#17 まで 0 kB を維持する）。

### 1.7 配色コントラストの実測

`@material/material-color-utilities@0.3.0` を Node から直接叩き、`applyTheme.ts` と同じトーン合成（`neutral.tone(92/17)` = `surface-container-high`、`neutral.tone(98/6)` = `surface`）を再現して WCAG コントラスト比を計算した。5シード（既定緑・雀傑金・雀豪橙・雀聖赤・魂天青）× light/dark の全10通り:

| 前景 / 背景 | light | dark |
|---|---|---|
| `on-surface` / `surface-container-high` | 13.98 – 14.06 | 11.06 – 11.21 |
| **`primary` / `surface-container-high`** | **5.25 – 5.30** | **8.38 – 8.45** |
| `on-surface-variant` / `surface-container-high` | 7.60 – 7.63 | 8.40 – 8.51 |
| `error` / `surface-container-high` | 5.26 – 5.29 | 8.42 – 8.50 |
| `on-*-container` / `*-container`（primary/error/tertiary） | 13.18 – 13.33 | 5.51 – 7.29 |
| `outline` / `surface-container-high` | **3.65 – 3.68** | 4.51 – 4.54 |

- **`primary` を Display 級の数値に使ってよい**（全シード・両モードで 4.5:1 以上）。しかも 5シード間の差が 0.05 以内なので、**シード色を後で差し替えてもこの判断は壊れない**（CLAUDE.md 保留事項との整合）。
- `outline` は light で 4.5:1 未満。**罫線・枠線（3:1 でよい非テキスト）専用**とし、テキストに使わない。
- 条件バッジは `*-container` / `on-*-container` のペアを使えば両モードで AA を満たす。

補足検証: `themeFromSourceColor(seed, customColorDefs)` の `customColors`（`blend:false`）は基底スキームの29キーを**1つも変えない**ことを実行して確認済み（差分キー 0）。上表は `customColors` 無しで計算したが実アプリと同値である。

### 1.8 その他の実物確認

- `index.html` は Material Symbols Outlined を **`FILL@0` 固定インスタンス**で読み込んでいる。塗りつぶし星（FILL=1）は出せない。→ 段位★はアイコンではなくテキスト `★`（U+2605）で描く（§3.2）。
- typescale CSS には `md-typescale-display-large/medium/small` が存在する（`node_modules/@material/web/typography/md-typescale-styles.css`）。
- `src/index.css` に `.numeric`（`tabular-nums`）が既にある。数値表示に使う。
- `tsc -b` はテストファイルも型検査する（`src/**/*.test.ts` が対象）。テストで Node 組み込み（`node:fs` 等）を使うと `@types/node` が `tsconfig.app.json` の `types` に無いためビルドが落ちる。**テストは純粋なロジック検証に留めること**。
- jsdom / `@testing-library/react` は未導入。**React コンポーネントのユニットテストは書けない**。検証は「純関数のユニットテスト」＋「ブラウザ実測」に分ける（§8）。

### 1.9 レイアウト実測（2026-09-05・是正のための追加調査）

`dd758f8` を dev サーバーで起動し、`#/__identity` 上でブラウザから DOM を組み立てて計測した。**リポジトリのコードは1行も変更していない**（DOM 操作のみ。計測後に破棄）。

**1. typescale の実値**（`node_modules/@material/web/typography/md-typescale-styles.css` を実読）

| クラス | font-size | line-height |
|---|---|---|
| `display-medium` | 45px | **52px** |
| `display-small` | 36px | **44px** |
| `headline-medium` | 28px | 36px |
| `headline-small` | 24px | 32px |
| `title-medium` | 16px | **24px** |
| `body-medium` | 14px | **20px** |
| `label-small` | 11px | **16px** |

**2. 是正前の `.identity` の高さ（実測）** — `#/__identity` の12状態、コンテンツ幅 293px

| 状態 | 高さ | 内訳 |
|---|---|---|
| 4・10・12（ready・条件なし） | **182** | 名前24＋段位52＋進捗6＋残pt20＋meta16 ＋ ギャップ16×4 |
| 9（魂天20・進捗と残ptなし） | **160** | |
| 5・8・11（条件1グループ） | **266** | ＋条件68＋ギャップ16 |
| 6・7（条件2グループ相当） | **290** | ＋条件92＋ギャップ16 |
| 1（loading） | **138** | 段位スケルトンが 40px しかなく、meta 行が無い |
| 2・3（notFound / error） | **88** | |

→ **同じヒーローが 88〜290px の間で揺れる**。行の line-height から積み上げた計算値と 1px の差もなく一致したので、以降の見積りはこのモデルで行い、最後に実測で照合した。

**3. 旧 §5.3 の是正策の効き幅（実測）** — `display-medium`(52) → `display-small`(44) は **−8px**、`headline-medium`(36) なら −16px。検収の報告（426→418→410）と一致する。**typescale だけでは 365 に届かない**ことが確定した。

**4. 検収の実測値との差は「クラシックスクロールバー 15px」で説明できる**（再現確認済み）

`.filter-bar__row` は `md-chip-set` に `overflow-x: auto` を当てているが、`md-chip-set` の `:host{display:flex;flex-wrap:wrap;gap:8px}`（`node_modules/@material/web/chips/internal/chip-set-styles.css` を実読）の **`flex-wrap: wrap` を上書きしていない**ため、横スクロールは一度も発生せず**チップが折り返す**。折り返し量がコンテンツ幅にきわめて敏感になる。

| コンテンツ幅 | モード行（6チップ） | 期間行（5チップ） | `.filter-bar` |
|---|---|---|---|
| 343px（ビューポート375・実機相当） | 2行 74 | **1行 34** | **116** |
| 328px（ビューポート375＋スクロールバー15px、またはビューポート360） | 2行 74 | **2行 74** | **156** |

期間行は 343px ちょうどで収まっている（`scrollWidth === clientWidth === 343`）ため、**15px 狭まるだけで +40px 跳ねる**。これで検収の値が再現できた:

| 検収の報告値 | 再現条件 | 実機相当（コンテンツ幅343）での値 |
|---|---|---|
| ヒーロー 426px | コンテンツ幅 328 → 72＋182＋16＋**156** | **386px** |
| ヒーロー 約566px（条件あり） | 同上 → 72＋290＋16＋156＝534 | **494px** |
| `.identity` 最大 322px | ギャラリーのカード内幅 280 → 段位行が折り返して 84 になる | **290px** |

→ **受け入れ条件は計測条件（デバイスエミュレーションの有無）を明示しないと再現しない。** §8.3 の B5 で固定する。

**5. 是正後の構成の実測**（§3.1・§4.3 の DOM を組み立てて計測）

`.identity` の高さ = 24（名前行）＋8＋52（段位行）＋8＋6（進捗）＋8＋20（残pt）＝ **126px**。
コンテンツ幅 280 / 328 / 343 の3条件 × 状態5種（ready通常 / ready雀聖3 / ready魂天 / loading / error）の**全15通りで 126px** となり、**幅にも状態にも依存しない**ことを確認した。ヒーロー全体は **330px（ビューポート375）/ 370px（ビューポート360）**。

**6. `main` の暫定ヒーロー（比較対象）** — 同じ手順で組み立てて **272px（375）/ 312px（360）**。検収の報告値 280px と同水準。是正後は `main` 比 **+58px** に収まる（是正前は +114px）。

**7. 段位行の水平方向の限界（実測）** — 最長ケース `雀聖★★★ 8950/10000` の `scrollWidth` は **291px**。コンテンツ幅 328・343 では収まるが、**280px 相当（ビューポート 320px の端末）では 11px あふれる**。§5.2 で `.identity__level` に `flex-wrap: nowrap; min-width: 0; overflow: hidden` を課し、**ページ全体の水平スクロールを起こさない**ことを優先する（あふれた場合は `/10000` の右端が切れる）。

---

## 2. カード1が使うデータの流れ

```
PlayerLayoutInner
  ├ useCurrentIdentity(numPlayers, playerId) ──► identity: CurrentIdentityState   ← カード1の唯一のデータ源
  ├ useGlobalFilter(numPlayers, identity)    ──► filter
  ├ useFilteredStats(numPlayers, playerId, filter) ──► stats   ← カード1は絶対に触らない
  │
  ├ useRankTheme(effectiveLevelId)           ──► テーマシード切替
  └ LayeredSheet
       hero  = <div class="player-hero"> <IdentityCard state={identity} …/> <FilterBar …/> </div>
       layer = <Outlet context={scope}/> → summary は <SummaryPanel/>
                 ├ <LevelDetailCard state={scope.identity}/>（昇降条件＋通算試合数）
                 └ 順位グラフ枠
```

`IdentityCard`（ヒーロー）と `LevelDetailCard`（層側）は**どちらも `CurrentIdentityState` だけを入力に取る表示専用コンポーネント**で、それぞれが `buildIdentityView` を呼ぶ。`SummaryPanel` は `usePlayerScope().identity` を渡すだけで、`scope.stats` を `LevelDetailCard` に渡さない。

**禁止事項（静的検証で担保する）**: `IdentityCard` / `identityView.ts` が `stats` / `FilteredStatsState` / `GlobalFilter` を import しないこと。

---

## 3. 設計判断

### 3.1 カード1の配置 — ヒーローは「固定4行」、可変・任意の内容はすべて層側【2026-09-05 是正】

**規則: `LayeredSheet` の `hero` に置いてよいのは、どの状態でも行数が変わらない要素だけ。**行数・有無が状態で変わる要素は、例外なく層側（`SummaryPanel`）に置く。

| 置き場所 | 内容 | 高さの性質 |
|---|---|---|
| **ヒーロー**（sticky） | ①名前行（名前＋`フィルタ非適用`）／②段位バッジ＋現在pt＋上限pt／③進捗バー／④残pt | **常に4行・126px 固定** |
| **層側**（`SummaryPanel`） | `LevelDetailCard`（昇降条件・通算試合数・フィルタ非適用の説明文）／順位グラフ枠 | 可変でよい |

根拠:

1. **`.layered-sheet__hero` は `position: sticky; top: 64px`**（`shell.css`）。sticky 要素の高さが状態によって動くと、同じ画面が読み込み中・条件成立・条件非成立で別のレイアウトになる。実測で **88 / 138 / 160 / 182 / 266 / 290px** の6水準に散っていた（§1.9-2）。上限値を下げるだけでは、条件が成立した瞬間に再発する。
2. **昇降条件は「常態が非表示」**（§1.2-1: 通常のプレイヤーはほぼ全 `never`）。つまりヒーローに置くと「ふだん無いものが、たまに出てきて 92px 押し広げる」という最悪の性質になる。
3. **順位グラフ枠を層側に置いた前例をそのまま広げただけ**であり、新しい方針を持ち込んでいない。分割の線を「アイデンティティの定数部分 ↔ それ以外」に引き直した。
4. **昇降条件はサマリータブ固有の内容として自然**。ヒーローは比較・スタッツタブでも出続けるが、「あと1戦で昇段」は段位を読み解く文脈（サマリー）でのみ意味を持つ。順位グラフ枠が summary タブのみで出ること（受け入れ条件 B9・検収合格済み）と同じ扱いになる。
5. 副次的利点として、**高さが条件の有無によらず一定**になる。統括担当の論点1のとおり。

**要件との関係**: Issue の完了条件「昇降条件が成立ケースで表示され、非成立時は非表示」は満たす（表示場所の指定は無い）。要件 §4.1 の「カード1」は本設計では**ヒーロー＋層側の2ブロックに分割**されている（順位グラフ枠を層側に置いた時点で既にそうなっている）。要件文の更新要否は §9 のとおり統括担当の判断。

**トレードオフ**: 比較・スタッツタブでは昇降条件が見えない。段位を見ながら条件も見たい場面ではサマリータブへ戻る必要がある。これを許容できない場合の代案は「ヒーローに**常に**条件ブロックの枠を確保する（非成立時は `あと1戦での昇降なし` を1行出す）」で、ヒーローは 126 → 170px（＋44）になる。§5.3 の上限には収まるが、**画面の3割弱を「何も起きていない」という情報に使う**ことになるため採らない。

### 3.2 段位表記 — `雀傑★★`

要件 §8 と Issue 本文が `雀傑★★` 形式を明示している。`getLevelTag()` は `雀傑2` を返すため、表示層で★に変換する。

- **通常段位（majorRank 1〜5）**: 主要部ラベル ＋ `★` を `minorRank` 個。空き枠（☆）は**出さない**（要件の表記に忠実、かつ雀魂本体の表記と一致）。
- **魂天（majorRank ≥ 6）**: `getLevelTag()` の出力（`魂天12`）をそのまま出す。★は使わない（最大20個になり破綻する）。§1.4 のとおり正規化後は majorRank 6 が現れないため「数字なしの魂天」は発生しない。
- 主要部ラベルは `LEVEL_TAGS_JA`（`levelConstants.ts`、バレル非公開）が唯一の情報源。**表示層でラベル表を複製しない**ため、ドメインに `getLevelMajorTag(level: Level): string` を追加してバレルから公開する（§4.1）。`getLevelTag()` の戻り値を文字列操作して主要部を取り出す実装は禁止。
- アクセシビリティ: ★は装飾。バッジ要素に `role="img" aria-label={getLevelTag(effLevel)}`（例 `雀傑2`）を付け、★の span に `aria-hidden="true"` を付ける。

### 3.3 昇降条件の表示規則

**(a) 計算対象**

- `lv` = **正規化後**の `{ id: eff.levelId, score: eff.point, delta: 0 }`（§1.4）
- `mode` = `preferredMode(eff.levelId)`。**`null` なら条件ブロックを丸ごと非表示**（§1.5-1）

**(b) 到達可能性による足切り（§1.3 への対処）**

順位 `rank`（0基点）で現実に到達しうる素点の上限を `reachable(rank) = tableTotalScore(mode) / (rank + 1)` と定義する。根拠: 上位の順位の素点は当該順位以上なので、`rank` 位の素点 `s` は `(rank+1) * s ≤ 卓の総素点` を満たす。

| `RankCondition` | 判定 |
|---|---|
| `never` | 表示しない |
| `always` | 無条件行として表示 |
| `atLeast` かつ `score > reachable(rank)` | 表示しない（到達不能） |
| `atLeast` かつ `score ≤ reachable(rank)` | 閾値行「◯◯点以上」 |
| `atMost` かつ `score ≥ reachable(rank)` | **無条件行**として表示（現実的な全素点で成立するため） |
| `atMost` かつ `score < reachable(rank)` | 閾値行「◯◯点以下」 |

この規則で §1.2 の実測値は次のように落ちる（狙いどおり）:

- 雀聖3 昇段: `1位` ／ `2位 9,100点以上`（3位 79,100 は落ちる。`reachable(2)=33,333`）
- 雀豪1 降段: `3位 9,000点以下` ／ `4位`
- 三麻 雀聖2 昇段: `1位` のみ（2位 84,100 は落ちる。`reachable(1)=52,500`）

**近似であることの明示**: 飛び終局で最下位が負の素点になる局面では他家が `reachable` を超えうるので、この上限は厳密な不可能性ではない。ただし境界を跨ぐのは「ありえない条件を消す」方向にしか効かず、実戦域の条件は落ちない（実測の閾値はすべて `reachable` の 1/3 以下か明確に超過のどちらか）。

**(c) 連続する無条件行の畳み込み**

`calculateDeltaPoint` は順位について単調（良い順位ほど有利）なので、昇段側の `always` は先頭から、降段側の `always` は末尾から連続する。実測もこの形（`[always, always, atLeast, never]` / `[never, never, atMost, always]`）。

- 昇段側: rank 0 から連続する無条件行が **2件以上**あれば1行に畳み、ラベルを `${k+1}位以内`（k = 連続の最後の rank）にする
- 降段側: 最終 rank から遡って連続する無条件行が **2件以上**あれば1行に畳み、ラベルを `${j+1}位以下`（j = 連続の最初の rank）にする
- 畳まれない行のラベルは `${rank+1}位`

実装は「実際に連続している範囲」だけを畳む（単調性を前提にしない）。単調性が崩れても行が個別に出るだけで壊れない。

**(d) 文言（builder が改変しないこと）**

| 箇所 | 文字列 |
|---|---|
| 昇段ブロック見出し | `あと1戦で昇段` |
| 降段ブロック見出し | `あと1戦で降段` |
| 行（無条件） | ラベルのみ（例 `2位以内`） |
| 行（昇段・閾値） | ラベル ＋ `{score.toLocaleString('ja-JP')}点以上` |
| 行（降段・閾値） | ラベル ＋ `{score.toLocaleString('ja-JP')}点以下` |
| 条件ブロック注記 | `{MODE_LABELS[mode]}・半荘での条件` |

`MODE_LABELS` は `src/filters/filterState.ts` の既存 export を使う（新しいラベル表を作らない）。「半荘」と断言してよい根拠は §1.5-3。

### 3.4 `useTheme().setRank()` — 呼ぶ（配線する）

**結論: 本 Issue で配線する。**

根拠:

1. CLAUDE.md が保留しているのは「**シード色（段位4色）**」という**値**であって、切替の**仕組み**ではない。しかも保留の解除条件は「画面が組み上がった段階で全体のバランスを見て再調整する」であり、**仕組みが動いていなければオーナーはその判断を下せない**。配線は保留判断の前提条件である。
2. issue-5 §344・§460 と issue-6 §699 が「`setRank` は Issue 8 で初めて呼ぶ」と明示的に引き継いでいる。
3. §1.7 の実測により、`primary` / `surface-container-high` のコントラストは5シード間で 0.05 差しかない。**シード色を後日差し替えても配色の可読性判断はやり直しにならない**ので、いま配線しても後戻りコストが発生しない。
4. 色の差し替えは `src/theme/seeds.ts` の `RANK_SEEDS` 編集だけで完結する構造が既にある（CLAUDE.md §5）。本 Issue は色を1つもハードコードしないので、この性質を壊さない。

**仕組み**

```ts
// src/theme/useRankTheme.ts
export function useRankTheme(levelId: number | null): void;
```

- `levelId === null`（loading / notFound / error）のときは**何もしない**。直前のシードを維持する。`null` を渡して既定色に戻すと、プレイヤー切替のたびに「緑 → 段位色」の点滅が出るため。
- `levelId` が与えられたら `setRank(rankFromLevelId(levelId))` を呼ぶ。`rankFromLevelId` は初心・雀士で `null` を返し、`seedForRank(null)` が `DEFAULT_SEED` になるので追加分岐は不要。
- クリーンアップで `setRank(null)`。アンマウント（検索画面へ戻る等）で既定シードに復帰する。`levelId` 変化時はクリーンアップと本体の setState が同一コミットでバッチされるため点滅しない。
- 渡す `levelId` は**正規化後**の値（§1.4）。表示中の段位タグとテーマ色が食い違わないようにする。

### 3.5 `usePlayerScope()` の型健全性 — ランタイムガードを入れる

現状 `usePlayerScope(): PlayerScope` は非 null を宣言しているが、実体は `useOutletContext<PlayerScope>()` なので Outlet 外では `undefined` になる（前回コードレビューの PLAUSIBLE 判定・未対応）。`PlaceholderPanel.tsx` は `scope?.stats?.kind` と防御的に書いており、**型が嘘であることを前提にしたコードが既に混入している**。

**採用案**: 実装内で `undefined` を検出して `throw` する。宣言型は `PlayerScope` のまま。

```ts
export function usePlayerScope(): PlayerScope {
  const scope = useOutletContext<PlayerScope | undefined>();
  if (!scope) {
    throw new Error('usePlayerScope must be used within PlayerLayout の Outlet');
  }
  return scope;
}
```

根拠:

- 同一リポジトリに前例がある（`useTheme()` は Provider 外で `throw` する）。規約を増やさない。
- 呼び出し側が `?.` を書かなくてよくなる。「型は非 null なのに `?.` が要る」という自己矛盾が消える。
- ルート定義上、タブは `PlayerLayout` の子ルートとしてしか描画されない（`AppRouter.tsx:13-22`）。`np`/`id` 不正時は `PlayerLayout` が `<Navigate>` を返して Outlet 自体が描画されない。**正常系で throw する経路は存在しない**。

代替案（採らない）: 戻り値型を `PlayerScope | undefined` にする案は、全呼び出し側に「起こらない分岐」を書かせ続ける。放置案は、型が嘘のままなので次の実装者が同じ罠を踏む。

`PlaceholderPanel.tsx` の防御的 `?.` は本 Issue では**触らない**（差分を最小化する。動作は変わらない）。#9 以降で当該ファイルを編集する際に整理する。

### 3.6 進捗バーは自前 CSS

`md-linear-progress` は **+12.03 kB / gzip +2.57 kB**（§1.6 実測）。段位ptの進捗表示のためだけに払う額としては大きい。`div` 2枚と `width: %` で同等の見た目が 0 kB で作れる。色は `--md-sys-color-primary`（トラックは `--md-sys-color-surface-container-highest`）。

ARIA は自前で付ける: `role="progressbar" aria-valuemin="0" aria-valuemax={maxPoint} aria-valuenow={point} aria-valuetext={`${pointText}/${maxPointText}`}`。

順位グラフ枠には `ElevatedCard`（**+2.65 kB**）を使う。#9〜#12 のカード群で共通して使う土台であり、M3 の形状・エレベーションのトークンを正しく持つため。

### 3.7 数値の書式

| 値 | 書式 | 例 |
|---|---|---|
| 現在pt / 上限pt / 残pt | `getScoreDisplay(effLevel, n)` の出力をそのまま（3桁区切りなし） | `232` `1400` `1168` / 魂天は `19.6` `20.0` `0.4` |
| 素点（昇降条件の閾値） | `toLocaleString('ja-JP')` で3桁区切り | `9,100点以上` |
| 通算試合数 | `toLocaleString('ja-JP')` | `1,234 戦` |

段位pt に区切りを入れないのは要件 §8 の `雀傑★★ 232/1400` 表記に合わせるため。素点は慣用的に区切る。数値要素にはすべて `.numeric` クラス（`tabular-nums`）を付ける。

### 3.8 「フィルタ非適用」の明示をヒーローに残す方法【2026-09-05 追加】

要件 §5.3 と Issue の完了条件「モード・期間フィルタを変えても本カードは変化しない」に対して、旧設計は `identity__meta`（`全モード・全期間 通算 1,234 戦（フィルタ非適用）`）を**独立した行**として置いていた。これは 16px＋ギャップ 16px＝**32px** を消費し、しかも注記の目的（直下の `FilterBar` がこの数値に効かないことを示す）には長すぎる。

**採用案**: 注記を2つに分ける。

| 置き場所 | 文言 | 高さコスト |
|---|---|---|
| ヒーロー・名前行の右端（`identity__scope`） | `フィルタ非適用` | **0px**（名前行 24px の中に収まる。`label-small` は 16px） |
| 層側 `LevelDetailCard` | `全モード・全期間の通算値です。モード・期間フィルタの影響を受けません。` ＋ `通算 1,234 戦` | 層側なので可変で可 |

名前は `flex: 1 1 auto; min-width: 0` ＋ 省略記号、注記は `flex: 0 0 auto`。32文字のニックネームでも名前行が 24px のままであることを実測で確認済み（§1.9-5）。

**採らなかった案**: 注記を層側だけに置く案は、`FilterBar` のすぐ上にある大きな数値が誤解の対象なので、**誤解が起きる場所に注記が無い**ことになり目的を果たさない。注記を段位行の右端に置く案は、段位行の水平余裕が最長ケースで 52px しかなく（§1.9-7）折り返しを誘発するため不可。

---

## 4. モジュール構成と公開シグネチャ

### 4.1 `src/domain/` への追加（2関数）

```ts
// src/domain/level.ts に追加し、src/domain/index.ts から公開する
/** 段位の主要部ラベル（'初心'|'雀士'|'雀傑'|'雀豪'|'雀聖'|'魂天'）。魂天は majorRank>=6 で '魂天' */
export function getLevelMajorTag(level: Level): string;
```

```ts
// src/domain/transitions.ts の private `totalFor` を改名して公開し、src/domain/index.ts から公開する
/** 卓の総素点（四麻 100000 / 三麻 105000）。境界探索の上限であり、UI の到達可能性判定にも使う */
export function tableTotalScore(mode: GameMode): number;
```

`totalFor` の呼び出し箇所は `promotionConditions` / `demotionConditions` の2箇所のみ。**ロジックは変えない**（名前と可視性だけ）。既存の `transitions.test.ts` が無改変で通ることを確認すること。

### 4.2 `src/summary/identityView.ts`（新規・純関数・React 非依存）

```ts
import type { CurrentLevelInfo, GameMode, LevelWithDelta } from '../api';
import type { LevelPoint, RankCondition } from '../domain';

export type RankBadge =
  | { readonly kind: 'stars'; readonly major: string; readonly stars: number } // 通常段位
  | { readonly kind: 'plain'; readonly text: string };                        // 魂天

export interface ConditionLine {
  readonly key: string;              // React key（'p0' / 'd2' 等）
  readonly rankLabel: string;        // '1位' | '2位以内' | '3位以下'
  readonly threshold: number | null; // 素点。null = 順位だけで成立
}

export interface IdentityView {
  readonly nickname: string;
  readonly badge: RankBadge;
  readonly levelText: string;             // getLevelTag(effLevel)。aria-label 用（'雀傑2'）
  readonly pointText: string;             // '232' / 魂天 '19.6'
  readonly maxPointText: string | null;   // '1400' / 魂天20 は null
  readonly progress: number | null;       // 0..1。上限0のとき null
  readonly remainingText: string | null;  // '1168' / 魂天20 は null
  readonly nextLevelText: string | null;  // '雀傑3' / 魂天20 は null
  readonly conditionMode: GameMode | null;
  readonly promotions: readonly ConditionLine[];
  readonly demotions: readonly ConditionLine[];
  readonly gameCount: number;
}

/**
 * 現在pt（score+delta）が上限超え／負のとき、本家規則で1段動かした後の (levelId, point)。
 * 実体は applyPointDelta(lp, 0)。戻り値の levelId は majorRank 6 を含まない。
 */
export function effectiveLevelPoint(lv: LevelWithDelta): LevelPoint;

/** RankCondition[] → 表示行。到達不能な閾値を落とし、連続する無条件行を畳む（§3.3） */
export function toConditionLines(
  conditions: readonly RankCondition[],
  mode: GameMode,
  direction: 'promotion' | 'demotion',
): ConditionLine[];

export function buildIdentityView(info: CurrentLevelInfo): IdentityView;
```

`buildIdentityView` の手順（この順序で実装する）:

1. `eff = effectiveLevelPoint(info.level)` / `effLevel = parseLevelId(eff.levelId)`
2. `badge`: `isKonten(effLevel)` なら `{kind:'plain', text: getLevelTag(effLevel)}`、そうでなければ `{kind:'stars', major: getLevelMajorTag(effLevel), stars: effLevel.minorRank}`
3. `maxPoint = getMaxPoint(effLevel)`。`0` なら `maxPointText / progress / remainingText / nextLevelText` はすべて `null`
4. `pointText = getScoreDisplay(effLevel, eff.point)` / `maxPointText = getScoreDisplay(effLevel, maxPoint)` / `remainingText = getScoreDisplay(effLevel, maxPoint - eff.point)`
5. `nextLevelText = getLevelTag(getNextLevel(effLevel))`
6. `conditionMode = preferredMode(eff.levelId)`。`null` なら `promotions`/`demotions` は空配列
7. `effLv = { id: eff.levelId, score: eff.point, delta: 0 }` を `promotionConditions` / `demotionConditions` に渡し、`toConditionLines` を通す

**import 禁止**: `../filters/useFilteredStats`・`../filters/filterState` の `GlobalFilter`・React。

### 4.3 `src/summary/IdentityCard.tsx`（新規・表示専用）

```ts
export interface IdentityCardProps {
  readonly state: CurrentIdentityState;
  readonly fallbackName: string; // 例 'プレイヤー: 123456'（identity 未解決時の名前）
}
export function IdentityCard(props: IdentityCardProps): ReactElement;
```

フックを使わない純粋な表示コンポーネントにする（dev ギャラリーから任意の状態を流し込めるようにするため）。`import './summary.css'` のみ副作用 import を許す（CSS は `sideEffects` 対象）。

DOM 構造【2026-09-05 是正】（`data-testid` は受け入れ条件が読むので**この名前で固定**）:

```html
<section class="identity" data-testid="identity-card">   <!-- gap: 8px。子は常に4つ（error系は2つ） -->

  <!-- ① 名前行（24px） -->
  <div class="identity__head">
    <p class="identity__name md-typescale-title-medium" data-testid="identity-name">…</p>
    <span class="identity__scope md-typescale-label-small" data-testid="identity-scope">フィルタ非適用</span>
  </div>

  <!-- ② 段位・pt 行（52px） -->
  <div class="identity__level" data-testid="identity-level">
    <span class="identity__badge md-typescale-headline-small" role="img" aria-label="雀傑2">
      雀傑<span class="identity__stars" aria-hidden="true">★★</span>
    </span>
    <span class="identity__point md-typescale-display-medium numeric">232</span>
    <span class="identity__max md-typescale-title-medium numeric">/1400</span>
  </div>

  <!-- ③ 進捗バー（6px）。上限なし（魂天20）のときは中身を描かない空の枠を出す -->
  <div class="identity__progress" role="progressbar" …><span class="identity__progress-fill"></span></div>

  <!-- ④ 残pt 行（20px） -->
  <p class="identity__remaining md-typescale-body-medium" data-testid="identity-remaining">
    雀傑3 まであと <span class="numeric">1168</span> pt
  </p>
</section>
```

- **昇降条件ブロックと `identity__meta` はこのコンポーネントから消える**（§3.1）。`identity-conditions` / `identity-promotion` / `identity-demotion` / `identity-meta` の testid は `LevelDetailCard`（§4.4.1）へ移る。
- `data-testid="identity-level"` は issue-6 の受け入れ条件 C5 が読む testid。**必ず残す**（全状態で存在させる。loading ではスケルトンの器に、notFound/error ではメッセージ要素に付ける）。ready 時の `textContent` は `雀傑★★232/1400` になる。
- **魂天20（上限なし）でも4行の構造を崩さない**。`identity__max` は出さず、進捗バーは `identity__progress` の枠（6px）だけを `aria-hidden="true"` で出し、`identity__remaining` を `昇段上限なし` にする。**旧設計はここで進捗バーごと消していたため 160px になっていた**（§1.9-2）。
- 「フィルタ非適用」の注記は、直下に `FilterBar` があることによる誤解（要件 §5.3 / Issue 完了条件3）を防ぐために必須。詳細な文言は `LevelDetailCard` 側（§3.8）。

**状態別（すべて高さ 126px に揃えること。これが受け入れ条件 B5-1）**

| `state.kind` | 表示 | 高さの作り方 |
|---|---|---|
| `ready` | 上記 | 24＋8＋52＋8＋6＋8＋20 ＝ **126** |
| `loading` | 名前は `fallbackName`、`identity__scope` は出す。②③④の位置にプレースホルダ矩形（`--md-sys-color-surface-container-highest`、アニメーションなし） | ②のスケルトンを **`height: 52px`**（旧 40px が 44px 跳ねの主因）、③は `identity__progress` の空枠 6px、④のスケルトンを `height: 20px` にして **126** |
| `notFound` | 名前は `fallbackName`、②③④の代わりに `identity__message` 1つ。文言 `プレイヤーが見つかりませんでした`（`--md-sys-color-on-surface-variant`） | `identity__message { min-height: 94px }` で 24＋8＋94 ＝ **126** |
| `error` | 同上。文言は `state.message`（`--md-sys-color-error`） | 同上。メッセージは最大4行（`body-medium` 20px × 4 ＝ 80 ≤ 94）まで枠内に収まる。5行以上になりうる文言を作らないこと |

`identity__message` には `data-testid="identity-level"` を付ける（issue-6 C5 の互換維持。現行実装と同じ）。

本格的なスケルトン設計は #15。ここでは「跳ねない」ことだけを満たす。

### 4.4 `src/summary/SummaryPanel.tsx`（新規）

```ts
export function SummaryPanel(): ReactElement;
```

- `usePlayerScope()` を使う（§3.5 のガード後の型で `?.` 不要）
- 描画順は **`LevelDetailCard` → 順位グラフ枠**。`LevelDetailCard` はヒーローの続きなので先に置く
- **`LevelDetailCard` は `scope.stats` の状態に関係なく常に描画する**【2026-09-05 是正】。`scope.stats.kind === 'empty'`（フィルタ期間に対局が無い）のときも、段位・昇降条件はフィルタ非依存なので消してはならない。`NO_GAMES_IN_PERIOD_MESSAGE` は `LevelDetailCard` の**下**に出し、順位グラフ枠を出さない
- 順位グラフ枠: `ElevatedCard` 内に見出し `順位グラフ` と本文 `対局履歴データの利用許諾後に実装します（#17）`。`data-testid="rank-graph-placeholder"`。高さは `min-height: 180px`、内部は中央寄せしない（要件 §3 の「中央寄せヒーロー等の手癖排除」に倣い、左揃え＋薄い罫線 `--md-sys-color-outline-variant` のプレースホルダ帯を1本置く）
- **recharts を import しない**

### 4.4.1 `src/summary/LevelDetailCard.tsx`（新規・表示専用）【2026-09-05 追加】

```ts
export interface LevelDetailCardProps {
  readonly state: CurrentIdentityState;
}
export function LevelDetailCard(props: LevelDetailCardProps): ReactElement | null;
```

`IdentityCard` と同じく**フックを使わない純粋な表示コンポーネント**（dev ギャラリーから状態を流し込めるようにするため）。`state.kind !== 'ready'` のときは `null` を返す（層側なので消えてよい。ヒーローと違い高さの制約が無い）。

`ElevatedCard`（`src/components/md` のバレル経由）を土台にする。**新しい `@material/web` コンポーネントを増やさない**（バンドル増分 0）。

DOM 構造（testid は旧 §4.3 から**そのまま移設**する。名前を変えない）:

JSX では `<md-elevated-card>` を直書きせず `ElevatedCard` を使う（CLAUDE.md §3）。以下は**描画結果の DOM** の形:

```html
<md-elevated-card class="level-detail" data-testid="level-detail-card">
  <div class="level-detail__inner">
    <h2 class="level-detail__title md-typescale-title-medium">段位の詳細</h2>

    <!-- 条件が1つも無い / conditionMode===null のときはこのブロックごと出さない -->
    <div class="identity__conditions" data-testid="identity-conditions">
      <div class="identity__cond-group" data-testid="identity-promotion"> … </div>
      <div class="identity__cond-group" data-testid="identity-demotion"> … </div>
      <p class="identity__cond-note md-typescale-label-small">金・半荘での条件</p>
    </div>

    <p class="identity__meta md-typescale-label-small" data-testid="identity-meta">
      全モード・全期間 通算 <span class="numeric">1,234</span> 戦（モード・期間フィルタの影響を受けません）
    </p>
  </div>
</md-elevated-card>
```

- 条件ブロックの中身（見出し文言・行の畳み込み・到達可能性の足切り・`MODE_LABELS[mode]・半荘での条件` の注記）は **§3.3 のまま。1文字も変えない。**
- `identity__conditions` / `identity__cond-*` の CSS 規則も現行のものをそのまま使う（クラス名を変えない）。移設先が変わるだけ
- `identity__meta` の文言だけ、旧 `（フィルタ非適用）` → `（モード・期間フィルタの影響を受けません）` に変える。ヒーローから離れたぶん説明を厚くする（§3.8）
- **`scope.stats` / `FilteredStatsState` / `GlobalFilter` を import しない**（受け入れ条件 S9 で機械チェックする）

### 4.5 `src/theme/useRankTheme.ts`（新規）

```ts
/** levelId に対応する段位シードへテーマを切り替える。null の間は直前のシードを維持し、アンマウントで既定へ戻す */
export function useRankTheme(levelId: number | null): void;
```

### 4.6 `src/dev/IdentityGallery.tsx`（新規・dev 専用）

`main.tsx` の `devRoutes` に `'#/__identity'` を追加する。**CLAUDE.md §4 の形（`import.meta.env.DEV` のリテラル分岐の内側に動的 `import()` を直書き）を崩さないこと。**

`IdentityCard` に以下の固定状態を並べて描画する（API を叩かない）。カラーモード切替は `#/__theme` と同じ `useTheme().setModeSetting` で行えるようにする。

| # | 状態 |
|---|---|
| 1 | loading |
| 2 | notFound |
| 3 | error（`ネットワークに接続できませんでした。`） |
| 4 | 雀傑2 四麻 `{id:10302, score:232, delta:0}`（条件なし・常態） |
| 5 | 雀傑3 昇段目前 `{id:10303, score:1950, delta:40}`（`2位以内` に畳まれる） |
| 6 | 雀聖3 昇段目前 `{id:10503, score:8950, delta:0}`（`1位` / `2位 9,100点以上`） |
| 7 | 雀豪1 降段目前 `{id:10401, score:60, delta:-40}`（`3位 9,000点以下` / `4位`） |
| 8 | 魂天1 `{id:10701, score:1960, delta:0}`（小数表示・`1位`） |
| 9 | 魂天20 `{id:10720, score:5000, delta:0}`（上限なし） |
| 10 | 雀士3 `{id:10203, score:900, delta:0}`（`preferredMode` が null → 条件ブロックなし） |
| 11 | 三麻 雀豪1 降段目前 `{id:20401, score:40, delta:0}`（3人分の順位） |
| 12 | 長いニックネーム（32文字）で省略が効くこと |

`nickname` には**実在プレイヤー名を使わない**（`テストプレイヤー01` 等）。

**【2026-09-05 追加】ギャラリーに2つの変更を入れる**

1. **各状態で `IdentityCard` と `LevelDetailCard` の両方を描画する。** 条件表示の検証（B4）は `LevelDetailCard` 側に移るため。カード枠の中で `IdentityCard` → `LevelDetailCard` の順に縦積みする。
2. **ヒーロー実寸プローブを追加する。** ページ先頭に、実ページと同じ入れ子でヒーローを2つ描画する。

```
<div class="identity-gallery__hero-probe" data-testid="gallery-hero" data-state="loading">
  <div class="layered-sheet__hero">           ← 実物と同じクラス（padding 24/16/48）
    <div class="player-hero">                 ← 実物と同じクラス（gap 16）
      <IdentityCard state={状態1: loading} fallbackName="プレイヤー: 000000"/>
      <FilterBar numPlayers={4} filter={null} onModesChange={noop} onPeriodChange={noop}/>
    </div>
  </div>
</div>
<div class="identity-gallery__hero-probe" data-testid="gallery-hero" data-state="ready-with-conditions"> …状態6… </div>
```

必須要件:

- **プローブは横パディングを持つ祖先の外側に置く**こと。`getBoundingClientRect().width === document.documentElement.clientWidth` になっていなければ B5 の計測が成立しない（ギャラリー本体の `padding: 24` の内側に入れてはいけない）
- `FilterBar` に `filter={null}` を渡す（チップは `disabled` で描画され、**寸法は選択状態と同じ**。API を1回も叩かずに実ページと同じ高さになる）
- `.layered-sheet__hero` は `position: sticky` なのでプローブ内でも粘着するが、計測には影響しない
- **これは dev 専用コードである。** 本番バンドルに入らないこと（受け入れ条件 S10）を崩さない

狙い: **B5 を実 API なしで、かつ実ページと同じ寸法で測れるようにする。** 製造担当も実装中に自己確認できる。

### 4.7 変更・追加ファイル一覧

| ファイル | 種別 | 内容 |
|---|---|---|
| `src/domain/level.ts` | 変更 | `getLevelMajorTag` 追加 |
| `src/domain/transitions.ts` | 変更 | `totalFor` → `tableTotalScore` 改名＋公開 |
| `src/domain/index.ts` | 変更 | 上記2つを export |
| `src/domain/level.test.ts` | 変更 | `getLevelMajorTag` のケース追加 |
| `src/domain/transitions.test.ts` | 変更 | `tableTotalScore` のケース追加（既存ケースは無改変で通ること） |
| `src/summary/identityView.ts` | 新規 | |
| `src/summary/identityView.test.ts` | 新規 | |
| `src/summary/IdentityCard.tsx` | 新規 | |
| `src/summary/SummaryPanel.tsx` | 新規 | |
| `src/summary/summary.css` | 新規 | |
| `src/theme/useRankTheme.ts` | 新規 | |
| `src/dev/IdentityGallery.tsx` | 新規（dev 専用） | |
| `src/main.tsx` | 変更 | dev ルート `#/__identity` 追加 |
| `src/shell/PlayerLayout.tsx` | 変更 | hero を `IdentityCard` に差し替え／`useRankTheme` 呼び出し／`formatLevelWithDelta` の import 削除 |
| `src/shell/shell.css` | 変更 | `.player-hero` のレイアウト規則を追加 |
| `src/shell/AppRouter.tsx` | 変更 | `summary` ルートのみ `<SummaryPanel/>` に差し替え |
| `src/filters/playerScope.ts` | 変更 | ランタイムガード（§3.5） |
| `src/summary/LevelDetailCard.tsx` | 新規 | 層側カード（§4.4.1）【2026-09-05 追加】 |

`src/shell/LayeredSheet.tsx` / `src/shell/PlaceholderPanel.tsx` / `src/filters/*`（playerScope 以外）/ `src/theme/seeds.ts` / `src/theme/applyTheme.ts` は**変更しない**。

**【2026-09-05】是正ラウンドで実際に触るのは次の5ファイルだけ**（他は `dd758f8` の実装のまま）:

`src/summary/IdentityCard.tsx`（§4.3）／`src/summary/LevelDetailCard.tsx`（新規・§4.4.1）／`src/summary/SummaryPanel.tsx`（§4.4）／`src/summary/summary.css`（§5.2）／`src/dev/IdentityGallery.tsx`（§4.6）

**`src/summary/identityView.ts` と `identityView.test.ts` は1行も変えない。** `src/shell/PlayerLayout.tsx` も変えない（hero に渡すのは `IdentityCard` のまま）。`src/filters/filters.css`・`src/filters/FilterBar.tsx` も変えない（§9 の欠陥は別件）。

---

## 5. レイアウト・CSS 仕様

### 5.1 `.player-hero`（`src/shell/shell.css`）

```
display: flex; flex-direction: column; gap: 16px;
```

順序は **IdentityCard → FilterBar**。フィルタはカード1に効かないので、先に本体を見せて注記（名前行右端の `identity__scope`）で誤解を切る【2026-09-05: 注記の実体を `identity__meta` から `identity__scope` に変更。§3.8】。

この規則は `dd758f8` で既に入っている。**是正ラウンドで `shell.css` は変更しない。**

### 5.2 `.identity`（`src/summary/summary.css`）

【2026-09-05 是正】**`.identity` の `gap` は 8px**（旧 16px）。子は常に「名前行 / 段位行 / 進捗 / 残pt」の4つ（notFound・error は「名前行 / メッセージ」の2つ）。

- **`@media (min-width: 840px)` の2カラム grid は削除する。** 条件ブロックがヒーローから消えたので右カラムに置くものが無い。4行の縦積みのまま広い画面でも使う（旧設計の `grid-template-areas` は不要）
- `.identity__head`: `display: flex; align-items: baseline; gap: 8px;`
  - `.identity__name`: `flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`
  - `.identity__scope`: `flex: 0 0 auto; color: var(--md-sys-color-on-surface-variant);`
- `.identity__level`: `display: flex; align-items: baseline; gap: 8px;` ＋ **`flex-wrap: nowrap; min-width: 0; overflow: hidden;`**（旧 `flex-wrap: wrap` は、狭い画面で段位行が2行に折り返して +32px 跳ねる原因になる。§1.9-7）
- `.identity__message`: `min-height: 94px; margin: 0;`（notFound / error の高さを ready に一致させる。§4.3）
- `.identity__point`: `color: var(--md-sys-color-primary)`（§1.7 で AA 適合を実測）、`md-typescale-display-medium`
- `.identity__badge`: `color: var(--md-sys-color-on-surface)`、`.identity__stars`: `color: var(--md-sys-color-primary); letter-spacing: 0.05em;`
- `.identity__max` / `.identity__remaining` / `.identity__meta`: `color: var(--md-sys-color-on-surface-variant)`
- `.identity__progress`: `height: 6px; border-radius: 3px; background: var(--md-sys-color-surface-container-highest); overflow: hidden;` / `.identity__progress-fill { height: 100%; background: var(--md-sys-color-primary); transition: width 300ms cubic-bezier(0.05,0.7,0.1,1); }`
- 条件行のバッジ（`1位` 等）: `background: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container)`（昇段）/ `error-container` ペア（降段）。§1.7 で両モード AA 適合を実測
- `@media (prefers-reduced-motion: reduce)` で `.identity__progress-fill { transition: none; }`
- `.level-detail__inner`: `padding: 16px; display: flex; flex-direction: column; gap: 12px;`（層側カードの中身。`identity__conditions` 以下の既存規則はそのまま流用する）

**色は必ず CSS 変数で書く。`summary.css` に16進カラーリテラルを1つも書かないこと**（CLAUDE.md §5、静的検証 S4 で機械チェックする）。

### 5.3 ヒーロー高さの規定【2026-09-05 全面改訂】

旧規定「375×812 で 365px 以下」は**破棄する**。理由は3つ:

1. **根拠が薄い。** 「ビューポート高の45%」は設計時の当て推量で、ヘッダ64・ボトムナビ80・層のせり上がり28px といった実際の寸法と関係が無い。
2. **本 Issue が動かせない固定費 244px（パディング72＋ギャップ16＋`FilterBar` 156）を無視している。** `.identity` を 121px 以下にしないと入らず、4行構成では物理的に届かない。
3. **計測条件が書かれていなかった。** クラシックスクロールバーの有無で ±40px 動く（§1.9-4）ので、数値だけ決めても再現しない。

**新しい規定**

| # | 規定 | 値 | 根拠 |
|---|---|---|---|
| H1 | **不変性**（最重要） | ヒーロー高さは `state.kind`・昇降条件の有無・段位・ニックネーム長・コンテンツ幅 280〜343px のいずれによっても**変わらない** | sticky 要素の高さが動くことが今回の欠陥そのもの。§3.1 の構造規則がこれを保証する。実測で `.identity` は全15通り 126px（§1.9-5） |
| H2 | **絶対上限（実機相当）** | ビューポート **375×812・デバイスエミュレーション有効**（コンテンツ幅343）で `[data-testid="sheet-hero"]` ≤ **304px** | 是正後の実測 290px ＋ 14px。**14px は「行が1つ増えたら必ず落ちる」幅**（最小の行単位は `label-small` の 16px）。フォント差による数px の揺れは吸収し、構造の退行は見逃さない |
| H3 | **絶対上限（狭い方）** | ビューポート **360×812** で ≤ **304px** | 是正後の実測 290px ＋ 14px。#40 の修正で `FilterBar` が折り返さなくなったため、375 と 360 で同値になった（折り返していた頃は 15px の幅差で ±40px 動いていた。§1.9-4） |
| H4 | **層側の初期表示** | 375×812・スクロール位置0で、層側の先頭カードの下端がボトムナビの上端より上にある | 「サマリータブを開いた瞬間に最初のカードが全部見える」という製品要件。数値ではなく要素位置で測るので、後続 Issue でカードが増えても意味が保たれる |

**【2026-09-05 再検収による H2・H3 の改訂】** 初回の是正時に置いた上限（H2 344 / H3 384）は、**計測器が 40px 楽観的**だったために実ページを過小評価した値だった。dev ギャラリーのヒーロー実寸プローブが `FilterBar` に `filter={null}` を渡していたため全チップが未選択で描画され、選択チップの先頭に付くチェックマーク（+18px/個）が無いぶんチップ行が狭くなり、期間チップ行が1行に収まってしまっていた（実ページは常に期間チップが1つ選択されるので2行）。

対処として2つを行った:

1. **プローブを実ページと同じ条件で描画するよう是正**（`PROBE_FILTER` を渡す。§4.6）。これにより「プローブで測った値＝実ページの値」が成立する
2. **`FilterBar` の折り返し欠陥（§9.1）を Issue #40 として切り出して修正**（`fix/issue-40-chip-nowrap` / PR #41）。本ブランチはこの修正を取り込んでいる

実測（`fix/issue-40-chip-nowrap` 取り込み後）:

| 計測対象 | ビューポート375 | ビューポート360 |
|---|---|---|
| プローブ `[data-testid="gallery-hero"]`（2状態とも） | **290px** | **290px** |
| 実ページ `[data-testid="sheet-hero"]` | **290px** | **290px** |
| `identity-card`（全状態） | **126px** | **126px** |

**この上限は Issue #40 の修正が入っていることを前提にしている。** 仮に Issue #6 の UI検証 D1 の仕切り直しで「2段折り返しのほうが良い」とオーナーが判断した場合、ヒーローは 330px に戻るため H2・H3 を 344px へ再改訂すること。

超過した場合の対処（この順に試す）:

1. `.identity` の `gap` 8 → 4（−12px）
2. `.identity__point` を `display-medium` → `display-small`（−8px。Issue の「Display級」は満たしたまま）
3. `.layered-sheet__hero` の `padding` 24/16/48 → 16/16/40（−16px。ただし `shell.css` を触るので全タブに影響する）

---

## 6. 想定される取り違え（製造担当向け）

1. `promotionConditions` に**正規化前**の `identity.level` を渡さない（§1.4）。表示と条件が矛盾する。
2. `preferredMode` は**正規化後**の levelId で呼ぶ（§1.5-2）。
3. `preferredMode` は `null` を返しうる（初心・雀士）。`as GameMode` でキャストして握り潰さない。
4. `getMaxPoint` が `0` を返すケース（魂天20）で `0 除算`・`n/0` の進捗を作らない。
5. `RankCondition[]` の**添字が順位**。表示は `rank + 1` 位。
6. `stats`（`useFilteredStats`）の値をカード1に一切使わない。
7. `import './summary.css'` 以外の副作用 import を書かない（CLAUDE.md §1）。
8. `<md-*>` を直書きしない。`ElevatedCard` は `src/components/md` のバレルから import する（CLAUDE.md §3）。
9. dev ルート追加時、`import.meta.env.DEV` 分岐の内側に動的 `import()` を直書きする形を崩さない（CLAUDE.md §4）。
10. テストで `node:fs` 等の Node 組み込みを使わない（`tsc -b` が落ちる。§1.8）。

**【2026-09-05 是正ラウンドで追加】**

11. **ヒーロー（`IdentityCard`）に条件付きで現れる要素を1つも足さない。** 「上限が無いから進捗バーを消す」「メッセージが短いから行を減らす」といった最適化がそのまま高さの揺れになる。**枠は常に出し、中身だけ変える。**
12. **loading のスケルトンは ready の実寸に合わせる**（段位行 **52px**・進捗 6px・残pt 20px）。40px にすると 12px ずれる。
13. **`identityView.ts` を触らない。** ビューモデルは正しい。動かすのは消費者だけ。
14. **`identity-conditions` / `identity-promotion` / `identity-demotion` / `identity-meta` の testid を改名しない。** 置き場所が `LevelDetailCard` に移るだけ。受け入れ条件 B4 とオーナー向け UI 検証手順書がこの名前を使っている。
15. **`SummaryPanel` で `stats.kind === 'empty'` のときに `LevelDetailCard` ごと消さない**（§4.4）。段位はフィルタ非依存なので、期間内に対局が無くても表示し続ける。

---

## 7. テスト方針

jsdom 未導入のため**コンポーネントテストは書かない**。`identityView.ts` を純関数に切り出したのはこのため。

### 7.1 `src/summary/identityView.test.ts` に含める最低ケース

| # | 内容 | 期待 |
|---|---|---|
| U1 | 雀傑2 `{10302,232,0}` | `badge {kind:'stars', major:'雀傑', stars:2}` / `pointText '232'` / `maxPointText '1400'` / `remainingText '1168'` / `nextLevelText '雀傑3'` / `promotions []` / `demotions []` / `conditionMode 9` |
| U2 | 上限超え `{10302,1400,0}` | `badge.stars 3`（雀傑3）/ `pointText '1000'` / `maxPointText '2000'` / `promotions []` |
| U3 | 負値 `{10401,10,-100}` | `badge {major:'雀傑', stars:3}` / **`conditionMode === 9`**（正規化前の 12 ではない） |
| U4 | 雀聖3 `{10503,8950,0}` | `promotions` が `[{rankLabel:'1位',threshold:null},{rankLabel:'2位',threshold:9100}]`（3位の 79100 が落ちる） |
| U5 | 雀豪1 `{10401,60,-40}` | `demotions` が `[{rankLabel:'3位',threshold:9000},{rankLabel:'4位',threshold:null}]` |
| U6 | 雀傑3 `{10303,1950,40}` | `promotions` が `[{rankLabel:'2位以内',threshold:null}]`（畳み込み） |
| U7 | 三麻 雀豪1 `{20401,40,0}` | `demotions` が `[{rankLabel:'3位',threshold:null}]`（1件なので畳まない） |
| U8 | 魂天1 `{10701,1960,0}` | `badge {kind:'plain', text:'魂天1'}` / `pointText '19.6'` / `maxPointText '20.0'` / `remainingText '0.4'` / `promotions [{rankLabel:'1位',threshold:null}]` |
| U9 | 魂天20 `{10720,5000,0}` | `maxPointText null` / `progress null` / `remainingText null` / `nextLevelText null` / 条件とも空 |
| U10 | 旧魂天 `{10601,1000,0}` | `badge.text '魂天1'` / `pointText '3.0'`（`getVersionAdjustedScore` 適用） |
| U11 | 雀士3 `{10203,900,0}` | `conditionMode null` / `promotions []` / `demotions []` / ただし `remainingText '100'`・`nextLevelText '雀傑1'` は出る |
| U12 | `toConditionLines` 境界 | 四麻 rank1 で `atLeast 50000` は残り、`atLeast 50100` は落ちる（`reachable(1)=50000`）。`atMost 50000` は無条件行、`atMost 49900` は閾値行 |
| U13 | `effectiveLevelPoint` と `formatLevelWithDelta` の整合 | U1〜U11 の全入力で、`formatLevelWithDelta(lv)` の先頭段位タグが `getLevelTag(parseLevelId(effectiveLevelPoint(lv).levelId))` と一致する |
| U14 | `preferredMode` 半荘不変条件 | `LEVEL_ALLOWED_MODES` が非空の全 levelId（10301〜10503・10701・20301〜20503・20701 等）で `preferredMode` の戻り値が `{16,12,9,26,24,22}` に含まれる（注記の「半荘」の根拠。§1.5-3） |
| U15 | `getLevelMajorTag` | `10302 → '雀傑'` / `10701 → '魂天'` / `10601 → '魂天'` / `10101 → '初心'` |
| U16 | `tableTotalScore` | `16 → 100000` / `26 → 105000` |

**red 先行の規律**（CLAUDE.md）: 新規テストは、実装を意図的に壊して**実際に落ちること**を確認してから完成とする。特に U3（正規化前の levelId を渡す退行）・U4（足切りを外す退行）・U6（畳み込みを外す退行）は、退行版で必ず FAIL することを確認すること。

---

## 8. 受け入れ条件

検収担当は以下を**1項目ずつ実行**して結果を記録する。

### 8.1 静的検証

| # | 実行すること | 合格条件 |
|---|---|---|
| S1 | `npm run build` | 成功。型エラー0。`dist/assets/index-*.js` のサイズが **482.0 kB 以下 / gzip 132.5 kB 以下**（実測値をレポートに記載する）<br>**【2026-09-05 改訂】** 旧上限 480.0 / 131.0 は、検収の実験により「§3.3・§4.4 を設計どおり実装する限り gzip 131.0 は達成不能（最良 131.39）」と確定した。無駄な取り込み（`all.js` / `recharts` / 未使用 md コンポーネント / dev コード）が `dist` に無いことも検収で確認済み。**実装は適格・閾値の見積りが甘い**と統括担当が判断し上限を改訂した（Issue #5・#6 と同じ扱い）。<br>是正ラウンドはこの上限を**上げない**: 追加するのは `LevelDetailCard.tsx` 1本で、新しい `@material/web` コンポーネントも新しい依存も増やさない（`ElevatedCard` は既に取り込み済み。§4.4.1）。むしろ `IdentityCard` から条件描画が抜けるぶん相殺される見込み |
| S2 | `npm run lint` | 新規エラー0（既存の警告水準を悪化させない） |
| S3 | `npm test` | 全パス。`identityView.test.ts` が実行されている（テスト数がベースラインより増えている） |
| S4 | `grep -rn "<md-" src/ --include='*.tsx'`（zsh では `--include` の値をクォートする） | 0件 |
| S5 | `grep -rn "^import '" src/ \| grep -v "\.css'"` | 0件（CSS 以外の副作用 import が無い） |
| S6 | `grep -rn "all\.js" src/` | 0件 |
| S7 | `grep -rniE "#[0-9a-f]{3,8}([^0-9a-f]\|$)" src/summary/ src/theme/useRankTheme.ts` | 0件（色のハードコードが無い） |
| S8 | `grep -rn "recharts" src/` | 0件 |
| S9 | `grep -rn "useFilteredStats\|FilteredStatsState\|GlobalFilter" src/summary/identityView.ts src/summary/IdentityCard.tsx src/summary/LevelDetailCard.tsx` | 0件（カード1がフィルタ由来の値に触れていない）【2026-09-05: `LevelDetailCard.tsx` を対象に追加】 |
| S10 | `grep -c "IdentityGallery" dist/assets/*.js` | 0（dev 専用コードが本番バンドルに入っていない） |
| S11 | `grep -n "data-testid=\"identity-level\"" src/summary/IdentityCard.tsx` | 1件以上（issue-6 C5 の testid が残っている） |
| S12 | `grep -n "identity-conditions\|identity__conditions\|identity-meta\|identity__meta" src/summary/IdentityCard.tsx`【2026-09-05 追加】 | **0件**（昇降条件と通算試合数がヒーローから抜けている。§3.1） |
| S13 | `grep -n "identity-conditions\|identity-meta" src/summary/LevelDetailCard.tsx`【2026-09-05 追加】 | 各1件以上（testid が改名されずに移設されている） |
| S14 | `git diff --stat dd758f8 -- src/summary/identityView.ts src/summary/identityView.test.ts src/shell/ src/filters/ src/domain/ src/theme/ src/main.tsx`【2026-09-05 追加】 | **出力が空**（是正ラウンドで触ってよいのは §4.7 の5ファイルだけ） |

### 8.2 ユニットテスト

| # | 実行すること | 合格条件 |
|---|---|---|
| T1 | `npx vitest run src/summary/identityView.test.ts` | 全パス。§7.1 の U1〜U16 が**すべて存在する**（ケース名で照合する） |
| T2 | `npx vitest run src/domain/` | 全パス。`transitions.test.ts` の既存ケースが**無改変で**通っている（`git diff` で既存 `it(...)` ブロックが変更されていないことを確認する） |
| T3 | red 先行の確認（3件） | (a) `buildIdentityView` の `preferredMode(eff.levelId)` を `preferredMode(info.level.id)` に戻す → **U3 が FAIL** (b) `toConditionLines` の到達可能性フィルタを外す → **U4 が FAIL** (c) 畳み込みを外す → **U6 が FAIL**。各改変後にコードを元に戻し、`npm test` が全パスに復帰することを確認する |

### 8.3 ブラウザ実測（dev サーバー）

`npm run dev` を起動し、ブラウザペインで確認する。**API を叩く操作は B1・B2 の1プレイヤー分に限る**（CLAUDE.md「1画面表示あたり数リクエスト以内」）。【2026-09-05: B5 はギャラリーのヒーロー実寸プローブ（§4.6）で測るので API を使わない】

**【2026-09-05 追加】ビューポートの作り方を必ず揃えること。** クラシックスクロールバー（15px）の有無でコンテンツ幅が 343px ↔ 328px に変わり、`FilterBar` の期間チップ行が1行↔2行に飛んでヒーローが ±40px 動く（§1.9-4）。B5 系は次の手順で作った状態でのみ有効:

- `resize_window({ preset: 'mobile' })`（375×812・デバイスエミュレーション有効）→ **`document.documentElement.clientWidth === 375` をレポートに記録する**
- 狭い側は `resize_window({ preset: 'mobile' })` の後に `resize_window({ width: 360, height: 812 })` → `clientWidth === 360` を記録
- `clientWidth` が 360 未満（＝スクロールバーが出ている）なら計測をやり直す

| # | 実行すること | 合格条件 |
|---|---|---|
| B1 | `#/4/player/<実在ID>/summary` を開く | `[data-testid="identity-card"]` が描画され、`identity-name` に空でないニックネーム、`identity-scope` に `フィルタ非適用`、`identity-level` に `〈段位ラベル〉★…〈数字〉/〈数字〉` 形式の文字列、`identity-remaining` に `〈次段位〉 まであと 〈数字〉 pt` が出る。層側に `[data-testid="level-detail-card"]` があり、その中に `identity-meta` がある。**`identity-meta` と `identity-conditions` がヒーロー（`[data-testid="sheet-hero"]`）の中に無い**こと（`document.querySelector('[data-testid="sheet-hero"] [data-testid="identity-meta"]') === null`）。コンソールエラー0 |
| B2 | B1 の状態で `identity-level` / `identity-name` / `identity-remaining` / `identity-meta` の `textContent` を記録 → モードチップを1つ追加 → 期間チップを「7日」に変更 | 4つの `textContent` が**1文字も変わらない**（`identity-meta` は層側に移ったが summary タブでは引き続き読める）。かつ `read_network_requests` で、全期間・全モードの `player_stats` URL が**再送されていない**（issue-6 C5 の回帰）。**さらに `[data-testid="sheet-hero"]` の高さがチップ操作の前後で同一**であること |
| B3 | B1 の状態で `getComputedStyle(document.querySelector('.identity__point')).color` と `getComputedStyle(document.documentElement).getPropertyValue('--md-sys-color-primary')` を比較 | 同一色。また `.identity` 配下の要素の `color` / `background-color` が、いずれも `:root` の `--md-sys-color-*` のどれかの値と一致する（トークン外の色が無い） |
| B4 | `#/__identity` を開く | 12状態すべてで `IdentityCard` と（ready のときは）`LevelDetailCard` が描画され、コンソールエラー0。状態10（雀士3）に `[data-testid="identity-conditions"]` が**存在しない**。状態9（魂天20）に `identity__max` が**無く** `昇段上限なし` が出る（**進捗バーの枠は出る**。§4.3）。状態5 に `2位以内`、状態6 に `1位` と `2位 9,100点以上`、状態7 に `3位 9,000点以下` と `4位` が出る。**条件行は `[data-testid="level-detail-card"]` の中にあり、`[data-testid="identity-card"]` の中には無い** |
| **B5-1**<br>不変性 | `#/__identity` を `preset:'mobile'`（375×812、`clientWidth===375`）で開き、12枚すべての `[data-testid="identity-card"]` の `getBoundingClientRect().height` を配列で取る。続けて `resize_window({width:360,height:812})` にして同じ配列を取る | **24個の値がすべて同一**（`new Set(...).size === 1`）。とくに **loading（状態1）と ready（状態4）の差が 0px**、**条件あり（状態6）と条件なし（状態4）の差が 0px**、**notFound/error（状態2・3）も同値**。設計上の期待値は **126**（§1.9-5）だが、判定は「全一致」であり 126 ちょうどである必要はない |
| **B5-2**<br>絶対上限（実機相当） | 同ページの `[data-testid="gallery-hero"]`（§4.6 のヒーロー実寸プローブ）を `preset:'mobile'` で測る。まず `el.getBoundingClientRect().width === document.documentElement.clientWidth`（375）を確認してから `.height` を読む | 2つのプローブ（loading / 条件あり）の高さが**同一**で、**304 以下**（§5.3 H2。実測 290＋許容14） |
| **B5-3**<br>絶対上限（狭い側） | `resize_window({width:360,height:812})`（`clientWidth===360`）にして B5-2 を再実行 | 2つのプローブの高さが**同一**で、**304 以下**（§5.3 H3。実測 290＋許容14） |
| **B5-5**<br>プローブの妥当性<br>【2026-09-05 追加】 | 実ページ（`vite preview` の `#/4/player/<id>/summary`）の `[data-testid="sheet-hero"]` を B5-2・B5-3 と同じ2幅で測り、プローブの値と突き合わせる | **プローブの値と実ページの値が一致**すること。ズレたらプローブが壊れている（初回の是正では `filter={null}` のせいで 40px 楽観的だった）。**この項目は他の B5 より先に実行すること** |
| **B5-4**<br>層側の初期表示 | `#/4/player/<B1と同じID>/summary` をスクロール位置0で開き（`preset:'mobile'`）、`document.querySelector('[data-testid="level-detail-card"], [data-testid="rank-graph-placeholder"]')` の**先頭カードの下端**と、`document.querySelector('.bottom-nav').getBoundingClientRect().top` を比べる | 先頭カードの `bottom` **≤** ボトムナビの `top`（＝サマリータブを開いた瞬間に最初のカードが全部見えている。§5.3 H4）。かつページ本体に水平スクロールが発生しない（`document.documentElement.scrollWidth <= document.documentElement.clientWidth`）。**B1 と同じプレイヤーを続けて見るのでAPIコールは増えない** |
| B6 | `#/__identity` で `localStorage.setItem('mjsv:color-mode','dark')` → リロード | 全12状態が dark で描画され、文字が背景に埋もれない。`getComputedStyle(document.documentElement).colorScheme === 'dark'`。※ `prefers-color-scheme` のエミュレーションは `matchMedia` の `change` を発火しないため、**必ず localStorage 経由で切り替えること**（CLAUDE.md 既知の検証環境の制約） |
| B7 | 段位シード切替: `#/4/player/<雀傑のID>/summary` と `#/4/player/<雀豪のID>/summary` で `getComputedStyle(document.documentElement).getPropertyValue('--md-sys-color-primary')` を読む | 値が異なる。light では雀傑 `#775a00` / 雀豪 `#964900` / 雀聖 `#ba1a20` / 魂天 `#0060a8`、dark では `#f3bf2f` / `#ffb786` / `#ffb3ac` / `#a2c9ff` のいずれかに一致する（§1.7 実測値）。**B7 は B4 の dev ギャラリーで代替してよい**（ギャラリーに段位を変える操作を用意した場合）。API 消費を避けるならそちらを優先する |
| B8 | B1 のページから `#/`（検索画面）へ戻る | `--md-sys-color-primary` が既定シード由来の値（light `#006c4d` / dark `#6bdbad`）に戻る |
| B9 | `#/4/player/<実在ID>/compare` を開く | ヒーローのアイデンティティ表示が summary タブと同一内容で残っている（`identity-level` の `textContent` が B1 と一致）。順位グラフ枠（`rank-graph-placeholder`）と **`level-detail-card`** は**表示されない**（どちらも summary タブ専用）【2026-09-05: `level-detail-card` の条項を追加】。**`[data-testid="sheet-hero"]` の高さが summary タブと同一**であること |
| B10 | `#/4/player/<実在ID>/summary` で `[data-testid="rank-graph-placeholder"]` を確認 | 存在し、見出し `順位グラフ` と `#17` への言及が読める |
| B11【2026-09-05 追加】 | `#/__identity` の状態9（魂天20）と状態4（雀傑2）で `.identity__progress` の有無を比べる | **両方に存在する**（上限なしでも枠は出す。§4.3）。状態9 では `identity__progress-fill` の幅が 0 か、`fill` 要素自体が無い |

### 8.4 UI検証の逆発注（オーナーへ委託）

`docs/ui-verification/TEMPLATE.md` を複製して手順書を作る（統括担当の作業）。**機械で測れる項目を混ぜないこと**（README §1）。委託する項目:

| # | 委託内容 | 種別 |
|---|---|---|
| V1 | 実機スマホで `#/4/player/<ID>/summary` を開き、ヒーローが画面を占有しすぎていないか、スクロール時の層状シートの動きが心地よいかを書く | ハードウェア依存＋主観 |
| V2 | 段位色（金・橙・赤・青）が Display 級の数値に乗ったときの印象を段位ごとに書く。「LLMに作らせた感」の有無も書く | 主観・オーナー決定事項（CLAUDE.md「シード色の再調整」の判断材料） |
| V3 | `雀傑★★` の★グリフ（Noto Sans JP）が実機で潰れず読めるか、★2個と3個の差が一目で分かるかを書く | 高DPI・フォント依存 |
| V4 | OS のダークモードを**実際に切り替えて**、カード1の印象を light/dark で比較して書く | エージェント環境で再現不能 |
| V5 | `#/__identity` を開き、条件ブロックがある状態（#5〜#8）と無い状態（#4・#9・#10）を見比べ、出現・消滅でレイアウトが落ち着かない感じがないかを書く【2026-09-05: 条件ブロックが層側カードへ移ったので、**「ヒーローの高さは変わらず、層側のカードだけが増減する」ことをどう感じるか**に設問を変える】 | 主観 |
| V6【2026-09-05 追加】 | 実機で summary → 比較 → スタッツとタブを往復し、**昇降条件がサマリータブでしか見えないこと**が不便に感じるかを書く。「サマリーに戻れば見られるので気にならない」／「段位の隣に常に欲しい」のどちらでもよい | §3.1 のトレードオフの当否。オーナー決定事項 |

各項目に「判断保留」欄と保留理由欄を置くこと。V2 は「金色に見えますか」のような正解を示唆する聞き方をしない。

**【2026-09-05】既存の手順書 `docs/ui-verification/2026-08-23-issue-8-*.md` は V5 の設問差し替えと V6 の追加が必要**（統括担当の作業）。

---

## 9. 後続 Issue への引き継ぎ

| Issue | 引き継ぎ |
|---|---|
| **#9〜#12（カード2〜5）** | `src/summary/SummaryPanel.tsx` にカードを追加していく。データは `usePlayerScope()` の `scope.stats`（フィルタ適用済み）から取る。**`scope.identity` はカード1専用**で、他カードが段位を出す必要が生じたら `stats.stats.level` ではなく `identity` を使うか、要件 §5.3 に戻って判断すること。`ElevatedCard` を土台にする（+2.65 kB は本 Issue で支払済み） |
| **#15（ローディング・空・エラー）** | 本 Issue の `IdentityCard` の loading/notFound/error は「跳ねない」ことだけを満たす最小実装。スケルトンのモーション・空状態のイラスト等はこの Issue で設計する。`SummaryPanel` の `empty` 表示も同様 |
| **#17（承諾後機能）** | `src/summary/SummaryPanel.tsx` の `[data-testid="rank-graph-placeholder"]` を実装に差し替える。`recharts@3.10.1` は導入済みだが**まだ一度も import されていない**（バンドル 0 kB）。初回 import 時のバンドル増分を必ず実測すること |
| **CLAUDE.md「保留中の設計判断」** | 段位シード切替は本 Issue で配線した。色の再調整は `src/theme/seeds.ts` の `RANK_SEEDS` 編集のみで完結する（本 Issue は色を1つもハードコードしていない）。V2 の結果が再調整の入力になる |
| **`usePlayerScope` の型健全性** | 本 Issue でランタイムガードを入れた（§3.5）。`src/shell/PlaceholderPanel.tsx` に残る防御的 `?.` は不要になったので、同ファイルを編集する Issue で整理すること |
| **`docs/requirements.md` §4.1** | 「カード1に順位グラフ」を、本設計ではヒーローではなく**サマリータブ本体**に置いた（§3.1）。**2026-09-05 の是正で昇降条件と通算試合数も層側へ移した**ので、要件上の「カード1」は「ヒーロー4行＋層側 `LevelDetailCard`＋順位グラフ枠」の3ブロックに分かれている。要件の表現を更新するかは統括担当の判断 |
| **#9〜#12 のヒーロー方針**【2026-09-05 追加】 | §3.1 の規則「**sticky なヒーローには行数が状態で変わらない要素しか置かない**」は本 Issue 限定ではなく、以降のカードにも適用する。ヒーローに何かを足したくなったら、まず層側で成立しないかを検討すること |

### 9.1 `FilterBar` の折り返し欠陥（Issue #6 の実装不備。統括担当の判断が要る）【2026-09-05 発見】

**事実**（実測・§1.9-4）:

`src/filters/filters.css` の `.filter-bar__row` は `md-chip-set` に `display:flex; overflow-x:auto; scrollbar-width:none; padding-bottom:2px` を当て、`::-webkit-scrollbar { display:none }` まで書いている。これは**横スクロールする1行のチップ列**を意図した書き方である。しかし `md-chip-set` の `:host{display:flex;flex-wrap:wrap;gap:8px}`（`node_modules/@material/web/chips/internal/chip-set-styles.css`）の **`flex-wrap: wrap` を上書きしていない**ため、実際にはチップが折り返し、`overflow-x: auto` は一度も働いていない。

**影響**:

| | 現状（wrap） | `flex-wrap: nowrap` を足した場合 |
|---|---|---|
| モード行（6チップ、必要幅 372px） | 2行 **74px** | 1行 34px＋横スクロール |
| 期間行（5チップ、必要幅 343px） | 幅343で1行 34px／幅328で2行 74px | 常に1行 34px |
| `.filter-bar` 合計 | **116px（幅343）／156px（幅328）** | **76px（幅によらず一定）** |

- ヒーローの高さが**画面幅 15px の差で ±40px 動く**という不安定さの原因はここにある
- 修正は `.filter-bar__row { flex-wrap: nowrap; }` の**1行**。ヒーローはさらに 40〜80px 縮む

**なぜ本 Issue で直さないか**:

1. Issue #6 の UI を変える判断であり、設計担当の一存で入れるべきでない
2. 未回収の UI 検証 D1（`docs/ui-verification/2026-08-23-issue-6-global-filter.md`）が「360px 幅の実機で、モード6チップの**横スクロール**が指で無理なく操作できるか（縦2段折り返しのほうが良いか）」をオーナーに委ねている
3. **ただし D1 の前提は現状すでに崩れている**: オーナーが実機で見ているのは「横スクロール」ではなく**既に折り返した2段**である。つまり D1 は設問のまま答えられない状態にある。この欠陥を直して初めて D1 が比較検証として成立する

**統括担当への提案**: 本 Issue とは別に「`FilterBar` が横スクロールしていない」を Issue 化し、修正後に D1 を仕切り直す。本 Issue の是正案は**この修正の有無にかかわらず §5.3 の上限を満たす**（修正が入れば 330 → 290px 相当にさらに縮むだけで、上限を割ることはない）。

---

## 10. 実挙動未確認・推定で書いた箇所

1. **実 API レスポンスでの確認をしていない。** 本設計の入力値はすべて合成データ（`src/domain/__fixtures__` と手組みの `LevelWithDelta`）で検証した。実プレイヤーの `nickname` の長さ・使用文字、`gameCount` の桁、`level.delta` の実際の分布は未観測。ニックネームは省略記号で切る設計にしてあるが、**実データでの見え方は B1 で初めて確認される**。
2. **昇降条件が成立している実プレイヤーを観測していない。** §1.2 の表はすべて手組み入力に対するドメイン関数の実行結果である。実データで条件ブロックが出る状態に遭遇するかは運次第で、B1 では確認できない可能性が高い。**B4（dev ギャラリー）が条件表示の実質的な検証**である。
3. **到達可能素点の上限 `total/(rank+1)` は近似**（§3.3）。飛び終局で最下位が負素点になる局面では破れる。実戦の素点分布で検証していない。
4. ~~**ヒーロー高さ 365px という上限は設計時の見積り**。~~ **【2026-09-05 解決】** 検収で未達が実証され、§1.9 で実測し直した。上限は §5.3 のとおり実測ベースに改訂した（344/384 → 再検収でプローブの欠陥が判明し 304/304 へ再改訂）。この項目は「推定で書いて外した」実例として残す。
5. **`useRankTheme` のクリーンアップと本体の setState が同一コミットでバッチされ、テーマが点滅しない**という記述は React 18+ の自動バッチングからの推論であり、実行して観測していない。B7/B8 で点滅が見えたら、`levelId` 変化時にクリーンアップを走らせない実装（前回値を ref で保持して差分がある時だけ `setRank`）へ変更する。
6. **`ElevatedCard`（`@material/web/labs/`）は labs 扱い**。API 安定性の保証が本体コンポーネントより弱い。`ComponentGallery` で描画実績はあるが、`min-height` を効かせるための内部 CSS カスタムプロパティ（`--md-elevated-card-container-shape` 等）の実挙動は未確認。効かない場合はラッパー `div` 側で高さを取ること。

**【2026-09-05 是正ラウンドで追加】**

7. **§1.9 の実測はすべて「ブラウザペインのデバイスエミュレーション」で行った。** 実機の Safari / Chrome では、システムフォント（Noto Sans JP のフォールバック）の差でテキスト行の実高さが数px 変わる可能性がある。§5.3 の許容 14px はこれを吸収する意図だが、**実機での実高さは未確認**。V1 で見え方を確認する。
8. **是正後の DOM は「ブラウザ上で組み立てたレプリカ」で測った値である。** React で実装した結果が同じ 126px / 330px になるかは、製造後に B5 で初めて確認される。レプリカは `.layered-sheet__hero` / `.player-hero` / `.filter-bar` / `.filter-bar__row` / `.identity*` の**実物のクラスと実物の `md-filter-chip`** を使い、是正前の構成で検収の報告値（426px）を再現できることを先に確かめてある。
9. **`identity__message` の `min-height: 94px` は「エラー文言が4行以内」という前提に依存する。** 現在 `useCurrentIdentity` が返す文言は1〜2行に収まるが、将来長い文言を足すと高さが跳ねる。B5-1 は状態3（固定文言）でしか検証しないので、**文言を追加する Issue でこの制約を思い出すこと**。
10. **`.identity__level` の `overflow: hidden` により、コンテンツ幅 280px 相当（ビューポート 320px の端末）では最長ケース `雀聖★★★ 8950/10000` の `/10000` の右端が約11px 切れる**（§1.9-7）。折り返して 32px 跳ねるよりましという判断だが、**320px 幅の実機で実際にどう見えるかは未確認**。V1 の対象端末に 320px 級があれば併せて見てもらう。
