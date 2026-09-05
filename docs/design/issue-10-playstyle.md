# Issue #10 設計書 — サマリー・カード3「打ち筋」（レーダー＋傾向2軸）

- Issue: #10（`design` / `feature` / `needs-decision`、M3 サマリータブ）
- ブランチ: `feat/issue-10-playstyle`
- ベースライン: `95e25f4`（`npm run build` 実測 **486.76 kB / gzip 133.97 kB**）
- 依存: #4（`src/domain/radar.ts` / `tendency.ts`）・#6（グローバルフィルタ）・#9（`src/summary/` の流儀）
- 参照: [docs/requirements.md](../requirements.md) §6.1・§6.2 / [issue-4-domain-logic.md](issue-4-domain-logic.md) §5.2・§5.3・§9 / [issue-9-rank-donut.md](issue-9-rank-donut.md) §3.1・§3.4・§4.7
- 版: **第2版（2026-09-06 改訂）**。第1版からの変更点は §0.1

---

## 0.1 改訂履歴

### 第3版（2026-09-06・オーナー指示による微修正。検収通過後）

| # | 変更 | 理由 |
|---|---|---|
| R-4 | 傾向バーの極ラベル `守` / `攻` → **`守備` / `攻撃`** | オーナー指示。レーダーの軸ラベル（`RADAR_AXIS_ORDER` の1文字表記）とは別物で、バー側は1文字に詰める必要がないため語として読める形にする。**レーダーの軸ラベルは変えない** |
| R-5 | セグメント高さ **8px → 16px**（2倍）。`--tendency-row-height` を 28 → 36px、形状マーカーを 6 → 10px に連動 | オーナー指示。マーカーがセグメント枠内に収まること・R1 が維持されることを実測で確認済み（343px 476×3 / 700px 380×3、マーカー 10px ⊂ セグメント 16px） |
 — 第1版から何をなぜ変えたか（2026-09-06 オーナー確定）

第1版は「タイプ名見出し＋5段階ラベル文言をオーナーに確定してもらう（第1版 §6 の D1/D2）」「閾値 ±0.5/±1.5 は据え置く（§3.1 の案 A）」という構成だった。オーナーが2点を確定させたため、本版で全面的に反映した。

| # | 第1版 | 第2版（本版） | オーナーの理由 |
|---|---|---|---|
| **R-1** | タイプ名見出し（2軸から生成）を出す。第1版 §6.2 で9〜25通りの語彙を確定してもらう | **タイプ名を作らない。** 見出しごと削除 | 「2本のゲージを見せればこの人がどういう打ち手かは伝わるので、頑張って言葉を作り出す必要はない」 |
| **R-2** | 5段階バンドに呼称（鉄壁／守備寄り／…）を付ける。§6.1 で文言を確定してもらう | **バンド呼称も作らない。** ただし**軸の両端ラベル（守 ⇔ 攻 / 門前 ⇔ 速度）は残す** | 同上。両端ラベルが無いとゲージの向きが読めないため、そこだけ残す |
| **R-3** | 閾値 ±0.5/±1.5 を据え置く（§3.1 案 A）。「両端帯はめったに出ない＝出たら本物」という前提でラベル文言を選ぶ | **合成値を単位 SD に正規化して帯を校正する**（§3.1 新・案 a を採用） | 「ラベルがなくなった以上、5段階で打ち筋を表示するという設計を変えたら意味がわかりません」＝**帯そのものが唯一の表現手段**になったので、67.9% が中央1マスに乗る現状を放置できない |

**採らなかった案**: 統括担当が一度提案した「帯をやめて連続位置マーカーにする」。5段階表示という設計そのものを壊すため、オーナーが却下した。

**R-1/R-2 は Issue 本文のスコープ変更である。** Issue #10 本文のスコープ「タイプ名見出し」と完了条件「タイプ名が2軸から生成される」は、**オーナー判断により本 Issue の対象外**とする（Issue 本文は統括担当が更新する）。残る完了条件は「レーダーが5軸で描画され、値が #4 の計算と一致」「傾向バーが5段階で現在位置を示す」「係数・（校正の）決定が記録されている」の3件。

**R-3 に伴い、第1版の「`src/domain/**` を1行も変更しない」という前提は解除された。** 変更は `src/domain/tendency.ts` の合成の分母1箇所のみ（§3.1）。影響範囲は実物で確認済み（§3.1.3）。

---

## 0. スコープ

サマリータブ3枚目のカード「打ち筋」を作る。

- レーダーチャート5軸（攻・守・速・制・運）— `calcRadar` の値をそのまま描く
- 傾向バー2本（守 ⇔ 攻 / 門前 ⇔ 速度）— `calcTendency` の5段階バンドを描く。**両端に極ラベル、現在位置に形状マーカー**
- **傾向2軸の帯の校正** — `calcTendency` の合成値を単位 SD に正規化する（§3.1。`src/domain/tendency.ts` の1行と、そのテスト）
- 上記に必要な **`global_histogram`（母集団分布）の取得経路を新設する**（本 Issue が初）

**やらないこと**:

- **タイプ名見出し・5段階バンドの呼称を作らない**（§0.1 の R-1/R-2。オーナー確定によるスコープ変更）
- **レーダー側（`calcRadar`）の値には一切触らない。** 今回の校正は傾向2軸のみ
- セクション色4系統への依存（§3.6）／ヒストグラム表示（#13）／`recharts` の採用（§1.1）

**第1版にあった needs-decision（D0/D1/D2）はすべて解消済み。製造担当が判断すべき未確定事項は残っていない。**

---

## 1. 実物調査の結果

### 1.1 レーダーを `recharts` で描くコスト（実測。3回ビルド）

`src/summary/__probe.tsx` を一時作成し `SummaryPanel` から描画してビルドした（計測後に削除済み・`git status` クリーン）。

| 状態 | modules | raw | gzip | ベースライン差 |
|---|---|---|---|---|
| ベースライン（`95e25f4`） | 312 | 486.76 kB | 133.97 kB | — |
| A: `recharts` の `RadarChart` + `PolarGrid` + `PolarAngleAxis` + `PolarRadiusAxis` + `Radar` + `ResponsiveContainer` | **886** | **772.12 kB** | **219.04 kB** | **+285.36 kB / gzip +85.07 kB** |
| B: 自前 SVG レーダー（リング4本・スポーク5本・多角形・頂点ドット・軸ラベル・傾向バー2本の DOM 込み） | 313 | 488.58 kB | 134.55 kB | **+1.82 kB / gzip +0.58 kB** |
| C: B ＋ データ配線（`getGlobalHistogram` 取得フック・`createStatsLookup`・`calcRadar`・`calcTendency`・`toBand`） | 314 | 490.79 kB | 135.51 kB | **+4.03 kB / gzip +1.54 kB** |

**判断: `recharts` は本 Issue でも採用しない。** #9 のドーナツと同じく、モジュール数が 312 → 886 に膨らみツリーシェイクが効かない。**レーダーは #9 のドーナツと違う図形だが、実装コストは実測 B のとおり 60 行程度の SVG で足りる**（プローブは軸ラベル・頂点ドット・傾向バーまで含んだ形で +1.82 kB）。極座標変換は5点の `cos`/`sin` のみで、目盛ラベル・凡例・ツールチップといった `recharts` の価値が出る要素を本カードは持たない。

C − B = **+2.21 kB / gzip +0.96 kB** がドメイン層（`radar.ts` / `tendency.ts` / `distribution.ts`）と取得フックの純増である。これらは現状バンドルに1バイトも入っていない（#4 で作ったが未使用だった）。

### 1.2 ドメイン層は実装済み（実読）

`src/domain/radar.ts`（41行）・`src/domain/tendency.ts`（56行）を読んだ。**本 Issue では1行も変更しない。**

```ts
export function calcRadar(stats: RadarInput, lookup: (metric: string) => MetricDistribution | null): RadarAxes;
// RadarAxes = { 攻|守|速|制|運: number | null }
export function calcTendency(stats: TendencyInput, lookup): Tendency;
// Tendency = { offenseDefense: TendencyAxis; concealedSpeed: TendencyAxis }
// TendencyAxis = { value: number; band: 0|1|2|3|4 } | null
export function toBand(value: number): 0 | 1 | 2 | 3 | 4; // <-1.5 / <-0.5 / <0.5 / <1.5 / else
```

確認できた重要な性質:

- `RadarInput ∪ TendencyInput` は `PlayerExtendedStats` の **11 キー**（`打点效率` `铳点损失` `和牌率` `立直率` `里宝率` `一发率` `追立率` `放铳率` `默听率` `副露率` `和了巡数`）。**`PlayerStats` 側は使わない。**
- 各軸は分布が引けなければ **`null`** を返す。`運` は `里宝率`・`一发率` の**両方**が要る（片方でも欠けると `null`）。`守` は `100 − 偏差値(铳点损失)`。
- `calcTendency` の `offenseDefense` は `(z立直 + z追立 + z放铳 − z默听) / 4`、`concealedSpeed` は `(z副露 − z默听 − z和了巡数) / 3`。**有効な項だけの単純平均**なので、一部 metric が欠けても値は出る（項数が減る）。

### 1.3 母集団分布（`global_histogram`）は**アプリ内で1度も取得されていない**（実読）

`grep -rn "istogram" src` の結果、`getGlobalHistogram` は `src/api/endpoints.ts` に実装され `src/api/index.ts` から export されているが、**`src/filters` / `src/shell` / `src/summary` のどこからも呼ばれていない**。`PlayerScope`（`src/filters/playerScope.ts`）にも分布は載っていない。

> **これが本 Issue の最大の新規要素である。** カード3はレーダーも傾向も母集団分布なしには1つも値を出せない。取得経路の新設が必要（§3.2）。

実物から確認した制約:

- `getGlobalHistogram(numPlayers: NumPlayers): Promise<GlobalHistogram>` — **`AbortSignal` を受け取らない**（`getPlayerStats` 等と違う）。フックは `cancelled` フラグで自衛すること。中断は API 側に伝わらない。
- `apiGet` は `path` をキーに **Promise を module-level `Map` にキャッシュ**する（`src/api/client.ts:15,154`）。したがって同一セッション・同一 `numPlayers` なら**実 HTTP は1回**。フィルタ操作で再取得は発生しない。
- 返り値は `deepFreeze` 済み（`endpoints.ts:97`）。ビューで書き換えない。
- ペイロードは **約 380 KB**（`docs/amae-koromo-api-spec.md` §346 の実測記録）。1画面あたり数リクエストの方針には収まるが、**タブを開くたびに増やしてよい種類のものではない**。

### 1.4 `createStatsLookup` は**単一 `GameMode`** を要求する（実読）

```ts
createStatsLookup(gh: GlobalHistogram, mode: GameMode): (metric: string) => MetricDistribution | null
// 内部: gh[String(mode)]?.['0']?.[metric]?.histogramFull
```

一方グローバルフィルタの `filter.modes` は**複数選択**（`GlobalFilter.modes: readonly GameMode[]`、空にならない）。**「複数モードを選んだときどの分布と比べるか」を決める必要がある**（§3.3）。`src/filters/filterState.ts:134` に `selectRepresentativeMode(numPlayers, selected, gameCountByMode?)` が既にあり、`gameCountByMode` を省くと `allModes` 順（王座 > 玉 > 金、半荘 > 東風）の先頭を返す。

