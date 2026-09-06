# Issue #14 設計書: スタッツタブ（全指標リスト・9セクション）

対象 Issue: [#14 スタッツタブ: 全指標リスト（9セクション）](https://github.com/BlueKurage119/mj-stats-viewer/issues/14)
依存: #4（ドメイン計算）・#6（グローバルフィルタ）— いずれも実装済み
参照: `docs/requirements.md` §4.3・§6.5・§6.6・§8 / `docs/design/issue-3-api-layer.md` §1.3・§4.4 / `issue-4-domain-logic.md` §1.4・§1.7・§6 / `issue-9`・`issue-11`・`issue-12`・`issue-13`

このタブは**参照タブ**である。グラフを描かず、`PlayerExtendedStats` の全キーと導出値を MD3 リストで正確に並べることだけが責務。

---

## 0. 統括担当に判断を仰ぐ事項

**R-14 のみ着手前に判断が要る**（注記なし行と受け入れ条件 A2-1 の矛盾）。**R-9 は 2026-09-07 に要件書側が訂正されて解決済み。** R-1〜R-8・R-10〜R-13 は確定済み（R-1 と R-7 は 2026-09-07 に CLI 版実物との突き合わせで訂正した。R-8・R-10・R-12・R-13 はオーナー判断による方針変更）。

**2026-09-07 第2次改訂（オーナー直接指示3件）**: R-12（`立直好型` を53指標から除外 → **指標数は 52 になる**）・R-13（和銃分布で回数と割合を併記）・R-10 の全面差し替え（四麻のラス率 → 逆連対率）。影響章は §1.1 / §2.1 / §2.2 / §2.3 / §4.1 / §4.2 / §4.3 / §7 / §8.1 / §8.2 / §8.6。

| # | 論点 | 設計担当の推奨 | 根拠 |
|---|---|---|---|
| **R-1** | ~~日本語ラベル・分母注記が確定できない指標が14件ある~~ → **解決済み（2026-09-07 改訂）。** 先行CLI版ツールの実物（`/Users/yuta/claudeworks/old/251115_amae-kokoro/03_works/251123_mdcli` の `formatter.js` ほか）を実読し、14件中 **10件が確定**した | **§2.2 の表を CLI 実物準拠に全面差し替えた。**なお未確定の4件（§2.3）は `tentative: true` を立てて実装し、`grep -n "tentative: true"` が残件リストになる | §2.3 に確定・未確定の内訳。確定分の根拠はすべて `formatter.js` の出力文字列そのもの |
| **R-2** | **成長指標の基準卓は `preferredMode()` であって `useRepresentativeMode` ではない。** 統括担当の事前情報 6 の訂正 | **`preferredMode(levelId)` を使う。**`useRepresentativeMode` は使わない | 要件 §6.5「複数モード選択時は**入れる最上の卓・半荘**の表を基準に計算し、その旨を注記」。`src/domain/growth.ts` の `preferredMode` がまさにこれで、`IdentityCard` が既に同じ用途で使っている。副次効果として**追加APIリクエストが0本**になる（`useRepresentativeMode` は候補2つ以上で `player_stats` を候補数ぶん追加発行する。issue-13 §6.3） |
| **R-3** | **順位分布セクションがサマリータブのカード2と値が完全に重複する** | **リスト形式で再掲する。ドーナツは出さない。**ビューモデルは `buildRankView()` を**再利用**し、その `slices` / `tiles` をリスト行に変換するだけにする（ラベル・丸めを再定義しない） | Issue の章立てが CLI 版準拠で「順位分布」を先頭に置いており、参照タブとして値が無いのは不自然。`Donut.tsx` を再掲するとサマリーとの差が無くなり、リスト形式という Issue の指定にも反する |
| R-4 | 「全53指標」の定義 | **改訂（R-12）。`PlayerExtendedStats` から `roundCount`・`recentBigLoss`・`立直好型` を除いた 52 キーが本タブの表示対象である**（§1.1 に実測）。導出値はこれと別枠で数える | Issue 本文の「53」は `roundCount`・`recentBigLoss` だけを除いた素の数。R-12 で `立直好型` を追加除外したため**完了条件の数は 53 → 52 に訂正される**（§8.1 冒頭に明記） |
| R-5 | 欠落キーの扱い。`normalize` は回数系12キーしか `?? 0` しない。型は `number` 必須でも**実行時 undefined がありうる** | **追加の `?? 0` は行わない。**全行を `Number.isFinite` でガードし、欠落は `—` と表示する | §1.4。率キーを 0 補完すると「母数ゼロ」と「本当に0%」が区別できなくなる（issue-3 §4.4 の線引きと同じ） |
| R-6 | `md-list` / `md-list-item` の本番バンドル投入。現在この2つは dev ギャラリーでしか使われていない | **投入する（+14.19 kB raw / +3.11 kB gzip・実測）。**Issue が「MD3リスト形式」を明示しており、自前 div での代替は MD3 準拠を捨てることになる | §1.5 に実測手順と数値 |
| R-7 | 立直率・副露率をどのセクションに置くか | **CLI 実物準拠に訂正（旧案「総合成績1にだけ置く」は誤り）。立直率は「立直統計」に、副露率は「総合成績2」に、それぞれ1回だけ置く。** | CLI の `formatOverallStats2` は 和了率・放銃率・自摸率・副露率・流局率・流局聴牌率・平均和了巡目・黙聴率 の8項目で**立直率を含まない**。`formatCallStats` は `副露后*` の3項目だけで**副露率を含まない**。要件 §8「日本語ラベルはCLI版準拠」に従いこの非対称配置をそのまま採る。「各キーちょうど1回」の網羅性検査（§4.2）はこの配置でも成立する |
| **R-8** | **分母注記の表示方式**。旧案は `supporting-text` スロットへの常時表示 | **撤回。既定は非表示とし、hover / フォーカス / タップで開くツールチップで提供する**（§5.2）。要件 §4.3 は 2026-09-07 に「ツールチップで提供してよい（常時表示は不要）」へ訂正済み | 本家 amae-koromo も分母をツールチップに隠している。**`@material/web` v2.5 にツールチップ実装は無い**（`node_modules/@material/web/` 直下・`labs/` 直下を実見。`tooltip` ディレクトリは存在しない）ため自前実装になる。§1.6 に実物調査 |
| **R-9** | **要件 §8 の記述が §4.3 と食い違ったまま残っている**。§8 に「分母が特殊な率は注記を**常時表示**」の一文がある（`docs/requirements.md` L244） | **解決済み（2026-09-07）。**統括担当／オーナーが `docs/requirements.md` §8 L244 を「注記はツールチップで提供してよい（常時表示は不要）」に訂正済み（本設計担当の作業ではない・未コミットの作業ツリー差分として確認）。本設計は §4.3 / §8 の双方と一致する | 設計担当は要件書を書き換えない。矛盾を残したまま検収に入ると A2 系の判定がぶれる |
| **R-10** | **「ラス率」の定義が CLI と mj-stats-viewer で異なる**。CLI 四麻は `逆連対率 = 3位率+4位率`、mj の `lastPlaceRate()` は**最下位率のみ**（ラベルも「ラス率」）で、サマリーのカード2が既にそれを表示している | **2026-09-07 オーナー指示により全面差し替え（旧案「mj 側を維持」は撤回）。本タブは CLI 準拠に揃える。値は四麻・三麻とも `1 − rentaiRate(rankRates)`（連対率の余事象）とし、ラベルだけを四麻「逆連対率」/ 三麻「ラス率」に分岐する。`lastPlaceRate()` は本タブでは使わない。`buildRankView().tiles.last` も使わない**（§2.2-2） | オーナー: 「三麻でラス率と表示したのは、ラス率＝逆連対率となるからです」。三麻は順位が3つなので `1 − (r0+r1) = r2` が数学的に最下位率と一致する。四麻では 3位+4位 になり最下位率とは別物。CLI `formatter.js` `formatOverallStats1` の `is3Player ? 'ラス率' : '逆連対率'` 分岐と `calculator.js` `calculateLastRate`（四麻 `r2+r3` / 三麻 `r2`）に一致する。**サマリータブのカード2は本 Issue では一切変更しない**（別 Issue でオーナーが統一する。§7-8） |
| **R-12** | **`立直好型`（`riichiGoodShape`・「2」なしのキー）を表示するか** | **2026-09-07 オーナー指示により表示しない。`roundCount` / `recentBigLoss` と同じ「表示に値しないキー」として `StatsKey` から除外する**（除外キーは3つ・指標数は 52 になる） | オーナー: 「何かの数値と同じなので表示する意味がありません」。**具体的にどのキーと同値かは統括担当・オーナーとも把握していないため、本設計書は同値の相手を特定しない**（推測で書かない）。副次的な裏付けとして、CLI 版 `formatter.js` はこのキーを一度も参照していない（`grep '立直好型' *.js` → `立直好型2` の1行のみ）。→ §2.3 Q15 は「未確定」から「**非表示（オーナー判断）**」へ変更 |
| **R-13** | **和銃分布セクションで回数を出すか**。Issue #12 は「凡例に回数を出さない（% のみ）」と判断していた（`issue-12-win-lose-donuts.md` §0 R-1） | **2026-09-07 オーナー指示により、9行すべてで「回数 / 割合」を併記する。ただし回数が API に実在するのは和了時3キーおよび放銃相手3キーで、放銃時の3行のみ概算であるため「約」を付けて区別する**（§2.2-8） | #12 が回数を出さなかったのは**サマリーカードの凡例**という限られた面積で書式を揃えるためで、参照タブである本タブとは前提が違う。本タブは「可能な限り数値を見せる」ことが責務なので、概算であることを明示したうえで回数を出す。**2026-09-07 追検証（実データで訂正）: `放铳至*` は率ではなく生の整数カウント（クレジット数）であることが判明したため、和了時と同様に実測カウントと割合（「約」なし）を表示する。概算（「約」あり）となるのは「放銃時」3行のみである（§1.7・§2.2-8）** |
| **R-14** | ~~§2.2 の「注記」列に `-` の行が 20 行以上あるが、受け入れ条件 A2-1 が全行の `note` 非空を要求している~~ → **解決済み（2026-09-07・統括担当が代案を採用）** | **A2-1 を緩和する。`note` は空文字でもよい。ただし空の行は吹き出し要素（`.stats-row__tip`）自体を生成せず、`tabindex="0"` も `aria-describedby` も付けない。**「hover したのに何も出ない」体験を作らないことが決定の理由 | 統括担当: 「特殊な分母が無い指標にまで無理に説明文をひねり出すのは筋が悪い」。影響章: §4.3（`StatRow.note` を `string` から空許容へ）/ §5.1 / §5.2 / §8.2（A2-1・A2-2・A2-5・A2-6） |
| **R-11** | CLI の成長指標には `昇格条件` / `降格条件` / `最高段位` の行もある | **昇格/降格条件は本タブに出さない**（`src/summary/identityView.ts` が IdentityCard で既に表示済み・Issue #8）。**`最高段位` は本タブに1行追加する**（`PlayerStats.max_level`。どこにも表示されていない） | 要件 §4.3 の成長指標は4項目だが、`最高段位` は CLI にあり実装コストがほぼゼロ。追加を望まない場合は §2.2 の該当行を落とすだけで済む（統括担当の判断事項） |

---

## 1. 実物調査の結果（設計判断の根拠）

### 1.1 表示対象＝ `PlayerExtendedStats` の 52 キー（実測。Issue 本文の「53」からの訂正あり）

```
$ node -e "…src/api/types.ts の PlayerExtendedStats のキーを抽出…"
55
```

55 キーのうち `roundCount`（ワイヤ `count` の改名。局数というメタ情報）と `recentBigLoss`（オブジェクト。指標ではない）を除くと**ちょうど 53**。Issue 本文の「全53指標」はこの集合を指すと確定できる。

**さらに `立直好型` を除外する（R-12・2026-09-07 オーナー指示）。** 除外理由は「何かの数値と同じなので表示する意味がない」。`roundCount` / `recentBigLoss` と同格の「表示に値しないメタ／冗長キー」として扱う。**何と同値なのかは判明していないため、本設計書は同値の相手を特定しない。**

→ **除外キーは 3 つ、本タブの表示対象は 52 キー。** Issue 完了条件の「全53指標が漏れなく表示される」は「**除外3キーを除く全52指標が漏れなく表示される**」と読み替える（§8.1 冒頭に明記）。

→ 網羅性は「セクション定義に現れる `statsKey` の集合 == この52キー」で機械的に検証できる（§4.2 / §8.1）。

### 1.2 既に実装済みで、作り直してはならないもの

| 必要な機能 | 既存実装 | 本 Issue での扱い |
|---|---|---|
| 順位分布・平均順位・連対率・ラス率・飛び率・平均持ち点の算出と表記 | `src/summary/rankView.ts` `buildRankView({stats, extended})` | **そのまま使う。**`slices[].percentText` / `tiles[].value` をリスト行のテキストに流す（R-3） |
| 局収支 | `src/domain/derived.ts` `roundBalance({rankRates, rankAvgScores, mode, gameCount, roundCount})` → `number \| null` | そのまま使う。`mode` は §3.3 の基準卓を渡す |
| 放銃時の門前率 | `dealInStateBreakdown(s)` → `Breakdown \| null`（`默听` キーが門前） | そのまま使う（和銃分布セクションの導出行） |
| 段位pt期待値/戦 | `src/domain/points.ts` `expectedPointPerGame(rankRates, rankAvgScores, mode, level, {includePenalty})` | そのまま使う。**`includePenalty` は既定（true）** |
| 昇段/降段まで◯戦 | `src/domain/growth.ts` `gamesToPromotion(lp, delta)` / `gamesToDemotion(lp, delta)` → `number \| null` | そのまま使う |
| 50戦後見込み | `projectAfterGames(lp, delta, games)` → `LevelPoint` | そのまま使う。`games = 50` |
| 安定段位 | `src/domain/stableLevel.ts` `estimateStableLevel2(input, mode)` → `StableLevel`（4種の判別共用体） | そのまま使う。**`estimateStableLevel`（無印）は呼ばない**（`estimateStableLevel2` が必要に応じて内部で委譲する） |
| 基準卓（入れる最上の卓・半荘） | `preferredMode(levelId)` → `GameMode \| null` | そのまま使う（R-2） |
| 段位ラベル・pt表示 | `getLevelTag` / `getLevelTagFromId` / `getScoreDisplay` / `formatAdjustedScore` / `getMaxPoint` | そのまま使う |
| 現在段位（フィルタ非依存） | `useCurrentIdentity(numPlayers, playerId)` → `CurrentLevelInfo`、`effectiveLevelPoint(lv)` → `LevelPoint` | そのまま使う。**`scope.stats.stats.level` ではない**（あれはクエリ範囲内の最終対局時点のスナップショット） |
| 率・点の表記 | `src/compare/histogramView.ts` `formatMetricValue(value, unit)`（`'rate'` → `%1桁` / `'point'` → 整数カンマ区切り・負は U+2212 / `'turn'` → `x.xx巡`）。`null`/`undefined`/非有限は `'—'` | **そのまま import して使う**（§4.3）。同じ丸めロジックを再実装しない |
| モード注記の作り方 | `keyStatsView.ts` `buildModeNote` / `playstyleView.ts` の同型ヘルパ | 同じ3行を `growthView.ts` に**複製**する（issue-11 §3.2 の前例どおり。文言が違うため共有化しない） |
| MD3 リスト部品 | `src/components/md/List.ts` が `List` / `ListItem` を export 済み・バレルにも載っている | **ラッパー追加は不要**。そのまま import する |

### 1.3 `md-list-item` の実物（`node_modules/@material/web/list/internal/listitem/list-item.js`）

- スロットは `overline` / `headline` / `supporting-text` / `trailing-supporting-text` / `start` / `end` と既定スロット。既定スロットの中身はテキスト列（`.text`）に入り、`trailing-supporting-text` は**テキスト列の外**（右端）に置かれる（`labs/item/internal/item.js` の `render()` を確認）
- → **ラベル=`headline` / 値=`trailing-supporting-text`** の2スロット構成を採る。**分母注記は `supporting-text` に入れない**（R-8 で常時表示を撤回したため）。結果として各行は1行アイテムになり、`--md-list-item-one-line-container-height`（既定 56px）が効く
- **`md-item` の `:host` に `overflow: hidden` が入っている**（`labs/item/internal/item-styles.css` を実見。`.text` にも `overflow: hidden`）。`md-list-item` は自身のシャドウ DOM 内で `<md-item>` を描画し、`headline` などのスロットはそこに中継される。**したがってスロットに入れた要素を `position: absolute` で行の外へはみ出させるとクリップされる。**`md-item` は外部から CSS で選択できない（シャドウ DOM 内・`overflow` はカスタムプロパティ化されていない）ため、**ツールチップの吹き出しは `md-list-item` の外側に置くしかない**（§5.1）
- **`type` の既定値は `'text'` で、そのとき `renderRipple()` / `renderFocusRing()` は `nothing` を返す**（同ファイル `renderRipple`）。70行並べてもリップル要素は生成されない
- `role` は `md-list` が `list`、`md-list-item` が `listitem`。追加の ARIA は不要
- **既定の値テキストが小さすぎる**: `--md-list-item-trailing-supporting-text-size` の既定は `--md-sys-typescale-label-small-size`（`0.6875rem` = 11px）。値が注記より小さくなるので **CSS 変数で必ず上書きする**（§5.2）
- 1行時の既定高さ `--md-list-item-one-line-container-height` は **56px**（`md-item` の `min-height: 56px` と一致）。70行で約 3,900px になるため、`48px` へ詰める（§5.2）
- `md-list` の `role="list"` は **`ElementInternals` でホストに付く**（`list/internal/list.js` L36）。`md-list-item` の `role="listitem"` は**シャドウ DOM 内の要素**に付く（`list-item.js` L101）。→ §5.1 で `md-list-item` を `<div>` でラップしても、リスト項目のロール自体は失われない。ただし「`role=list` の直下でなくなる」影響は AT 実装依存なので **A11y 検証を受け入れ条件に置く**（A2-5）

### 1.6 `@material/web` にツールチップは存在しない（実見）

```
$ ls node_modules/@material/web        # tooltip なし（button/checkbox/chips/color/dialog/divider/
                                       #  elevation/fab/field/focus/icon/iconbutton/list/menu/
                                       #  progress/radio/ripple/select/slider/switch/tabs/typography …）
$ ls node_modules/@material/web/labs   # badge/behaviors/card/gb/item/navigationbar/navigationdrawer/
                                       #  navigationtab/segmentedbutton/segmentedbuttonset
```

→ **MD3 のツールチップ部品は無い。**`src/components/md/` にラッパーを足しても包む対象が存在しない。したがって §5.1 の**自前実装（CSS + 1要素/行、JS ゼロ）**を採る。

**バンドルへの影響は実質ゼロ**: 新規ライブラリ依存が無く、追加されるのは行あたり1つの `<span>` と数十行の CSS だけ。§1.5 の実測値（+3.11 kB gzip）から動かない。注記文字列そのものは常時表示案でも同じだけバンドルに載るため、方式変更による増減は無い。

### 1.4 型は `number` でも実行時 `undefined` がありうる

`src/api/normalize.ts` の `normalizePlayerExtendedStats` は回数系12キーだけを明示的に `?? 0` し、**残りは `...rest` でワイヤの内容をそのまま通す**。したがって `PlayerExtendedStats` の型が `和牌率: number` と宣言していても、ワイヤにキーが無ければ実行時は `undefined` になる。issue-3 §4.4 もこの方針を意図している（「率・平均は母数ゼロのとき 0 ではなく値なし」）。

→ **ビューは型を信用せず、必ず `Number.isFinite` でガードする。**`formatMetricValue` が既にこのガードを持ち `'—'` を返すので、それに委ねればよい（R-5）。

補完対象キーの棚卸し（統括担当の事前情報3への回答）: 本 Issue が新たに表示する回数系キーは `最大连庄` `最大累计番数` `役满` `累计役满` `W立直` `流满` `立直和了` `副露和了` `默听和了`（+率だが予防補完済みの `放铳至*` 3件）で、**すべて既存12キーに含まれる。追加の補完は不要。**

### 1.5 バンドル影響（実測）

`src/shell/PlaceholderPanel.tsx` に一時的に `<List><ListItem>…3スロット…</ListItem></List>` を挿入して `npm run build` を2回実行し、直後に復元して `git status --porcelain` が空であることを確認した。

| | raw | gzip |
|---|---|---|
| baseline | 520.74 kB | 143.42 kB |
| `md-list` + `md-list-item` 追加後 | 534.93 kB | 146.53 kB |
| **差分** | **+14.19 kB** | **+3.11 kB** |

CSS は 29.75 kB で変化なし（Lit のスタイルは JS 側に入るため）。

### 1.7 和銃分布の母数を実データ4サンプルで独立検証した（2026-09-07 全面改訂・R-13 の根拠）

オーナー指摘「放銃相手の計算が複雑になっているのはダブロン・トリロンがあるからです」を受け、**前提を置かずにゼロから再検証した。**

#### 1.7.1 検証に使ったデータ（新規に発見した実データ4サンプル）

先行 CLI 版ツールのリポジトリに、**実 API から生成された出力 Markdown が4本コミットされている**（`/Users/yuta/claudeworks/old/251115_amae-kokoro/03_works/251123_mdcli/0{1,2,3,4}_*.md`）。三麻2本・四麻2本、局数 508 / 1151 / 883 / 859。CLI は率を小数第2位の % まで出しているので、**「その % を整数比で表せる最小の母数」を逆算すれば API 内部の母数が特定できる**（誤差 ±0.00005 の範囲で候補を列挙し、3値の整数和が母数に一致するものだけを残す）。

**外部 API は一切叩いていない。**すべてリポジトリ内のファイルからの計算である。

> 実プレイヤーのID・ニックネームはこの設計書に転記しない（公開リポジトリのため）。以下ではサンプル1〜4と呼ぶ。

#### 1.7.2 実測結果

| | 局数 | `和牌率 × 局数` | 和了時3行の母数（逆算） | `放铳率 × 局数`（= `D`） | 放銃時3行の母数（逆算） | 放銃相手3行の母数（逆算） | 相手 − 放銃時 |
|---|---|---|---|---|---|---|---|
| サンプル1（三麻） | 508 | 137.01 | **137** | 93.01 | **93** | **95** | +2（+2.2%） |
| サンプル2（三麻） | 1151 | 354.05 | **354** | 199.01 | **199** | **207** | +8（+4.0%） |
| サンプル3（四麻） | 883 | 274.97 | **275** | 114.00 | **114** | **120** | +6（+5.3%） |
| サンプル4（四麻） | 859 | 265.00 | **265** | 126.96 | **127** | **128** | +1（+0.8%） |

（放銃相手の母数は逆算で得られる最小候補の整数倍のうち、`D` 以上で最小のものを採った。クレジット数は discard イベント数を下回りえないという制約による）

#### 1.7.3 ここから確定したこと

1. **`D = round(放铳率 × roundCount)` は「放銃時の状態」3行（`放铳时立直率` / `放铳时副露率` / 門前）の母数と、4サンプルすべてで厳密に一致する。**したがって `放铳率` の分子は **discard イベント数**であり、`放铳时*` も同じ discard イベント数を母数にしている。R-13 の概算方式はこの3行については**概算ではなく正確**（`放铳率` が小数4桁に丸められている分だけの誤差しか無い。局数 10,000 でも ±0.5 回未満）。
2. **「放銃相手の状態」3行（`放铳至*`）の母数は D より系統的に大きい**（+0.8% 〜 +5.3%、4サンプル平均 +3.1%）。**これがオーナーの指摘したダブロン・トリロンである。**1回の discard に複数人が同時にロンすると、discard イベントは1でも「(discard, 和了者) のペア＝クレジット」は2以上になる。超過率 0.8〜5.3% は実戦のダブロン発生率としてまったく自然な水準である。
3. **`放铳至立直 + 放铳至副露 + 放铳至默听` が常に 1.0000 になる理由は「クレジット数ベース」で自然に説明できる。**1クレジットは和了者1人に対応するので必ずどれか1カテゴリに属し、合計は定義上 1 になる。discard イベント数ベースだと、ダブロンで和了者2人の状態が異なる場合にイベントをどちらに数えるかという曖昧さが生じ、合計が 1 を超えるか恣意的な優先規則が要る。**実測（母数が D より大きい）と合わせて、クレジット数ベースであると結論する。**
4. **`放铳时立直率 + 放铳时副露率 + 門前 = 1` は discard イベント数ベースで説明できる。**放銃時の状態は「自分が捨てた瞬間の自分の状態」なので、和了者が何人いても1イベントにつき1つに定まる。トリロンで自分が2人に放銃しても discarder 視点では 1 回。実測で母数が `放铳率 × 局数` と厳密一致することがこれを裏付ける。
5. **`和牌率 × roundCount` は `立直和了 + 副露和了 + 默听和了` と4サンプルすべてで厳密に一致する。**→ **Issue #12 §1.4 が未解決として残した「58 vs 88」の食い違いは実データでは起きない。**原因は §1.7.4（フィクスチャ側の問題）。

#### 1.7.4 `src/api/testdata/player_extended_stats.json` は内部整合していない（重要な訂正）

上と同じ逆算を mj のフィクスチャに当てると、**4つの独立した整合性検査すべてに失敗する**（実データ4サンプルはすべて通る）。

| 検査 | フィクスチャの値 | 判定 |
|---|---|---|
| `和牌率 × count` = `立直和了+副露和了+默听和了` | 0.4536 × 194 = **88** vs **58** | ✗ |
| `放铳率 × count` が `放铳时*` の母数 | **24** vs 母数は 13 の倍数（`0.1538 = 2/13`・`0.4615 = 6/13`） | ✗ |
| `立直率 × count` が `立直后*` の母数 | **41** vs 母数は 44 の倍数（`0.4773 = 21/44`・`0.1591 = 7/44`） | ✗ |
| `副露率 × count` が `副露后*` の母数 | **72** vs 母数は 68 の倍数（`0.4118 = 28/68`・`0.1324 = 9/68`） | ✗ |

`issue-3-api-layer.md` §7.3 は「匿名化は id / nickname / 牌譜ID だけで、数値は実データのまま」としているが、**少なくとも `count`（194）は他のキーと整合しない**。原因の特定はしていない（**実挙動未確認**）。

→ **設計への影響**: フィクスチャは「型と書式のテストデータ」としては使えるが、**母数の関係式を検算する根拠には使えない**。§8.9 の受け入れ条件は、書式検証にだけフィクスチャを使い、母数の関係式は合成入力（`放铳率 = 0.13` / `roundCount = 400` 等）で検証する。**フィクスチャの `21 / 29 / 8` から `和牌率 × count` との一致を検査してはならない**（落ちる）。

#### 1.7.5 CLI 版 `formatWinLossDistribution` の回数計算はバグである

`.../251123_mdcli/formatter.js` L378-416 を実読した。

```js
const dealInToRiichi = extendedStats['放铳至立直'] || 0;   // 実測 0.1875（率）
const dealInToCall   = extendedStats['放铳至副露'] || 0;   // 実測 0.5   （率）
const dealInToDamaten= extendedStats['放铳至默听'] || 0;   // 実測 0.3125（率）
const totalDealIn = dealInToRiichi + dealInToCall + dealInToDamaten;   // ← 常に約 1.0
…
`| 立直 | ${formatNumber(Math.round(totalDealIn * dealInWhenRiichi))}回 | …`  // ← Math.round(1.0 * 0.1538) = 0
```

`放铳至*` が率であることは Issue #12 が実 API レスポンスで実測済み（`issue-12-win-lose-donuts.md` §1.1）。したがって `totalDealIn` は常に約 1.0 で、この式の「回数」は常に 0〜1 になる。**CLI をそのまま模倣してはならない。**

> [!IMPORTANT]
> **2026-09-07 実データによる訂正（放銃相手3キーは率ではなく整数の生カウントだった）**:
> 過去の調査（Issue #12 の小規模フィクスチャなど）では `放铳至*` の値が小数に見えていたため「率」と誤認していたが、実アカウントの本家データ（実測値 136 / 102 / 31、合計269）と突き合わせた結果、API の `放铳至立直` / `放铳至副露` / `放铳至默听` は**率ではなく整数の生カウント（和了者クレジット数そのもの）**であることが確定した。
> したがって、CLI が `totalDealIn = dealInToRiichi + dealInToCall + dealInToDamaten` としてこれら3値の合計を生カウント合計として求めていた前提自体は正しかった。
> 本 Issue でも、`放铳至*` 3キーを生カウントとしてそのまま扱い、その合計 `dealInTargetTotal` に対する割合 `count / dealInTargetTotal` を計算して実測値（「約」なし）として表示する。

（なお §1.7.1 で使った4本の出力 Markdown に整数の回数が並んでいるのは、CLI の**別の**表示経路が「放銃相手」側の母数を先に求め、それを「放銃時」側にも流用しているため。母数を取り違えているので回数自体も1ずつずれている例がある — サンプル1の放銃時は真値 29/36/28 に対し CLI 出力は 30/37/29。**この点でも CLI は模倣対象にならない。**）

#### 1.7.6 本 Issue が採る方式（結論）

> [!NOTE]
> **2026-09-07 実データで訂正**:
> - **和了時3行**: API の生カウントそのまま（実測値、「約」なし）。割合は `W = 立直和了 + 副露和了 + 默听和了` に対する比率。
> - **放銃相手3行**: API の生カウントそのまま（実測値、「約」なし）。割合は `dealInTargetTotal = 放铳至立直 + 放铳至副露 + 放铳至默听` に対する比率。
> - **放銃時3行**: `D = round(放铳率 × roundCount)`（discard イベント数）に各率を掛けた概算値（「約」あり）。

```
D = round(放铳率 × roundCount)          // discard イベント数。放銃時3行の母数として厳密
放銃時各行の回数 = Math.round(D × その行の率)
```

- **放銃時3行**: `D` が母数そのものなので、丸め誤差だけの正確な値になる（概算値として「約」を付与）。
- **放銃相手3行**: API の生カウント（実測値）をそのまま出す。合計に対する比率を計算し、「約」は付けない。
- **和了時3行**: API の生カウント（`立直和了` ほか）をそのまま出す。合計 `W` に対する比率を計算し、「約」は付けない。

## 2. 指標の棚卸し（このIssueの単一情報源）

### 2.1 セクション構成（CLI 実物準拠に訂正）

要件 §4.3 の章立て＝CLI 版 `formatMarkdown()` の出力順そのもの（`formatter.js` L28-44 を実見）。**どのキーがどのセクションに属するかも CLI に合わせる**（R-7）。見出し語は要件 §4.3 の表記（「総合成績1 / 総合成績2」）を使う（CLI の見出しは「総合成績その1 / その2」）。

| # | id | 見出し | CLI の関数 | 内容 | 行数 |
|---|---|---|---|---|---|
| 1 | `rank` | 順位分布 | `formatRankDistribution` | 1位〜4位（三麻は3位まで） | 4 / 3 |
| 2 | `overall1` | 総合成績1 | `formatOverallStats1` | 対局数・局数・順位系集計（**APIキーを1つも含まない**） | 7 |
| 3 | `overall2` | 総合成績2 | `formatOverallStats2` | 和了率など8キー（**立直率は含まない**） | 8 |
| 4 | `efficiency` | 効率指標 | `formatEfficiencyMetrics` | 打点・損失5キー + 局収支（導出） | 6 |
| 5 | `growth` | 成長指標 | `formatGrowthMetrics` | 導出のみ（#4 のドメイン関数） | 5 |
| 6 | `riichi` | 立直統計 | `formatRiichiStats` | **立直率を含む**16キー（`立直好型` は R-12 で除外） | 16 |
| 7 | `call` | 副露統計 | `formatCallStats` | `副露后*` の3キーのみ（**副露率は含まない**） | 3 |
| 8 | `distribution` | 和銃分布 | `formatWinLossDistribution` | 8キー + 放銃時門前（導出） | 9 |
| 9 | `luck` | 幸運度 | `formatLuckMetrics` | **一発率は含まない**（立直統計側）12キー | 12 |

**旧版からの主な移動**（統括担当への差分報告）:

| キー | 旧設計の所属 | CLI 実物 |
|---|---|---|
| `立直率` | 総合成績1 | **立直統計** |
| `和了巡数` | 総合成績2 | **総合成績2**（CLI の「総合成績その2」＝旧設計の総合成績1相当） |
| `平均打点` `平均铳点` | 総合成績2 | **効率指標** |
| `被炸率` `平均被炸点数` `最大连庄` `最大累计番数` | 総合成績2 | **幸運度** |
| `平均起手向听` 3種 | 効率指標 | **幸運度** |
| `一发率` `里宝率` | 幸運度 | `一发率` は**立直統計**、`里宝率` は幸運度のまま |

### 2.2 全52指標テーブル（CLI 実物準拠。`立直好型` は R-12 で除外済み）

`確` = CLI 版 `formatter.js` の出力文字列そのもの、または要件本文・既存コードで裏が取れている／`要` = §2.3 の未確定。
`unit` は §4.3 の `StatUnit`。`suffix` は `count` 系にだけ付く追加単位。**「注記」列がツールチップの中身**（R-8）。

#### 1 順位分布（4行・APIキーなし）

| key | ラベル | 値 | 注記（ツールチップ） | |
|---|---|---|---|---|
| `rank1`〜`rank4` | `1位`〜`4位` | `slices[i].percentText + '%'` | `{countText}回・平均 {rank_avg_score[i] を四捨五入・3桁区切り}点` | 確 |

`buildRankView()` の `slices` をそのまま使う（R-3）。CLI は「回数 / 割合 / 平均点数」を表の3列に出しているが、リスト1行には割合を値として出し、**残り2つを注記に回す**。順位別平均点は `PlayerStats.rank_avg_score[i]` の生読みで、計算の再実装ではない。

#### 2 総合成績1（7行・APIキーなし）

| key | ラベル | 値の作り方 | 注記 | |
|---|---|---|---|---|
| `gameCount` | 記録対戦数 | `rankView.gameCountText + '戦'` | 選択中の期間・モードの対局数 | 確 |
| `roundCount` | 総計局数 | `rankView.roundCountText + '局'`（`null` なら `—`） | 選択中の期間・モードの配牌回数 | 確 |
| `avgRank` | 平均順位 | `tiles.avgRank.value + '位'` | 順位の平均。小数第2位まで表示 | 確 |
| `rentai` | 連対率 | `tiles.rentai.value` | 2位以上の割合 | 確 |
| `last` | **四麻:「逆連対率」/ 三麻:「ラス率」** | `formatStatValue(1 - rentaiRate(rank_rates), 'rate')`。**`tiles.last.value` は使わない** | 四麻: `3位以下（3位+4位）の割合`／三麻: `3位（最下位）の割合` | 確（R-10・2026-09-07 オーナー指示） |
| `negative` | 飛び率 | `tiles.negative.value` | 0点未満で終局した割合 | 確 |
| `avgScore` | 平均持ち点 | `tiles.avgScore.value + '点'` | 終局時の平均点棒 | 確 |

CLI のラベルは `記録対戦数` `総計局数` `平均順位` `連対率` `逆連対率`（三麻は `ラス率`）`飛び率` `平均持ち点`。**7行すべて CLI 準拠にする**（R-10・2026-09-07 オーナー指示で旧案「`逆連対率` だけは採らない」を撤回）。CLI は平均順位を小数3桁で出すが、`buildRankView` の `toFixed(2)` を優先する（カード2との一致を壊さない）。

**`last` 行の実装指示（製造担当が最も踏みやすい）**:

- 値は `1 - rentaiRate(rankRates)`。`rentaiRate` は `src/domain/derived.ts` が**エクスポート済み**（`src/domain/index.ts` の re-export も確認済み。`rentaiRate(rates) = rates[0] + rates[1]`）。**新規に計算関数を書かない。**
- **`lastPlaceRate()` は本タブでは呼ばない。**`buildRankView().tiles.last` も参照しない（値・ラベルとも別物になるため）。
- ラベルは `numPlayers === 4 ? '逆連対率' : 'ラス率'`。CLI `formatter.js` `formatOverallStats1` の `is3Player` 分岐と同じ。**値の式は四麻・三麻で共通**（三麻は順位が3つで合計 1 なので `1 - (r0+r1) = r2` が最下位率と一致する。呼び方だけを変える）。
- `連対率` 行は従来どおり `tiles.rentai.value`（＝`rentaiRate` を `percentText` したもの）を使う。`last` 行だけ `formatStatValue(..., 'rate')` 経由になるが、`percentText` と `formatMetricValue('rate')` はいずれも小数1桁 `%` で書式が一致する。
- 浮動小数の残差（`1 - (r0+r1)` が `r2+r3` と最下位ビットで異なりうる）は小数1桁への丸めで消えるため、表示上の差は生じない。
- **サマリータブのカード2（`src/summary/rankView.ts` の `tiles.last`）は本 Issue では一切変更しない。**カード2は引き続き `lastPlaceRate()`（最下位率・ラベル「ラス率」）を表示する。統一は別 Issue（§7-8）。

#### 3 総合成績2（8キー）

| key | statsKey | ラベル | unit | 注記 | |
|---|---|---|---|---|---|
| `winRate` | `和牌率` | 和了率 | rate | 和了回数 / 配牌回数 | 確 |
| `dealInRate` | `放铳率` | 放銃率 | rate | 放銃回数 / 配牌回数 | 確 |
| `tsumoRate` | `自摸率` | ツモ率 | rate | ツモあがり回数 / 和了回数 | 確 |
| `callRate` | `副露率` | 副露率 | rate | 副露した局数 / 配牌回数 | 確 |
| `drawRate` | `流局率` | 流局率 | rate | 流局回数 / 配牌回数 | 確 |
| `drawTenpaiRate` | `流听率` | 流局聴牌率 | rate | 流局聴牌回数 / 流局回数 | 確 |
| `avgWinTurn` | `和了巡数` | 平均和了巡目 | turn | - | 不要 |
| `damatenRate` | `默听率` | 闇聴率 | rate | 門前ダマ和了回数 / 和了回数 | 確 |

**行の順序も CLI に合わせる**（`formatOverallStats2` の出力順）。`自摸率(和了回数比)` `流局聴牌率(流局回数比)` `默听率(和了回数比)` の注記は CLI が括弧で明示している唯一の3つで、要件 §8 の明示例と一致する。
ラベルは `KEY_STAT_METRICS`（和了率・放銃率・副露率）と `COMPARE_METRICS`（ツモ率・闇聴率・平均和了巡目）と**同じ文字列**にする。CLI の見出し語は「黙聴率」だが、要件 §4.3 L128 と既存実装（`COMPARE_METRICS` / `DONUT_SPECS`）が「闇聴」で統一済みなので**闇聴率を優先する**（統括判断の上書きをしない）。

#### 4 効率指標（5キー + 導出1）

| key | statsKey | ラベル | unit | 注記 | |
|---|---|---|---|---|---|
| `avgWinScore` | `平均打点` | 平均打点 | point | - | 不要 |
| `winEfficiency` | `打点效率` | 打点効率 | point | 平均打点 × 和了率 | 確 |
| `avgDealInScore` | `平均铳点` | 平均放銃点 | point | - | 不要 |
| `lossEfficiency` | `铳点损失` | 銃点損失 | point | 平均放銃点 × 放銃率 | 確 |
| `netEfficiency` | `净打点效率` | 調整打点効率 | point | 打点効率 − 銃点損失 | 確 |
| *(導出)* `roundBalance` | — | 局収支 | point | (平均持ち点 − 配給原点) × 記録対戦数 / 総計局数 | 確 |

**重要（統括担当の事前情報1の確定）**: CLI は `打点効率` / `銃点損失` / `調整打点効率` を**API の値ではなく自前で計算**している（`formatter.js` L191-224 → `calculator.js`）:

```js
export function calculatePointEfficiency(avgPoint, winRate)      { return Math.round(avgPoint * winRate); }
export function calculatePointLoss(avgDealInPoint, dealInRate)   { return Math.round(avgDealInPoint * dealInRate); }
export function calculateAdjustedPointEfficiency(pe, pl)         { return pe - pl; }
```

本 Issue は**再計算しない。**API の生キー `打点效率` / `铳点损失` / `净打点效率` をそのまま表示する。理由は `src/domain/radar.ts`（Issue #4 実装済み・変更しない）が既にこの生キーを「攻」「守」軸に使っており、同じ画面で別計算の同名指標を出すとドメイン層と矛盾するため。注記は CLI にならって**分母比ではなく計算式相当の説明**にする。
**残留リスク（実挙動未確認）**: API の生値が CLI の式と数値的に一致するかは検証していない。mj のフィクスチャは合成値なので数値照合ができない（§9-2）。

#### 5 成長指標（5行・APIキーなし）

§3 参照。CLI の `段位点期待値` / `(昇段まであと◯戦)` / `50戦後の見込み` / `最高段位` に、要件 §6.5 の `安定段位` を加えた5行。CLI の `昇格条件` / `降格条件` は IdentityCard が既に出しているので本タブには出さない（R-11）。

#### 6 立直統計（16キー）

CLI `formatRiichiStats` の出力順どおり。

| key | statsKey | ラベル | unit | 注記 | |
|---|---|---|---|---|---|
| `riichiRate` | `立直率` | 立直率 | rate | 立直回数 / 配牌回数 | 確 |
| `riichiWinRate` | `立直后和牌率` | 立直成功率 | rate | 立直後に和了した割合 | 確 |
| `riichiDealInRate` | `立直后放铳率` | 立直後放銃率A | rate | 立直した局で放銃した割合（立直した瞬間を含む） | 確 |
| `riichiDealInRateNonImmediate` | `立直后非瞬间放铳率` | 立直後放銃率B | rate | 立直した局で放銃した割合（立直した瞬間を除く） | 確 |
| `riichiBalance` | `立直収支` | 立直収支 | point | 立直後の収支(供託含む) / 立直回数 | 確 |
| `riichiIncome` | `立直收入` | 立直収入 | point | 立直和了収入(供託含む) / 立直後の和了回数 | 確 |
| `riichiExpense` | `立直支出` | 立直支出 | point | 立直後の放銃支出(供託含む) / 立直後の放銃回数 | 確 |
| `riichiFirst` | `先制率` | 先制立直率 | rate | その局で初めて立直した割合 | 確 |
| `riichiChase` | `追立率` | 追っかけ率 | rate | 追っかけ立直をした回数 / 立直回数 | 確 |
| `riichiChased` | `被追率` | 追っかけられ率 | rate | 他家に追いかけ立直された回数 / 立直回数 | 確 |
| `riichiTurn` | `立直巡目` | 平均立直巡目 | turn | - | 不要 |
| `riichiDrawRate` | `立直后流局率` | 立直後流局率 | rate | 立直した局が流局した回数 / 立直回数 | 確 |
| `ippatsuRate` | `一発率` | 一発率 | rate | 一発回数 / 立直和了回数 | 確 |
| `riichiFuriten` | `振听立直率` | 振聴立直率 | rate | 立直後の見逃しは含まない | 確 |
| `riichiMultiWait` | `立直多面` | 立直多面率 | rate | 2面待ち以上（シャンポンを含む） | 確 |
| `riichiGoodShape2` | `立直好型2` | 立直良形率 | rate | 宣言時に待ちが自分から見て6枚以上 | 確 |

- **`立直好型2` のラベルは「立直良形率」**（語尾に 2 を付けない）。CLI L349 の出力そのもの。旧設計の「立直良形率2」は誤り
- **`立直好型`（2なし）の行は存在しない**（R-12・2026-09-07 オーナー指示で表示対象から除外）。オーナーの理由は「何かの数値と同じなので表示する意味がない」。**同値の相手は不明なので推測を書かない。**副次的な裏付けとして CLI も一度も参照していない（`grep '立直好型' *.js` → `立直好型2` の1行のみ）。実装上は `StatsKey` の `Exclude<>` に入るため、**`STATS_KEY_COVERAGE` に書こうとすると型エラーになる**（§4.1 / §4.2）
- **`立直后非瞬间放铳率` に独立行を与える**。CLI は独立行にせず `立直後放銃率` の下に `（うち立直した瞬間の放銃: A−B%）` と**差分だけ**を出している（L340）。本 Issue は「全52指標を漏れなく表示」が完了条件なので、CLI の差分注記は採用せず、B 自体に行を与えて A の注記から「うち…」の文言を落とす。**A−B の差分行は作らない**（導出行を増やすと §4.2 の網羅性検査の見通しが悪くなる）
- CLI の追加注記「※立直収支の計算には、横移動・流局・ツモられも含むため、立直収入と立直支出の差とは必ずしも一致しない。」は**セクション見出し直下の注記**（`StatSectionView.note`）として1行出す（§4.3 の `note` を `riichi` セクションでも使う）

#### 7 副露統計（3キー）

| key | statsKey | ラベル | unit | 注記 | |
|---|---|---|---|---|---|
| `callDealInRate` | `副露后放铳率` | 副露後放銃率 | rate | 副露後放銃回数 / 副露した局数 | 確 |
| `callWinRate` | `副露后和牌率` | 副露後和了率 | rate | 副露和了回数 / 副露した局数 | 確 |
| `callDrawRate` | `副露后流局率` | 副露後流局率 | rate | 副露流局回数 / 副露した局数 | 確 |

CLI の出力順は 放銃率 → 和了率 → 流局率。**副露率はここに置かない**（総合成績2 に1回だけ・R-7）。

#### 8 和銃分布（8キー + 導出1）

**このセクションだけ値の書式が特殊で、`{回数} / {割合}` を併記する**（R-13・2026-09-07 オーナー指示）。`unit` は `'distribution'` を新設する（§4.3）。

| key | statsKey | ラベル | 回数の出所 | 割合の出所 | |
|---|---|---|---|---|---|
| `winStateRiichi` | `立直和了` | 立直 | **API 生カウント（実測値）** | `立直和了 / W` | 確 |
| `winStateCall` | `副露和了` | 副露 | **API 生カウント（実測値）** | `副露和了 / W` | 確 |
| `winStateDamaten` | `默听和了` | 闇聴 | **API 生カウント（実測値）** | `默听和了 / W` | 確 |
| `dealInStateRiichi` | `放铳时立直率` | 立直 | **概算** `round(D × 放铳时立直率)` | `放铳时立直率`（API 生の率） | 確 |
| `dealInStateCall` | `放铳时副露率` | 副露 | **概算** `round(D × 放铳时副露率)` | `放铳时副露率`（API 生の率） | 確 |
| *(導出)* `dealInStateConcealed` | — | 門前 | **概算** `round(D × 門前率)` | `dealInStateBreakdown().默听` | 確 |
| `dealInTargetRiichi` | `放铳至立直` | 立直 | **API 生カウント（実測値）** | `放铳至立直 / dealInTargetTotal` | 確 |
| `dealInTargetCall` | `放铳至副露` | 副露 | **API 生カウント（実測値）** | `放铳至副露 / dealInTargetTotal` | 確 |
| `dealInTargetDamaten` | `放铳至默听` | 闇聴 | **API 生カウント（実測値）** | `放铳至默听 / dealInTargetTotal` | 確 |

> [!NOTE]
> **2026-09-07 実データで訂正および表形式化に伴うラベル簡潔化**:
> - `放铳至*` 3キーは率ではなく整数の生カウント（和了者クレジット数）であることが判明したため、「放銃相手の状態」は和了時3行と同様に実測カウントと割合（「約」なし）を表示する。
> - 小表化（「和了時の状態」「放銃時の状態」「放銃相手の状態」）に伴い、テーブル「状態」列のラベルからセクションプレフィックスを除去し、「立直」「副露」「闇聴」「門前」に簡潔化した。

記号:

- `W = 立直和了 + 副露和了 + 默听和了`（和了回数。**API に実在する整数の合計**。実データ4サンプルで `和牌率 × roundCount` と厳密一致・§1.7.2）
- `dealInTargetTotal = 放铳至立直 + 放铳至副露 + 放铳至默听`（**放銃相手の和了者クレジット数の合計**。API に実在する整数の合計）
- `D = round(放铳率 × roundCount)`（**放銃した discard イベント数**。`放铳率` の分母は配牌回数＝`extended.roundCount`）
  - **放銃時3行では `D` が母数そのもの**（実データ4サンプルで厳密一致・§1.7.3-1）。回数は丸め誤差だけの正確な値になるが、API に回数の生データがないため概算として「約」を付ける

**表示書式（実測値と概算を見た目で区別する・R-13 の必須要件）**:

| 種別 | `valueText` の例 | 規則 |
|---|---|---|
| 実測（和了時3行 + 放銃相手3行） | `21回 / 36.2%` | 回数に**「約」を付けない** |
| 概算（放銃時3行のみ） | `約12回 / 26.5%` | 回数に**必ず「約」を付ける** |

**注記（ツールチップ）** — 2026-09-07 UI調整で3つの独立した小表形式に変更されたため、ツールチップ注記は削除済み（§8.9）。

**欠落・ゼロ時のフォールバック**:

| 状況 | 表示 |
|---|---|
| `W === 0` または 3値のいずれかが非有限 | 和了時3行の割合を `—`、回数は `0回`（`normalize` が `?? 0` 済み。§1.4） |
| `dealInTargetTotal === 0` または 3値のいずれかが非有限 | 放銃相手3行の割合を `—`、回数は `0回`（または有限な回数） |
| `放铳率` が非有限 / `0` / `roundCount` が非有限 → `D` が算出できない | 放銃時3行を **割合だけ**表示（`— / 26.5%`）。回数部を捏造しない |
| 個々の率が非有限 | その行を `—`（行は消さない・R-5） |

> [!NOTE]
> **CLI の `totalDealIn` について（2026-09-07 訂正）**:
> CLI の `formatWinLossDistribution` は `放铳至*` の合計を `totalDealIn` としていたが、これら3キーが生カウントであることが判明したため、CLI のこの合計自体は正しかった。ただし、CLI がその `totalDealIn` を「放銃時」の母数として流用していた点は依然として取り違えであり、放銃時の母数は `D = 放铳率 × roundCount` を使う。

**なぜ Issue #12 と判断が違うのか**: #12 はサマリーカードの**ドーナツ凡例**で「3枚の書式を揃える」ため回数を出さない判断をした（`issue-12-win-lose-donuts.md` §0 R-1）。本タブは**参照タブ**であり「可能な限り数値を見せる」ことが責務なので、概算であることを明示したうえで回数を出す。#12 のカード5は本 Issue では変更しない。

語彙は `src/summary/winLoseView.ts` `DONUT_SPECS` と一致させる（Issue #12 で確定済み）。CLI は「黙聴」だが mj は「闇聴」で統一済みなので**闇聴を優先**する。導出行の割合は `dealInStateBreakdown()` の `默听` フィールド。`null` のときは `—`。

#### 9 幸運度（12キー）

CLI `formatLuckMetrics` の出力順どおり。

| key | statsKey | ラベル | unit | 注記 | |
|---|---|---|---|---|---|
| `maxRenchan` | `最大连庄` | 最大連荘 | count（suffix `連荘`） |  - | 不要 |
| `uradoraRate` | `里宝率` | 裏ドラ率 | rate | 裏ドラのある和了回数 / 立直和了回数 | 確（§1.7.1 の実データ4サンプルで逆算・§2.3 Q12） |
| `hitByTsumoRate` | `被炸率` | 痛い親かぶり率 | rate | 親番で満貫以上のツモられ回数 / 親番でのツモられ回数 | 確（分母は要） |
| `avgHitByTsumoScore` | `平均被炸点数` | 痛い親かぶり平均 | point | 満貫以上の親かぶり点数 / 回数 | 確 |
| `yakuman` | `役满` | 役満 | count（suffix `回`） |  - | 不要 |
| `countedYakuman` | `累计役满` | 数え役満 | count（suffix `回`） |  - | 不要 |
| `maxFan` | `最大累计番数` | 最大合計飜数 | count（suffix `飜`） |  - | 不要 |
| `nagashiMangan` | `流满` | 流し満貫 | count（suffix `回`） |  - | 不要 |
| `doubleRiichi` | `W立直` | ダブル立直 | count（suffix `回`） |  - | 不要 |
| `avgShanten` | `平均起手向听` | 配牌平均向聴 | shanten |  - | 不要 |
| `avgShantenDealer` | `平均起手向听亲` | 親配牌平均向聴 | shanten |  - | 不要 |
| `avgShantenNonDealer` | `平均起手向听子` | 子配牌平均向聴 | shanten |  - | 不要 |

- **ラベル訂正**: `最大累计番数` → **「最大合計飜数」**（旧「最大累計飜」は誤り。CLI L437）／`平均被炸点数` → **「痛い親かぶり平均」**（旧「平均親かぶり点」は誤り。CLI L434）／`平均起手向听*` → **「配牌平均向聴」「親配牌平均向聴」「子配牌平均向聴」**（旧「平均配牌向聴（親）」は誤り）
- `被炸率` の注記は CLI の定義文「※**痛い親かぶり** とは、親番で子に満貫以上の自摸和了りをされることをいう。」を1行に縮めたもの。**分母（局数比か親番局数比か）は CLI にも記載がない**
- CLI は親／子の配牌向聴を値 > 0 のときだけ出すが、本タブは**常に行を出し欠落時 `—`**（R-5・参照タブとして構造を保つ）
- CLI は向聴を小数3桁で出す。本タブは `shanten` unit で**小数2桁 + 「向聴」**（§4.3）。桁数はアプリ内の一貫性を優先した設計判断

#### 件数の突き合わせ

statsKey: 8 + 5 + **16** + 3 + 8 + 12 = **52**（総合成績1 と成長指標は statsKey を持たない。`立直好型` は R-12 で除外）。
表示行数: 4 + 7 + 8 + 6 + 5 + **16** + 3 + 9 + 12 = **70**（四麻）／**69**（三麻・順位分布が3行）。

**改訂前（`立直好型` を含んでいた版）は 53 キー / 71 行 / 70 行だった。**受け入れ条件の数値もすべて 1 ずつ減っている（§8.1）。

### 2.3 CLI 実読後に残った未確定（旧「要確認14件」の顛末）

旧 §2.3 の14件は、CLI 実物の突き合わせで **10件確定・4件未確定**になった。

| # | 対象 | 旧暫定案 | 実物での結論 |
|---|---|---|---|
| Q1 | `被炸率` のラベル | 痛い親かぶり率 | **確定**（CLI L432 が同文字列。要件 §4.3 L128 とも一致） |
| Q2 | `平均被炸点数` のラベル | 平均親かぶり点 | **訂正して確定 →「痛い親かぶり平均」**（CLI L434） |
| Q3 | `被炸率` の分母 | 局数比 | **未確定。CLI にも記載なし。**注記は分母を主張せず CLI の定義文を使う |
| Q4 | `最大累计番数` のラベル | 最大累計飜 | **訂正して確定 →「最大合計飜数」**（CLI L437） |
| Q5 | `振听立直率` のラベル | 振聴立直率 | **確定**。注記も CLI の「立直後の見逃しは含まない」を採用 |
| Q6 | `立直好型2` のラベル | 立直良形率2 | **訂正して確定 →「立直良形率」**（CLI L349）。注記も「宣言時に待ちが自分から見て6枚以上」 |
| Q7 | `立直多面` のラベル | 立直多面待ち率 | **訂正して確定 →「立直多面率」**（CLI L348）。注記「2面待ち以上」 |
| Q8 | `立直后非瞬间放铳率` | 立直後放銃率（即放銃を除く） | **意味は確定**（CLI は A−B を「立直した瞬間の放銃」と表示している）。**ラベルは CLI に無い**ので設計判断で「立直後放銃率（宣言巡を除く）」とする |
| Q9 | `立直收支` / `立直收入` / `立直支出` の分母 | 立直1回あたり | **確定**。CLI が3件とも分母を明記（§2.2 の注記列がその原文） |
| Q10 | `打点效率` 系の分母 | 1局あたり | **訂正して確定 → 計算式相当の注記**（CLI は分母比ではなく `平均打点 * 和了率` 等の式を出す）。ただし API 生値と式の一致は未検証（§9-2） |
| Q11 | `一发率` の分母 | 立直回数比 | **確定（2026-09-07 実測）→ `一発回数 / 立直和了回数`。**§1.7.1 の実データ4サンプルで `一发率 × (立直率 × 局数 × 立直后和牌率)` が 22 / 37 / 26 / 23 とすべて整数になる（立直回数を分母にすると 44.24 / 63.18 / 46.37 / 41.51 で整数にならない）。`tentative` を外す |
| Q12 | `里宝率` の分母 | 立直和了回数比 | **確定（2026-09-07 実測）→ `裏ドラのある和了回数 / 立直和了回数`。**同じ逆算で 44 / 85 / 65 / 46 とすべて整数（立直回数だと 88.47 / 145.12 / 115.88 / 83.02 で非整数）。§2.2-9 の注記を「立直回数」から訂正した。`tentative` を外す |
| Q13 | `流满` のラベル | 流し満貫 | **確定**（CLI L438） |
| Q14 | 局収支 | 局収支 | **確定**。CLI が式まで明記（`(平均持ち点 - 配給原点) * 記録対戦数 / 総計局数`）。mj の `roundBalance()` と同型 |
| **Q15**（新規） | `立直好型`（2なし）の定義 | — | **解決＝調査不要になった（2026-09-07 オーナー指示・R-12）。「何かの数値と同じなので表示する意味がない」として表示対象から除外。**したがって定義を確定させる必要が無くなった。`tentative` も立てない（そもそも行が存在しない） |
| **Q16**（新規） | `追立率` / `被追率` の分母 | — | **確定（2026-09-07 実測）→ 両方とも `/ 立直回数`。**§1.7.1 の4サンプルで `立直回数 = 立直率 × 局数` に対し 追立 37/64/42/52・被追 39/63/55/51 とすべて整数。`先制率 + 追立率 = 1.0000` も4サンプルで成立し、同一母数であることを裏付ける。`tentative` を外す |

**2026-09-07 の追検証（§1.7.1）で Q11・Q12・Q16 が確定したため、未確定は Q3 の1項目（対象キーは `被炸率` の1キー）だけになった。**`被炸率` は「局数比」「親番局数比」「和了回数比」のいずれでも4サンプルが整数にならず、分母を特定できなかった（**実挙動未確認**・§9-14）。残った1キーにだけ `tentative: true` を立て、`grep -n "tentative: true" src/stats/statsMetrics.ts` が残件リストになる（**1件だけになる**）。**ラベルは表示対象の全52キーで確定した**（未確定は分母注記の裏取りのみ）。Q15（`立直好型`）は R-12 の除外により未確定リストから外れた。

---

## 3. 成長指標セクションの設計（#4 のロジックを初めて UI に繋ぐ）

### 3.1 入力

| 何を | どこから | 注意 |
|---|---|---|
| 現在段位 `LevelWithDelta` | `useCurrentIdentity(numPlayers, playerId)` の `identity.level` | **フィルタ非依存**。`scope.stats.stats.level` を使ってはならない（クエリ範囲内の最終対局時点のスナップショット） |
| `rankRates` / `rankAvgScores` | `scope.stats.stats.rank_rates` / `.rank_avg_score` | **フィルタ依存**（期間・モード）。混在は要件 §6.5 の指定どおり |
| 基準卓 `mode` | `preferredMode(eff.levelId)` | R-2 |

`eff = effectiveLevelPoint(identity.level)`（`applyPointDelta(lp, 0)` と同義。上限超え／負値を本家規則で1段動かす）。

### 3.2 5行の定義（CLI 準拠で `最高段位` を追加・R-11）

| key | ラベル | 計算 | 表示 | 注記 |
|---|---|---|---|---|
| `expectedPoint` | 段位pt期待値 | `expectedPointPerGame(rankRates, rankAvgScores, mode, effLevel)`（`includePenalty` 既定 true） | 小数2桁 + `pt/戦`。負は U+2212 | `{卓名}の間・{半荘\|東風}基準` |
| `gamesToBoundary` | `昇段まで` / `降段まで` / `昇降段まで` | `delta > 0` → `gamesToPromotion(eff, delta)` / `delta < 0` → `gamesToDemotion(eff, delta)` / `delta === 0` → 計算しない | `{n}戦`。`null` は `—` | `現在 {formatAdjustedScore(effLevel, eff.point)}` |
| `projection50` | 50戦後の見込み | `projectAfterGames(eff, delta, 50)` | `{getLevelTagFromId(levelId)} {formatAdjustedScore(level, round(point))}` 例: `雀傑3 480/1800`（※2026-09-07指示: 見込み段位Ptは小数点以下四捨五入） | `{卓名}の間・{半荘\|東風}を50戦打った場合` |
| `stableLevel` | 安定段位 | `estimateStableLevel2({levelId: identity.level.id, score: identity.level.score, delta: identity.level.delta, rankRates, rankAvgScores}, mode)` | §3.4 | `{卓名}の間・{半荘\|東風}基準` |
| `maxLevel` | 最高段位 | `scope.stats.stats.max_level`（計算なし） | `getLevelTagFromId(max_level.id)`（例 `雀聖1`） | 選択中の期間・モードで到達した最高段位 |

`PROJECTION_GAMES = 50` を名前付き定数にする（マジックナンバー禁止）。

**`最高段位` だけはフィルタ依存**（`PlayerStats.max_level` はクエリ範囲内の最大）。他の4行はフィルタ非依存の `identity.level` を基準にするため、注記でその違いを明示する。`max_level` が欠落／不正な `id` のときは `—`。

**`estimateStableLevel2` には `eff` ではなく生の `identity.level`（id / score / delta）を渡す。**内部で `getAdjustedLevel(parseLevelId(levelId), score + delta)` を行うため、先に正規化すると二重適用になる（`src/domain/stableLevel.ts` を実物確認）。

### 3.3 `StableLevel` 4種の表示

| kind | 表示 |
|---|---|
| `number` | `splitStableLevelNumber(value).text`（例 `雀豪2.43` / `雀聖1.07`）。**小数2桁「切り捨て」**は関数側の仕様 |
| `level` | `getLevelTagFromId(levelId)` に `bound` を付ける: `exact` → そのまま / `plus` → `雀聖3+` / `minus` → `初心1−`（U+2212） |
| `konten` | `getLevelTagFromId(levelId)` + `+`（例 `魂天+`） |
| `unavailable` | `—` |

### 3.4 例外・ガード（**製造担当が最も踏みやすい罠**）

`expectedPointPerGame` は内部の `assertRankCount` が**長さ不一致で `throw` する**（`src/domain/points.ts`）。React のレンダ中に投げると画面全体が落ちる。以下をすべて満たすときだけ計算し、満たさないときは `expectedPoint` 由来の3行を `—` にする（`最高段位` は独立に評価する）。

1. `identity.kind === 'ready'` かつ `scope.stats.kind === 'ready'`
2. `mode = preferredMode(eff.levelId)` が `null` でない
3. `rankRates.length === rankAvgScores.length` かつ `rankRates.length === numPlayersForMode(mode)`
   `numPlayersForMode` は `levelConstants.ts` の非公開関数なので、**`mode >= 21 ? 3 : 4`** ではなく `numPlayers`（ルートの `:np`）と `rankRates.length` の一致で判定する。`preferredMode` は同じ `numPlayerId` のモードしか返さないため、これで十分
4. すべての `rankRates` / `rankAvgScores` 要素が `Number.isFinite`

### 3.5 「複数モード選択時は基準卓を注記」

`scope.filter.modes.length >= 2` のときだけ、セクション見出し直下に注記を1行出す:

> `複数モードを選択中です。段位pt の計算は{卓名}の間・{半荘|東風}を基準にしています。`

単一モード選択で、かつその選択モードが基準卓と一致する場合は出さない。**選択モードが基準卓と一致しない場合（例: 玉の間だけを選択している雀聖）も注記を出す**（順位率は玉の間のもの、pt表は王座の間のもの、というズレが起きるため）。

---

## 4. モジュール構成

```
src/stats/
  statsMetrics.ts     セクション・指標テーブル（このタブの単一情報源）
  statsView.ts        ビューモデル構築（React 非依存の純関数）
  growthView.ts       成長指標セクションのビューモデル（同上）
  StatsPanel.tsx      タブ本体（フック配線のみ）
  StatsSection.tsx    1セクション = md-list（純表示部品・フックなし）
  stats.css
  statsMetrics.test.ts
  statsView.test.ts
  growthView.test.ts
src/dev/StatsGallery.tsx    dev ルート #/__stats
```

`src/shell/AppRouter.tsx` の `stats` タブを `PlaceholderPanel` から `StatsPanel` に差し替える。`src/main.tsx` に `#/__stats` を既存と同じ DCE が効く形（`import.meta.env.DEV` リテラル分岐の内側に動的 `import()` 直書き）で追加する。

### 4.1 `statsMetrics.ts` の公開シグネチャ

```ts
import type { PlayerExtendedStats } from '../api';

/**
 * 表示対象の 52 キー（§1.1）。除外は3つ:
 *   roundCount    メタ情報（局数）
 *   recentBigLoss オブジェクト。指標ではない
 *   立直好型      オーナー判断で非表示（R-12。「何かの数値と同じ」）
 */
export type StatsKey = Exclude<keyof PlayerExtendedStats, 'roundCount' | 'recentBigLoss' | '立直好型'>;

/** 'distribution' は和銃分布セクション専用（回数 / 割合 の併記・R-13） */
export type StatUnit = 'rate' | 'point' | 'turn' | 'count' | 'shanten' | 'distribution';

export type StatSectionId =
  | 'rank' | 'overall1' | 'overall2' | 'efficiency' | 'growth'
  | 'riichi' | 'call' | 'distribution' | 'luck';

/** 導出行の識別子。API キーを持たない行 */
export type DerivedRowId = 'roundBalance' | 'dealInStateConcealed';

export interface StatMetricSpec {
  readonly kind: 'metric';
  readonly key: string;            // 'winRate' 等の安定キー（data-metric / テスト用）
  readonly statsKey: StatsKey;
  readonly label: string;
  readonly unit: StatUnit;
  readonly suffix?: string;        // '回' | '飜' | '連荘'
  readonly note: string;           // 分母注記＝ツールチップ本文。空文字は禁止（§8.2 で検査）
  readonly tentative?: true;       // §2.3 の未確定5項目（Q3/Q11/Q12/Q15/Q16）。UI 上の差は付けない
}

export interface DerivedRowSpec {
  readonly kind: 'derived';
  readonly key: DerivedRowId;
  readonly label: string;
  readonly unit: StatUnit;
  readonly suffix?: string;
  readonly note: string;
}

export type StatRowSpec = StatMetricSpec | DerivedRowSpec;

export interface StatSectionSpec {
  readonly id: StatSectionId;
  readonly title: string;
  readonly rows: readonly StatRowSpec[];   // 'rank' と 'growth' は空（専用ビルダが組む）
}

export const STAT_SECTIONS: readonly StatSectionSpec[];
```

### 4.2 網羅性を型で強制する（Issue 完了条件1）

`STAT_SECTIONS` を素朴に書くとキーの取りこぼしが**静かに**通る。以下を同ファイルに置いて、**取りこぼしをコンパイルエラーにする**。

```ts
/**
 * 52キーの網羅を型で強制する索引。STAT_SECTIONS に載せた statsKey を
 * ここにも書く。1つでも欠けると tsc が Record の不足を報告する。
 * 逆に除外3キー（roundCount / recentBigLoss / 立直好型）を書くと
 * StatsKey に存在しないため「余分なプロパティ」で tsc が落ちる。
 */
export const STATS_KEY_COVERAGE: Readonly<Record<StatsKey, StatSectionId>> = {
  和牌率: 'overall2',
  // …52件…
};
```

そのうえで単体テスト（§8.1）が「`STAT_SECTIONS` を走査して得た `statsKey` の多重集合」==「`STATS_KEY_COVERAGE` のキー集合」かつ**各キーちょうど1回**、さらに各行の `section` が `STATS_KEY_COVERAGE` の値と一致することを検査する。型と実データの二重化を、テストで突き合わせて閉じる。

**`立直好型` の除外が型で効くこと（R-12）**: `STATS_KEY_COVERAGE` に `立直好型: 'riichi'` を書き足すと `Record<StatsKey, …>` の余剰プロパティになりコンパイルエラーになる。これは設計意図であり、除外が静かに戻ることを防ぐ（受け入れ条件 A1-9）。

### 4.3 `statsView.ts` の公開シグネチャ

```ts
import type { PlayerExtendedStats, PlayerStats } from '../api';
import type { StatSectionId, StatUnit } from './statsMetrics';
import type { GrowthView } from './growthView';

export interface StatRow {
  readonly key: string;
  readonly label: string;
  readonly note: string;       // ツールチップ本文（Issue 完了条件2・R-8）。**空文字可**（R-14）。
                               // 空のときは吹き出し要素を生成せず、tabindex / aria-describedby も付けない
  readonly valueText: string;  // '36.5%' | '5,312' | '9.87巡' | '3回' | '—'
}

export interface StatSectionView {
  readonly id: StatSectionId;
  readonly title: string;
  readonly rows: readonly StatRow[];
  readonly note: string | null;   // セクション見出し直下の注記（growth の基準卓注記・§3.5 と riichi の立直収支注記・§2.2 で使う）
}

/** unit → テキスト。'rate'|'point'|'turn' は compare の formatMetricValue に委譲する */
export function formatStatValue(
  value: number | null | undefined,
  unit: StatUnit,
  suffix?: string,
): string;

export function buildStatsView(input: {
  readonly stats: PlayerStats;
  readonly extended: PlayerExtendedStats | null;
  readonly growth: GrowthView | null;
  readonly baseMode: GameMode | null;   // 局収支の計算に使う基準卓（§3.1）
  readonly numPlayers: 3 | 4;           // 総合成績1 の last 行のラベル分岐（R-10）
}): readonly StatSectionView[];
```

`numPlayers` はルートの `:np`（`StatsPanel.tsx` が持つ）を渡す。`stats.rank_rates.length` から推測しない（欠落・不正長のときに黙ってラベルが入れ替わるのを防ぐ）。

`formatStatValue` の追加分:

| unit | 出力 | 備考 |
|---|---|---|
| `count` | `value.toLocaleString('ja-JP') + (suffix ?? '')` | 例 `3回` `12連荘` `7飜`。非整数は `Math.round` してから |
| `shanten` | `value.toFixed(2)` | 例 `3.21` |

`'rate'` / `'point'` / `'turn'` は `import { formatMetricValue } from '../compare/histogramView'` にそのまま渡す（丸め・U+2212・`'—'` フォールバックを再実装しない）。`suffix` は `'count'` 以外では無視する。

**`'distribution'` は `formatStatValue` では扱わない**（引数が2つ要るため）。専用関数を分ける:

```ts
/**
 * 和銃分布セクション専用の値テキスト（R-13・§2.2-8）。
 * count が null（概算不能）のときは割合だけを出す。
 * approximate = true のとき回数に「約」を付ける（概算と実測の区別・必須）。
 */
export function formatDistributionValue(input: {
  readonly count: number | null;
  readonly rate: number | null;
  readonly approximate: boolean;
}): string;
```

| 入力 | 出力 |
|---|---|
| `{count: 21, rate: 0.362, approximate: false}` | `21回 / 36.2%` |
| `{count: 12, rate: 0.265, approximate: true}` | `約12回 / 26.5%` |
| `{count: null, rate: 0.265, approximate: true}` | `— / 26.5%` |
| `{count: 0, rate: null, approximate: false}` | `0回 / —` |
| `{count: null, rate: null, approximate: true}` | `—` |

回数部は `formatStatValue(count, 'count', '回')`、割合部は `formatStatValue(rate, 'rate')` に委譲する（丸めを再実装しない）。区切りは半角スペース + `/` + 半角スペース。

`DerivedRowId` に `dealInStateConcealed` が既にあるが、和銃分布の**概算回数は導出行を増やさずに `statsView.ts` 内で計算する**（`STAT_SECTIONS` の行構成は §2.2-8 の9行のまま。網羅性検査 §4.2 の見通しを壊さない）。

### 4.4 `growthView.ts` の公開シグネチャ

```ts
import type { GameMode, LevelWithDelta } from '../api';
import type { StatRow } from './statsView';

export const PROJECTION_GAMES = 50;

export interface GrowthInput {
  readonly level: LevelWithDelta;              // useCurrentIdentity 由来（フィルタ非依存）
  readonly rankRates: readonly number[];
  readonly rankAvgScores: readonly number[];
  readonly numPlayers: 3 | 4;
  readonly selectedModeCount: number;          // §3.5 の注記判定
  readonly selectedModes: readonly GameMode[]; // 同上
  readonly maxLevel: LevelWithDelta | null;    // PlayerStats.max_level（フィルタ依存・§3.2）
}

export interface GrowthView {
  readonly mode: GameMode | null;   // 基準卓。null なら全行 '—'
  readonly note: string | null;     // §3.5 の注記
  readonly rows: readonly StatRow[];// 常に5行（§3.2 の順）
  readonly expectedPoint: number | null; // テスト・#4 との突き合わせ用に生値も返す
}

/** §3.4 のガードをすべて内包する。throw しない */
export function buildGrowthView(input: GrowthInput): GrowthView;
```

**`buildGrowthView` は例外を投げない**ことを契約とする（§3.4）。

---

## 5. 画面構成

### 5.1 DOM 構造（分母注記はツールチップ・R-8）

> [!NOTE]
> **2026-09-07 UI調整で上書き**:
> 1. **カード化**: 各セクションを `ElevatedCard` (`src/components/md`) で包み、9セクション = 9枚のカードが縦に並ぶ構成とする。
> 2. **表形式化**: `rank`（順位分布）および `distribution`（和銃分布）は `List` ではなく表形式（`table`）で描画する。表内に回数・割合（順位分布は平均点数も）が揃うため、この2セクションのツールチップ（注記）は不要（削除）。
> 3. **ツールチップのトリガー限定**: リスト形式の残り7セクションにおいて、ラベル全体での hover/focus は廃止し、注記がある行のみラベル横に Material Icon `info`（`src/components/md` の `Icon` コンポーネント）ボタンを配置する。PC では hover（マウスカーソル `help`）または focus-visible で表示し、タッチ端末ではタップ（クリック）で表示・非表示をトグルする（`data-tip-open="true"` / `aria-expanded`）。外側タップで閉じる。
> 4. **値の文字サイズ拡大**: リスト行の値および表の回数・割合・平均点数セルを `title-medium`（16px, 500）相当とし、ラベル（`body-medium`）より大きく表示する。

```tsx
<div className="stats-panel">
  <p className="stats-panel__count md-typescale-body-small">
    {gameCountText}戦 / {roundCountText}局      {/* 要件 §6.6 */}
  </p>

  {sections.map((s) => (
    <ElevatedCard key={s.id} className="stats-section-card" data-section={s.id}>
      <section className="stats-section">
        <h2 className="stats-section__title md-typescale-title-small">{s.title}</h2>
        {s.note && <p className="stats-section__note md-typescale-body-small">{s.note}</p>}
        {/* s.id === 'rank' の場合は順位分布テーブル */}
        {/* s.id === 'distribution' の場合は和銃分布3小テーブル */}
        {/* その他セクションは以下の List */}
        <List className="stats-section__list">
          {s.rows.map((r) => (
            <div className="stats-row" key={r.key} data-row={r.key} data-has-note={r.note ? 'true' : 'false'}>
              <ListItem>
                <span slot="headline" className="stats-row__headline">
                  <span className="stats-row__label">{r.label}</span>
                  {r.note && (
                    <button
                      type="button"
                      className="stats-row__info-btn"
                      aria-label={`${r.label}の注記`}
                      aria-describedby={`tip-${s.id}-${r.key}`}
                    >
                      <Icon className="stats-row__info-icon">info</Icon>
                    </button>
                  )}
                </span>
                <span slot="trailing-supporting-text" className="stats-row__value">
                  {r.valueText}
                </span>
              </ListItem>
              {r.note && (
                <span className="stats-row__tip" id={`tip-${s.id}-${r.key}`} role="tooltip">
                  {r.note}
                </span>
              )}
            </div>
          ))}
        </List>
      </section>
    </ElevatedCard>
  ))}
</div>
```

設計上の要点:

1. **`.stats-row` でラップするのは装飾ではなく必須要件**。吹き出しを `md-list-item` のスロット内に置くと `md-item` の `:host{overflow:hidden}` にクリップされ、外から `overflow` を上書きする手段が無い（§1.3 の実物調査）。`.stats-row` は `position: relative` にし、吹き出しはその中で `position: absolute` にする
2. `.stats-row` には **`data-row` を移す**（旧案は `ListItem` に付けていた。受け入れ条件のセレクタも合わせて変更する）
3. **注記がある行では `aria-describedby` は常に有効**。吹き出しは視覚的に隠すだけ（`opacity`/`visibility`）で `display: none` にしない。→ スクリーンリーダーは hover せずとも注記を読む
3'. **注記が無い行（`note === ''`）は `.stats-row__tip` を DOM に出さない**（R-14・2026-09-07 統括担当判断）。`tabindex` も `aria-describedby` も付けない。→ 「hover / フォーカスしたのに何も出ない」行が生まれない。`data-has-note` 属性で検収が両者を区別できる
4. **フォーカス可能にするのは注記がある行のラベルだけ**（`tabIndex={0}`）。`md-list-item` は `type='text'`（既定）のままにする。リップル・フォーカスリングを生成させないため（§1.3）。注記の無い行のラベルはフォーカス対象にしない（Tab の停止回数が減る副次効果がある）
5. `<span slot="headline">` に `tabIndex` を付けるのは light DOM 側なので、スロット中継されてもフォーカス可能性は保たれる（**実挙動未確認**。A2-6 で検証する）

**52行＋導出行にフォーカス可能要素が並ぶことの影響**（統括担当への申し送り）:

| 懸念 | 評価 |
|---|---|
| Tab キーで注記のある行数ぶん止まる（R-14 で「全70行」ではなくなった） | 参照タブとしては許容範囲だが、タブ切替直後に本文へ入る導線が長くなる。**セクション見出しに `tabindex="-1"` を置いて `#` リンクで飛ばす、といった追加ナビゲーションは本 Issue では作らない**（スコープ外） |
| モバイル（タップ）で開くか | `tabindex` 付き要素はタップでフォーカスを受けるため `:focus-within` で開く。**iOS Safari の挙動は未検証**（§9）。開いた吹き出しは次のタップ（＝他要素へのフォーカス移動）で閉じる |
| 吹き出しが画面外に出る | 吹き出しはラベル直下・左寄せに出し、`max-width: min(280px, calc(100vw - 32px))` で右端はみ出しを防ぐ。JS による位置計算はしない |
| ホバーで開くまでの遅延 | 遅延は入れない（CSS のみ）。`transition` で 120ms のフェードだけ付ける |

### 5.2 CSS（`stats.css`）

> [!NOTE]
> **2026-09-07 UI調整で上書き**:
> - 各セクションを包むカード `.stats-section-card` に `padding: 16px` を設定。
> - 表形式セクション（`.stats-table`）のレイアウト・ボーダー・パディングを設定。
> - 和銃分布テーブル（`.stats-table--dist`）: 放銃時「約」による列幅のズレを防ぎ3つの表で縦の列を揃えるため、`table-layout: fixed` および列幅比率 2:1:1（50%:25%:25%）を設定。
> - 値の文字サイズ: リスト行の値（`.stats-row__value`）および表の数値セル（`.stats-table__cell--value`）を `var(--md-sys-typescale-title-medium-size)`（16px）かつ太字 `500` に拡大し、ラベル（`body-medium`: 14px）より大きく表示。
> - ツールチップトリガーの限定: ラベルの点線下線を撤去し、`.stats-row__info-btn`（Material Icon `info`）を配置。ホバー時のマウスカーソルは `help` とする。PC では `@media (hover: hover)` 内で hover / focus-visible で表示し、タッチ端末ではタップで表示・非表示をトグルする（`.stats-row[data-tip-open="true"]`。sticky hover 防止のためアイコンの hover 色変化およびツールチップ表示を `@media (hover: hover)` 内に隔離し、タップ・ポインタ操作時のフォーカス枠を `:focus:not(:focus-visible)` で抑制。2回目のタップで閉じる際に `requestAnimationFrame` 経由で `blur()` を実行してフォーカスを確実に解除）。外側タップ（`pointerdown`）で閉じる。

色は必ず `--md-sys-color-*` を使う。ハードコード禁止（CLAUDE.md §5）。`md-list-item` の既定値の上書きが**必須**（§1.3）:

```css
.stats-section-card {
  display: block;
}

.stats-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
}

.stats-section__list {
  --md-list-container-color: transparent;
  --md-list-item-container-color: transparent;
  background-color: transparent;
  --md-list-item-one-line-container-height: 48px;
  --md-list-item-top-space: 4px;
  --md-list-item-bottom-space: 4px;
  --md-list-item-trailing-supporting-text-size: var(--md-sys-typescale-title-medium-size, 1rem);
  --md-list-item-trailing-supporting-text-line-height: var(--md-sys-typescale-title-medium-line-height, 1.5rem);
  --md-list-item-trailing-supporting-text-weight: 500;
  --md-list-item-trailing-supporting-text-color: var(--md-sys-color-on-surface);
}

.stats-row {
  position: relative;
  border-bottom: 1px solid var(--md-sys-color-surface-container-highest);
}

.stats-row:last-child {
  border-bottom: none;
}

.stats-row__headline {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.stats-row__info-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  color: var(--md-sys-color-on-surface-variant);
  border-radius: 50%;
  outline-offset: 2px;
}

.stats-row__info-btn:hover,
.stats-row__info-btn:focus-visible {
  color: var(--md-sys-color-primary);
}

.stats-row__info-icon {
  font-size: 16px;
  width: 16px;
  height: 16px;
}

.stats-row__value {
  font-size: var(--md-sys-typescale-title-medium-size, 1rem);
  line-height: var(--md-sys-typescale-title-medium-line-height, 1.5rem);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.stats-row__tip {
  position: absolute;
  z-index: 2;
  top: calc(100% - 10px);
  left: 12px;
  max-width: min(280px, calc(100vw - 32px));
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--md-sys-color-inverse-surface);
  color: var(--md-sys-color-inverse-on-surface);
  font-size: var(--md-sys-typescale-body-small-size);
  line-height: var(--md-sys-typescale-body-small-line-height);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 120ms ease;
}

.stats-row:has(.stats-row__info-btn:hover) .stats-row__tip,
.stats-row:has(.stats-row__info-btn:focus-visible) .stats-row__tip {
  opacity: 1;
  visibility: visible;
}

@media (prefers-reduced-motion: reduce) {
  .stats-row__tip { transition: none; }
}
```

`--md-sys-color-inverse-surface` / `--md-sys-color-inverse-on-surface` は MD3 の 37 トークンに含まれる（`src/theme/` が供給済み）。ツールチップの標準的な配色であり、light / dark 双方で自動的に反転する。

**注記を `supporting-text` スロットに出す当初案は採らない**（R-8）。したがって各行は1行アイテムで、`--md-list-item-two-line-container-height` は使わない。

### 5.3 状態

| 状態 | 表示 |
|---|---|
| `scope.stats.kind === 'loading'` | セクション見出しだけ出し、行はスケルトン（各セクションの行数ぶん） |
| `scope.stats.kind === 'empty'` | `NO_GAMES_IN_PERIOD_MESSAGE` を1行（他タブと同じ） |
| `scope.stats.kind === 'error'` | `scope.stats.message` を1行 |
| `stats.kind === 'ready'` かつ `extended === null` | 順位分布・総合成績1・成長指標（`PlayerStats` だけで作れる）は値を出し、他セクションは全行 `—`。セクション自体は隠さない（参照タブなので構造を保つ）。ただし `総計局数` は `—`（`extended.roundCount` 由来）、`局収支` も `—`（`roundCount` が要る） |

### 5.4 API リクエスト

**このタブは新規のAPIリクエストを1本も発行しない。**`scope.stats`（`useFilteredStats`）と `scope.identity`（`useCurrentIdentity`）が既に取得済みのデータだけを読む。`global_histogram` も `level_statistics` も使わない（分布・パーセンタイルは比較タブの責務）。

---

## 6. テスト方針

- `statsMetrics.test.ts`: 網羅性・重複なし・注記の非空・キーの一意性（§8.1・§8.2）
- `statsView.test.ts`: `formatStatValue` の各 unit、`formatDistributionValue` の5ケース（§4.3）と概算母数 `D`（§8.9）、`last` 行のラベル・値の三麻/四麻分岐（§8.6 A6-6/A6-7）、`src/api/testdata/player_extended_stats.json` を入力にした52行の値テキスト、欠落キーの `—` フォールバック
- `growthView.test.ts`: §8.3 の検算表。`src/domain/__fixtures__/player_stats_4p.json` を入力に、`expectedPointPerGame` を**テスト内で直接呼んだ値**とビューの生値が一致すること（Issue 完了条件3の直接検証）

---

## 7. 引き継ぎ事項（後続 Issue へ）

1. **`STATS_KEY_COVERAGE` は API の型が増えたら壊れる**。`PlayerExtendedStats` にキーを足すと `Record<StatsKey, …>` が不足でコンパイルエラーになる。これは設計意図（静かに欠落しない）なので、キー追加時は本テーブルへの追記が必須である
2. `formatMetricValue` を `src/compare/histogramView.ts` から import する形にした。将来3タブ目が使うようなら `src/util/format.ts` への移設を検討する（本 Issue では churn を避けて移設しない）
3. §2.3 の未確定は **`被炸率` の1キーだけ**になった（2026-09-07 の実データ逆算で `一发率` / `里宝率` / `追立率` / `被追率` が確定・§1.7.1）。確定したら `tentative` フラグを外す。`grep -n "tentative: true" src/stats/statsMetrics.ts` が残件リストになる。`被炸率` は CLI 版ツールにも本家仕様書にも記載が無く、実データ4サンプルでもどの分母候補でも整数にならなかったため、確定には本家 `ja.json` かオーナーの知識が要る
6. **ツールチップ機構は本 Issue が初出**（`.stats-row__tip` + `aria-describedby`）。他タブ（比較タブの指標名など）でも注記を出したくなったら、`src/stats/stats.css` の3クラスを `src/components/` へ切り出すことを検討する。本 Issue では churn を避けて切り出さない
7. **CLI 版の `formatWinLossDistribution` は「黙聴」表記**だが本アプリは「闇聴」で統一済み（Issue #12）。CLI と突き合わせる将来の作業でこの差を「不整合」と誤診しないこと
4. 履歴タブ（#4.4）が入ると `最近大铳`（`recentBigLoss`）の表示先ができる。本 Issue では**意図的に表示しない**（表示対象52指標に含めない・§1.1）
5. 順位分布セクションは `buildRankView` に依存している。カード2の表記を変えると本タブの表示も変わる（意図的な共有）。**ただし `last` 行だけは共有していない**（次項）
8. **「ラス率」の定義が本タブとサマリーカード2で食い違ったままになる**（R-10・オーナー了承済みの一時的な不整合）。本タブ（四麻）は `逆連対率 = 1 − 連対率 = 3位率+4位率`、カード2は `ラス率 = 最下位率（4位率のみ）`。**オーナーが別 Issue でカード2側を統一する予定**。統一 Issue では `src/summary/rankView.ts` の `tiles.last`（`lastPlaceRate()` 呼び出し・ラベル `'ラス率'`）を本タブと同じ仕様に揃えることになる。そのとき `rankView.test.ts` と本タブの受け入れ条件 A6-6 の両方を更新すること。**それまでは「サマリーとスタッツで値が違う」ことを欠陥と誤診しないこと**
9. **和銃分布の母数は実データ4サンプルで検証済み**（§1.7）。`D = 放铳率 × roundCount` は「放銃時」3行の母数と厳密に一致するが、「放銃相手」3行の母数は**ダブロン・トリロンのぶんだけ大きい**（+0.8〜5.3%）。将来 `games` / `player_records` 以外の経路でクレジット数の生データが得られるようになったら、放銃相手3行を実測に切り替えて「約」を外すこと。**補正係数を推定で入れてはならない**
11. **Issue #12 §1.4 の未解決事項（`立直和了+副露和了+默听和了` = 58 と `和牌率 × count` = 88 が合わない）は解決した**（§1.7.4）。**実データでは両者は厳密に一致する**（4/4サンプル）。食い違いは `src/api/testdata/player_extended_stats.json` 側の問題である。`issue-12-win-lose-donuts.md` §8-4 の記述は本設計書 §1.7.4 に置き換わる
12. **`src/api/testdata/player_extended_stats.json` は4つの内部整合性検査に失敗する**（§1.7.4）。api 層（#3 / #23）の担当範囲なので本 Issue では触らないが、**このフィクスチャを使って母数の関係式を検算するテストを書いてはならない**。差し替えるなら別 Issue で、api 層の既存テストごと更新すること
10. **`立直好型` は表示対象から恒久的に除外した**（R-12）。`StatsKey` の `Exclude<>` に入っているので、将来表示したくなったら `Exclude<>` から外し `STATS_KEY_COVERAGE` に追記する（型が要求してくる）。除外理由は「何かの数値と同じ」というオーナーの指摘のみで、**同値の相手は特定できていない**

---

## 8. 受け入れ条件

検収担当は上から順に1項目ずつ実行する。**各項目は「実行手順」と「合格の見え方」を持つ。**

### 8.1 全52指標が漏れなく表示される（Issue 完了条件1）

**完了条件の数は「53」から「52」に訂正されている**（R-12・2026-09-07 オーナー指示。`立直好型` を `roundCount` / `recentBigLoss` と同じ「表示に値しないキー」として除外したため。§1.1）。**検収担当は Issue 本文の「53」ではなく本節の「52」で判定すること。**

- [ ] **A1-1** `STATS_KEY_COVERAGE` が `Record<StatsKey, StatSectionId>` として型注釈されており、`npm run build` が通ること。
  実行: `npm run build` → 型エラー0
- [ ] **A1-2** **red 確認（型）**: `STATS_KEY_COVERAGE` から任意の1キー（例 `振听立直率`）を削除すると `npm run build` が
  「Property '振听立直率' is missing」で落ちること。確認後に戻す
- [ ] **A1-3** 単体テスト: `STAT_SECTIONS` を走査して集めた `kind === 'metric'` の `statsKey` が
  **ちょうど52件・重複なし**で、`Object.keys(STATS_KEY_COVERAGE)` と集合として一致すること。
  かつ `立直好型` が**どこにも現れない**こと（`STAT_SECTIONS` 走査結果・`STATS_KEY_COVERAGE` のキーの双方）
  実行: `npm test -- statsMetrics` → 合格
- [ ] **A1-4** 単体テスト: 各 `statsKey` の所属セクションが `STATS_KEY_COVERAGE` の値と一致すること
- [ ] **A1-5** **red 確認（テスト）**: `STAT_SECTIONS` の `luck` セクションから `流满` の行を削除すると A1-3 が
  「52 !== 51」で落ちること。確認後に戻す
- [ ] **A1-6** 実画面での件数。dev サーバーで `#/__stats` を開き
  `document.querySelectorAll('.stats-section .stats-row').length` を数える。
  → 4 + 7 + 8 + 6 + 5 + 16 + 3 + 9 + 12 = **70**（四麻）。三麻は順位分布が3行になるので **69**
- [ ] **A1-7'** セクション別の行数。実行:
  `[...document.querySelectorAll('.stats-section')].map(s=>[s.dataset.section, s.querySelectorAll('.stats-row').length])`
  → `[['rank',4],['overall1',7],['overall2',8],['efficiency',6],['growth',5],['riichi',16],['call',3],['distribution',9],['luck',12]]`
  （`riichi` が **16**。17 なら `立直好型` が混入している）
- [ ] **A1-8** **CLI 準拠の配置**（R-7）。単体テストで
  `STATS_KEY_COVERAGE['立直率'] === 'riichi'` かつ `STATS_KEY_COVERAGE['副露率'] === 'overall2'`、
  `STATS_KEY_COVERAGE['一发率'] === 'riichi'`、`STATS_KEY_COVERAGE['平均起手向听'] === 'luck'`、
  `STATS_KEY_COVERAGE['平均打点'] === 'efficiency'` であること
- [ ] **A1-7** セクションが9個・Issue の順序どおりであること。実行:
  `[...document.querySelectorAll('.stats-section')].map(s=>s.dataset.section)` →
  `['rank','overall1','overall2','efficiency','growth','riichi','call','distribution','luck']`
- [ ] **A1-9** **`立直好型` が除外されていること**（R-12）。実行:
  1. `grep -rn "立直好型" src/stats/` → **`立直好型2` の行だけがヒットし、`立直好型` 単独のヒットが 0 件**
     （`grep -rn "立直好型[^2]" src/stats/` → 0件 で確認する）
  2. 実画面 `#/__stats` で `document.querySelectorAll('[data-section="riichi"] .stats-row').length` → **16**
  3. `[...document.querySelectorAll('[data-section="riichi"] .stats-row__label')].map(e=>e.textContent).filter(t=>t.includes('旧定義')).length` → **0**
- [ ] **A1-10** **red 確認（除外が型で守られていること）**: `STATS_KEY_COVERAGE` に `立直好型: 'riichi'` を書き足すと
  `npm run build` が「Object literal may only specify known properties」等で落ちること。確認後に戻す

### 8.2 分母注記がツールチップでアクセスできる（Issue 完了条件2・R-8 で文言変更）

**完了条件の文言は「分母注記が各指標に常時表示される」から「分母注記がツールチップ等でアクセス可能である」に変更されている**（要件 §4.3・2026-09-07 オーナー判断）。旧 A2-3（常時表示であること）は**削除**した。

**R-14（2026-09-07 統括担当判断）により、`note` は空文字を許容する。空の行は吹き出し要素を出さない。**以下の条件はその方針に従う。

> [!NOTE]
> **2026-09-07 UI調整で上書き**:
> - **トリガーを info アイコンに限定**: A2-4, A2-5, A2-6 のフォーカス/hover 対象はラベル全体ではなく、注記がある行にのみ配置される `.stats-row__info-btn`（Material Icon `info`）に変更。ホバー時のマウスカーソルは `help` とする。PC では hover / focus-visible で表示し、タッチ端末ではタップ（クリック）で表示・非表示をトグルする（`data-tip-open="true"` / `aria-expanded`）。外側タップで閉じる。
> - **表形式2セクションの注記削除**: `rank`（順位分布）および `distribution`（和銃分布）は表形式化により情報がセルに揃うため、注記（ツールチップ）は対象外（`note = ''`）とし、info アイコンおよび吹き出し要素は生成しない。ツールチップが有効なのは残り7セクションのみとなる。

- [ ] **A2-1** 単体テスト: `STAT_SECTIONS` の全行（導出行・成長指標行を含む）の `note` が
  **前後に空白を含まないこと**（`note === note.trim()`）。**空文字は許容する。**
  加えて、**§2.2 の「注記」列が `-` 以外の行では `note` が空でないこと**を、
  §2.2 由来の期待値表（テスト内にリテラルで持つ）と突き合わせて検証すること
- [ ] **A2-2** 実画面: **注記がある行にのみ吹き出し要素がある**こと。実行:
  ```js
  const rows=[...document.querySelectorAll('.stats-row')];
  ({
    // 注記ありなのに吹き出しが無い / 中身が空
    missing: rows.filter(r => r.dataset.hasNote==='true'
      && !r.querySelector('.stats-row__tip')?.textContent?.trim()).length,
    // 注記なしなのに吹き出し要素が存在する
    extra: rows.filter(r => r.dataset.hasNote==='false' && r.querySelector('.stats-row__tip')).length,
    withNote: rows.filter(r => r.dataset.hasNote==='true').length,
  })
  ```
  → `missing: 0` かつ `extra: 0` かつ `withNote` が 1 以上（§2.2 の「注記」列が `-` でない行数と一致）
- [ ] **A2-3** **既定では見えないこと**。実行:
  ```js
  const t=document.querySelector('.stats-row__tip');
  const cs=getComputedStyle(t);
  ({vis: cs.visibility, op: cs.opacity, disp: cs.display})
  ```
  → `visibility: 'hidden'` かつ `opacity: '0'` かつ **`display` が `'none'` でない**
  （`display:none` にすると `aria-describedby` の読み上げが失われる）
- [ ] **A2-4** **hover で見えること**。実行: `.stats-row` の1つに `dispatchEvent(new MouseEvent('mouseover'))` ではなく
  ブラウザの `computer` ツールで実際にホバーし、`getComputedStyle(tip).visibility === 'visible'` になること。
  （CSS `:hover` は合成イベントでは発火しない）
- [ ] **A2-5** **キーボードでアクセスできること**。実行: `#/__stats` で最初の
  `.stats-row[data-has-note="true"] .stats-row__label` に `.focus()` を呼び、
  その行の `.stats-row__tip` が `visibility: visible` になること。
  加えて `document.querySelectorAll('.stats-row__label[tabindex="0"]').length` が
  **A2-2 の `withNote` と一致**すること（＝注記の無い行はフォーカス対象にしないこと・R-14）
- [ ] **A2-6** **アクセシビリティ関連付け**。実行:
  ```js
  const rows=[...document.querySelectorAll('.stats-row')];
  ({
    ok: rows.filter(r => r.dataset.hasNote==='true').every(r => {
      const id = r.querySelector('.stats-row__label')?.getAttribute('aria-describedby');
      return !!id && r.querySelector(`#${CSS.escape(id)}`)?.getAttribute('role') === 'tooltip';
    }),
    // 注記なしの行に aria-describedby が残っていないこと（R-14）
    stray: rows.filter(r => r.dataset.hasNote==='false'
      && r.querySelector('.stats-row__label')?.hasAttribute('aria-describedby')).length,
    ids: new Set([...document.querySelectorAll('[id^="tip-"]')].map(e=>e.id)).size,
  })
  ```
  → `ok: true` かつ `stray: 0` かつ `ids` が A2-2 の `withNote` と一致（id 重複なし・宙に浮いた `aria-describedby` なし）
- [ ] **A2-7** **リスト構造が壊れていないこと**（§1.3 のラップの副作用）。ブラウザペインの
  `read_page`（アクセシビリティツリー）で `list` / `listitem` のロールが読めること。
  読めない場合は**欠陥として報告**し、`.stats-row` に `role="presentation"` を足す案を検討する
- [ ] **A2-8** 要件 §8 の明示例が CLI 準拠の原文どおりであること。実行: dev 画面で
  ```js
  ['tsumoRate','damatenRate','drawTenpaiRate','riichiGoodShape2'].map(k=>{
    const r=document.querySelector(`[data-row="${k}"]`);
    return [k, r.querySelector('.stats-row__label').textContent, r.querySelector('.stats-row__tip').textContent];
  })
  ```
  → `ツモ率 / 和了回数比`、`闇聴率 / 和了回数比`、`流局聴牌率 / 流局回数比`、
  **`立直良形率 / 宣言時に待ちが自分から見て6枚以上`**（「立直良形率2」ではない・§2.3 Q6）
- [ ] **A2-9** CLI 実物準拠のラベル訂正が反映されていること。単体テストで
  `最大累计番数` → `最大合計飜数`、`平均被炸点数` → `痛い親かぶり平均`、`立直多面` → `立直多面率`、
  `平均起手向听` → `配牌平均向聴`、`立直后和牌率` → `立直成功率`、`被追率` → `立直後追っかけられ率`
- [ ] **A2-10** CLI が明記していた分母注記が原文どおりであること。単体テストで
  `立直收支` → `立直後の収支(供託含む) / 立直回数`、
  `立直收入` → `立直和了収入(供託含む) / 立直後の和了回数`、
  `立直支出` → `立直後の放銃支出(供託含む) / 立直後の放銃回数`、
  `振听立直率` → `立直後の見逃しは含まない`、`立直多面` → `2面待ち以上`
- [ ] **A2-11** 立直統計セクションに CLI の警告注記が1行出ていること。実行:
  `document.querySelector('[data-section="riichi"] .stats-section__note').textContent` に
  「立直収入と立直支出の差とは必ずしも一致しない」が含まれること
- [ ] **A2-12** 既存カードとのラベル一致（表記ゆれ防止）。実行:
  `npm test -- statsMetrics` に「`STAT_SECTIONS` の `和牌率`/`放铳率`/`副露率`/`平均打点`/`平均铳点` のラベルが
  `KEY_STAT_METRICS` の同 `statsKey` のラベルと文字列一致する」テストがあり合格すること。
  同様に `自摸率`/`默听率`/`打点效率`/`铳点损失`/`净打点效率`/`和了巡数`/`里宝率`/`一发率` が
  `COMPARE_METRICS` と一致すること。**`立直率` は `KEY_STAT_METRICS` と同じ文字列だが所属セクションは `riichi`**（R-7）
- [ ] **A2-13** **red 確認**: `STAT_SECTIONS` の `和牌率` のラベルを `'アガリ率'` に変えると A2-12 が落ちる。確認後に戻す
- [ ] **A2-14** 未確定項目のフラグ。実行: `grep -c "tentative: true" src/stats/statsMetrics.ts` → **1**
  （`被炸率` のみ。`一发率` / `里宝率` / `追立率` / `被追率` の分母は 2026-09-07 の実データ4サンプル逆算で
  確定したため `tentative` を外した・§2.3 / §1.7.1。`立直好型` は R-12 で除外されたので含まない）
- [ ] **A2-15** **分母が実測で確定した4キーの注記が正しいこと**（§2.3 Q11・Q12・Q16）。単体テストで
  `一发率` → `一発回数 / 立直和了回数`、`里宝率` → **`裏ドラのある和了回数 / 立直和了回数`**（「立直回数」ではない）、
  `追立率` → `追っかけ立直をした回数 / 立直回数`、`被追率` → `他家に追いかけ立直された回数 / 立直回数`

### 8.3 成長指標が #4 の計算と一致する（Issue 完了条件3）

- [ ] **A3-1** `buildGrowthView` が `expectedPointPerGame` を**呼び出している**こと（独自に順位点表を再実装していないこと）。
  実行: `grep -n "expectedPointPerGame\|calculateDeltaPoint\|rankDeltaPoints" src/stats/growthView.ts` →
  `expectedPointPerGame` の import と呼び出しだけが出る。
  `grep -rniE "15|配給原点|25000|35000" src/stats/growthView.ts` に順位点・配給原点の再実装が無いこと
- [ ] **A3-2** 単体テスト: `src/domain/__fixtures__/player_stats_4p.json` を入力に、
  テスト内で直接呼んだ `expectedPointPerGame(rankRates, rankAvgScores, preferredMode(effLevelId), effLevel)` と
  `buildGrowthView(...).expectedPoint` が `toBeCloseTo(…, 10)` で一致すること
- [ ] **A3-3** 単体テスト: `gamesToBoundary` 行。
  期待値 > 0 のとき ラベルが `昇段まで` で値が `gamesToPromotion` の戻り値 + `戦`、
  期待値 < 0 のとき ラベルが `降段まで` で値が `gamesToDemotion` の戻り値 + `戦`、
  `null` のとき値が `—`
- [ ] **A3-4** 単体テスト: `projection50` が `projectAfterGames(eff, delta, 50)` の結果と一致し、
  表示が `{段位タグ} {formatAdjustedScore}` 形式であること（段位Ptは小数点以下四捨五入）。**`PROJECTION_GAMES` が 50**
- [ ] **A3-5** 単体テスト: `estimateStableLevel2` に渡す `StableLevelInput` が
  **`identity.level` の生の `id`/`score`/`delta`** であること（`effectiveLevelPoint` を通していないこと）。
  実行: `estimateStableLevel2` をスパイして引数を検証するテスト、または
  `score+delta` が上限を超える入力で「二重正規化していれば1段ズレる」ケースを検算表で固定する
- [ ] **A3-6** `StableLevel` 4種の表示。単体テストで
  `{kind:'number', value: 4.07}` → `雀聖1.07`、
  `{kind:'level', levelId:10503, bound:'plus'}` → `雀聖3+`、
  `{kind:'konten', levelId:10701}` → `魂天+`、
  `{kind:'unavailable'}` → `—`
- [ ] **A3-7** **例外を投げないこと**（§3.4）。単体テストで
  `rankRates` が長さ3・`numPlayers` が4 の不整合入力、`rankRates` に `NaN` を含む入力、
  `preferredMode` が `null` を返す入力（存在しない levelId）を与えて、
  **throw せず** 全行 `—` の `GrowthView` が返ること
- [ ] **A3-8** **red 確認**: §3.4 のガード3（長さ一致チェック）を削除すると A3-7 が
  「`points: array length 3 does not match mode 16's player count 4`」で落ちること。確認後に戻す
