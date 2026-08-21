# Issue 3 設計書: API層（クライアント・型定義・エラー処理）

作成日: 2026-08-21
対象 Issue: #3 API層: クライアント・型定義・エラー処理
前提資料: `docs/amae-koromo-api-spec.md`（一次資料）/ `docs/requirements.md` §5・§6・§7 / CLAUDE.md「API利用の方針」
検証方法: **パターンB（設計フェーズで最小限の実叩き）**。robots.txt 確認込みで実リクエスト計10回（§1.1 の台帳参照）。本家ソース `../src/amae-koromo/src/data/`（MIT、リポジトリ外に clone 済み）の `api.ts` / `misc.ts` / `records/loader.ts` / `types/*.ts` を全読して突合済み

---

## 0. 確定済み前提（変更不可）

- **`games` / `player_records` は実装しない**（CAP保護下。迂回禁止。CLAUDE.md 明記）
- 使用エンドポイントは認証不要の6つのみ: `search_player` / `player_stats` / `player_extended_stats` / `global_histogram` / `global_statistics_2` / `level_statistics`
- ミラー4系統: `5-data` → `1.data` → `2.data` → `4.data`（.amae-koromo.com）
- CORS は任意 Origin を許可（API仕様書 §5 で実測確認済み）→ ブラウザから直接 fetch できる。サーバー・プロキシ不要
- リクエスト節度: 1画面表示あたり数リクエスト以内。二分探索等の多量コール手法は禁止
- tsconfig 制約: `verbatimModuleSyntax` / `erasableSyntaxOnly`（**TS enum・constructor パラメータプロパティ使用禁止**）/ `noUnusedLocals` / `noUnusedParameters`
- `package.json` の `"sideEffects": ["*.css"]` 宣言下にあるため、**副作用のためだけの bare import は書かない**（本設計の全モジュールは export 経由でのみ使われる純粋モジュール。該当リスクなし）

---

## 1. 実API検証の記録

### 1.1 robots.txt の確認と実叩き可否の判断（ステップ0）

`https://5-data.amae-koromo.com/robots.txt` を最初に取得した。結果:

```
HTTP/2 400（Cloudflare 経由、オリジンは nginx/1.29.8）
本文: <html>…<h1>400 Bad Request</h1>…（nginx の定型エラーページ）
```

- データミラーには **robots.txt が存在しない**（パス自体が 400 で拒否される）。AI ボットに対する Disallow 指定も、全 UA に対する Disallow 指定も**存在しない**
- RFC 9309 §2.3.1.3 により、robots.txt が 4xx（unavailable）の場合クローラはアクセス制限なしとして扱ってよい
- 本体サイト `amae-koromo.sapk.ch` の AI ボット Disallow（API仕様書 §2.3）はデータミラーには適用されていない。また運営者が明示的に設けたアクセス制御（Cap）は `games` / `player_records` のみを保護しており、本設計はそれらに触れない
- 以上より**実叩きを実施可と判断**した。UA 偽装なし（curl のデフォルト UA）、CAP保護下エンドポイントへのアクセスなし

### 1.2 リクエスト台帳（合計10回・予算10回）

| # | リクエスト | 結果 |
|---|---|---|
| 1 | `GET /robots.txt` | 400（robots.txt 不存在） |
| 2 | `pl4/search_player/{2文字プレフィックス}?limit=5&tag=all` | 200 |
| 3 | `pl4/player_stats/{id}/1262304000000/{nowMs}?mode=`（空） | **400 `{"error":"mode_is_required"}`** |
| 4 | `pl4/player_extended_stats/{同}?mode=`（空） | **400 `{"error":"mode_is_required"}`** |
| 5 | `pl4/player_stats/{id}/1262304000000/{nowMs}?mode=16.12.9.15.11.8` | 200 |
| 6 | `pl4/player_extended_stats/{同}?mode=16.12.9.15.11.8` | 200 |
| 7 | `pl4/global_histogram` | 200（約380KB） |
| 8 | `pl4/global_statistics_2?mode=16.12.9.15.11.8` | 200（約54KB） |
| 9 | `pl4/level_statistics` | 200 |
| 10 | `pl3/level_statistics`（三麻パス形状確認） | 200 |

プレイヤー ID は search_player の結果から取得した実在プレイヤーのもの（ユーザー本人ではない）。本設計書では `123456789` に置換して例示する。#3・#4 の 400 は予備予算2回を消費した想定外の収穫（§1.3 差分1）。

異常系（404 `id_not_found` / `{maintenance}` / `{result_key}` / ミラー障害）は**実叩きで再現させていない**。これらは API仕様書 §2.2・§4.5 と本家実装準拠で設計する（該当箇所に「実挙動未確認」と明記）。

### 1.3 仕様書・本家型定義との差分（実レスポンスが正）