### 1.5 フィクスチャで確認した数値（Node で実行）

`src/domain/__fixtures__/global_histogram.json`（pl4 / mode `"16"` / band `"0"` / 11 metric、N = 999,998）と `extended_stats_4p.json` を読んで計算した。**このフィクスチャは #4 §7.4 のとおり `和牌率` 以外が合成値**である点に注意（分布の形は実データではない）。

**(a) レーダー5軸（フィクスチャのプレイヤー）**

```
攻=57.22  守=53.64  速=57.82  制=58.62  運=53.65
```

**(b) 軸ごとのスケールが揃っていない（重要）**

`攻`・`守`・`速`・`制` は偏差値なので母集団上で厳密に μ=50 / σ=10（p5≒33.5・p95≒66.5）。これに対し `運` は `50×(裏+一発)/(卓平均裏+卓平均一発)` という**比率指標**で、独立サンプリング 20万件で **p5=39.9 / p50=50.0 / p95=60.0** と、ばらつきが偏差値軸の**約 0.6 倍**しかなかった。つまり**運軸だけ動きが鈍く見える**。合成フィクスチャ由来の値なので実データでの倍率は未確認だが、**「運軸は他の4軸と同じ物差しではない」ことは定義上確実**である（§3.5 で注記の扱いを決める）。

**(c) 傾向2軸のバンド占有率 — 名目値 7/24/38/24/7% は成立しない（本設計の中心的な発見）**

各 z は「その metric 自身の μ・σ」で作るので、**母集団上で厳密に平均 0・SD 1**。`calcTendency` はその平均を取るので、合成値の SD は項間相関 ρ に応じて **`sqrt((1+(k−1)ρ)/k)`**、すなわち **1/√k 以上 1 以下**にしかならない。閾値 ±0.5 / ±1.5 は「SD ≒ 1」を前提にした値なので、実際には**中央帯が厚くなり両端帯がほぼ出ない**。

独立（ρ=0）を仮定した 20万件シミュレーション:

| 軸 | 項数 k | 合成 SD | band0 | band1 | band2 | band3 | band4 |
|---|---|---|---|---|---|---|---|
| 攻⇔守 | 4 | **0.504** | 0.15% | 15.89% | **67.85%** | 15.98% | 0.13% |
| 門前⇔速度 | 3 | **0.578** | 0.48% | 18.82% | **61.40%** | 18.83% | 0.48% |

相関を入れた解析値（正規近似。実データの ρ は未測定なのでレンジで示す）:

| ρ | k=4 の帯分布 | k=3 の帯分布 |
|---|---|---|
| 0.0 | 0.1 / 15.7 / 68.3 / 15.7 / 0.1 % | 0.5 / 18.9 / 61.4 / 18.9 / 0.5 % |
| 0.4 | 2.2 / 22.9 / 50.0 / 22.9 / 2.2 % | 2.6 / 23.3 / 48.1 / 23.3 / 2.6 % |
| 0.8 | 5.2 / 24.2 / 41.2 / 24.2 / 5.2 % | 5.4 / 24.2 / 40.9 / 24.2 / 5.4 % |
| （名目 7/24/38/24/7 に必要な ρ） | **1.0（＝全項完全相関）** | 同左 |

**結論: 実在プレイヤーの 41〜68% が中央帯（バランス）に入り、両端帯（band0 / band4）は良くて 5%、悪ければ 0.1% しか出ない。** 立直率と追っかけ率のように正相関する項があるので実際は ρ=0 より広がるはずだが、**名目の 7/24/38/24/7 に届くことは原理的にない**。

これは #4 §9 が「UI 実装 Issue で実分布を測って閾値を再調整する余地を残す」として引き継いだ宿題そのものである。**第2版では、この測定結果に基づいて帯を校正する**（§3.1）。校正後の占有率は §6.2。

**(d) 校正前のフィクスチャのプレイヤーは両軸とも band2**（offense +0.3436 / speed +0.1390）。**校正後は offense +0.6871（band3）/ speed +0.2407（band2）**（§3.1.3 で実測）。dev ギャラリーは band2 以外も**合成値を直接流し込んで**作ること（実データからは端の帯が作れない）。

### 1.6 三麻（pl3）の分布は**未確認**

#4 §9 が明記しているとおり、`pl3/global_histogram` は一度も取得しておらず、**band `"0"` に `打点效率` / `铳点损失` などが揃っているかは不明**。実 API アクセス禁止のため本 Issue でも確認できない。**したがって「三麻では一部軸が `null` になる」経路が実運用で起こりうる前提で設計する**（§3.4）。

### 1.7 `src/summary/` の流儀（実読）

`rankView.ts`（純関数のビューモデル・React 非依存）＋ `RankCard.tsx`（フックを使わない表示専用）＋ `Donut.tsx`（汎用図形）＋ `summary.css` 追記 ＋ `src/dev/RankGallery.tsx`。**カード3も同じ構成を踏襲する。** 幾何定数は TSX に直書きせずビューモデル側に置く（`DONUT_RADIUS` 等の前例）。

`SummaryPanel` は `empty` をパネル単位で1回だけ扱い、その場合カードを一切描かない。**カード3も `empty` を持たない。**

---

## 2. データの流れ

```
PlayerLayout
 ├ useCurrentIdentity(numPlayers, playerId)      → scope.identity   （フィルタ非依存・カード1）
 ├ useGlobalFilter(...)                          → scope.filter
 ├ useFilteredStats(numPlayers, playerId, filter) → scope.stats      （カード2・カード3の実測値）
 └ useGlobalHistogram(numPlayers)  ★新設         → scope.distribution（母集団。フィルタ非依存）
        ↓ useOutletContext
   SummaryPanel
     └ PlaystyleCard({ stats, distribution, modes, numPlayers })   ★新設（フックを持たない）
           ↓
        buildPlaystyleView({ extended, lookup, mode })  ★新設（純関数）
           ↓ calcRadar / calcTendency / toBand（src/domain。無改変）
```

- **カード3の実測値は `scope.stats`（`ready` の `extended`）から取る。** `stats.extended` は `ready` でも `null` になりうる（`useFilteredStats` の型）。**`null` のときカード3は値を1つも出せない**（レーダーも傾向も `PlayerExtendedStats` 由来）。
- **母集団は `numPlayers` にのみ依存**し、期間・モード選択で再取得しない（`gh` は全モードを含む1つの JSON。モードは `createStatsLookup` の引数で選ぶ）。

---

## 3. 設計判断

### 3.1 合成値を**単位 SD に正規化する**（オーナー確定 D0 = 校正する）

#### 3.1.1 どこが壊れているのか — 「閾値が悪い」のではなく「合成値が z ではない」

`toBand` の ±0.5 / ±1.5 は、**入力が SD 1 の z スコアであること**を前提にした値である（標準正規なら 6.7 / 24.2 / 38.3 / 24.2 / 6.7% で、要件 §6.2 の名目 7/24/38/24/7% と一致する）。**閾値の側は正しい。**

崩れているのは入力の側である。`calcTendency` は k 個の z の**単純平均**を返す。各 z は母集団上で厳密に SD 1 だが、その平均の SD は `sqrt((1+(k−1)ρ)/k)` であり、**k ≥ 2 なら必ず 1 未満**になる（§1.5(c) 実測: 攻守 0.5038 / 門前速度 0.5784。理論値 1/√4 = 0.5000・1/√3 = 0.5774 と一致）。

> **設計担当の見立て: これは #4 の取りこぼしである。** #4 §5.3 は「等係数の単純平均」を、#4 §5.1 は「z = (偏差値−50)/10」を、それぞれ単体としては正しく定義した。**取りこぼしたのは「平均を取ると SD が縮む」という、2つの定義をつないだところに現れる性質**で、#4 §9 が「実分布を測って閾値を再調整する余地を残す」と書いたのは、この縮みを**閾値側の問題として**引き継いだためである。実際には閾値ではなく合成の分母の問題であり、**#4 の時点で `sqrt(k)` で割っていれば `toBand` は最初から文字どおりに機能していた**。第1版はこの区別に踏み込まず「閾値を据え置く」と結論したが、**問題の所在を取り違えていた**。

#### 3.1.2 どこを直すか（3案）

| 案 | 内容 | 代償 |
|---|---|---|
| **(a) 採用: ドメインで正規化** | `calcTendency` が `sum(terms) / sqrt(terms.length)` を返す（現行は `sum / terms.length`）。`toBand` は**一切変更しない** | `src/domain/tendency.ts` の2行と `src/domain/tendency.test.ts` の値アサーション4件が変わる（§3.1.3 で実物確認済み）。`TendencyAxis.value` の意味が「z の平均」から「単位 SD に正規化した合成 z」に変わるため、#4 設計書に追補が要る |
| (b) 表示側（カード3）で正規化 | `playstyleView` 側で `value * sqrt(k)` してから `toBand` し直す | **実装不能に近い。** `calcTendency` は**使った項数 k を返さない**（`{ value, band }` のみ）。ビューが k を知るには、どの metric の分布が引けたかを `lookup` で数え直す＝**ドメインの分岐をビューに再実装する**ことになる。k を 4/3 と決め打ちすると、分布欠損時（三麻想定。§1.6）に誤った倍率を掛ける。さらに `calcTendency().band` と画面の帯が食い違い、真実が2箇所に増える |
| (c) `toBand` の閾値を軸ごとに変える | `toBand(value, terms)` にして閾値を `±0.5/√k`・`±1.5/√k` にする、または軸別の定数表を持つ | 数学的には (a) と等価。ただし `toBand` の公開シグネチャが変わり、**既存の `toBand` テスト6件（`toBand(-1.5)===1` 等）が全部書き換わる**。加えて `value`（平均）と `band`（正規化スケール）が別々の物差しのまま残り、将来 `value` を読む消費者が同じ誤読を繰り返す |

**(a) を推奨・採用する理由**:

1. **物差しが1本になる。** 正規化後の `value` はそれ自体が単位 SD の z なので、`toBand` の ±0.5/±1.5 が文字どおりの意味を取り戻す。「値は平均、帯は別スケール」という食い違いが消える
2. **項数が減る欠損ケースが自動的に正しくなる。** `sqrt(terms.length)` は実際に使った項数を使うので、三麻等で項が落ちても正規化は成立する（(b)(c) はここで k を渡す経路が要る）
3. **`toBand` を触らないので、その既存テスト6件が無改変で通る**（§3.1.3）
4. 差分が小さい（`average()` の呼び出し2箇所を `normalized()` に置き換えるだけ）

#### 3.1.3 (a) の影響範囲 — 実物で確認した結果

`grep -rn "calcTendency\|toBand\|Tendency" src/` を実行した（実読）。**`src/domain` の外に消費者は1つも無い。**