- [ ] **A3-9** 基準卓の注記（§3.5）。単体テストで
  `selectedModes: [16, 12]`（複数）→ `note` が非 null で `王座` を含む、
  `selectedModes: [16]` かつ基準卓が 16 → `note === null`、
  `selectedModes: [12]` かつ基準卓が 16 → `note` が非 null
- [ ] **A3-11** `最高段位` 行（R-11）。単体テストで `maxLevel: {id: 10503, score: 0, delta: 0}` を渡すと
  値が `getLevelTagFromId(10503)` と一致し、`maxLevel: null` のとき `—` になること。
  かつ実画面で `document.querySelectorAll('[data-section="growth"] .stats-row').length` → **5**
- [ ] **A3-12** `最高段位` が `PlayerStats.max_level` 由来であること（`identity` 由来でないこと）。実行:
  `grep -n "max_level" src/stats/` → `statsView.ts` または `StatsPanel.tsx` で `scope.stats.stats.max_level` を読んでいる
- [ ] **A3-10** 追加APIリクエスト0本（R-2 の副次効果）。実行:
  `grep -rn "useRepresentativeMode\|getPlayerStats\|getPlayerExtendedStats\|getGlobalHistogram\|getLevelStatistics" src/stats/` → **0件**

### 8.4 値の丸め・単位が適切（Issue 完了条件4）