1. **`mode` パラメータは必須**。`?mode=`（空文字）は 400 `{"error":"mode_is_required"}`。「全モード」は**全 GameMode ID を明示列挙**して表現する（本家も `mode.length ? mode : Conf.availableModes` で常に全列挙を送っている。仕様書 §3 の表には空可否の記載がなく、§4.5 の「全モード」実測も全列挙で行われていたと推定される）。→ 仕様書 §3 に追記推奨
2. **`global_statistics_2` のトップレベルキーは「リクエストした mode 文字列そのもの」**。`?mode=16.12.9.15.11.8` に対しキーは `"16.12.9.15.11.8"` の1個だけ。仕様書 §3.4 の「モード×段位別」はモードごとに分かれる印象を与えるが、実際は**リクエスト単位の1集計**。また本家型 `GlobalStatistics` にある `num_players` は実レスポンスの entry（`{basic, extended}`）に**存在しない**
3. **`player_extended_stats` のレスポンスには `id` と `played_modes` が含まれる**（本家型 `PlayerExtendedStats` には無いキー。実レスポンス末尾に `"id": 123456789, "played_modes": [8]`）
4. **`search_player`（pl4）は三麻 levelId のプレイヤーも返す**。検索5件中3件の `level.id` が 2xxxx（三麻）だった。検索インデックスは四麻/三麻横断とみられる。**検索結果の `level` を「四麻の段位」と決めつけてはならない**
5. **`played_modes` は number 配列**で返る（本家型は `(string | GameMode)[]` で parseInt している。実レスポンスは `[8]`）
6. `search_player` の `latest_timestamp` は**秒単位**（実測値 1618494843 ≈ 2021-04）。仕様書 §3 の「レコード内の時刻は秒」の一般則どおり
7. **`global_histogram` の実形状**（仕様書 §3.4 より詳細な実測）:
   - トップキーは単一モード文字列 `"8" "9" "11" "12" "15" "16"`（pl4）
   - 各モード配下の段位帯キーは `"0"`（卓全体）＋卓別の段位帯（例: mode 8 は 10301〜10403、mode 16 は 10501〜10503 と **10799**＝魂天合算バンド）
   - **band 0 のみ** `mean` + `histogramFull` + `histogramClamped` を持つ。**段位帯バンドは `mean` のみ**（要件 §6.1 の前提と一致・実測で確定）
   - band 0 でも回数系6指標（`最大累计番数` `最大连庄` `W立直` `役满` `累计役满` `流满`）は `histogramClamped` を持たない（`histogramFull` はある）
   - 指標は56個。`PlayerExtendedStats` に無い `count` `对局数` `局收支` `立直好型` を含む
8. **回数系キーの省略（実測確定）**: 対局数54戦のプレイヤーで `役满` `累计役满` `W立直` `流满` が**キーごと欠落**、`最大连庄`(2) `最大累计番数`(7) は存在した。つまり省略は Issue 記載の6キャンディデート全てに起こりうる（値0のとき）。さらに `global_statistics_2` の extended でも段位帯によって `累计役满` が欠落する例を確認 → **省略はプレイヤー統計に限らない**
9. `player_stats` の実レスポンス形状は本家型 `PlayerMetadata` と一致（`extended_stats` / `cross_stats` はクライアント側で合成されるフィールドであり、ワイヤには乗らない）:

```json
{
  "count": 54,
  "level": { "id": 10301, "score": 695, "delta": -11 },
  "max_level": { "id": 10301, "score": 1184, "delta": 0 },
  "rank_rates": [0.2037, 0.1481, 0.3888, 0.2592],
  "rank_avg_score": [37718, 27250, 21357, 11079],
  "avg_rank": 2.7037,
  "negative_rate": 0.0555,
  "id": 123456789,
  "nickname": "（匿名化）",
  "played_modes": [8]
}
```

（search_player の結果から得た実 ID で検証済み。数値は実データ、id/nickname のみ置換）

10. `level_statistics` は pl4 / pl3 とも `[zone, levelId, num_players][]`（pl4: 69行、pl3: 70行。pl3 の levelId は 2xxxx）。パスプレフィックス `api/v2/pl3/` の疎通も確認済み
11. `tag` クエリの本家実装（`records/loader.ts` 実物）: `search_player` は固定 `tag=all`、`player_stats` / `player_extended_stats` は**1時間粒度のタイムタグ** `Math.floor(now秒/3600)`、グローバル系（histogram / statistics / level_statistics）は **tag なし**

---

## 2. モジュール構成

```
src/api/
  index.ts          バレル（公開面はここから import させる）
  gameMode.ts       GameMode ID 定数・全モードリスト・joinModes
  errors.ts         ApiError / MaintenanceError / RangeNotSupportedError
  mirrors.ts        ミラーリスト・選択状態・localStorage 永続化
  client.ts         fetch 核（タイムアウト・フォールバック・キャッシュ・特殊レスポンス）
  types.ts          ワイヤ型（Raw*）と公開型
  normalize.ts      Raw → 公開型変換（?? 0 補完・count 改名・Date 化）
  endpoints.ts      公開6関数 + getCurrentLevel
  range.ts          期間解決（RangeSpec / RangeResolver）
  testdata/         匿名化フィクスチャ JSON（§7.3）
  *.test.ts         vitest テスト（対象モジュールと同階層に併置）
```

- アプリコードは **必ず `src/api`（index.ts）から import** する。`Raw*` 型と client 内部関数はバレルに載せない
- React 依存なし（hooks 化は後続 Issue の責務）。`dayjs` にも依存しない（境界は `Date` と number で完結。§4.3）

---

## 3. gameMode.ts