| ファイル | 影響 |
|---|---|
| `src/domain/tendency.ts` | `average(offenseTerms)` → 正規化に変更（2軸ぶん）。`toBand` は**無変更** |
| `src/domain/index.ts` | **無変更**（export される名前・型は同じ） |
| `src/domain/tendency.test.ts` | **4アサーションが変わる**。内訳は下表 |
| `src/domain/purity.test.ts:48` | **無変更**（`not.toThrow()` のみで値を見ていない） |
| `src/summary/**` / `src/filters/**` / `src/shell/**` | **無変更**（そもそも呼んでいない。本 Issue が初の消費者） |

`src/domain/tendency.test.ts` の変更点（実読。フィクスチャで実測した新値）:

| テスト | 現行 | 改訂後 |
|---|---|---|
| 「2軸の値と band」 | `offenseDefense.value ≈ 0.3436` / `band === 2` | **`≈ 0.6871`** / **`band === 3`** |
| 同上 | `concealedSpeed.value ≈ 0.1390` / `band === 2` | **`≈ 0.2407`** / `band === 2`（据え置き） |
| 「等係数の単純平均であること」 | `(zR+zO+zH−zM) / 4` | **`(zR+zO+zH−zM) / Math.sqrt(4)`**。テスト名も「等係数の合成を √項数 で正規化していること」に改める |
| 「一部 metric の分布が欠けても残りの項で平均される」 | `(zR+zH−zM) / 3` | **`(zR+zH−zM) / Math.sqrt(3)`**（実測 0.2914 → **0.5047**）。テスト名も「…残りの項で合成される」に改める |
| 「全項の分布が欠けると軸は null」 | — | **無変更** |
| `describe('tendency: toBand')` の6件 | — | **無変更**（`toBand` を触らないため） |

> **フィクスチャのプレイヤーの攻守バンドが 2 → 3 に動く。** これは校正が効いている証拠であって不具合ではない。dev ギャラリー（§4.9）・受け入れ条件 B5 の期待値もこの新値に合わせてある。

**#4 設計書への追補**: `docs/design/issue-4-domain-logic.md` §5.3 は「有効な項の単純平均」と書いている。**本 Issue で `docs/design/issue-4-domain-logic.md` を書き換えない**（過去の設計書は当時の記録として残す）。代わりに**本設計書 §3.1 を参照先とし、`src/domain/tendency.ts` の冒頭コメントの参照行に本設計書 §3.1 を追記する**（コメント1行の変更）。

#### 3.1.4 正規化の定義（製造担当が実装する内容）

```
value = Σ(有効な項) / sqrt(有効な項数)      // 現行は Σ / 項数
band  = toBand(value)                      // toBand は無変更（±0.5 / ±1.5）
```

- 項数が 1 のときは `value = その項の z` そのもの（SD 1）。現行の平均と一致する
- 符号の向き（`−z默听` / `−z和了巡数`）は**現行のまま。1つも変えない**
- **`toBand` の定数 ±0.5 / ±1.5 を書き換えないこと**（校正は分母側で行う）

### 3.2 `global_histogram` の取得は `PlayerLayout` に置き、`PlayerScope` に載せる

| 案 | 評価 |
|---|---|
| **(採用) `src/filters/useGlobalHistogram.ts` を新設し `PlayerLayout` で呼ぶ → `scope.distribution`** | `useCurrentIdentity` / `useFilteredStats` と同じ形。カード3は**フックを持たない表示専用**を保てる（#9 の流儀・dev ギャラリーに任意状態を流し込める）。**#13（ヒストグラム14枚）が同じデータを必要とする**ので、置き場所としても正しい |
| カード3の内部で `useEffect` して取る | カードがフックを持つと dev ギャラリーで状態を作れず、R1 の検証ができない。#13 で二重取得の危険 |
| `ThemeProvider` のようなグローバル Provider | プレイヤーページ以外でも取りに行ってしまう。380 KB を無関係な画面で取るのは方針に反する |

```ts
export type DistributionState =
  | { kind: 'loading' }
  | { kind: 'ready'; lookupFor: (mode: GameMode) => (metric: string) => MetricDistribution | null }
  | { kind: 'error'; message: string };
```

- **`lookupFor` はフック内で `useMemo` し、`mode` ごとに `createStatsLookup` の結果を `Map` にメモ化する。** レンダごとに `createStatsLookup` を呼ぶと metric ごとの再集計（100 bin × 11 metric）が毎回走る。
- `getGlobalHistogram` は `signal` を取らない（§1.3）ので、アンマウント時は `cancelled` フラグで `setState` を抑止するだけにする。**`AbortController` を渡そうとしないこと**（型エラーになる）。
- エラー文言は既存の `describeStatsError(err)` を使う。

**#13 への配慮**: `DistributionState` を「ルックアップ関数だけ」に絞ると `HistogramData` の bins が要る #13 が困る。**`ready` に生の `histogram: GlobalHistogram` も併せて載せておく**（`{ kind:'ready'; histogram: GlobalHistogram; lookupFor: ... }`）。バンドル増は無い。

### 3.3 複数モード選択時は「代表モード」の分布と比べる

`filter.modes` が複数のとき、比較対象の母集団は `selectRepresentativeMode(numPlayers, filter.modes)`（§1.4）で1つに決める。**`gameCountByMode` は `player_stats` 1本からは取れない**（`filterState.ts` のコメント）ので渡さない ＝ 王座・半荘を優先する既定順になる。

**この選択は画面に明示する。** カードの脚注に `MODE_LABELS[mode]` を使って「**{王座の間・半荘}の全体分布との比較**」と出す。出さないと「金の間しか打っていないのに王座基準で評価された」ことが読み手に分からない。

> 代替案（採用しない）: 選択モードの分布を試合数で加重平均する。`histogramFull` の bins を足し合わせれば数学的には可能だが、**モード別試合数が取れない**ため重みが決められず、等重み合成は「1戦しか打っていないモード」を過大評価する。

### 3.4 状態設計 — 2系統の状態を**3状態に畳む**

カード3は `stats`（フィルタ依存）と `distribution`（フィルタ非依存）の2系統に依存する。**カード内部で持つ状態は #9 と同じ3つ**に畳む。

| `stats.kind` | `distribution.kind` | カードの状態 |
|---|---|---|
| `loading` | 何でも | `loading` |
| 何でも | `loading` | `loading` |
| `error` | — | `error`（`stats.message`） |
| `ready` | `error` | `error`（`distribution.message`。stats のエラーを優先） |
| `ready`（`extended === null`） | `ready` | **`unavailable`** → `error` と同じ描画で「打ち筋データを取得できません」 |
| `ready` ＋ `extended` | `ready` ＋ 全軸 `null` | **`unavailable`** → 「この卓の分布データが揃っていません」（三麻で起こりうる。§1.6） |
| `ready` ＋ `extended` | `ready` ＋ 一部の軸のみ `null` | **`ready`（部分表示）** — §3.5 |
| `empty` | — | カード自体を描かない（`SummaryPanel` が扱う。#9 §3.4） |

> **R1（#9 §3.4）をカード3にも適用する: 同じ幅において `loading` / `ready` / `error` の高さが完全一致すること。**
>
> **担保方法は「実測値の焼き付け」ではなく「共有変数から両状態が決まる」形にする**（#9 で実測値焼き付けが2回壊れた）。カード3では次の4点で担保する。
>
> 1. **レーダーは `aspect-ratio: 1` の SVG**。高さは幅から決まるので、状態によらず同一。`loading` でも**リング・スポーク（枠）は描き、多角形と頂点だけ描かない**（枠が消えると高さが変わる余地を作ってしまう）。
> 2. **傾向バーは `.tendency__row { min-height: var(--tendency-row-height) }`**。ready 行とスケルトン行が同じ変数から決まる（#9 の `--legend-row-height` と同じ手口）。**行数は常に2**（軸が `null` でも行を消さない）。
> 3. **脚注（モード注記）は `.playstyle-card__note { min-height: var(--note-height) }`**。`loading` では `modes` が未確定で文言を出せないため中身が空になるが、**高さは同じ変数から決まる**ので R1 が保たれる。
>     - **第1版からの変更点**: 第1版はタイプ名見出しの `--typename-height` を R1 の柱の1つに据えていた。**タイプ名が無くなったので、その柱は消えた**。脚注は第1版では R1 の担保対象に入っていなかった（見出しの高さに紛れていた）ため、**本版で明示的に変数化する**。ここを落とすと `loading`（空）と `ready`（1行）で高さが変わり、R1 が壊れる
> 4. `error` / `unavailable` は #9 と同じく **`loading` と同じ構造を描いて `visibility: hidden` にし、メッセージを絶対配置で重ねる**。固定 `min-height` は使わない。

### 3.5 軸が欠けたときの表示（部分表示の規則）

`calcRadar` は軸ごとに `null` を返しうる（分布欠損）。`calcTendency` も軸ごとに `null`。

- **レーダー**: `null` の軸は**多角形の頂点を中心（値 50 相当ではなく原点）に落とさない**。落とすと「極端に悪い」と誤読される。**`null` を含む場合は多角形を描かず、有効な軸の頂点ドットと値ラベルだけを描く**（枠は残す）。全軸有効なときのみ塗り多角形を描く。
- **傾向バー**: `null` の軸は 5 セグメントを**マーカーなし**で描き（極ラベルは残す）、`aria-label` を「判定できません」にする。**行そのものは残す**（＝ R1）。「判定できません」は帯の呼称ではなく**欠損の告知**なので、§0.1 R-2 の「呼称を作らない」に抵触しない。

### 3.6 色 — セクション色に依存しない（CLAUDE.md「保留中の設計判断」との整合）

Issue 本文は「軸色はセクション色と連動」と書いているが、CLAUDE.md は **「セクション色4系統は再考の可能性あり、色分けそのものを行わない可能性がある」** としている。加えて**レーダーの軸は5本でセクション色は4系統**なので、そもそも1対1に対応しない。

**採用: レーダーは単色（`--md-sys-color-primary` 系）で描く。** 具体的には CSS 側に

```css
.playstyle-card { --radar-stroke: var(--md-sys-color-primary); --radar-fill: var(--md-sys-color-primary); }
```

の**2変数だけ**を置き、`Radar.tsx` は `stroke="var(--radar-stroke)"` / `fill="var(--radar-fill)"`（`fill-opacity` は CSS）を使う。将来セクション色で軸ごとに塗り分けると決まったら、**この2変数と軸ごとの `data-axis` 属性を足すだけ**で移行できる（`Radar.tsx` は各頂点・各スポークに `data-axis="攻"` 等を付けておく）。

**`SECTION_COLORS` / `--md-custom-color-win` 等を本 Issue で参照しないこと**（静的検証 S9 で機械確認する）。`--md-custom-color-rank-*`（順位色）も使わない。

傾向バーのセグメントは `--md-sys-color-surface-container-highest`（非アクティブ）と `--md-sys-color-primary`（現在位置）。

> **色を唯一の伝達手段にしない。** 第1版はここをテキストのバンドラベルで担保していたが、**そのラベルが無くなった**（§0.1 R-2）。代替として **(i) 現在位置に形状マーカー（アクティブセグメントの下に頂点を上に向けた三角 `.tendency__marker`）を置き、(ii) 行に `aria-label` で位置を読み上げさせる**。マーカーは色ではなく**形**なので、色覚特性・モノクロ印刷でも位置が読める。Issue 本文の「現在位置マーカー」がこれに当たる。