- [ ] **A4-1** 単体テスト: `formatStatValue` が
  `(0.36542, 'rate')` → `36.5%`、
  `(5312.4, 'point')` → `5,312`、
  `(-1234, 'point')` → `−1,234`（**U+2212**。ASCII ハイフンでないこと。`'−'` で検査）、
  `(9.87, 'turn')` → `9.87巡`、
  `(3, 'count', '回')` → `3回`、
  `(12, 'count', '連荘')` → `12連荘`、
  `(3.21, 'shanten')` → `3.21`、
  `(undefined, 'rate')` → `—`、`(NaN, 'point')` → `—`
- [ ] **A4-2** `formatStatValue` が `'rate'`/`'point'`/`'turn'` を `formatMetricValue` に委譲していること。
  実行: `grep -n "formatMetricValue" src/stats/statsView.ts` → import と呼び出しがある。
  かつ `grep -nE "toFixed\(1\)|Math.round\(.*1000\)" src/stats/statsView.ts` → **0件**（丸めの再実装が無い）
- [ ] **A4-3** **red 確認**: `formatMetricValue` の `'rate'` 分岐を `toFixed(2)` に変えると A4-1 の rate ケースが落ちる。
  確認後に戻す（compare 側のテストも落ちるのが正常）
- [ ] **A4-4** 実データでの目視。`#/__stats` で率が全て `%` 1桁、点が全てカンマ区切り整数、巡目が `x.xx巡` であること

