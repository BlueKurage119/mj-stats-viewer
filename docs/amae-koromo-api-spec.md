# 雀魂牌譜屋（amae-koromo）仕様調査メモ

調査日: 2026-08-21
調査方法: GitHub リポジトリ（SAPikachu/amae-koromo）のソースコード読解・コミット履歴 + 実API疎通確認 + 本番バンドル解析

## 0. 要点サマリ

| 論点 | 結論 |
|---|---|
| 429の原因 | 2026-07-23 に導入された Cap（PoW型CAPTCHA）。**ごく最近の措置**（§2.3） |
| 429の回避 | 正規ルートは「SAPikachu氏へキー申請」のみ。運営者は7/28にAI botを明示的に拒否しており**迂回はしない方針**（§2.3） |
| 影響範囲 | 全13エンドポイント中 **`games` と `player_records` の2つだけ**が429（§2.4） |
| 失われる機能 | **1局粒度の時系列**のみ（順位推移グラフ・対局一覧・同卓率）。集計統計は全て取得可（§4.2） |
| 現在の段位pt | **`player_stats` の `level.score + level.delta`** で直接取得可能。計算不要（§4.5） |
| 段位pt推移 | **終端日を変えて複数回叩けば日次粒度で再現可能**（§4.5） |
| 目的の達成可否 | プレイヤースタッツの可視化は**認証不要のエンドポイントだけで完全に実現できる**（§5） |

## 1. 概要