### 3.7 レーダーの幾何（ビューモデル側の定数として持つ）

- `viewBox="0 0 200 200"`、中心 `(100, 100)`、外周半径 `R = 70`、ラベル半径 `R + 16`
- 軸の順序（時計回り、頂点が真上）: **攻 → 守 → 速 → 制 → 運**。`i` 番目の角度 = `-90° + 72°·i`
- **表示レンジ `[20, 80]`（＝偏差値 ±3σ）にクランプする。** §1.5(b) の実測で偏差値軸の p1 = 26.7 / p99 = 73.3 なので、クランプが効くのは 1% 未満。レンジを狭める（例 [25,75]）とよくクランプに当たり、広げる（[0,100]）と図形が中央に潰れる
- **クランプした軸は頂点ドットに `data-clamped="true"` を付け**、数値ラベルには**クランプ前の実値**を出す（図と数字が食い違って見えるのを数字側で救う）
- リング（目盛）は偏差値 **35 / 50 / 65 / 80** の4本。50 のリングだけ強調（`--md-sys-color-outline`）＝「卓平均」の位置が読めるようにする
- `stroke-linejoin: round` は使わない（頂点位置が読めなくなる）

### 3.8 数値の書式

| 値 | 書式 | 例 |
|---|---|---|
| レーダー各軸 | `toFixed(1)`（偏差値・単位なし） | `57.2` |
| 傾向軸の合成値 | **画面に出さない**（`aria-label` にも出さない）。帯の位置のみ | — |
| 傾向軸の極ラベル | 固定文字列（`守` / `攻` / `門前` / `速度`） | `守 ⇔ 攻` |
| 脚注のモード名 | `MODE_LABELS[mode]` | `王座の間・半荘` |

**傾向の生の z 合成値を画面に出さない理由**: 校正後（§3.1）の値は単位 SD の z なので**スケール上は誠実になった**が、それでも出さない。読み手に「±1.5 で端」という物差しを渡しても行動可能な情報にならず、**5段階の帯こそが唯一の表現手段**（オーナー確定 §0.1 R-3）だからである。数値は帯より細かい情報を持つように見えて、実際には母集団の何%かも読めない。**離散表現にとどめる。**

**バンドの呼称を出さない**（§0.1 R-2）。行に出る文字は**両端の極ラベルだけ**。位置は形状マーカーと `aria-label` で伝える（§3.6）。

### 3.9 `@material/web` のコンポーネントを増やさない

本カードが使うのは `ElevatedCard` のみ（`src/components/md` のバレル経由）。**新しいラッパー・新しい依存を1つも増やさない。**

---

## 4. モジュール構成と公開シグネチャ

### 4.1 `src/filters/useGlobalHistogram.ts`（新規）

```ts
import type { GameMode, GlobalHistogram, NumPlayers } from '../api';
import type { MetricDistribution } from '../domain';

export type MetricLookup = (metric: string) => MetricDistribution | null;

export type DistributionState =
  | { kind: 'loading' }
  | { kind: 'ready'; histogram: GlobalHistogram; lookupFor: (mode: GameMode) => MetricLookup }
  | { kind: 'error'; message: string };

export function useGlobalHistogram(numPlayers: NumPlayers): DistributionState;
```

- `useEffect` の deps は **`[numPlayers]` のみ**（フィルタを絶対に入れない。`useCurrentIdentity` と同じ規律）
- `lookupFor` は `Map<GameMode, MetricLookup>` でメモ化（§3.2）
- `MetricDistribution` は `src/domain/index.ts:42` で既に型 export 済み（実読で確認）。**`src/domain` に追加変更は不要**

### 4.2 `src/filters/playerScope.ts`（変更・1フィールド追加）

```ts
export interface PlayerScope {
  // …既存はそのまま…
  readonly distribution: DistributionState; // ★追加
}
```

### 4.3 `src/shell/PlayerLayout.tsx`（変更・2行）

`const distribution = useGlobalHistogram(numPlayers);` を追加し、`scope` に載せる。**それ以外は触らない。**

### 4.4 `src/summary/playstyleView.ts`（新規・純関数・React 非依存）

```ts
import type { GameMode, PlayerExtendedStats } from '../api';
import type { MetricLookup } from '../filters/useGlobalHistogram';

/** レーダーの幾何定数（TSX に直書きしない） */
export const RADAR_CENTER = 100;
export const RADAR_RADIUS = 70;
export const RADAR_LABEL_RADIUS = 86;
export const RADAR_MIN = 20;
export const RADAR_MAX = 80;
export const RADAR_RINGS: readonly number[]; // [35, 50, 65, 80]
export const RADAR_AXIS_ORDER: readonly ['攻', '守', '速', '制', '運'];

export interface RadarPoint {
  readonly axis: '攻' | '守' | '速' | '制' | '運';
  readonly value: number | null;   // クランプ前の実値
  readonly valueText: string | null; // '57.2' / null
  readonly x: number;              // viewBox 座標。value === null なら外周上の点は返さない
  readonly y: number;
  readonly clamped: boolean;
}

export interface TendencyRow {
  readonly key: 'offenseDefense' | 'concealedSpeed';
  readonly band: 0 | 1 | 2 | 3 | 4 | null;   // null = 判定不能（分布欠損）
  readonly poleStart: string;      // バー左端の極ラベル（'守備' / '門前'）
  readonly poleEnd: string;        // バー右端の極ラベル（'攻' / '速度'）
  readonly ariaLabel: string;      // '守 ⇔ 攻: 5段階のうち守側から4番目' / '守 ⇔ 攻: 判定できません'
}
// ★ 第1版にあった axisLabel / bandLabel は削除（§0.1 R-2。バンドの呼称を作らない）。
//    行の可読テキストは poleStart / poleEnd の2語だけ。位置は形状マーカーと ariaLabel で伝える。

export interface PlaystyleView {
  readonly points: readonly RadarPoint[];  // 常に長さ5・RADAR_AXIS_ORDER 順
  readonly polygonPoints: string | null;   // 全軸有効なときだけ 'x,y x,y …'。1つでも null なら null
  readonly rows: readonly TendencyRow[];   // 常に長さ2
  readonly radarAriaLabel: string;         // '打ち筋レーダー 攻 57.2 守 53.6 …（データなしの軸は「データなし」）'
  readonly modeNote: string;               // '王座の間・半荘の全体分布との比較'
  readonly allAxesMissing: boolean;        // true なら呼び出し側は unavailable 表示にする
}
// ★ 第1版にあった typeName は削除（§0.1 R-1）。

export function buildPlaystyleView(input: {
  readonly extended: PlayerExtendedStats;
  readonly lookup: MetricLookup;
  readonly mode: GameMode;
}): PlaystyleView;

/** 極座標→viewBox 座標（単体テスト対象） */
export function radarPointAt(index: number, radius: number): { x: number; y: number };
```

**`typeNameFor` は作らない**（§0.1 R-1）。バンド→語彙の対応表をこのファイルに置かないこと。

- **`calcRadar` / `calcTendency` / `toBand` は `src/domain` からそのまま呼ぶ。式を書き写さないこと。**
- `buildPlaystyleView` は**例外を投げない**。欠損は `null` で表す。

### 4.5 `src/summary/Radar.tsx`（新規・汎用表示部品・フックなし）

```ts
export interface RadarProps {
  readonly points: readonly RadarPoint[];
  readonly polygonPoints: string | null;
  readonly ariaLabel: string;
  readonly placeholder?: boolean; // true なら枠だけ描く（loading）
}
export function Radar(props: RadarProps): ReactElement;
```

`Donut.tsx` と同じ流儀（フックなし・幾何定数は view から import・`role="img"` ＋ `aria-label`）。各頂点・スポーク・ラベルに `data-axis={axis}` を付ける（§3.6 の将来移行のため／検収の機械確認のため）。

### 4.6 `src/summary/PlaystyleCard.tsx`（新規・表示専用・フックなし）

```ts
export interface PlaystyleCardProps {
  readonly state: FilteredStatsState;
  readonly distribution: DistributionState;
  readonly modes: readonly GameMode[] | null; // filter?.modes。null なら loading 扱い
  readonly numPlayers: NumPlayers;
}
export function PlaystyleCard(props: PlaystyleCardProps): ReactElement;
```

- `data-testid="playstyle-card"` / `data-state={'loading'|'ready'|'error'}`
- 構造: `h2 打ち筋` → `.playstyle-card__body`（`.playstyle-card__radar` ＋ `.playstyle-card__tendency`） → `p.playstyle-card__note`（モード注記）
- **タイプ名見出しの要素は作らない**（§0.1 R-1）。第1版の `p.playstyle-card__typename` は DOM ごと削除
- 傾向の1行の構造: `div.tendency__row[role="img"][aria-label={row.ariaLabel}][data-axis={row.key}]` の中に `span.tendency__pole` × 2（両端）と `ol.tendency__bar > li.tendency__seg[data-active]` × 5。アクティブなセグメントの中に `span.tendency__marker`（形状マーカー・`aria-hidden`）
- **`state.kind === 'empty'` を扱わない**（`SummaryPanel` が上流で処理する）

### 4.7 `src/summary/SummaryPanel.tsx`（変更）

`<RankCard …/>` の直後に `<PlaystyleCard state={scope.stats} distribution={scope.distribution} modes={scope.filter?.modes ?? null} numPlayers={scope.numPlayers} />` を足す。**それ以外の分岐は変えない。**

### 4.8 `src/summary/summary.css`（追記のみ）

`.playstyle-card*` / `.radar*` / `.tendency*` を**ファイル末尾に追記**する。既存規則は1行も変えない。

- `.playstyle-card { --tendency-row-height: 36px; --note-height: 20px; --radar-stroke: var(--md-sys-color-primary); --radar-fill: var(--md-sys-color-primary); }`（**`--typename-height` は第1版で使っていた変数。削除する**）
- `.playstyle-card__radar { width: 100%; max-width: 280px; aspect-ratio: 1; }` / `svg { display:block; width:100%; height:100% }`
- `.radar__ring { stroke: var(--md-sys-color-outline-variant); fill: none }` ／ `.radar__ring[data-mid="true"] { stroke: var(--md-sys-color-outline) }`
- `.radar__spoke { stroke: var(--md-sys-color-outline-variant) }`
- `.radar__area { fill: var(--radar-fill); fill-opacity: 0.24; stroke: var(--radar-stroke); stroke-width: 2 }`
- `.radar__dot { fill: var(--radar-stroke) }` ／ `.radar__label`・`.radar__value { fill: var(--md-sys-color-on-surface-variant) }`
- `.tendency__row { min-height: var(--tendency-row-height); display:flex; align-items:center; gap:8px }` — **R1 の生命線その1**
- `.playstyle-card__note { min-height: var(--note-height); margin:0 }` — **R1 の生命線その2**（`loading` では中身が空。§3.4-3）
- `.tendency__bar { display:flex; gap:2px; flex:1 1 auto; list-style:none; margin:0; padding:0 }` / `.tendency__seg { position:relative; flex:1 1 0; height:16px; border-radius:3px; background: var(--md-sys-color-surface-container-highest) }` / `.tendency__seg[data-active="true"] { background: var(--md-sys-color-primary) }`
- `.tendency__marker` — アクティブセグメントの中心に置く**形状マーカー**（`position:absolute; left:50%; transform:translateX(-50%)` ＋ CSS 三角形。色は `--md-sys-color-primary`）。**セグメント高さ 16px の枠内に収め、行の高さを増やさないこと**（増やすと `--tendency-row-height` を上げる必要が出る）
- `.tendency__pole { color: var(--md-sys-color-on-surface-variant); flex: 0 0 auto }`（両端の極ラベル。`md-typescale-label-medium` 相当）
- `.playstyle-card__body--message > * { visibility: hidden }` ＋ `.playstyle-card__message { position:absolute; inset:0; … ; color: var(--md-sys-color-error) }`（#9 §4.7 と同じ手口）
- **レイアウト**: 既定は縦積み（レーダー → 傾向2行）。`@container playstyle-card (min-width: 600px)` で `.playstyle-card__body { flex-direction: row }`（レーダー ｜ 傾向）。**`@container` ブロックは基本ルールより後ろ（ファイル末尾）に置くこと** — 詳細度が同じで基本ルールが後ろにあると打ち消される（#9 で実際に踏んだ）
- **16進カラーリテラルを1つも書かない**（CLAUDE.md 制約5）