### 8.5 欠落キーの扱い（R-5）

- [ ] **A5-1** 単体テスト: `平均起手向听亲` / `平均起手向听子` を持たない `PlayerExtendedStats` を渡すと
  該当2行の `valueText` が `—` になり、**行そのものは消えない**こと
- [ ] **A5-2** 単体テスト: 型上は必須の率キー（例 `流听率`）を実行時に削除した入力でも throw せず `—` になること
  （`delete (obj as Record<string, unknown>).流听率` で作る）
- [ ] **A5-3** 追加の `?? 0` を入れていないこと。実行: `git diff src/api/normalize.ts` が**空**であること
- [ ] **A5-4** 回数系6キーが欠落した入力で該当行が `0回` と表示されること（normalize の既存補完が効いている証拠）

### 8.6 順位分布セクション（R-3）

> [!NOTE]
> **2026-09-07 UI調整で上書き**:
> - **表形式化**: 順位分布セクションはリスト形式から `| 順位 | 回数 | 割合 | 平均点数 |` の表形式に変更。
> - **注記の削除**: 回数・割合・平均点数がすべて表のセルに出そろうため、ツールチップ（注記）は不要（削除・A6-5のツールチップ検証は表内セル検証に移行）。
> - **行数**: 四麻で4行（1位〜4位）、三麻で3行（1位〜3位）の table row となる。