```ts
export type GameMode = 8 | 9 | 11 | 12 | 15 | 16 | 21 | 22 | 23 | 24 | 25 | 26;
export type NumPlayers = 3 | 4;

/** 表示順を兼ねた全モードリスト（上位卓・半荘優先）。「全モード」クエリはこれを明示列挙する */
export const ALL_MODES_4: readonly GameMode[] = [16, 12, 9, 15, 11, 8];
export const ALL_MODES_3: readonly GameMode[] = [26, 24, 22, 25, 23, 21];

export function allModes(numPlayers: NumPlayers): readonly GameMode[];
/** '.' 連結。空配列は Error を throw（mode_is_required を型より手前で防ぐ。§1.3 差分1） */
export function joinModes(modes: readonly GameMode[]): string;
```

- `erasableSyntaxOnly` のため **TS enum は使わない**。ID→名称のラベルマップは表示層（Issue 4/6）の責務でありここには置かない
- ID の意味は仕様書 §4.1 のとおり（四麻 王座16/玉12/金9/王東15/玉東11/金東8、三麻 26/24/22/25/23/21）

## 4. 型定義（types.ts / normalize.ts）

### 4.1 方針: ワイヤ型と公開型を分離し、境界で1回だけ正規化する

- **ワイヤ型 `Raw*`**: 実レスポンス（§1 で保存した JSON）に忠実。回数系キーは optional。`types.ts` 内でのみ使用し、バレル非公開
- **公開型**: `normalize.ts` で変換して返す。変換内容は次の3点だけ（それ以外のキー名は中国語キー含めワイヤのまま維持。対訳・表示名は Issue 4 以降の責務）:
  1. **`count` の改名**（§4.2）
  2. **回数系キーの `?? 0` 補完**（§4.4）
  3. **秒単位時刻の `Date` 化**（§4.3）

### 4.2 `count` の二重の意味 → 正規化で名前を分ける

| ワイヤ | 公開型 | 意味 |
|---|---|---|
| `RawPlayerStats.count` | `PlayerStats.gameCount` | **試合数** |
| `RawPlayerExtendedStats.count` | `PlayerExtendedStats.roundCount` | **局数** |

公開型には `count` という名前のフィールドを**残さない**（残すと呼び出し側で混同が再発する）。`global_statistics_2` の basic/extended 内の `count` も同じ規則で `gameCount` / `roundCount` に改名する。

### 4.3 時刻単位の混在 → 境界で `Date` に閉じ込める（branded type は不採用）

- **公開関数の期間引数は `Date` 型のみ**受け取り、内部で `.getTime()` して URL パス（ミリ秒）に埋める。number を直接受けないため「秒を渡してしまう」事故が型レベルで起きない
- **レスポンス内の秒単位時刻は正規化で `Date` に変換**し、フィールド名も改名する（`latest_timestamp`(秒) → `lastPlayedAt: Date`、`最近大铳.start_time`(秒) → `recentBigLoss.startedAt: Date`）
- branded type（`TimestampMs` 等）は、公開面から生 number が消える本方式では防御が二重になるだけなので**不採用**（過剰設計の回避）
- 内部（client.ts / range.ts）では `startMs` / `endMs` のように**必ず単位サフィックス付きの変数名**を使う

### 4.4 公開型定義

```ts
export type LevelWithDelta = {
  id: number;     // levelId（仕様書 §4.3。解釈・表示は Issue 4）
  score: number;
  delta: number;  // 現在ポイント = score + delta（仕様書 §4.5）
};

export type PlayerSearchResult = {
  id: number;
  nickname: string;
  /** 注意: pl4 検索でも三麻 levelId (2xxxx) が返りうる（§1.3 差分4） */
  level: LevelWithDelta;
  lastPlayedAt: Date;   // ワイヤ latest_timestamp（秒）から変換
};

export type PlayerStats = {
  id: number;
  nickname: string;
  gameCount: number;            // ワイヤ count（試合数）
  /** クエリ範囲内の最終対局時点のスナップショット。現在段位には getCurrentLevel を使う */
  level: LevelWithDelta;
  max_level: LevelWithDelta;    // 同上（クエリ範囲内の最大）
  rank_rates: number[];         // 長さ 4（四麻）/ 3（三麻）
  rank_avg_score: number[];     // 同上
  avg_rank: number;
  negative_rate: number;
  played_modes: GameMode[];     // number で返ることを実測確認済み（§1.3 差分5）
};

export type FanStatEntry = { id: number; label: string; count: number; 役满: number };

export type PlayerExtendedStats = {
  roundCount: number;           // ワイヤ count（局数）
  // --- 回数系6キー: ワイヤでは値0のときキー省略 → 0 補完して必須化 ---
  最大连庄: number;
  最大累计番数: number;
  役满: number;
  累计役满: number;
  W立直: number;
  流满: number;
  // --- 率・点数系（実レスポンスで全て存在を確認したもの。中国語キーはワイヤのまま） ---
  和牌率: number; 自摸率: number; 默听率: number; 放铳率: number;
  副露率: number; 立直率: number; 平均打点: number; 和了巡数: number;
  平均铳点: number; 流局率: number; 流听率: number; 一发率: number;
  里宝率: number; 被炸率: number; 平均被炸点数: number;
  放铳时立直率: number; 放铳时副露率: number;
  立直后放铳率: number; 立直后非瞬间放铳率: number; 副露后放铳率: number;
  立直后和牌率: number; 副露后和牌率: number; 立直后流局率: number; 副露后流局率: number;
  放铳至立直: number; 放铳至副露: number; 放铳至默听: number;
  立直和了: number; 副露和了: number; 默听和了: number;
  立直巡目: number; 立直收支: number; 立直收入: number; 立直支出: number;
  先制率: number; 追立率: number; 被追率: number; 振听立直率: number;
  立直好型: number; 立直好型2: number; 立直多面: number;
  打点效率: number; 铳点损失: number; 净打点效率: number;
  平均起手向听: number;
  // --- 母数条件により欠落しうるもの（0 補完すると意味が変わるため optional のまま） ---
  平均起手向听亲?: number;      // 親番が無いと欠落しうる（本家型で optional）
  平均起手向听子?: number;
  recentBigLoss?: {             // ワイヤ 最近大铳（start_time 秒 → Date 化・改名）
    id: string;
    startedAt: Date;
    fans: FanStatEntry[];
  };
};
```