### 4.9 `src/dev/PlaystyleGallery.tsx`（新規・dev 専用）＋ `src/main.tsx` に `#/__playstyle`

**CLAUDE.md 制約4 の形（`import.meta.env.DEV` のリテラル分岐の内側に動的 `import()` を直書き）を崩さないこと。API を1回も叩かないこと。実在プレイヤー名・ID を書かないこと。**

流し込む状態（`PlaystyleCard` に props を直接与える）:

| # | 状態 |
|---|---|
| 1 | `loading`（stats loading） |
| 2 | `loading`（stats ready・distribution loading）— **1 と同じ見た目・同じ高さになること** |
| 3 | `error`（stats error） |
| 4 | `error`（distribution error） |
| 5 | `ready` 全軸あり・**攻守 band3 / 門前速度 band2**（フィクスチャ相当。§1.5(a)(d)。**校正後の値**なので第1版の「両軸 band2」から変わっている） |
| 6 | `ready` 両軸 band0（守備×門前） |
| 7 | `ready` 両軸 band4（攻撃×速度） |
| 8 | `ready` band0 × band4 / band4 × band0（対角の2枚） |
| 9 | `ready` 一部軸 `null`（`運` だけ欠損 → 多角形なし・頂点のみ） |
| 10 | `unavailable`（`extended === null`） |
| 11 | `unavailable`（全軸 `null` = 分布に metric が無い。三麻想定） |
| 12 | `ready` クランプ発生（`攻` が 95 相当の入力 → 頂点が外周で止まり、数値ラベルは実値） |
| 13 | `ready` 傾向2軸のうち**片方だけ `null`**（攻守は band2・門前速度は判定不能）。マーカーなしの行と有りの行が並ぶ |

**`distribution` のスタブは実データを使わない**: `lookupFor: () => (metric) => FIXED[metric] ?? null` の形で `MetricDistribution` を直接与える（`global_histogram` の JSON をギャラリーに import しない＝本番バンドルとは無関係だが dev の起動も軽くなる）。

**高さ計測プローブ**: `data-testid="playstyle-height-probe"` のブロックをページ先頭（**横パディングを持つ祖先の外側**）に置き、各枠に `data-testid="playstyle-height-probe-item"` ＋ `data-layout`（`stack`/`row`）・`data-state` を付ける。**#9 と同じく基準幅 600px の両側で測る**:

| `data-layout` | プローブ幅 | 中身 |
|---|---|---|
| `stack` | **343px**（＝実ページ最小幅 375 − ページ左右パディング 32） | loading / ready / error の3枚 |
| `row` | **700px** | 同じ3枚 |

> **プローブは実ページと同じ寸法で作ること。** #8・#9 で「プローブが実ページとズレていて欠陥を検出できない」事故が計2回起きている。プローブ枠の幅は `width: 343px` を直接指定し、内側に余分な padding を足さない。

### 4.10 変更・追加ファイル一覧

| ファイル | 種別 | 内容 |
|---|---|---|
| `src/domain/tendency.ts` | **変更**（第2版で追加） | 合成の分母を `項数` → `sqrt(項数)` に（§3.1.4）。**`toBand` は無変更** |
| `src/domain/tendency.test.ts` | **変更**（第2版で追加） | 値アサーション4件を新値に（§3.1.3 の表）。`toBand` の6件は無変更 |
| `src/filters/useGlobalHistogram.ts` | 新規 | §4.1 |
| `src/filters/playerScope.ts` | 変更 | `distribution` を1行追加（§4.2） |
| `src/shell/PlayerLayout.tsx` | 変更 | フック呼び出し＋scope に載せる（§4.3） |
| `src/summary/playstyleView.ts` | 新規 | §4.4 |
| `src/summary/playstyleView.test.ts` | 新規 | §5 |
| `src/summary/Radar.tsx` | 新規 | §4.5 |
| `src/summary/PlaystyleCard.tsx` | 新規 | §4.6 |
| `src/summary/SummaryPanel.tsx` | 変更 | 1要素追加（§4.7） |
| `src/summary/summary.css` | 変更 | **追記のみ**（§4.8） |
| `src/dev/PlaystyleGallery.tsx` | 新規（dev 専用） | §4.9 |
| `src/main.tsx` | 変更 | dev ルート `#/__playstyle` 追加 |

**触らない**: `src/domain/radar.ts` / `distribution.ts` と**そのテスト**（＝**レーダー側の値は一切変えない**）/ `src/domain/tendency.ts` の `toBand` / `src/domain/purity.test.ts` / `docs/design/issue-4-domain-logic.md` / `src/api/**` / `src/theme/**` / `src/components/md/**` / `src/summary/rankView.ts` / `RankCard.tsx` / `Donut.tsx` / `identityView.ts` / `IdentityCard.tsx` / `LevelDetailCard.tsx` / `package.json`。

---

## 5. ユニットテストの計画

### 5.0 `src/domain/tendency.test.ts`（既存ファイルの改訂＋新規2件）

§3.1.3 の表に従って**既存の4アサーションを新値に更新**し、さらに**校正が効いていることを固定する2件を新設する**。

| # | ケース | 合格条件 |
|---|---|---|
| **DT1（新設）**<br>※第1版のオーナー確認事項 D1/D2 とは無関係の**テストID** | 「合成値は単位 SD に正規化されている」— 独立な k 個の z を模した入力ではなく、**`calcTendency` の返す値が `Σz / √k` に一致する**ことを直接固定する（k=4 と k=3 の両方） | `offenseDefense.value ≈ (zR+zO+zH−zM)/Math.sqrt(4)`（誤差 1e-10）／欠損時 `≈ (zR+zH−zM)/Math.sqrt(3)` |
| **DT2（新設）** | 「項が1つだけのとき値はその z そのもの」— `lookup` を `立直率` だけ返すようにする | `offenseDefense.value ≈ zR`（√1 = 1。平均との等価性の境界を固定する） |
| 既存4件 | §3.1.3 の表のとおり値と band を更新 | — |
| `toBand` の6件 | **1文字も変えない** | 変えていないことを `git diff` で確認する（受け入れ条件 T4） |

> **red 先行（検収が実行）**: `tendency.ts` の `Math.sqrt(terms.length)` を `terms.length` に戻す（＝校正を取り消す）と、**DT1・DT2 と既存「2軸の値と band」が FAIL し、`toBand` の6件は PASS のまま**であること。これは「校正がテストで守られている」ことと「`toBand` に手が入っていない」ことを同時に示す。

### 5.1 `src/summary/playstyleView.test.ts`（新規）

分布は**テスト内で `MetricDistribution` を直接与える**（`global_histogram` の JSON を読まない）。

| # | ケース |
|---|---|
| U1 | `radarPointAt(0, 70)` が中心の真上 `(100, 30)` を返す（頂点が真上） |
| U2 | `radarPointAt(1..4, 70)` が 72° ずつ時計回り（`x` の符号・順序で確認） |
| U3 | `points` は常に長さ5で `RADAR_AXIS_ORDER` 順 |
| U4 | 全軸有効なら `polygonPoints` が5点（空白区切り）を返す |
| U5 | 1軸でも `null` なら `polygonPoints` は `null`、当該 `RadarPoint.value` も `null` |
| U6 | 値 95 の軸は `clamped === true` で頂点が外周（半径 = `RADAR_RADIUS`）、`valueText` は `'95.0'`（クランプ前） |
| U7 | 値 5 の軸は下端 `RADAR_MIN` にクランプされ半径 0 |
| U8 | `valueText` が小数1桁（`57.216 → '57.2'`） |
| U9 | `守` が `100 − 偏差値(铳点损失)` になっている（`铳点损失` が μ より小 → `守 > 50`）※`calcRadar` の再実装ではなく符号の向きを1本だけ固定する |
| U10 | `rows` は常に長さ2・`key` が `offenseDefense` → `concealedSpeed` の順 |
| U11 | 極ラベルが軸ごとに正しい（`offenseDefense` = `守`／`攻`、`concealedSpeed` = `門前`／`速度`）。**`poleEnd` 側が band4 の向きである**ことを、band4 になる入力で確認する（向きが逆だとゲージが嘘をつく） |
| U12 | 軸が `null` のとき `band === null` かつ `ariaLabel` に「判定できません」が含まれる |
| U13 | `ariaLabel` が band ごとに位置を含む（band 0..4 の5ケース表駆動。例 band3 → 「守側から4番目」相当の文字列）。**バンドの呼称語（「攻撃寄り」等）を1つも含まないこと**を `expect(...).not.toMatch()` で固定する（§0.1 R-2 の回帰防止） |
| U14 | **`PlaystyleView` に `typeName` プロパティが存在しない**（`expect('typeName' in view).toBe(false)`。§0.1 R-1 の回帰防止） |
| U15 | `radarAriaLabel` に5軸すべての名前が現れ、`null` の軸は「データなし」と読み上げられる |
| U16 | `modeNote` に `MODE_LABELS[mode]` の文言が含まれる（mode 16 → 王座の間・半荘） |
| U17 | 全軸 `null`（`lookup` が常に `null`）で `allAxesMissing === true`、かつ例外を投げない |
| U18 | `lookup` が一部 metric だけ返すとき `calcTendency` の項が減っても値が出る（`concealedSpeed` が `副露率` のみで算出される） |

**red 先行の確認（検収が実行する4件）**

- (a) `RADAR_MIN` を 20 → 0 に変える → **U7 だけ**が FAIL
- (b) `RADAR_AXIS_ORDER` の `守` と `速` を入れ替える → **U3・U15** が FAIL
- (c) 極ラベルの `poleStart` / `poleEnd` を入れ替える → **U11 だけ**が FAIL
- (d) `src/domain/tendency.ts` の `Math.sqrt(terms.length)` を `terms.length` に戻す → **§5.0 の DT1・DT2・「2軸の値と band」が FAIL、`toBand` の6件は PASS**