- [ ] **A6-1** `buildRankView` を再利用していること。実行:
  `grep -n "buildRankView" src/stats/statsView.ts` → import と呼び出しがある。
  `grep -rn "avg_rank\|negative_rate\|lastPlaceRate\|averageScore" src/stats/` → **0件**
  （順位系の計算を再実装していない）。
  **`rentaiRate` はこのリストから外れた**（R-10 により `last` 行が `1 - rentaiRate(...)` を直接呼ぶため。A6-9 で別途検査する）
- [ ] **A6-2** ドーナツを描いていないこと。実行: `grep -rn "Donut\|<svg" src/stats/` → **0件**
- [ ] **A6-3** 順位分布は四麻で4行・三麻で3行、総合成績1 は常に7行であること（CLI の章立て・§2.1）。
  実行: `#/__stats` の四麻/三麻それぞれで
  `document.querySelectorAll('[data-section="rank"] .stats-row').length` → 4 / 3、
  `document.querySelectorAll('[data-section="overall1"] .stats-row').length` → 7 / 7
- [ ] **A6-5** 順位行の注記に回数と順位別平均点が入っていること。実行:
  `document.querySelector('[data-row="rank1"] .stats-row__tip').textContent` が
  `11回・平均 26,300点` の形（`{n}回・平均 {点}点`）であること