補完方針の線引き: **「回数」は 0 が正しい既定値**なので補完する。**「平均・率」は母数ゼロのとき 0 ではなく「値なし」**なので optional のまま残す（`平均起手向听亲/子`）。`局收支` はワイヤに存在せずクライアント計算（本家 `processExtendedStats` / 要件 §6.6）のため**API層では持たない**（Issue 4 の責務。§9 引き継ぎ）。

`立直好型` `立直多面` `立直好型2` は今回の実レスポンスに存在したが、本家型では一部 optional。normalize では「回数系6キー以外の欠落キーはそのまま undefined を通す」実装とし、上記3つは実測どおり必須側に置く（万一欠落する古いデータに当たった場合は Issue 4 側の表示で `-` 表示にフォールバックする。検収はフィクスチャベースなのでこの判断で製造が止まることはない）。

```ts
export type GlobalStatisticsEntry = {
  // num_players はワイヤに存在しない（§1.3 差分2）
  basic: {
    gameCount: number;          // ワイヤ count
    rank_rates: number[];
    avg_rank: number;
    negative_rate: number;
  };
  extended: PlayerExtendedStats; // 回数系キーは同じ 0 補完を適用（§1.3 差分8）
};
/** キー: levelId 文字列（例 "10503"、魂天は "10701"〜個別） */
export type GlobalStatistics = { [levelId: string]: GlobalStatisticsEntry };

export type HistogramData = { min: number; max: number; bins: number[] };
export type HistogramGroup = {
  mean: number;
  histogramFull?: HistogramData;     // band "0" のみ存在
  histogramClamped?: HistogramData;  // band "0" かつ回数系6指標以外のみ存在
};
/** metric キー56種（PlayerExtendedStats のキー ∪ {count, 对局数, 局收支, 立直好型}） */
export type GlobalHistogramLevelBand = { [metric: string]: HistogramGroup };
/**
 * modeId("8"等・単一モード) → band → metric。
 * band "0" = 卓全体（histogramFull あり）、その他 = 段位帯（mean のみ）。
 * 魂天は "10799" に合算される（王座の間のみ・実測）。
 */
export type GlobalHistogram = {
  [modeId: string]: { [levelBand: string]: GlobalHistogramLevelBand };
};

/** [zone(1=中国 2=日本 3=英語圏), levelId, num_players] */
export type LevelStatisticsItem = [number, number, number];
export type LevelStatistics = LevelStatisticsItem[];
```

`GlobalStatistics` はワイヤの「mode 文字列キーの1段」を**関数内で剥がして返す**（呼び出し側は自分が渡した mode 文字列を知っているが、二重に持ち回るのはバグの温床。§1.3 差分2）。

## 5. クライアント設計（client.ts / mirrors.ts / errors.ts）

### 5.1 ミラーフォールバック — 逐次切替を採用（本家の並列 probe は不採用）

本家は失敗時に**全4ミラーへ同時 probe** して最速を採用するが、これは一度の障害で同一リクエストを4連射する。要件 §7「リクエスト節度」と衝突するため**採用しない**。

採用する方式:

1. **リクエストごとに起点インデックスを1回だけスナップショットする**（`const startIndex = getSelectedMirrorIndex()` をループの外で読む）。以降のフォールバックは `(startIndex + i) % MIRRORS.length` で計算し、ループの中で可変グローバル `selectedMirrorIndex` を読み直さない
2. 起点ミラーで fetch（タイムアウト **5000ms**、`AbortController`）
3. **ネットワーク層の失敗（fetch reject / タイムアウト）のときのみ**次のミラーへ進んで同一パスを再試行。HTTP エラーレスポンス（404/400/5xx）は**フォールバックしない**（どのミラーでも同じ結果になるため。本家 `fetchData` も fetch 例外時のみ切替）
4. 4系統全滅で `ApiError`（`status: 0`、`cause` に最後の例外）
5. 成功したミラーを `selectedMirrorIndex` に記憶し、localStorage キー **`mjsv:api-mirror`** にオリジン文字列で永続化。起動時に読み戻す（リストに無い値は無視）
6. localStorage アクセスは try/catch で包み、失敗時はメモリのみで動作（プライベートモード・テスト環境対策）

**バグ修正の記録**（PR #22 Codex レビュー指摘・2件目）: 当初の実装はループ内で `getSelectedMirrorIndex()` を毎回読み直しており、`player_stats` と `player_extended_stats` のように同一操作内で並行発行される2本のリクエストが同時にミラー0で失敗すると、片方が成功して選択インデックスを書き換えた瞬間にもう片方が唯一生きているミラーを飛ばして残り全ミラーを試し「全滅」と誤判定する事故があった。要件 §5.2 の「1操作あたりAPIコール2回」を踏まえると通常運用で再現するため、起点インデックスをリクエスト開始時に1回だけスナップショットする方式に修正した。各リクエストは必ず全ミラーをちょうど1周する。