**対照実験（ミューテーション判定の前に必ず行う。CLAUDE.md の規律）**: 意味を変えないダミー改変 — 例えば `average` / `normalized` のローカル変数名を変える、`RADAR_RINGS` の要素順を `[35,50,65,80]` のまま再代入で書き換える — を先に入れ、**`npm test` が全パスのまま（SURVIVED）**であることを確かめる。ここで KILLED になるなら「常に落ちる」故障モードなので、上の (a)〜(d) の結果は判定材料にならない。

各改変後に戻して `npm test` が全パスに復帰することを確認する。

---

## 6. 校正の記録（Issue 完了条件「係数・決定が記録されている」に対応）

### 6.1 決定の要約

| 項目 | 決定 | 決めた人 / 根拠 |
|---|---|---|
| 合成係数（符号・等係数） | **変更しない** | #4 §5.3 のまま |
| 合成の分母 | **項数 → √項数**（単位 SD への正規化） | オーナー確定（§0.1 R-3）＋ §3.1 の分析 |
| `toBand` の閾値 ±0.5 / ±1.5 | **変更しない** | 正規化後は文字どおりの意味を取り戻すため（§3.1.1） |
| 5段階バンドの呼称 | **作らない** | オーナー確定（§0.1 R-2） |
| タイプ名 | **作らない** | オーナー確定（§0.1 R-1） |
| 極ラベル | `守 ⇔ 攻` / `門前 ⇔ 速度` | オーナー確定（向きの明示は残す） |

### 6.2 校正前後の帯占有率（実測。フィクスチャ分布からの独立サンプリング 200,000 件）

`src/domain/__fixtures__/global_histogram.json`（pl4 / mode `"16"` / band `"0"`）の各 metric の `histogramFull` から、**metric ごとに独立に**値をサンプリングして z を作り、`calcTendency` と同じ式で合成した。乱数は線形合同法で固定シード（再現可能）。**実 API は叩いていない。**

**攻⇔守 軸（k = 4。実測 SD 0.5038 ／ 理論 1/√4 = 0.5000）**

| | band0（守） | band1 | band2（中央） | band3 | band4（攻） |
|---|---|---|---|---|---|
| **校正前**（現行 `Σ/4`） | 0.13% | 15.97% | **67.87%** | 15.90% | 0.14% |
| **校正後**（`Σ/√4`） | **6.83%** | **24.27%** | **38.06%** | **24.04%** | **6.80%** |
| 要件 §6.2 の名目値 | 7% | 24% | 38% | 24% | 7% |

**門前⇔速度 軸（k = 3。実測 SD 0.5784 ／ 理論 1/√3 = 0.5774）**

| | band0（門前） | band1 | band2（中央） | band3 | band4（速度） |
|---|---|---|---|---|---|
| **校正前**（現行 `Σ/3`） | 0.47% | 18.81% | **61.30%** | 18.97% | 0.45% |
| **校正後**（`Σ/√3`） | **6.80%** | **24.16%** | **38.06%** | **24.30%** | **6.68%** |
| 要件 §6.2 の名目値 | 7% | 24% | 38% | 24% | 7% |

**校正によって、中央1マスへの集中（67.9% / 61.3%）が解消し、両端の帯が 0.1〜0.5% から約 6.8% になる。** 5つの帯すべてが「実際に人が乗る」帯になった＝ 5段階という表現が機能する。

> 参考: 実測 SD で割った場合（`Σ/(k·0.5038)` 等）の占有率は 6.68/24.29/38.32/24.05/6.66 と 6.77/24.16/38.12/24.30/6.65 で、理論値 1/√k で割った場合とほぼ一致した。**実装は理論値（`Math.sqrt(k)`）を使う** — フィクスチャ由来の実測 SD を定数として焼き付けると、フィクスチャが合成値である（§10-1）ぶんの誤差をコードに固定してしまうため。

### 6.3 正規化定数の根拠と限界（重要）

**根拠**: 各 z は「その metric 自身の μ・σ」で作られるので、母集団上で厳密に平均 0・SD 1 である。k 個の**互いに独立な**単位分散変数の和を √k で割れば分散は厳密に 1 になる。したがって `√k` は**独立を仮定したときの厳密な正規化定数**であり、フィッティングで得た経験値ではない。

**限界**: 実際の項どうしには相関がある（例: 立直率が高い人は追っかけ率も高い。`默听率` は攻守軸と速度軸の**両方**に符号違いで入る）。項間の平均相関を ρ とすると、正規化後の実効 SD は **`sqrt(1 + (k−1)ρ)`** で、**ρ > 0 なら 1 より大きい**。すなわち **`√k` は「割り足りない」側に外れる**。

**外れたときに何が起きるか（正規近似で算出）**:

| ρ（項間の平均相関） | k=4（攻⇔守）の帯 | k=3（門前⇔速度）の帯 |
|---|---|---|
| 0.0（＝正規化の前提） | 6.7 / 24.2 / **38.3** / 24.2 / 6.7 % | 6.7 / 24.2 / **38.3** / 24.2 / 6.7 % |
| 0.2 | 11.8 / 22.8 / **30.7** / 22.8 / 11.8 % | 10.2 / 23.4 / **32.7** / 23.4 / 10.2 % |
| 0.4 | 15.6 / 21.2 / **26.4** / 21.2 / 15.6 % | 13.2 / 22.3 / **29.1** / 22.3 / 13.2 % |
| 0.8 | 20.8 / 18.5 / **21.4** / 18.5 / 20.8 % | 17.6 / 20.2 / **24.4** / 20.2 / 17.6 % |

**読み方 — 誤差の向きは片側で、しかも安全側である。**

- 外れ方は必ず**「帯が広がりすぎる」＝両端が厚くなる**方向で、**「中央に潰れる」方向には絶対に外れない**（ρ ≥ 0 なら実効 SD ≥ 1）。ρ が最悪の 0.8 でもほぼ一様（約 21/18/21/18/21%）にしかならず、**校正前の 67.9% のような1マス集中は原理的に再発しない**
- 一方 ρ < 0（項が打ち消し合う）ならば帯は名目より狭くなるが、**攻守軸の4項は打ち筋の同じ側面を測っており、`−z默听` の符号反転を含めて正相関になる設計**なので、実務上 ρ < 0 は考えにくい
- **したがって最悪ケースは「攻撃型・守備型と判定される人が 7% でなく 15〜20% いる」。5段階表示が機能しなくなる失敗ではない**

**将来どう検証・是正できるか**:

1. **検証（安いほう）**: 実データ1件でも「両端の帯が出るか」は分かる。**受け入れ条件 V4（オーナー委託）で複数プレイヤーの帯を記録する**。名目 6.8% に対し、数人見て2人以上が端に来るなら ρ が大きい側の疑いがある
2. **検証（正攻法・現時点では不可）**: ρ を測るにはプレイヤー母集団の**同時分布**（1人ぶんの 6 metric が揃った行が多数）が要る。`global_histogram` は metric ごとの周辺分布しか返さず、`player_records` / `games` は CAP 保護下で方針上叩けない。**したがって本 Issue の時点で ρ は測定不能**
3. **是正**: ρ が判明したら、`√k` を **`sqrt(k / (1 + (k−1)ρ))`** に差し替えれば厳密になる。**変更箇所は `src/domain/tendency.ts` の1箇所のみ**で、`toBand` にも表示側にも波及しない（正規化をドメインの分母に置いた §3.1 案 (a) の利点）。**是正のコストを1箇所に閉じ込めたことが、この設計の主目的の1つである**
4. 是正が要るかどうかの判断材料は、V4 の観測 ＋ 将来 #13（ヒストグラム）で母集団分布を扱うときに得られる情報

## 7. 想定される取り違え（製造担当向け）

1. **`src/domain/radar.ts` を書き換えない**（レーダー側の値は今回の対象外）。`src/domain/tendency.ts` は **§3.1.4 の分母1箇所だけ**を変える。**`toBand` の ±0.5/±1.5 と、符号（`−z默听` / `−z和了巡数`）には触らない。** 式をビュー側に書き写すのも禁止（二重実装になる）。
1-b. **タイプ名を作らない・バンドの呼称を作らない**（§0.1 R-1/R-2）。「バランス型」「攻撃寄り」といった語を DOM・ビューモデル・テスト・CSS クラス名のどこにも書かないこと。行に出る文字は**極ラベル4語（守 / 攻 / 門前 / 速度）だけ**。
1-c. **傾向バーの現在位置を色だけで示さない。** 形状マーカー（§3.6）と `aria-label` を必ず付ける。
2. **`getGlobalHistogram` に `AbortSignal` を渡そうとしない**（引数に無い。§1.3）。
3. **`useGlobalHistogram` の deps に `filter` を入れない。** 母集団は期間・モードで変わらない。入れると 380 KB のフェッチが**フィルタ操作のたびに走る**（`apiGet` のキャッシュで実 HTTP は防がれるが、state のリセットで `loading` に落ちてカードが点滅する）。
4. **`createStatsLookup` をレンダのたびに呼ばない**（§3.2。100 bin × 11 metric の再集計）。
5. **`extended` は `ready` でも `null` になりうる。** カード3は `extended` が無いと何も出せない → `unavailable`。
6. **軸が `null` のとき値 50 で埋めない。** 「平均的」と嘘をつくことになる（§3.5）。
7. **`loading` のレーダー枠を省略しない。** 枠まで含めて同じ構造にするのが R1 の担保（§3.4）。
8. **`--tendency-row-height` / `--note-height` を実測値の焼き付けにしない。** ready 側も同じ変数から `min-height` を取ること（#9 で焼き付け方式が2回壊れている）。**脚注は `loading` で中身が空になるので、変数を落とすと R1 が壊れる**（§3.4-3）。
9. **`@container` ブロックは `summary.css` の末尾**（基本ルールより後ろ）に置く。
10. **セクション色（`SECTION_COLORS` / `--md-custom-color-win` 等）を参照しない**（§3.6）。順位色（`--md-custom-color-rank-*`）も使わない。
11. **`<md-*>` を直書きしない**。`ElevatedCard` は `src/components/md` バレルから。
12. **`import './summary.css'` 以外の bare import を書かない**（CLAUDE.md 制約1）。
13. **`recharts` を import しない**（§1.1）。
14. **dev ギャラリーに実在プレイヤーの ID・ニックネームを書かない。**

---

## 8. 受け入れ条件

検収担当は以下を**1項目ずつ実行**して結果を記録する。

### 8.1 静的検証