- [ ] **A6-6** **四麻の `last` 行が「逆連対率」であること**（R-10・2026-09-07 オーナー指示。旧 A6-6「ラス率＝最下位率」は撤回）。単体テストで
  `rank_rates=[0.25,0.25,0.3,0.2]` / `numPlayers: 4` のとき
  - `last` 行のラベルが **`逆連対率`**
  - `last` 行の値が **`50.0%`**（＝`1 − (0.25+0.25)` = 3位率+4位率）であり、**`20.0%`（最下位率）ではない**こと
- [ ] **A6-7** **三麻の `last` 行が「ラス率」ラベルで、値は同じ式であること**。単体テストで
  `rank_rates=[0.4,0.35,0.25]` / `numPlayers: 3` のとき
  ラベルが **`ラス率`**、値が **`25.0%`**（`1 − (0.4+0.35)`。三麻では最下位率と一致する）
- [ ] **A6-8** **`lastPlaceRate` を本タブで使っていないこと**。実行:
  `grep -rn "lastPlaceRate" src/stats/` → **0件**。
  かつ `grep -rn "tiles.last\|'last'" src/stats/statsView.ts` に `buildRankView` の `tiles.last` を読む記述が無いこと
  （`key: 'last'` という行識別子の定義はあってよい）
- [ ] **A6-9** **`rentaiRate` を再実装していないこと**。実行:
  `grep -n "rentaiRate" src/stats/statsView.ts` → `../domain`（または `../domain/derived`）からの import と呼び出しがある。
  かつ `grep -nE "rankRates\[0\] *\+ *rankRates\[1\]|rates\[0\] *\+ *rates\[1\]" src/stats/` → **0件**