### 5.2 メモリキャッシュ

- `Map<string, Promise<unknown>>`。キーは**ミラーを含まない** `apiPrefix + path`（クエリ込み）
- **Promise を格納**する（本家は解決値を格納）。同一 URL の同時多発呼び出しが1リクエストに合流する（in-flight dedupe）。reject した Promise は Map から削除する（失敗をキャッシュしない）
- 上限 **500 エントリ**。超過時は**全クリア**（本家と同じ。LRU は過剰設計 — 全クリア後の再取得コストは高々数リクエスト）
- 「現在まで」を含むクエリの可変性は **`tag` パラメータの1時間タイムタグ**（§5.3）と **endMs の1時間丸め**（§6.3）で解決する: URL 自体が1時間ごとに変わるため、古いエントリは自然に参照されなくなり、500 上限の全クリアで回収される。TTL 管理は実装しない

### 5.3 `tag` パラメータ（本家踏襲・§1.3 差分11）

| エンドポイント | tag |
|---|---|
| `search_player` | `tag=all`（固定） |
| `player_stats` / `player_extended_stats` | `tag=${Math.floor(Date.now() / 3_600_000)}`（1時間粒度） |
| グローバル3種 | なし |

### 5.4 特殊レスポンス（**実挙動未確認**・仕様書 §2.2 と本家 `handleResponse` 準拠）

- **`{"maintenance": "..."}`** → `MaintenanceError(message)` を throw。本家は全コンポーネントを凍結する（never-resolve な Promise を返す）が、本アプリは throw して上位でメンテ画面表示に変換する（Issue 5 以降で catch。凍結方式はエラーハンドリングが不可能になるため不採用）
- **`{"result_key": "..."}`** → 1000ms 待機 → `{mirror}/{apiPrefix}/result/{result_key}` を `Cache-Control: max-age=0, no-cache` ヘッダ付きで再取得し、レスポンスを同じハンドラで再処理。**最大5回**で打ち切り `ApiError` を throw（本家は無制限再帰だが、無限ループ防止のため上限を設ける）。`result/...` の URL はキャッシュに入れない
  - **バグ修正の記録**（PR #22 Codex レビュー指摘・1件目）: 当初の実装は `result/{result_key}` のみを URL に使っており、元リクエストの API プレフィックス（`api/v2/pl4` 等）が丸ごと欠落していた。仕様書 §3「パスはすべて `{mirror}{apiSuffix}` の後ろに続く」に基づき `{apiPrefix}/result/{result_key}` の形に修正した。加えて、再取得先のミラーは可変グローバル `getSelectedMirror()` を読み直すのではなく、**元リクエストで実際に成功したミラーを呼び出し元（`fetchWithFallback`）から引数で引き継ぐ**方式にした（グローバルの読み直しは指摘2と同種の並行実行時の不整合を招くため）。この経路自体は実挙動未確認のままであり、あくまで仕様書の規約に基づく修正である
- 上記2分岐は JSON 本文がオブジェクトで該当キーを持つ場合のみ発動（配列レスポンスでは発動しない）

### 5.5 エラー分類（errors.ts）

```ts
/** HTTP エラー・全ミラー失敗・result_key 打ち切り */
export class ApiError extends Error {
  status: number;   // HTTP ステータス。ネットワーク全滅は 0
  url: string;      // 最後に試みた URL（パス部分）
  constructor(message: string, status: number, url: string) { ... }
}
export class MaintenanceError extends Error { ... }
export class RangeNotSupportedError extends Error { ... }  // §6.4
```

- `erasableSyntaxOnly` のため**フィールド宣言＋コンストラクタ本体で代入**する（`constructor(public status: number)` は書けない）
- **404 の扱い**: client の内部関数 `apiGet<T>(path, opts)` はオプション `nullOn404: boolean` を持つ。true のとき HTTP 404 は throw せず `null` を解決値としてキャッシュごと返す。**`player_stats` / `player_extended_stats` のみ true**（「その期間にデータなし」は正常系。仕様書 §4.5・実挙動未確認だが本文 `{"error":"id_not_found"}` の解析はせずステータスのみで判定する — 404 かつこの2エンドポイントなら意味は一意）。他のエンドポイントの 404 と、400 等その他の HTTP エラーは `ApiError` を throw（400 `mode_is_required` は呼び出し側のプログラミングエラーであり隠してはならない — ただし §3 の `joinModes` が空配列を throw するため通常到達しない）

## 6. 公開関数（endpoints.ts / range.ts）

### 6.1 共通事項

- 全関数の第1引数は `numPlayers: NumPlayers`（3 | 4）。API プレフィックス `api/v2/pl4/` / `api/v2/pl3/` に対応
- `modes` 引数は省略可。**省略時・空配列時は `allModes(numPlayers)` を明示列挙**して送る（空 mode は 400。§1.3 差分1）
- 期間引数は `Date`（§4.3）。URL には `date.getTime()`（ミリ秒）を埋める

### 6.2 シグネチャ