| # | 実行すること | 合格条件 |
|---|---|---|
| S1 | `npm run build` | 成功・型エラー0。`dist/assets/index-*.js` が **500.0 kB 以下 / gzip 139.0 kB 以下**（**実測値をレポートに記載**）<br>**上限の根拠**: ベースライン `95e25f4` = 486.76 kB / gzip 133.97 kB（実測）。本 Issue の一時プローブ（自前 SVG レーダー＋傾向バー＋取得フック＋ドメイン配線）は **+4.03 kB / gzip +1.54 kB**（§1.1 の C）。**#9 では簡易プローブ +1.38 kB に対しフル実装が +5.67 kB（約 4.1 倍・gzip 3.2 倍）になった**。#5・#6・#8・#9 と4回連続で見積りが甘く上限改訂になっているため、**今回はプローブ実測に約 3 倍を掛けた枠**（+13.2 kB / gzip +5.0 kB）を最初から与える。**この枠を超えたら「収まらなかった」ではなく「意図しない取り込みがある」ことを疑い、内訳を実測してから報告すること**（S8 が recharts 混入を、S12 が dev コード混入を機械的に排除する） |
| S2 | `npm run lint` | 新規エラー0 |
| S3 | `npm test` | 全パス。`playstyleView.test.ts` が実行され、テスト数がベースラインより増えている |
| S4 | `grep -rn "<md-" src/ --include='*.tsx'` | 0件 |
| S5 | `grep -rn "^import '" src/ \| grep -v "\.css'"` | 0件 |
| S6 | `grep -rn "all\.js" src/` | 0件 |
| S7 | `grep -rniE "#[0-9a-f]{3,8}([^0-9a-f]\|$)" src/summary/ src/filters/` | 0件 |
| S8 | `grep -rn "recharts" src/` | 0件 |
| S9 | `grep -rn "SECTION_COLORS\|custom-color-win\|custom-color-dealin\|custom-color-riichi\|custom-color-luck\|custom-color-rank" src/summary/playstyleView.ts src/summary/Radar.tsx src/summary/PlaystyleCard.tsx src/summary/summary.css` | **0件**（セクション色・順位色に依存していない。§3.6） |
| S10 | `git diff 95e25f4 -- src/api/ src/theme/ src/components/ package.json src/summary/rankView.ts src/summary/RankCard.tsx src/summary/Donut.tsx src/summary/identityView.ts src/domain/radar.ts src/domain/distribution.ts src/domain/radar.test.ts src/domain/distribution.test.ts src/domain/purity.test.ts docs/design/issue-4-domain-logic.md` | **出力が空**（§4.10。**`src/domain/` を丸ごと除外していた第1版から変更**。`tendency.ts` / `tendency.test.ts` は変更対象なので個別に列挙している。**レーダー側 `radar.ts` が無改変であることをここで機械確認する**） |
| **S10-b**<br>（第2版で追加） | `git diff 95e25f4 -- src/domain/tendency.ts` | **差分が §3.1.4 の分母のみ**。`toBand` の関数本体（`-1.5` / `-0.5` / `0.5` / `1.5`）に差分が **1行も無い**こと。`grep -n "1.5\|0.5" src/domain/tendency.ts` の結果が `toBand` 内の4行だけであることも確認する |
| **S10-c**<br>（第2版で追加） | `grep -rniE "タイプ名\|typeName\|バランス型\|攻撃寄り\|守備寄り\|鉄壁\|フルアタック\|門前主義\|速攻全振り\|bandLabel" src/` | **0件**（§0.1 R-1/R-2 の機械確認。タイプ名・バンド呼称が実装に混入していない） |
| S11 | `git diff 95e25f4 -- src/summary/summary.css \| grep "^-" \| grep -v "^---"` | **空**（追記のみ） |
| S12 | `grep -c "PlaystyleGallery" dist/assets/*.js` | 0（dev 専用コードが本番バンドルに無い） |
| S13 | `grep -n "deps\|\[numPlayers\]" src/filters/useGlobalHistogram.ts` を目視 | `useEffect` の deps が **`[numPlayers]` のみ**で、`filter` / `modes` / `period` を含まない（§7-3） |
| S14 | `grep -rn "signal" src/filters/useGlobalHistogram.ts` | 0件（`getGlobalHistogram` は signal を取らない。§7-2） |
| **S15**<br>（第2版で追加） | `grep -rn "typename-height" src/` | **0件**（第1版の変数が残っていない） |
| **S16**<br>（第2版で追加） | `grep -n "note-height\|tendency-row-height" src/summary/summary.css` | **`--note-height` と `--tendency-row-height` が定義1箇所・参照1箇所ずつ**あり、`min-height` の値に px リテラルが直書きされていない（R1 の共有変数方式。§3.4） |

### 8.2 ユニットテスト

| # | 実行すること | 合格条件 |
|---|---|---|
| T1 | `npx vitest run src/summary/playstyleView.test.ts` | 全パス。§5.1 の **U1〜U18 がすべて存在する**（ケース名で照合）。**U13・U14 が呼称／`typeName` の不在を積極的に固定している** |
| T2 | `npx vitest run src/domain/ src/summary/ src/filters/` | 全パス |
| **T2-b**<br>（第2版で追加） | `git diff 95e25f4 --stat -- '**/*.test.ts'` | 変更されている既存テストが **`src/domain/tendency.test.ts` の1ファイルだけ**であること。他の既存テストは**無改変で**通っている |
| **T2-c**<br>（第2版で追加） | `npx vitest run src/domain/tendency.test.ts` ＋ `git diff 95e25f4 -- src/domain/tendency.test.ts` を目視 | 全パス。差分が **§3.1.3 の表の4アサーション＋新設 DT1・DT2 のみ**で、`describe('tendency: toBand')` ブロックに差分が **1行も無い** |
| T3 | red 先行の確認（4件）＋**対照実験** | §5.1 末尾の**対照実験を先に実施**し、意味を変えないダミー改変が **SURVIVED（全パス）** であることを確認してから、(a)(b)(c)(d) を実施して**対応するケースだけが FAIL** することを確認。各改変後に戻して `npm test` が全パス復帰 |
| **T4**<br>（第2版で追加） | (d) の red 確認の内訳を記録 | `tendency.ts` の `Math.sqrt(terms.length)` → `terms.length` で **DT1・DT2・「2軸の値と band」が FAIL し、`toBand` の6件は PASS** であること（校正がテストで守られ、かつ `toBand` に手が入っていないことの二重確認） |

### 8.3 ブラウザ実測

**ポート 5173 はオーナーが使用中。`npm run dev -- --port 5199` のように別ポートで起動し、停止もポート指定で行うこと（`pkill -f vite` 禁止）。**

ビューポートの作り方: `resize_window({ preset: 'mobile' })`（375×812）→ **`document.documentElement.clientWidth === 375` をレポートに記録**。375 でなければ計測をやり直す。

| # | 実行すること | 合格条件 |
|---|---|---|
| B1 | `#/__playstyle` を開く | §4.9 の**13状態**すべてが描画され、**コンソールエラー0**。状態5に `[data-testid="playstyle-card"][data-state="ready"]` があり、その中に SVG（`role="img"`）と `.tendency__row` が2つある。**`.playstyle-card__typename` が DOM 上に0個**（§0.1 R-1） |
| B2<br>レーダー要素数 | 状態5で `document.querySelectorAll('[data-state="ready"] .radar__dot').length` と `.radar__spoke` / `.radar__label` の数 | それぞれ **5 / 5 / 5**。`.radar__label` の `textContent` が上から時計回りに `攻 守 速 制 運`（`data-axis` 属性で照合） |
| B3<br>値の一致（#4 との突き合わせ） | 状態5に流している `MetricDistribution` と入力から、Node で `calcRadar` を直接呼んだ値と、画面の `.radar__value` の `textContent` を突き合わせる | **5軸すべて小数1桁まで一致**（Issue 完了条件「値が #4 の計算と一致」）。ギャラリーの入力を §1.5(a) と同じにした場合の期待値は `攻 57.2 / 守 53.6 / 速 57.8 / 制 58.6 / 運 53.7`。**校正はレーダーに影響しないので、この5値は第1版から変わっていない**（変わっていたら `radar.ts` に手が入った疑い → S10 で再確認） |
| **B4**<br>高さ不変（R1） | `[data-testid="playstyle-height-probe"]` 内の `[data-testid="playstyle-card"]` の `getBoundingClientRect().height` を `data-layout` ごとにグループ化。**必ず `await document.fonts.ready` の後に測る** | **`stack`（幅343px）の3枚（loading/ready/error）が `new Set(...).size === 1`、`row`（幅700px）の3枚も同様。** 実測値をレポートに記録（絶対値の上限は課さない）。**プローブ幅が 343 / 700 になっていることも `getBoundingClientRect().width` で確認する**（プローブが実ページとズレていた事故が過去2回） |
| B5<br>傾向バー | 状態5・6・7で `.tendency__row` ごとに `.tendency__seg` の数と `[data-active="true"]` の位置（`index`）を読む | 各行 **セグメント5個**。**状態5は攻守が index 3・門前速度が index 2**（§1.5(d) の校正後の値。第1版の「両行とも 2」から変更）、状態6は両行とも **0**、状態7は両行とも **4** |
| **B5-b**<br>（第2版で追加）<br>色以外の伝達 | 状態5・6・7で `[data-active="true"] .tendency__marker` の個数と、`.tendency__row` の `aria-label` | **各行にマーカーがちょうど1個**あり、**アクティブセグメントの中にある**（`closest('[data-active="true"]')` が非 null）。`aria-label` に極ラベルと位置（何番目か）が含まれる。**行のテキスト（`textContent`）が極ラベル2語だけで、バンドの呼称語を含まない**（§0.1 R-2） |
| **B6**<br>（第2版で書き換え）<br>タイプ名が無いこと | `document.querySelectorAll('.playstyle-card__typename').length` と、ページ全体の `document.body.textContent` に対する呼称語の検索 | **`.playstyle-card__typename` が 0 個**。`body.textContent` に「タイプ」「バランス型」「攻撃寄り」「守備寄り」「鉄壁」「フルアタック」「門前主義」「速攻」が**1つも現れない**（§0.1 R-1/R-2 の実画面確認） |
| B7<br>欠損 | 状態9（`運` のみ欠損）・**状態13（傾向の片軸のみ欠損）** | 状態9: `.radar__area`（多角形）が **0個**、`.radar__dot` が **4個**、`運` のラベルは残る。`aria-label` に「運 データなし」相当が含まれる。状態10・11はメッセージが出てレーダーが `visibility: hidden`。**状態13: `.tendency__row` は2行のまま、欠損側の行に `.tendency__marker` が 0 個で `aria-label` に「判定できません」が含まれる**（§3.5） |
| B8<br>クランプ | 状態12 | 該当軸の頂点が外周上（中心からの距離 = `RADAR_RADIUS`、誤差1px以内）、かつ `.radar__value` は**クランプ前の実値**を表示、`data-clamped="true"` が付く |
| B9<br>実ページ | `#/4/player/<実在ID>/summary`（**実 API を叩けない環境では `fetch` を `src/api/testdata/*.json` を返すスタブに差し替えてよい。差し替えたことをレポートに明記**） | `playstyle-card` が **`rank-card` の後ろ**にある（`compareDocumentPosition`）。コンソールエラー0。水平スクロールなし（`scrollWidth <= clientWidth`）。**(a) 375px で縦積み（レーダーと傾向の `x` が同じ）／(b) 885px 相当で横並び（`x` が相異なり `y` が重なる）** |
| B10<br>リクエスト回数 | B9 の状態で Network を記録し、**期間チップを3回切り替える** | **`global_histogram` へのリクエストが期間切替の前後を通じて1回だけ**（`apiGet` のキャッシュと deps 設計の実証。§7-3）。`player_stats` / `player_extended_stats` は切替ごとに増えてよい |
| B11<br>フィルタ連動 | B9 でモード選択を変更 | レーダーの数値と傾向バーが**変わりうる**（`extended` が変わるため）。かつ**脚注のモード名が選択に追随する**（例: 玉の間のみ選択 → 「玉の間・半荘の全体分布との比較」）。操作中に `playstyle-card` の高さが**変わらない**（R1 の実ページ確認） |
| **B14**<br>（第2版で追加）<br>校正の実画面確認 | B9 の実ページ（またはスタブ）で、`.tendency__row` の `[data-active="true"]` の index を読み、**同じ入力を Node で `calcTendency`（校正後）に通した band と突き合わせる** | **2軸とも一致**。かつ Node で**校正前の式（`Σ/k`）でも計算し、少なくとも1軸で band が異なる**ことを示す（＝校正が実際に表示を変えていることの実証。フィクスチャ相当の入力なら攻守が 2 → 3 に動く。§1.5(d)） |
| B12<br>dark | `#/__playstyle` で `localStorage.setItem('mjsv:color-mode','dark')` → リロード | 全状態が dark で描画され、レーダーの塗り・リングが背景に埋もれない。`getComputedStyle(document.documentElement).colorScheme === 'dark'`。※`prefers-color-scheme` のエミュレーションは `matchMedia` の `change` を発火しないため**必ず localStorage 経由**（CLAUDE.md 既知の制約） |
| B13<br>色トークン | 状態5で `.radar__area` の `getComputedStyle().fill` / `stroke`、`.tendency__seg[data-active="true"]` の `background-color` を読む | いずれも `:root` の `--md-sys-color-primary` に由来する値と一致。**トークン外の色が1つも無い** |