- **雀魂牌譜屋** は雀魂（Mahjong Soul）の段位戦（金の間以上）の対局データを収集・可視化する非公式サイト。
- 四麻: https://amae-koromo.sapk.ch/ （ミラー: https://saki.sapk.ch/ ）
- 三麻: https://ikeda.sapk.ch/ （ミラー: https://momoko.sapk.ch/ ）
- フロントエンド: [SAPikachu/amae-koromo](https://github.com/SAPikachu/amae-koromo)（React + TypeScript、MITライセンス、Vercelデプロイ）
- クローラ/バックエンド: [SAPikachu/amae-koromo-scripts](https://github.com/SAPikachu/amae-koromo-scripts)
- データ収集期間: 四麻 2019-08-23〜 / 三麻 2019-11-29〜（`dateMin`）

## 2. API 基盤

### 2.1 ミラーとベースURL

フロントエンドは以下のデータミラーを自動選択する（失敗時は全ミラーへ probe して最速を採用）:

```
https://5-data.amae-koromo.com/
https://1.data.amae-koromo.com/
https://2.data.amae-koromo.com/
https://4.data.amae-koromo.com/
```

APIプレフィックス:

| 対象 | プレフィックス |
|---|---|
| 四麻 | `api/v2/pl4/` |
| 三麻 | `api/v2/pl3/` |
| 大会 | `api/contest/{contest_id}/` |

例: `https://5-data.amae-koromo.com/api/v2/pl4/search_player/xxx`

### 2.2 共通挙動

- レスポンスは JSON。`{"maintenance": "..."}` が返るとメンテナンス中。
- `{"result_key": "..."}` が返る場合は非同期処理中 → 1秒待って `result/{result_key}` を再取得（ポーリング）。
- `Last-Modified` ヘッダでデータ鮮度が分かる。
- フロントは 500 エントリ上限のメモリキャッシュを持つ。

### 2.3 ⚠️ CAPTCHA（Cap）保護 — 重要

対局レコード系エンドポイント（`games/`, `player_records/`）は認証なしだと HTTP 429 で以下が返る:

```
[x-cap-token-required] CAPTCHA required, please contact SAPikachu to obtain a key if you are crawling the data
```

#### 導入経緯（コミット履歴より）

**2026-07 に導入された、ごく最近の措置**。半年前の情報とは仕様が異なるので注意。

| 日付 | コミット |
|---|---|
| 2026-07-23 | `30ae8f9` Add Cap support（CAPTCHA導入） |
| 2026-07-23〜24 | `cab0497` `8fb2d1e` `db76440` `0f5aee5` `6440295` `4beb980` Cap実装の追い込み（Bearer認証化、並行リフレッシュ防止、キャッシュ回避、WASMローカル配信） |
| 2026-07-28 | `9504eb8` **Add robots meta tag to index.html and update robots.txt for AI bot disallowance** |

7/28 のコミットで `public/robots.txt` に以下が追加され、`index.html` にも `<meta name="robots" content="noai, noimageai">` が入った:

```
User-agent: GPTBot
Disallow: /
User-agent: Google-Extended
Disallow: /
User-agent: ClaudeBot
Disallow: /
User-agent: anthropic-ai
Disallow: /
```

（従来からの `User-Agent: * / Disallow: /player/` も継続）

#### Cap の仕組みと防御レイヤー

- [Cap](https://capjs.js.org/) は Proof-of-Work 型のセルフホスト CAPTCHA。ブラウザで PoW を解いてトークンを得て `Authorization: Bearer <token>` で送る。
- CAPエンドポイントは牌譜屋が用意した外部の Cap サービス（`REACT_APP_CAP_API_ENDPOINT` でビルド時注入）。第三者インフラのため具体URLは本ドキュメントには記載しない。
- **このCAPエンドポイント自体が直接アクセスを HTTP 403 で拒否する**。ブラウザ相当のヘッダを付与しても同様で、別レイヤーの防御が入っていると見られる。

#### 判断

運営者が明確な意図をもって設置したアクセス制御であり、**迂回は行わない**方針とする。正規の選択肢は次の2つ:

1. **認証不要のエンドポイントのみで構成する**（後述のとおり、当初の目的はこれで達成可能）
2. **SAPikachu 氏にキーを申請する**（エラーメッセージが明示する公式ルート）

### 2.4 エンドポイント可否の実測（2026-08-21）

全13エンドポイントを1回ずつ叩いた結果。**塞がれているのは2つだけ**。

| 状態 | エンドポイント |
|---|---|
| ✅ 200 | `search_player` `player_stats` `player_extended_stats` `global_histogram` `global_statistics_2` `level_statistics` `fan_stats` `rank_rate_by_seat` `career_ranking` `player_delta_ranking` `recent_highlight_games` |
| ❌ 429 | **`games`** **`player_records`** |
| ❌ 400 | `games_by_id` → `{"error":"v1_endpoint_is_no_longer_supported"}`（廃止済み） |

`games_by_id` が廃止されているため、`recent_highlight_games` で得た `_id` から芋づる式にレコードを引く迂回路も存在しない。

## 3. API エンドポイント一覧

パスはすべて `{mirror}{apiSuffix}` の後ろに続く。日時は **ミリ秒 Unix タイムスタンプ**（レコード内の `startTime`/`endTime` は秒単位なので注意）。`mode` パラメータは GameMode ID を `.` 区切りで連結（例: `mode=16.12`）。

### 3.1 プレイヤー関連

| エンドポイント | 説明 |
|---|---|
| `GET search_player/{prefix}?limit=20&tag=all` | ニックネーム前方一致検索。`id`, `nickname`, `level`, `latest_timestamp` を返す |
| `GET player_stats/{id}/{startTsMs}/{endTsMs}?mode={modes}` | 基本統計（試合数、段位、順位率、平均順位、飛び率など） |
| `GET player_extended_stats/{id}/{startTsMs}/{endTsMs}?mode={modes}` | 詳細統計（和了率、放銃率、副露率、立直率、平均打点ほか約50項目） |
| `GET player_records/{id}/{cursorTsMs}/{startTsMs}?limit=100&mode={modes}&descending=true` | プレイヤーの対局履歴（カーソルページング: 返ってきた最後の `startTime*1000-1` を次の cursor に）⚠️ CAP必須 |
| `POST player_stats/{id}` body:`{keys:[startTime...], modes:[...]}` | 指定対局のみの統計（絞り込み用） |
| `POST player_extended_stats/{id}` 同上 | 同上の詳細統計 |

### 3.2 対局一覧

| エンドポイント | 説明 |
|---|---|
| `GET games/{cursorTsMs}/{dayStartTsMs}?limit=100&descending=true&mode={mode}` | 日別対局一覧（カーソルページング）❌ CAP必須 |
| `GET games_by_id/{_id},{_id},...` | 内部ID指定での対局取得 ❌ **廃止済み**（400 `v1_endpoint_is_no_longer_supported`） |
| `GET recent_highlight_games?limit=100&mode={mode}` | 直近の役満などハイライト対局 ✅ 認証不要 |
| `GET view_game/{zone}/{modeId}/{_id}[/{encodedAccountId}]` | マスクされた牌譜リンク（リダイレクト） |

### 3.3 ランキング

| エンドポイント | 説明 |
|---|---|
| `GET player_delta_ranking/{timespan}` | 段位ポイント増減ランキング。timespan: `1d` `3d` `1w` `4w`。mode別に `top` / `bottom` / `num_games` |
| `GET career_ranking/{type}[_{minGames}]?mode={modeId}` | キャリアランキング。minGames デフォルト300（300のときサフィックスなし） |

`career_ranking` の type（`CareerRankingType`）:
`rank1` `rank12` `rank123` `rank3` `rank4` `avg_rank` `max_level_global` `num_games` `stable_level` `point_efficiency` `win` `lose` `win_lose_diff` `win_rev` `lose_rev` `expected_game_point_0..3` `里宝率` `被炸率` `一发率`（各 `_rev` あり）`平均打点` `平均铳点` `打点效率` `净打点效率` `铳点损失` `局收支`

### 3.4 全体統計

| エンドポイント | 説明 |
|---|---|
| `GET global_statistics_2?mode=16.12...` | モード×段位別の全体統計（basic + extended） |
| `GET global_statistics_year?mode=...` | 直近1年版 |
| `GET global_statistics_snapshot/{YYYY-MM-DD}?mode=...` | 日次スナップショット |
| `GET level_statistics` | 段位分布 `[zone, levelId, num_players][]`（zone: 1=中国 2=日本 3=英語圏） |
| `GET global_histogram` | 各統計指標のヒストグラム（mode→levelId→指標名→ `{mean, histogramFull, histogramClamped}`） |
| `GET fan_stats` | 役統計（mode別の役出現数） |
| `GET rank_rate_by_seat` | 席（起家/南家…）別の順位率 `[[modeId, rank, seatId], count][]` |

## 4. データ型

### 4.1 GameMode ID

| ID | 四麻 | ID | 三麻 |
|---|---|---|---|
| 8 | 金の間・東風 | 21 | 三金・東風 |
| 9 | 金の間・半荘 | 22 | 三金・半荘 |
| 11 | 玉の間・東風 | 23 | 三玉・東風 |
| 12 | 玉の間・半荘 | 24 | 三玉・半荘 |
| 15 | 王座の間・東風 | 25 | 三王座・東風 |
| 16 | 王座の間・半荘 | 26 | 三王座・半荘 |

### 4.2 対局レコード（GameRecord）

`games` / `player_records` / `recent_highlight_games` が返す共通の型。**`games` と `player_records` の違いは「誰の対局を引くか」だけで、中身の構造は同一**。

| | `games/{cursor}/{dayStart}` | `player_records/{id}/{cursor}/{start}` |
|---|---|---|
| 範囲 | 指定日の**全プレイヤーの対局** | **特定プレイヤー**の対局 |
| 用途 | 日別の対局一覧ページ | プレイヤーページの戦績一覧 |

```ts
{
  _id?: string;         // 内部ID
  modeId: GameMode;
  uuid: string;         // 雀魂の牌譜UUID
  startTime: number;    // 秒単位Unix時刻
  endTime: number;
  players: {
    accountId: number;
    nickname: string;
    level: number;      // 対局時点の levelId
    score: number;      // 最終持ち点
    gradingScore?: number;  // 段位ポイント増減（実データには必ず入っている）
  }[];
}
```

実データ例（`recent_highlight_games` より。同じ型なので構造確認に使える）:

```json
{
  "_id": "992WeThZy1p",
  "modeId": 16,
  "uuid": "260820-43070659-06a0-46ad-aab5-b155c3c83ef1",
  "startTime": 1787226587, "endTime": 1787227357,
  "players": [
    { "accountId": 74675520, "nickname": "さときち708",
      "level": 10502, "score": 81900, "gradingScore": 192 },
    ...
  ],
  "event": { "type": "役満", "fan": [{ "id": 37, "label": "大三元", "count": 1, "役満": 1 }],
             "player": 74675520 }
}
```

要するに **1対局ごとの「いつ・誰と・何点で・何位で・段位ptがいくら動いたか」という集計前の生ログ**。統計系エンドポイントが集計済みの数値を返すのと対照的。

- 順位判定: `score` 同点時は席順（インデックスが小さい方が上位）。ソートキーは `5 - index + score`。
- 牌譜リンク: `https://game.mahjongsoul.com/?paipu={uuid}_a{encodeAccountId(accountId)}`
- `encodeAccountId(t) = 1358437 + ((7*t + 1117113) ^ 86216345)`

#### レコードが使えないと失われる本家の機能

本家ソースを追った結果、レコード依存なのは以下:

| 機能 | ファイル |
|---|---|
| **順位推移＋累積段位ポイントグラフ**（最大の損失） | `charts/recentRank.tsx` |
| 対局一覧テーブル（牌譜リンク付き） | `gameRecords/table.tsx` |
| 同卓率（対戦相手別の集計） | `playerDetails/sameMatchRate.tsx` |
| 大会ツール | `contestTools/minMax.tsx` |

一方 **`charts/rankRate.tsx`（順位率）と `winLoseDistribution.tsx`（和了・放銃内訳の円グラフ）は `PlayerExtendedStats` のみで動作しレコード不要**。プレイヤーページの統計表示の大半はこちら側。

→ 失われるのは「**1局単位の時系列**」のみ。ただし段位ポイント推移は §4.5 の方法で日次粒度なら再現可能。

### 4.3 levelId（段位ID）

`levelId = numPlayerId * 10000 + majorRank * 100 + minorRank`

- `numPlayerId`: 1=四麻, 2=三麻（例: 10503 = 四麻・聖3）
- `majorRank`: 1=初心 2=雀士 3=雀傑 4=雀豪 5=雀聖 6=魂天(旧) 7=魂天
- `minorRank`: 1〜3（魂天は 1〜20）
- majorRank >= 6 は魂天（konten）。ポイント表示は 1/100 して小数1桁（例: score 6871 → 68.7）。
- 昇段必要pt: `[20,80,200,600,800,1000,1200,1400,2000,2800,3200,3600,4000,6000,9000]`（雀士1から3つずつ）、魂天は2000pt固定。
- ラスペナルティ・順位ウマ（RANK_DELTA/MODE_DELTA）・原点（四麻25000/三麻35000）はソース `metadata.ts` / `level.ts` 参照。安定段位の計算式も実装済み（`estimateStableLevel2`）。

### 4.4 プレイヤー統計

**player_stats（基本）**: `count`, `level`, `max_level`, `rank_rates`（順位率配列）, `rank_avg_score`（順位別平均最終スコア）, `avg_rank`, `negative_rate`（飛び率）, `id`, `nickname`, `played_modes`

**player_extended_stats（詳細）**: 中国語キーの約50項目。主なもの:

| キー | 意味 |
|---|---|
| 和牌率 / 放铳率 | 和了率 / 放銃率 |
| 自摸率 / 默听率 / 副露率 / 立直率 | ツモ率 / ダマ率 / 副露率 / リーチ率 |
| 平均打点 / 平均铳点 | 平均和了点 / 平均放銃点 |
| 和了巡数 / 流局率 / 流听率 | 平均和了巡目 / 流局率 / 流局時聴牌率 |
| 一发率 / 里宝率 | 一発率 / 裏ドラ率 |
| 役满 / 累计役满 / W立直 / 流满 | 役満回数など |
| 先制率 / 追立率 / 被追率 | 先制リーチ率 / 追っかけ率 / 追っかけられ率 |
| 打点效率 / 铳点损失 / 净打点效率 / 局收支 | 打点効率系指標 |
| 最近大铳 | 最近の大物手放銃（id, start_time, fans） |

### 4.5 段位ポイントの取得 ★重要

#### 現在の段位ポイント = `level.score + level.delta`

**計算不要。`player_stats` から直接取得できる**（`player_records` は不要）。

本家の実装も同じ（`LevelWithDelta.format()` = `new Level(id).formatAdjustedScoreWithTag(score + delta)`）。`score` と `delta` の分割は集計パイプラインの都合であり、合計値が現在のポイント。

実測例（ある三麻プレイヤーのデータ・IDは非公開）:

```json
"level": { "id": 20302, "score": 58, "delta": 174 }
```

- `id` 20302 → numPlayerId=2（三麻）, majorRank=3（雀傑）, minorRank=2 → **雀傑2**
- ポイント = 58 + 174 = **232**
- 雀傑2の昇段点 = `LEVEL_MAX_POINTS[(3-1)*3 + 2-1]` = `LEVEL_MAX_POINTS[7]` = 1400
- 表示: **雀傑2 232/1400**

#### `level` の正確な意味 = 「クエリ範囲内の最終対局時点のスナップショット」

期間・モードを変えて実測した結果:

| クエリ範囲（全モード） | 対局数 | ポイント |
|---|---|---|
| 〜2026-01-01 | 520 | 668 |
| 〜2026-07-01 | 798 | 548 |
| 〜2026-08-01 | 812 | 48 |
| 全期間 | 814 | **232**（現在値） |

モードフィルタでも同様に変わる:

| クエリ | level |
|---|---|
| 全モード | score=58, delta=174 → **232** |
| `mode=22` のみ | score=58, delta=174 → 232 |
| `mode=21` のみ | score=127, delta=-79 → **48** |

`mode=21` は「最後の三金東の対局時点」の値になる。

> ⚠️ **現在値が欲しいときは必ず全モード・終端=現在で引くこと。** モードを絞ると過去のスナップショットが返る。実装時のハマりどころ。

- `max_level` も同様に**クエリ範囲内の最大値**。生涯最高段位が欲しければ全期間・全モードで引く。

#### 応用: 段位ポイント推移グラフの再現

この性質を利用し、**終端日を変えて複数回叩けば推移グラフが作れる**（`player_records` で失われたと思われた機能を実質的に回復できる）。

日次21日分の実測結果:

```
2026-08-01 〜 08-10   812戦   48pt
2026-08-11           814戦  232pt   ← +2戦で +184pt
2026-08-12 〜 08-21   814戦  232pt
```

特性と制約:

- 粒度は「1局ごと」ではなく「1日ごと」（同日の複数対局は合算）
- 対局のない日は前日の値が続くので、自然な階段状の推移として描ける
- `count` も同時に返るため、**差分でその日の対局数が分かる**
- リクエスト数は日数分。URL単位でキャッシュが効き、過去の値は不変なのでクライアントキャッシュ可能。実用上は「直近90日は日次 + それ以前は週次/月次」など可変粒度が現実的
- 昇段・降段をまたぐと `level.id` が変わるため、グラフ化には「段位×ポイント」を連続量に変換する処理が必要（`Level.getMaxPoint()` を使った累積換算）
- 魂天帯は `score` の扱いが変わる（100で割って小数1桁、旧魂天 majorRank=6 は補正あり）。汎用化には `getVersionAdjustedScore()` の移植が必要
- データのない期間を指定すると **HTTP 404 `{"error":"id_not_found"}`**。エラーではなく「その期間にデータなし」として扱う

## 5. 自作アプリへの示唆

1. **統計・検索・ランキング系はそのまま叩ける**（認証不要）。**CORS は任意オリジンを許可**（`Origin` をそのまま反射することを実測確認）なので、**サーバー不要・完全静的なSPAでブラウザから直接叩ける**。
   ```
   access-control-allow-origin: http://localhost:5173   ← 送ったOriginがそのまま返る
   access-control-allow-methods: GET, POST, OPTIONS, HEAD
   access-control-allow-headers: Authorization, Origin, X-Requested-With, Content-Type, Accept, Cache-Control
   ```
2. **対局履歴系（games / player_records）は Cap トークンが必要 → 使わない方針**（§2.3）。
   幸い、プレイヤースタッツの可視化（ヒストグラム・レーダー・分布内の位置づけ・段位ポイント推移）は**すべて認証不要のエンドポイントだけで実現できる**。
   - 分布の中での位置づけ → `global_histogram`（モード×段位帯×56指標の bins、1リクエスト約380KB）
   - 段位帯平均との比較 → `global_statistics_2`
   - 段位ポイント推移 → §4.5 の終端日可変クエリ
   - 諦めるもの: 1局粒度の順位推移、対局一覧テーブル、同卓率
3. **本家は MIT ライセンス**なので、型定義・計算ロジック（安定段位、levelId 解釈、encodeAccountId 等）は流用可能。`src/` に clone 済み:
   ```
   git clone https://github.com/SAPikachu/amae-koromo src/amae-koromo
   git clone https://github.com/SAPikachu/amae-koromo-scripts src/amae-koromo-scripts
   ```
4. タイムスタンプの単位混在に注意: **URLパスはミリ秒、レコード内 startTime は秒**。
5. ページングは offset ではなく**時刻カーソル方式**（最後のレコードの `startTime*1000 - 1` を次のカーソルに）。
6. 中国語キー（和牌率など）がAPIレスポンスにそのまま出てくるため、日本語表示には対訳マップが必要（本家の i18n リソースが流用可能）。