- [ ] **A6-10** **red 確認**: `statsView.ts` の `1 - rentaiRate(rates)` を `lastPlaceRate(rates)` に差し替えると
  A6-6 が「`20.0%` !== `50.0%`」で落ちること。確認後に戻す
- [ ] **A6-11** **サマリーカード2を変更していないこと**（R-10・§7-8）。実行:
  `git diff --stat src/summary/` → **空**。`grep -n "lastPlaceRate" src/summary/rankView.ts` → 従来どおり1件残っている。
  実画面で同一プレイヤー・四麻・同一フィルタのとき、**サマリータブのカード2の「ラス率」とスタッツタブの「逆連対率」は
  値が異なる**（前者が 4位率、後者が 3位+4位率）。**これは意図した一時的な不整合であり欠陥ではない**（別 Issue で統一予定）
- [ ] **A6-4** 順位行の値がカード2と一致すること。実行: 同一プレイヤー・同一フィルタで
  サマリータブのカード2の「1位 20.4%」とスタッツタブの `[data-row="rank1"]` 行の値が**文字列として一致**すること

### 8.9 和銃分布セクションの回数・割合併記（R-13）

> [!NOTE]
> **2026-09-07 UI調整および実データで上書き・訂正**:
> - **3つの小表形式化**: 「和了時の状態」「放銃時の状態」「放銃相手の状態」の3つの小表（各 `| 状態 | 回数 | 割合 |`）に変更。
> - **回数列と割合列の分離**: 和了時3行および放銃相手3行は実測回数（「約」なし）、放銃時3行のみ概算回数（「約」表記をセル内に維持）。
> - **注記の削除**: 表内に回数と割合が独立して表示されるため、ツールチップ経由の注記（A9-9）は不要（削除）。
> - **放銃相手3行の実測値化**: `放铳至*` 3キーが生カウントであることが判明したため、実測値（「約」なし）として扱う。
> - **状態ラベルの簡潔化**: 表見出しとの重複を解消するため、「和了時 立直」等のプレフィックスを除去し「立直」「副露」「闇聴」「門前」と表示する。