### 8.4 UI検証の逆発注（オーナーへ委託）

`docs/ui-verification/TEMPLATE.md` を複製して手順書を作る（統括担当の作業）。**機械で測れる項目を混ぜないこと。** 各項目に「判断保留」欄と保留理由欄を置く。

| # | 委託内容 | 種別 |
|---|---|---|
| V1 | 実機で `#/4/player/<ID>/summary` を開き、レーダーの大きさ（最大 280px）とカード2（ドーナツ 240px）との**大小のバランス**が自然かを書く | 主観・実機 |
| V2 | **ラベルが無くても「この人がどういう打ち手か」がゲージ2本から伝わるか**を、自分と知人の2〜3人分で見て書く。伝わらないと感じたら、何が足りないか（極ラベルの語・マーカーの見え方・バーの長さ）を書く | **仕様の当否。オーナー確定（§0.1 R-1/R-2）の妥当性そのものの検証** |
| V3 | 極ラベル `守 ⇔ 攻` / `門前 ⇔ 速度` を見て、**ゲージの向き（右が攻・右が速度）が説明なしに読めるか**を書く | 表現の当否 |
| **V4**<br>（**校正の実地検証。第2版で最重要**） | **自分と知人の合計 5〜10 人ぶんの2軸の帯位置（左から何番目か）を記録して表にする**。校正後の名目は 各帯 7 / 24 / 38 / 24 / 7% | データ検証。エージェントには母集団が無く実施不能。**§6.3 の限界の唯一の検証手段**<br>**読み方**: 端（1番目/5番目）が名目 7% に対し**極端に多い（半数近くが端）なら ρ が大きい側**＝ `√k` が割り足りない。逆に**誰も端に来ず中央に集中するなら校正が効いていない**＝実装の疑い（B14 で先に潰れているはず）。**サンプルが10人では統計的な結論は出ない。「明らかにおかしい」だけを拾う目的**であることを手順書に明記する |
| V5 | 脚注「◯◯の全体分布との比較」（§3.3）を読んで、**比較対象が1モードに絞られていることが伝わるか**を書く | 表現の当否 |
| V6 | OS のダークモードを**実際に切り替えて**、レーダーの塗り（primary の 24% 透過）が light / dark 双方で読めるかを書く | エージェント環境で再現不能 |
| V7 | 三麻ページ（`#/3/player/<ID>/summary`）を開き、**レーダーの軸が欠けていないか / 「判定できません」が出ていないか**を報告する | **§1.6 の未確認事項。pl3 の分布に必要 metric があるかは実データでしか分からない** |

---

## 9. 後続 Issue への引き継ぎ

| Issue | 引き継ぎ |
|---|---|
| **#13（ヒストグラム14枚）** | `scope.distribution.histogram`（生の `GlobalHistogram`）を**そのまま使える**。追加のリクエストは0。`percentile()` も `src/domain/distribution.ts` に実装済み。**ただしグラフ形状が違うので `recharts` の是非は §1.1 と同じ手順（一時プローブ → `npm run build` → 削除）で再実測すること**（#9 §8 と同じ引き継ぎ） |
| **#11（カード4）** | `SummaryPanel` に追加する。**R1（§3.4）を同じく適用**。`empty` はパネル単位で1回だけ |
| **傾向2軸の校正**（第2版で内容差し替え） | 本 Issue で**合成の分母を `√k` に校正済み**（§3.1・§6）。残る不確かさは**項間相関 ρ が未測定**であること。ρ が判明したら分母を `sqrt(k/(1+(k−1)ρ))` に差し替える（**`src/domain/tendency.ts` の1箇所のみ**。`toBand` にも表示側にも波及しない）。判断材料は §6.3 の ρ 感度表と、受け入れ条件 V4 の観測記録 |
| **バンドの呼称・タイプ名** | **本 Issue では作らないと確定した**（§0.1 R-1/R-2）。後続 Issue で「やっぱり言葉がほしい」となった場合、`TendencyRow` に `label` を1つ足すだけで済む形にしてある（`band` は既にビューモデルに載っている）。ただし**その場合は §6.2 の占有率表を根拠に語の強さを配分すること**（校正後は両端に 6.8% が来るので、第1版が想定した「両端はめったに出ない」という前提はもう成り立たない） |
| **セクション色** | 本カードは**一切依存していない**（§3.6）。軸ごとに塗り分けると決まったら `--radar-stroke` / `--radar-fill` と `data-axis` 属性を起点に移行できる |
| **バンドル上限** | 本 Issue の上限は 500.0 kB / gzip 139.0 kB。**次 Issue は本 Issue の実測値を新しいベースラインとして枠を引き直すこと**（#9 は余裕 gzip 0.03 kB で次に進めなくなった） |
| **`docs/requirements.md` §6.2** | 「z合成の**平均**」「閾値 ±0.5・±1.5 → おおむね 7/24/38/24/7%」の記述は、**平均のままでは成立しない**（実測 67.9% が中央）。本 Issue で合成を `Σ/√k` に校正した結果**名目値どおりになった**（§6.2）。要件の「平均」を「√項数で正規化した合成」に改める必要がある。**本 Issue では `docs/requirements.md` を書き換えない**（統括担当の判断領域）。5段階の呼称例（鉄壁/守備寄り/…）も、オーナー確定により**実装しない**旨の反映が要る |
| **`docs/design/issue-4-domain-logic.md` §5.3** | 「有効な項の単純平均」の記述は本 Issue で覆った。**当該設計書は当時の記録として書き換えない**（§3.1.3）。参照する人向けに `src/domain/tendency.ts` の冒頭コメントから本設計書 §3.1 を指す |

---

## 10. 実挙動未確認・推定で書いた箇所

1. **`global_histogram` の実レスポンスを見ていない**（実 API アクセス禁止）。使ったのは `src/domain/__fixtures__/global_histogram.json`（#4 §7.4 のとおり `和牌率` 以外は**合成値**）。したがって §1.5 の (a)(b) の絶対値は「実データでの値」ではない。**分布の歪度・裾は再現されていない。**
2. **項間の相関 ρ は測定できていない（第2版で最も重要な未確認事項）。** §6.2 の校正後占有率は **ρ=0 を仮定した独立サンプリングの実測値**であり、実データでの占有率ではない。ρ > 0 なら帯は名目より広がる（§6.3 の感度表: ρ=0.4 で両端 13〜16%）。実データの ρ を得るにはプレイヤー母集団の**同時分布**が要り、`global_histogram` は周辺分布しか返さず `player_records` / `games` は CAP 保護下で方針上叩けない。**ただし (i) 各 z の SD が厳密に 1 であること、(ii) 正規化後の実効 SD が `sqrt(1+(k−1)ρ)` で ρ ≥ 0 なら 1 以上であること、の2点は定義上確実**なので、**「校正前より必ず改善する」「中央1マス集中は再発しない」という結論は ρ の値によらず成立する**。検証手段は受け入れ条件 V4 のみ。
2-b. **校正後の帯占有率を実データで確認していない。** §6.2 の数値はすべて合成フィクスチャからのサンプリング（200,000 件・固定シード）である。
3. **三麻（pl3）の `global_histogram` は完全に未確認**（#4 §9 から継続）。`打点效率` / `铳点损失` 等が band `"0"` に存在するかは不明。**設計は全軸 `null` になっても壊れない形にした**（§3.4 の `unavailable`）が、三麻で実際に何が出るかは受け入れ条件 V7（オーナー委託）で初めて分かる。
4. **`運` 軸のばらつきが他4軸の約 0.6 倍**という §1.5(b) の数値は合成フィクスチャ由来。実データでの倍率は未確認。**ただし「運軸は偏差値ではなく比率指標で、他軸と物差しが違う」ことは定義上確実**である。この非対称を UI で補正しない（補正すると `calcRadar` の値と画面が食い違う）。
5. **バンドル上限 500.0 kB / gzip 139.0 kB は実測プローブ（+4.03 / +1.54）に約3倍を掛けた枠**であり、フル実装の実測ではない。倍率の根拠は #9 の実績（プローブ +1.38 → 実装 +5.67、約4.1倍）。**上振れも下振れもありうる。**
6. **`--tendency-row-height: 36px` / `--note-height: 20px` の具体値は typescale からの見積り**であり、ブラウザ実測ではない。`ready` 側の自然高がこれを超えると R1 が壊れる。**B4 が検出する**が、超えていた場合は「変数の値を上げる」ことで直す（ready 側を縮めない）。**形状マーカー（§3.6）が行の高さを押し上げないことも未確認**で、押し上げていれば同じく B4 が検出する。
7. **`@container` の 600px 境界はカード2（#9）に揃えただけ**で、カード3の内容量から導いた値ではない。実測（B9）で横並びが窮屈なら境界を上げる余地がある。
8. **傾向バーの `aria-label` の読み上げ文言は実機のスクリーンリーダーで確認していない。** 「守側から4番目」のような位置表現が音声で自然に聞こえるかは未検証。文言の当否は V2/V3 で拾える範囲にとどまる。
9. **`selectRepresentativeMode` を `gameCountByMode` なしで呼ぶ**ため、「金の間しか打っていないが全モード選択中」のプレイヤーは王座の間の分布と比較される。**モード別試合数が API から取れない**ことによる原理的な限界で、脚注（§3.3）で開示することしかできない。