```ts
export async function searchPlayer(
  numPlayers: NumPlayers,
  prefix: string,
  limit?: number,        // 既定 20
): Promise<PlayerSearchResult[]>;
// 空白 trim 後に空なら fetch せず [] を返す（本家踏襲）。encodeURIComponent 必須

export async function getPlayerStats(
  numPlayers: NumPlayers,
  playerId: number,
  start: Date,
  end: Date,
  modes?: readonly GameMode[],
): Promise<PlayerStats | null>;   // null = 期間内データなし（404）

export async function getPlayerExtendedStats(
  numPlayers: NumPlayers,
  playerId: number,
  start: Date,
  end: Date,
  modes?: readonly GameMode[],
): Promise<PlayerExtendedStats | null>;

export async function getGlobalHistogram(
  numPlayers: NumPlayers,
): Promise<GlobalHistogram>;

export async function getGlobalStatistics(
  numPlayers: NumPlayers,
  modes?: readonly GameMode[],
): Promise<GlobalStatistics>;     // ワイヤの mode 文字列キー1段を剥がして返す

export async function getLevelStatistics(
  numPlayers: NumPlayers,
): Promise<LevelStatistics>;      // 本家同様 levelId 昇順ソートして返す
```

パス構築例: `player_stats/${playerId}/${start.getTime()}/${end.getTime()}?mode=${joinModes(modes)}&tag=${hourTag()}`

### 6.3 getCurrentLevel（要件 §5.3 / 仕様書 §4.5）

`player_stats.level` は「クエリ範囲内の最終対局時点のスナップショット」なので、現在段位は**全モード・全期間・終端=現在**で引く必要がある。カード1（段位・pt・昇降条件）はフィルタに関わらず常にこれを使う。

```ts
export type CurrentLevelInfo = {
  level: LevelWithDelta;       // 現在段位。現在pt = score + delta
  maxLevel: LevelWithDelta;    // 生涯最高
  nickname: string;
  gameCount: number;           // 生涯試合数
  playedModes: GameMode[];
};
export async function getCurrentLevel(
  numPlayers: NumPlayers,
  playerId: number,
): Promise<CurrentLevelInfo | null>;
```

- 実装は `getPlayerStats(numPlayers, playerId, DATA_MIN_DATE, currentHourEnd(), allModes(numPlayers))` の薄いラッパー。**独自の fetch はしない**ため、フィルタが全期間・全モードのときはキャッシュが完全に共有され追加リクエスト0で済む
- `DATA_MIN_DATE` = `2010-01-01T00:00:00Z`（= 1262304000000。本家 `PlayerDataLoader` の既定 startDate と同値）
- `currentHourEnd()` = 現在時刻を**次の1時間境界へ切り上げた** `Date`。終端が1時間の間 URL 安定になりキャッシュが効く（§5.2）。未来時刻の終端はフィルタ上限として無害（本家も「現在の分の末尾」を送っている）。§5.3 の1時間 tag と粒度が揃う

### 6.4 期間解決インターフェース（要件 §5.2 の将来拡張点）

「直近n戦」（`player_records` 必須・承諾後実装）を、**API層の呼び出し規約を変えずに**追加できる形をここで確定する。

```ts
// range.ts
export type PeriodPreset = 'all' | '1y' | '90d' | '30d' | '7d';
export type RangeSpec =
  | { kind: 'preset'; preset: PeriodPreset }
  | { kind: 'lastNGames'; n: 100 | 200 | 300 | 500 };   // 承諾後に有効化
export type ResolvedRange = { start: Date; end: Date };

export interface RangeResolver {
  resolve(spec: RangeSpec, numPlayers: NumPlayers, playerId: number): Promise<ResolvedRange>;
}

/** preset のみ解決する既定実装。lastNGames は RangeNotSupportedError を throw */
export const defaultRangeResolver: RangeResolver;
export function resolveRange(
  spec: RangeSpec, numPlayers: NumPlayers, playerId: number,
): Promise<ResolvedRange>;
/** 承諾後: player_records ベースの resolver を差し込む（それまで呼ばれない） */
export function setRangeResolver(resolver: RangeResolver): void;
```

- preset の解決: `end = currentHourEnd()`、`start` は `all` → `DATA_MIN_DATE`、それ以外 → `end - N日`。**丸めた end を基準に引く**ため URL が1時間安定
  - **バグ修正の記録**（PR #22 Codex レビュー指摘・3件目）: `all` の分岐は当初 `DATA_MIN_DATE`（export 済みの共有 `Date` インスタンス）をそのまま返しており、消費側が戻り値の `start` に対して `setFullYear` 等の破壊的メソッドを呼ぶと、以降その実行中の全ての「全期間」クエリと `getCurrentLevel` が汚染された開始時刻を使い続ける事故があった。タイムスタンプから `new Date(DATA_MIN_DATE.getTime())` で毎回新しいインスタンスを組み立てて返すよう修正した
- 承諾後の実装追加は「`lastNGames` を解決する `RangeResolver` を実装して `setRangeResolver` する」だけ。既存6関数・呼び出し側 UI は無変更（要件 §5.2 の「実装追加のみで対応」を満たす）
- playerId / numPlayers を resolve の引数に入れてあるのは lastNGames の境界時刻特定に必要なため。preset では未使用（`noUnusedParameters` に注意 — インターフェース実装の未使用引数は `_` プレフィックスにする）

## 7. テスト戦略 — vitest を本 Issue で導入する（結論）

### 7.1 判断と根拠

**導入する。** 根拠:

1. Issue 3 の完了条件「回数系キーの補完が**テストで確認されている**」はテスト基盤なしには満たせない
2. 検収で実APIを叩かせない方針（§8）を取る以上、モック fetch によるテストが唯一の機械検証手段
3. Issue 4（ドメイン計算ロジック）は「要ユニットテスト」であり、どのみち直後に必要になる
4. 互換性を確認済み: **vitest 4.1.11 の peerDependencies は `vite: ^6.0.0 || ^7.0.0 || ^8.0.0`**（npm registry 実照会）。本プロジェクトの Vite 8.2 と適合

### 7.2 導入範囲（最小）

- devDependencies に **`vitest`（^4.1.11）のみ**追加。jsdom / happy-dom / testing-library は**入れない**（API層・Issue 4 とも純ロジック。DOM 不要。環境は既定の node）
- `package.json` に `"test": "vitest run"` を追加。設定ファイルは作らない（vitest は `*.test.ts` を規約で発見する。必要になったら `vite.config.ts` に `test` ブロックを足す — その際は `/// <reference types="vitest/config" />` を使う）
- `tsconfig.app.json` は `*.test.ts` を `include: ["src"]` に含める点では変更不要（`tsc -b` で型検査される）。`vitest/globals` は使わず **`import { describe, it, expect, vi } from 'vitest'` を明示**する — globals 注入は tsconfig 変更が必要になるため不採用
- **`resolveJsonModule: true` のみ追加**（フィクスチャ JSON を直接 import するため。§7.3 参照）。`/// <reference types="node" />` 等で node のアンビエント型をプログラム全体に漏らす手段は**採用しない**（tsconfig の `"types"` を実質的に無効化してしまい、ブラウザ用コードが `process` 等を型エラーなしで参照できてしまう。検収の実証で判明した回帰）
- localStorage は §5.1 のとおり try/catch ガード済みなので node 環境で問題にならない。`fetch` / `AbortController` は Node 20+ にネイティブ存在し、テストでは `vi.stubGlobal('fetch', mock)` で差し替える

### 7.3 フィクスチャ

- §1 で保存した実レスポンス JSON を**匿名化して** `src/api/testdata/` にコミットする: `id` → `123456789`、`nickname` → `"テストプレイヤー"`、`最近大铳.id`（牌譜ID）→ ダミー文字列。それ以外の数値は実データのまま（型検証の根拠として価値があるため）
- 対象: `player_stats.json` / `player_extended_stats.json`（回数系4キー欠落の実物）/ `search_player.json` / `level_statistics.json`。histogram / global_statistics_2 は巨大なため**縮約版**（mode 1個 × band 2個 / level 2個に間引き。構造は実物どおり）を手で起こす
- **読み込み方式: ES import（`resolveJsonModule`）を使う。** テストファイルから `import raw from './testdata/xxx.json'` の形で直接 import し、`as unknown as Raw*` で型付けする。`node:fs` 等 node 組み込みモジュールには依存しない — `tsconfig.app.json` に `types` の `"node"` 追加や `/// <reference types="node" />` を必要とする実装は**採用しない**（ブラウザ向けアプリコード全体に `process` 等のアンビエント型が漏れ、`CLAUDE.md` が警告する「エラーも警告も出ずに壊れる」類のリスクになるため）

### 7.4 必須テストケース（受け入れ条件と対応）

| # | 対象 | ケース |
|---|---|---|
| T1 | normalize | 回数系6キーが欠落したフィクスチャ → 全て 0 で補完され、存在するキー（最大连庄=2 等）は実値保持 |
| T2 | normalize | `count` が公開型から消え `gameCount` / `roundCount` に載る。`latest_timestamp`(秒) → `lastPlayedAt` が正しい `Date` |
| T3 | client | 同一 URL 2回呼び → fetch は1回（キャッシュ）。同時2連呼びでも1回（in-flight 合流） |
| T4 | client | 1st ミラー reject → 2nd ミラーで成功、以後の呼び出しは2ndへ直行。localStorage 書き込み値も検証 |
| T5 | client | 4ミラー全 reject → `ApiError`（status 0） |
| T6 | client | 404 + nullOn404 → null 解決（throw しない）。404 + 非対象エンドポイント → `ApiError` |
| T7 | client | `{maintenance}` → `MaintenanceError`。`{result_key}` → fake timers で1秒待機後 `result/{key}` を再取得し最終値を返す。5回超で `ApiError`（**仕様書準拠の挙動をテストが固定化する**。実挙動と食い違いが見つかったら仕様書ごと更新） |
| T8 | gameMode | `joinModes([])` throw / `joinModes([16,12])` === `"16.12"` |
| T9 | endpoints | `getPlayerStats` 省略 modes → URL に `mode=16.12.9.15.11.8`（空 mode を送らない） |
| T10 | endpoints | `getGlobalStatistics` がワイヤの mode 文字列キーを剥がして返す |
| T11 | range | preset 解決の start/end が仕様どおり・1時間内で安定。`lastNGames` → `RangeNotSupportedError` |
| T12 | getCurrentLevel | 全期間・全モードの URL を叩くこと、`getPlayerStats` とキャッシュ共有されること |

### 7.5 製造中の実APIアクセス規律

**製造担当は実装・テストで実APIを一切叩かないこと。** テストは全て fetch モック。手動確認も不要（検収も叩かない。§8）。dev サーバーでの目視確認は本 Issue のスコープ外（UI が無い）。