- [ ] **A9-1** 単体テスト: `formatDistributionValue` が §4.3 の5ケース表どおりであること。
  `{count:21, rate:0.362, approximate:false}` → `21回 / 36.2%`、
  `{count:12, rate:0.265, approximate:true}` → `約12回 / 26.5%`、
  `{count:null, rate:0.265, approximate:true}` → `— / 26.5%`、
  `{count:0, rate:null, approximate:false}` → `0回 / —`、
  `{count:null, rate:null, approximate:true}` → `—`
- [ ] **A9-2** **概算と実測が見た目で区別されていること**（R-13 の必須要件）。実行: `#/__stats` で
  ```js
  [...document.querySelectorAll('[data-section="distribution"] .stats-row')]
    .map(r => [r.dataset.row, r.querySelector('.stats-row__value').textContent])
  ```
  → 9件。うち `winStateRiichi` / `winStateCall` / `winStateDamaten` および
  `dealInTargetRiichi` / `dealInTargetCall` / `dealInTargetDamaten` の計6件は **「約」を含まない**、
  放銃時3件（`dealInState*` 3件）のみ**すべて「約」で始まる回数**を含むこと
  （回数が `—` の場合を除く。その場合は A9-5 で扱う）
- [ ] **A9-3** 単体テスト: 和了時の回数が **API 生カウントそのまま**であること。
  `src/api/testdata/player_extended_stats.json`（`立直和了: 21` / `副露和了: 29` / `默听和了: 8`）を入力に
  3行の回数部が `21回` / `29回` / `8回`、割合部が `21/58` `29/58` `8/58` の1桁 % 表示であること。
  **このフィクスチャで `和牌率 × count`（= 88）と `W`（= 58）の一致を検査してはならない。**
  フィクスチャは内部整合していないことが判明している（§1.7.4）。実データでは両者は一致する（§1.7.2）
- [ ] **A9-4** 単体テスト: 概算回数が `round(放铳率 × roundCount × 各率)` であること。
  `放铳率 = 0.13`・`roundCount = 400` → `D = 52`。`放铳时立直率 = 0.1538` のとき回数部が **`約8回`**
  （`Math.round(52 * 0.1538) = 8`）。テストは `D` と期待値をテスト内で明示的に計算して固定する
- [ ] **A9-5** 単体テスト: `放铳率` が `0` / `undefined` / `NaN` のいずれかのとき、
  概算3行（放銃時）が `— / {割合}` になり **回数を捏造しないこと**。`roundCount` が欠落した場合も同じ
- [ ] **A9-6** **CLI の流用バグを模倣していないこと**（§1.7）。放銃相手の合計 `totalDealIn` を放銃時（`dealInState`）の母数として流用していないこと。
- [ ] **A9-7** 単体テスト: 概算回数の母数が `放铳率 × roundCount` であること。
  `grep -n "放铳率" src/stats/statsView.ts` → 概算母数の算出箇所でヒットすること。
  かつ `放铳率` を 2 倍にしたテスト入力で放銃時3行の回数がすべて約2倍になること（母数依存の証明）
- [ ] **A9-8** **red 確認**: 概算母数を `放铳率 × roundCount` から `roundCount` だけに変えると A9-4 が落ちること。確認後に戻す
- [ ] **A9-9** 全9行の注記（ツールチップ）が**母数の性質を正しく説明している**こと。実行:
  ```js
  [...document.querySelectorAll('[data-section="distribution"] .stats-row')]
    .map(r => [r.dataset.row, r.dataset.hasNote, r.querySelector('.stats-row__tip')?.textContent])
  ```
  → 9件すべて `data-has-note === 'true'`（このセクションは R-14 の空注記を使わない）。かつ
  - 和了時3行の注記に `実測値` が含まれる
  - 放銃時3行・放銃相手3行の注記に `放銃率 × 局数` が含まれる
  - **放銃相手3行の注記にだけ `ダブロン` が含まれ、放銃時3行の注記には含まれない**（§1.7.3-2 / §2.2-8）。
    放銃時と放銃相手で注記文が同一でないこと
- [ ] **A9-11** **`D` を放銃相手の母数として補正していないこと**。実行:
  `grep -nE "1\.0[0-9]|補正|credit|クレジット数 *[*×]" src/stats/statsView.ts` に、
  `D` へ係数を掛ける実装が無いこと。クレジット数は API から得られないため**推定係数を捏造しない**（§1.7.6）
- [ ] **A9-10** 行数が9のまま増えていないこと。実行:
  `document.querySelectorAll('[data-section="distribution"] .stats-row').length` → **9**
  （回数を出すために導出行を増やしていないこと・§4.3）

### 8.7 UI・テーマ・バンドル

- [ ] **A7-1** 生タグを書いていないこと。実行: `grep -rn "<md-" src/stats/` → **0件**。
  `grep -n "from '../components/md'" src/stats/StatsSection.tsx` → 1件
- [ ] **A7-2** 副作用のためだけの bare import が無いこと。実行:
  `grep -rnE "^import '[^']+'" src/stats/` → `'./stats.css'` **のみ**
- [ ] **A7-3** 色のハードコードが無いこと。実行:
  `grep -rniE "#[0-9a-f]{3,8}|rgb\(|hsl\(" src/stats/stats.css` → **0件**
- [ ] **A7-4** 値テキストがラベルと同等の大きさで読めること（§1.3 の既定値上書きが効いている証拠）。実行: ブラウザで
  ```js
  const r=document.querySelector('.stats-row');
  const v=parseFloat(getComputedStyle(r.querySelector('.stats-row__value')).fontSize);
  const l=parseFloat(getComputedStyle(r.querySelector('.stats-row__label')).fontSize);
  ({v,l})
  ```
  → **`v >= 14`**（既定のままなら 11px になる）
- [ ] **A7-8** ツールチップがクリップされていないこと（§1.3 の実物調査への回帰テスト）。実行: 最初の行にホバーし
  ```js
  const r=document.querySelector('.stats-row');
  const t=r.querySelector('.stats-row__tip').getBoundingClientRect();
  const li=r.querySelector('md-list-item').getBoundingClientRect();
  ({tipBottom: t.bottom, rowBottom: li.bottom, visible: t.height > 0 && t.width > 0})
  ```
  → 吹き出しが**行の下端より下にはみ出して**表示され、幅・高さが 0 でないこと。
  （`md-list-item` のスロット内に置いた実装だとここで height が 0 になるか行内に収まる）
- [ ] **A7-9** ツールチップの配色がテーマトークン由来であること。実行:
  `grep -n "inverse-surface\|inverse-on-surface" src/stats/stats.css` → 2件以上。A7-3（色ハードコード0件）も併せて通ること
- [ ] **A7-5** light / dark 双方で全行が読めること。`localStorage['mjsv:color-mode']` を切り替えてリロードして確認する
  （`prefers-color-scheme` のエミュレーションは `matchMedia` の change を発火しない — CLAUDE.md 既知の制約）
- [ ] **A7-6** バンドル増分が §1.5 の実測値からの乖離が **gzip で +2 kB 以内**であること。実行:
  `npm run build` の gzip 値が **149.7 kB 以下**（ツールチップは CSS + 1要素/行で新規依存が無く、§1.6 のとおり増分は §1.5 の実測から動かない）（baseline 143.42 + 実測 3.11 + 余裕 2.0 + 本 Issue のロジック分。
  超えた場合は超過分の内訳を報告してから判断を仰ぐ）
- [ ] **A7-7** dev ルートが本番に混入していないこと。実行:
  `npm run build && grep -c "__stats" dist/assets/*.js` → dist 側の JS に `StatsGallery` の実体が含まれないこと
  （`import.meta.env.DEV` のリテラル分岐の内側に動的 `import()` を直書きする形になっていること。CLAUDE.md §4）

### 8.8 リグレッション

- [ ] **A8-1** `npm run build` が型エラー0、`npm run lint` が0件、`npm test` が全件合格
- [ ] **A8-2** 既存タブ（サマリー・比較）の表示が変わっていないこと。実行:
  `git diff --stat` の対象が `src/stats/**` `src/dev/StatsGallery.tsx` `src/main.tsx` `src/shell/AppRouter.tsx`
  `docs/design/issue-14-stats-tab.md` に限られること（`src/summary/**` `src/compare/**` `src/api/**` `src/domain/**` に差分が無いこと）
- [ ] **A8-3** **対照実験**（ミューテーション判定の前提確認）: `statsView.ts` の変数名を1つ変えるなど
  **意味を変えないダミー改変**を入れて `npm test` が全件合格（SURVIVED）することを先に確かめる。
  これが KILLED になるならテストが実装の内部表現に結合しすぎているので報告する

---

## 9. 実挙動を確認できなかった箇所（明記）

1. **§2.3 の未確定5項目**（`被炸率` / `一发率` / `里宝率` の分母、`立直好型`（2なし）の定義、`追立率` / `被追率` の分母）。**CLI 版ツールの実物にも記載が無い。**本家 `ja.json` は未参照
2. **`打点效率` / `铳点损失` / `净打点效率` の API 生値が、CLI の計算式（`平均打点 × 和了率` 等）と数値的に一致するか**。CLI は API 値を使わず自前計算しており、両者の一致は未検証。mj のフィクスチャは合成値のため数値照合ができない。**本 Issue は API 生値をそのまま出す**（§2.2-4 の設計判断）ので、注記の「〜に相当」が誤りである可能性が残る
3. **`立直收支` / `立直收入` / `立直支出` の注記は CLI の文言をそのまま採ったもの**で、API 側の定義と一致するかは未検証（CLI も API 生値をそのまま出しているため、CLI 作者の理解に依存する）
4. **`流听率` など率キーが母数ゼロで省略されるか**。issue-3 §1.3 差分8 は回数系6キーの省略を実測しているが、率キーについては未確認。本設計はどちらでも壊れない形（`—` フォールバック）にしてある
5. **`最大连庄` の単位**。CLI が「連荘」表記なのでそれに従うが、値が「連荘回数」か「連続和了回数」かは未確認
6. **A1-6 の行数 70 / 69**。§2.2 の件数から算出した設計値であり、実画面での実測ではない（実装前のため）
7. **`<span slot="headline" tabindex="0">` がスロット中継後もフォーカス可能か**（§5.1-5）。light DOM の要素なので理屈上は可能だが、`md-list-item` 内での実挙動は未検証。A2-5 で検証する
8. **モバイル（タップ）でツールチップが開くか**。`tabindex` 付き要素はタップでフォーカスを受けるはずだが、**iOS Safari では未検証**。Claude Code のブラウザペインではタッチ操作を再現できないため、`docs/ui-verification/` への逆発注を検討すること（統括担当の判断事項）
9. **`.stats-row` によるラップが `role=list` / `listitem` のアクセシビリティツリーに与える影響**（§1.3 末尾・A2-7 で検証）
10. **`md-list` を70行並べたときの描画性能**。`type='text'` でリップル・フォーカスリングが生成されないことは実物のコードで確認したが、実機のフレーム時間は未計測
11. **和銃分布の母数（R-13）は 2026-09-07 に実データ4サンプルで検証済み**（§1.7）。ただし残る未確認は次のとおり:
    - 検証に使ったのは**先行 CLI 版ツールが生成した出力 Markdown 4本**（三麻2・四麻2）であり、**API を直接叩いた生 JSON ではない**。CLI の出力は率を小数第2位 % に丸めているため、母数は逆算値である（3値の整数和が母数に一致する候補だけを採ったので一意性は高いが、原理的には整数倍の曖昧さが残る。§1.7.2 の表はその最小候補を採っている）
    - 放銃相手の母数がクレジット数（(discard, 和了者) のペア数）であるという解釈は、**「母数が D より 0.8〜5.3% 大きい」という実測と「3値の合計がちょうど 1.0000」という性質の両方を最も自然に説明する仮説**であって、amae-koromo のソースコードで確認したものではない。**本家実装は未確認。**`docs/amae-koromo-api-spec.md` にも CLI 版ツールにも、ダブロン・トリロン・放銃回数の数え方に関する記載は**一切ない**（`grep` 済み）
    - 超過率のサンプルは4件しかない。**他のプレイヤー・他の期間で 5.3% を超える可能性は否定できない**
    - この不確かさへの対処は「約」表記と注記（§2.2-8）であり、**精度そのものは保証しない**
14. **`被炸率`（痛い親かぶり率）の分母**。§1.7.1 の4サンプルに対し「局数」「和了回数」「立直回数」「立直和了回数」「親番局数（局数 ÷ 人数）」のいずれを分母としても整数にならなかった。CLI にも本家仕様書にも記載がない。**唯一残る `tentative: true`**（A2-14）
15. **`src/api/testdata/player_extended_stats.json` が内部整合しない原因**（§1.7.4）。`count` が他キーと合わないのか、複数レスポンスが混ざっているのかは特定していない。**本 Issue ではフィクスチャに手を入れない**（api 層の担当範囲であり、#3 / #23 の受け入れ条件を壊しうるため）。統括担当への申し送り事項
12. **和銃分布の値テキストが他セクションより長い**（`約12回 / 26.5%`）。`trailing-supporting-text` は右端に置かれるため、狭い画面でラベルと衝突しうる。§5.2 の CSS は折り返しを指定していない。**実機での幅は未計測**。A9-2 の実行時に見た目の破綻がないか併せて確認し、破綻するなら `.stats-row__value { white-space: nowrap }` + ラベル側の `min-width: 0` を検討する（統括担当への報告事項）
13. **四麻の「逆連対率」がサマリーカード2の「ラス率」と値が食い違う**（R-10・§7-8）。オーナー了承済みの一時的な不整合。**別 Issue で統一されるまでの間、検収・レビューでこれを欠陥として報告しないこと**