## 8. 受け入れ条件（検収チェックリスト）

前提: `npm ci` 済み。**検収で実APIは叩かない（0回）**。全て機械検証で完結し、人手検証（UI逆発注）も**なし**（本 Issue は UI を持たず、docs/ui-verification/README.md の基準でエージェント検証可能な項目のみ）。

1. **ビルド・lint・テスト**: `npm run build`・`npm run lint`・`npm run test` がすべて exit 0。vitest が devDependencies にあり dependencies に紛れていない
2. **テストケース網羅**: §7.4 の T1〜T12 に対応するテストが存在し全て green（`vitest run` の出力でテスト名を突合）。特に T1（回数系キー補完）は Issue 完了条件そのもの
3. **CAP保護エンドポイント不使用**: `git grep -nE "games/|player_records" -- src/api` が **0件**
4. **型レベルの count 分離**: `src/api/types.ts` で公開型 `PlayerStats` に `gameCount` があり `count` が無いこと、`PlayerExtendedStats` に `roundCount` があり `count` が無いこと、回数系6キー（最大连庄・最大累计番数・役满・累计役满・W立直・流满）が **optional でない number** であることをコードレビューで確認
5. **時刻境界**: 公開関数（endpoints.ts / range.ts のバレル公開分）の期間引数に number 型が無い（`Date` のみ）。`grep -n "getTime()" src/api` でミリ秒化が client/endpoints 内部に閉じていることを確認
6. **mode 必須の防御**: T8/T9 が green で、`src/api` 内に `?mode=` を空で送りうる経路が無い（`joinModes` を経由しない mode 文字列構築が無いことを grep `mode=` で確認）
7. **ミラー・キャッシュ**: T3/T4/T5 が green。localStorage キーが `mjsv:api-mirror` である（CLAUDE.md の `mjsv:` プレフィックス規約）
8. **404 正常系**: T6 が green。`getPlayerStats` / `getPlayerExtendedStats` の戻り型が `| null` を含む
9. **フィクスチャ匿名化**: `grep -rn "テストプレイヤー\|123456789" src/api/testdata` がヒットし、実在の ID・ニックネームが含まれない（`git grep -E "7[0-9]{7}" src/api/testdata` で8桁実IDらしき数値が 123456789 以外に無いこと）
10. **バレル規約**: `src/api/index.ts` が §6 の公開関数・公開型・エラー3種・`RangeSpec` 系・`GameMode` 定数を export し、`Raw*` 型を export していない。`src/api` 配下に CSS 以外の bare import（`import './xxx'`）が無い
11. **副作用ゼロ確認**: `npm run build` の成果物サイズが Issue 2 検収時のベースラインから著しく増えていない（API層は本番コードから未参照のためツリーシェイクで消えるはず。目安: gzip +1 kB 以内）
12. **作業ツリー**: 完了時 `git status` に想定ファイル（`src/api/**`、`package.json`、`package-lock.json`）以外の差分が無い

## 9. 後続 Issue への引き継ぎ事項

- **Issue 4（ドメイン計算）**:
  - `局收支` は API 層に存在しない。式 = `(Σ rank_rates[i]×rank_avg_score[i] − 配給原点) × gameCount ÷ roundCount`（本家 `processExtendedStats`、要件 §6.6）
  - `global_histogram` の μ・σ は **band "0" の histogramFull** から計算する（段位帯 band は mean のみ・実測確定 §1.3 差分7）。回数系6指標には histogramClamped が無い点に注意。魂天の段位帯 band は王座の間で `"10799"` に合算
  - histogram の metric キーには拡張統計に無い `count` `对局数` `局收支` `立直好型` が混在する
  - `global_statistics_2` の extended でも回数系キー欠落が起こる（正規化済みの値が渡るため Issue 4 側の対処は不要 — 0 として扱われることだけ認識しておく）
  - 段位計算定数（LEVEL_MAX_POINTS / LEVEL_PENALTY 系 / MODE_DELTA / RANK_DELTA / KONTEN_DELTA / LEVEL_ALLOWED_MODES）は本家 `../src/amae-koromo/src/data/types/level.ts` `metadata.ts`（MIT）から移植する
- **Issue 6（グローバルフィルタ）**: 既定モードの決定（要件 §5.1「入れる最上の卓」）には `getCurrentLevel().level.id` → `LEVEL_ALLOWED_MODES` を使う。期間フィルタ UI は `RangeSpec` を組み立てて `resolveRange` に渡すだけでよい。「直近n戦」プリセットは `RangeNotSupportedError` を catch して無効化表示にしておくと承諾後の切替が UI 変更なしで済む
- **検索画面**: `searchPlayer` の結果 `level` は三麻 ID が混ざる（§1.3 差分4）。四麻画面で 2xxxx が来た場合の表示は UI 側で吸収すること
- **承諾後（player_records）**: `RangeResolver` 差し込み（§6.4）に加え、Cap トークン対応が必要になった場合は client.ts の fetch オプション拡張で対応する（現設計はヘッダ注入ポイントを持たないが、`apiGet` のシグネチャにオプションを足すだけで済む構造）
- **仕様書更新の推奨**: §1.3 の差分1（mode 必須）・差分2（global_statistics_2 のキー形状・num_players 不存在）は `docs/amae-koromo-api-spec.md` に反映する価値がある（統括判断に委ねる）
