# Issue 4 設計書: ドメイン計算ロジック（段位・偏差値・昇降条件・成長指標）

作成日: 2026-08-22
対象 Issue: #4 ドメイン計算ロジック: 段位・偏差値・昇降条件・成長指標（要ユニットテスト）
依存: #3（API層・完了済み）
前提資料: `docs/requirements.md` §6 / `docs/amae-koromo-api-spec.md` §4.3・§4.5 / `docs/design/issue-3-api-layer.md` §9 / CLAUDE.md
一次調査対象: 本家 amae-koromo（MIT・リポジトリ外に clone 済み）`../src/amae-koromo/src/data/types/level.ts` / `metadata.ts` / `constants.ts` / `gameMode.ts`、`../src/amae-koromo/src/components/playerDetails/histogram.tsx`
検証方法: **実APIアクセス 0 回**。本家ソースの全読 + Node による数値実測（本書の全ての期待値は実際に計算して得た値であり、推定値ではない）

---

## 0. 確定済み前提（変更不可）

- 本 Issue は**純ロジックのみ**。UI・色・チャート・React には一切触れない。`src/domain/` 配下のみを追加する
- 全て**純関数**として実装する。モジュールスコープの可変状態を持たない。入力は API 層の公開型（`src/api/index.ts` から import）と素の number
- API 層の公開結果は `deepFreeze` 済み（issue-3 §5.2）。**ドメイン関数は引数を一切変更しない**（`.sort()` `.reverse()` 等の in-place 操作禁止。凍結配列への書き込みは strict mode で TypeError になるが、コピーしてから操作すること）
- fixture は `src/domain/__fixtures__/` にコミットする。**ネットワークアクセスは製造・検収とも 0 回**
- tsconfig 制約（issue-3 §0 と同じ）: `verbatimModuleSyntax` / `erasableSyntaxOnly`（**TS enum 禁止**）/ `noUnusedLocals` / `noUnusedParameters` / `resolveJsonModule` は有効
- `"sideEffects": ["*.css"]` 下にあるため、副作用目的の bare import を書かない（本設計の全モジュールは export 経由でのみ使われる純粋モジュール。該当リスクなし）
- 本家コードは MIT。移植部分にはファイル冒頭コメントで出典（リポジトリ名・ファイル名・MIT）を明記する

---

## 1. 本家ソース調査の結果（実物確認済み・これが仕様の一次情報）

`level.ts` / `metadata.ts` を全読して抽出した定数と式。**Issue 本文・要件・API仕様書の記述と食い違う場合は本節が正**。

### 1.1 定数（`level.ts`）

```ts
LEVEL_MAX_POINTS  = [20, 80, 200, 600, 800, 1000, 1200, 1400, 2000, 2800, 3200, 3600, 4000, 6000, 9000];
LEVEL_PENALTY     = [0,0,0, 20,40,60, 80,100,120, 165,180,195, 210,225,240, 255];  // 四麻・半荘
LEVEL_PENALTY_3   = [0,0,0, 20,40,60, 80,100,120, 165,190,215, 240,265,290, 320];  // 三麻・半荘
LEVEL_PENALTY_E   = [0,0,0, 10,20,30, 40, 50, 60,  80, 90,100, 110,120,130, 140];  // 四麻・東風
LEVEL_PENALTY_E_3 = [0,0,0, 10,20,30, 40, 50, 60,  80, 95,110, 125,140,160, 175];  // 三麻・東風
LEVEL_KONTEN = 7;
LEVEL_MAX_POINT_KONTEN = 2000;
```

- `LEVEL_MAX_POINTS` の添字は `idx = (majorRank - 1) * 3 + (minorRank - 1)`（長さ15 = 初心1〜雀聖3）
- **`LEVEL_PENALTY*` は長さ16**（`LEVEL_MAX_POINTS` より1つ長い）。同じ添字式で引く。16番目（添字15）は本家でも未使用
- ペナルティ表のモード対応（`MODE_PENALTY`）:
  | モード | 表 |
  |---|---|
  | 9 金 / 12 玉 / 16 王座 | `LEVEL_PENALTY` |
  | 8 金東 / 11 玉東 / 15 王東 | `LEVEL_PENALTY_E` |
  | 22 三金 / 24 三玉 / 26 三王座 | `LEVEL_PENALTY_3` |
  | 21 三金東 / 23 三玉東 / 25 三王東 | `LEVEL_PENALTY_E_3` |

```ts
LEVEL_ALLOWED_MODES  // キー = numPlayerId*100 + majorRank
101: []                  // 四麻 初心
102: []                  // 四麻 雀士
103: [9, 8]              // 四麻 雀傑   → 金・金東
104: [9, 12, 8, 11]      // 四麻 雀豪   → 金・玉・金東・玉東
105: [12, 16, 11, 15]    // 四麻 雀聖   → 玉・王座・玉東・王東
106: [16, 15]            // 四麻 魂天(旧)
107: [16, 15]            // 四麻 魂天
201: []  202: []
203: [22, 21]            // 三麻 雀傑
204: [22, 24, 21, 23]    // 三麻 雀豪
205: [24, 26, 23, 25]    // 三麻 雀聖
206: [26, 25]  207: [26, 25]
```

### 1.2 定数（`metadata.ts`）

```ts
RANK_DELTA_4 = [15, 5, -5, -15];   // 四麻 全モード共通
RANK_DELTA_3 = [15, 0, -15];       // 三麻 全モード共通

MODE_DELTA = {   // 順位別モードボーナス
   9 金:    [80, 40, 0, 0],   12 玉:   [110, 55, 0, 0],   16 王座: [120, 60, 0, 0],
   8 金東:  [40, 20, 0, 0],   11 玉東: [ 55, 30, 0, 0],   15 王東: [ 60, 30, 0, 0],
  22 三金:  [105, 0, 0],      24 三玉: [160, 0, 0],       26 三王座: [240, 0, 0],
  21 三金東:[ 55, 0, 0],      23 三玉東:[ 75, 0, 0],      25 三王東: [120, 0, 0],
};

KONTEN_DELTA = {   // 魂天は素点によらず固定。王座/王東のみ定義（他モードには入室できない）
  16 王座: [50, 20, -20, -50],  15 王東: [30, 10, -10, -30],
  26 三王座: [50, 0, -50],      25 三王東: [30, 0, -30],
};

MODE_BASE_POINT = 四麻(8,9,11,12,15,16)=25000 / 三麻(21〜26)=35000;
KONTEN_FALLBACK_LEVEL_ID = 503;   // 魂天の安定段位計算で雀聖3として扱う
```

### 1.3 `calculateDeltaPoint`（実物・逐語）

```ts
function calculateDeltaPoint(score, rank, mode, level, includePenalty = true, trimNumber = true) {
  if (level.isKonten()) {
    const delta = KONTEN_DELTA[mode];
    if (delta) return delta[rank];          // ← 素点も trimNumber も無視して即 return
    level = level.withLevelId(503);
  }
  let result = (trimNumber ? Math.ceil : identity)((score - MODE_BASE_POINT[mode]) / 1000 + RANK_DELTA[mode][rank])
             + MODE_DELTA[mode][rank];
  if (rank === RANK_DELTA[mode].length - 1 && includePenalty) result -= level.getPenaltyPoint(mode);
  return result;
}
```

**憶測では出てこなかった点（設計上重要）**:

1. **魂天は素点に依存しない固定値**。`KONTEN_DELTA` があるモードでは `score` も `trimNumber` も完全に無視される。したがって魂天の昇降条件は「常に成立/常に不成立」の二値にしかならない
2. `isKonten()` は **`majorRank >= LEVEL_KONTEN - 1`、つまり majorRank 6 も 7 も真**
3. ラスペナは `rank === RANK_DELTA[mode].length - 1`（＝三麻なら 3位、四麻なら 4位）のときだけ引かれる
4. `getPenaltyPoint()` は魂天のとき 0 を返す（が 1 のパスで先に return されるため通常到達しない）
5. `includePenalty=false, trimNumber=false` の組み合わせは**安定段位2（`getStableLevelComponents`）専用**。通常表示には使わない

### 1.4 段位遷移（`getAdjustedLevel` 実物）

```ts
getAdjustedLevel(score) {
  score = this.getVersionAdjustedScore(score);
  let level = this.getVersionAdjustedLevel();
  let maxPoints = level.getMaxPoint();
  if (maxPoints && score >= maxPoints) { level = level.getNextLevel(); score = level.getStartingPoint(); }
  else if (score < 0) {
    if (!maxPoints || level._majorRank === 1 || (level._majorRank === 2 && level._minorRank === 1)) score = 0;
    else { level = level.getPreviousLevel(); score = level.getStartingPoint(); }
  }
  return level;
}
getStartingPoint() { return this._majorRank === 1 ? 0 : this.getMaxPoint() / 2; }
```

- **昇段/降段したときの新ポイントは「新段位の上限の 1/2」**（0 でも持ち越しでもない）。これは要件 §6.5 の「段位跨ぎは pt 表で換算」（＝累積ポイント線形換算）と**矛盾する**。§6.4 で本家準拠を採用し、要件の記述を訂正対象として引き継ぐ
- 遷移は**1 ステップのみ**（1回の適用で 2 段階昇段はしない）
- 降段しない条件: `maxPoints === 0`（魂天20）/ majorRank 1（初心）/ 雀士1
- `getNextLevel` / `getPreviousLevel` は majorRank 6（旧魂天）を経由せず 7 / 5 に飛ぶ

### 1.5 魂天のバージョン補正（`getVersionAdjustedScore` / `getVersionAdjustedLevel`）

```ts
getVersionAdjustedLevel() { return majorRank === 6 ? new Level(numPlayerId*10000 + 701) : this; }
getVersionAdjustedScore(score) { return majorRank === 6 ? Math.ceil(score / 100) * 10 + 200 : score; }
getScoreDisplay(score) { score = adjusted; return isKonten() ? (score/100).toFixed(1) : String(score); }
```

実測: majorRank 6 で score 6871 → `ceil(68.71)*10+200 = 890` → 表示 `8.9`。majorRank 7 で score 6871 → 表示 `68.7`。

### 1.6 段位タグ

本家は i18n の `"初士杰豪圣魂"`（ja では `"初士傑豪聖魂"`）を1文字ずつ split する。**本アプリでは日本語フルネームを採用する**（本家の1文字表記は日本語圏の慣用ではないため）:

```ts
LEVEL_TAGS_JA = ['初心', '雀士', '雀傑', '雀豪', '雀聖', '魂天'];  // 添字 = majorRank-1、魂天は添字5固定
```

`getTag()` の規則（本家準拠）: ラベル添字は `isKonten() ? 5 : majorRank - 1`。**majorRank === 6（旧魂天）だけは数字を付けず `'魂天'`**、それ以外は `ラベル + minorRank`。

### 1.7 安定段位（`estimateStableLevel2` / `estimateStableLevel`）

```
estimateStableLevel2(mode):
  mode が 12(玉) / 16(王座) 以外        → estimateStableLevel(mode) にフォールバック
  rank_rates[3] が falsy               → 算出不能
  E = 期待値(includePenalty=false)       ※ trimNumber は既定 true
  result = E / (rank_rates[3] * 15) - 10
  現在段位が魂天 かつ KONTEN_DELTA[mode] あり:
      |E| < 0.001 → 魂天(数値なし)
      E > 0       → 魂天 +E
      E <= 0      → E を「雀聖3(=503)固定」で再計算して以下へ
  else if result > 7 かつ KONTEN_DELTA[mode] あり → estimateStableLevel(mode) にフォールバック
  result = E / (rank_rates[3] * 15) - 10   ※ 再計算（魂天分岐で E が変わりうるため）
  表示: result >= 4 → 「雀聖」+ (result-3) / それ以外 → 「雀豪」+ result（小数2桁切り捨て）
```

```
estimateStableLevel(mode):   # 段位を動かして期待値の符号が変わる位置を探す
  level = 現在段位
  loop:
    E = 期待値(level, includePenalty=true)
    |E| < 0.001            → (level, 'exact', 0)
    E >= 0:
       level が魂天         → (level, 'konten', E)
       lastPositive = level; level = level.getNextLevel()
       次段位が mode に入室不可 → (lastPositive, 'plus', E)
    E < 0:
       lastPositive あり     → (lastPositive, 'exact', 期待値(lastPositive))
       なければ下降ループへ
  下降ループ:
    prev = level.getPreviousLevel()
    prev が mode に入室不可 or prev === level → (level, 'minus', 期待値(level))
    level = prev; E = 期待値(level)
    E > -0.001            → (level, 'exact', |期待値(level)|)
```

**注意（実物由来）**: 上昇ループの `level === lastPositiveLevel` はオブジェクト同一性比較で本家では**決して真にならない**（`getNextLevel` が常に新インスタンスを返すため）。移植では**この比較を再現しない**。下降ループの `prevLevel === level` は初心1で `getPreviousLevel()` が `this` を返すため真になりうるので、**`toLevelId()` の一致で判定する**。

### 1.8 ヒストグラム（`components/playerDetails/histogram.tsx`）

パーセンタイルは `getValueAccumulation` の実装が正:

```ts
binStep = (max - min) / bins.length;
bin = floor((value - min) / binStep);
bin < 0            → 0
bin >= bins.length → sum(bins)
otherwise          → sum(bins[0..bin-1]) + bins[bin] * ((value - (min + binStep*bin)) / binStep)
```

**本家は μ・σ を一切計算していない**（偏差値という概念が本家に無い）。σ の算出方法は本設計の独自定義であり、§5.1 で確定する。

---

## 2. モジュール構成

全て `src/domain/` 配下。バレルは `src/domain/index.ts`。

| ファイル | 責務 | Issue スコープ |
|---|---|---|
| `levelConstants.ts` | §1.1・§1.2 の定数と `LEVEL_TAGS_JA`。他モジュールから読むのみ | 1,2 |
| `level.ts` | levelId のパース・タグ・上限pt・遷移・魂天補正・表示整形 | 1 |
| `points.ts` | `calculateDeltaPoint` と順位別変動・期待値 | 2 |
| `transitions.ts` | 昇格・降格条件（素点境界の探索） | 3 |
| `growth.ts` | 期待値/戦・昇降まで◯戦・50戦後見込み・入れる最上の卓 | 4 |
| `stableLevel.ts` | 安定段位（`estimateStableLevel` / `estimateStableLevel2` 移植） | 5 |
| `distribution.ts` | histogramFull からの μ・σ、偏差値、パーセンタイル | 6 |
| `radar.ts` | レーダー5軸 | 7 |
| `tendency.ts` | 傾向2軸と5段階バンド | 8 |
| `derived.ts` | 局収支・連対率・ラス率・平均持ち点・内訳%・段位分布内の位置 | 9 |
| `index.ts` | 公開バレル | — |
| `__fixtures__/*.json` | テスト用固定データ（§7） | — |

**クラスではなく純関数群にする。** 本家の `Level` クラスは移植せず、`type Level = { numPlayerId; majorRank; minorRank }` の plain object + 関数群にする（親エージェント指示「純関数群として設計」、および `erasableSyntaxOnly` 下でクラスを持つ利点が無いため）。挙動は §1 と 1:1 で一致させる。

---

## 3. level.ts（スコープ1）

```ts
export type NumPlayerId = 1 | 2;                       // 1=四麻 2=三麻
export type Level = { readonly numPlayerId: number; readonly majorRank: number; readonly minorRank: number };

export function parseLevelId(levelId: number): Level;  // realId = levelId % 10000
export function toLevelId(level: Level): number;       // numPlayerId*10000 + majorRank*100 + minorRank
export function isKonten(level: Level): boolean;       // majorRank >= 6
export function isSameLevel(a: Level, b: Level): boolean;   // 本家 isSame（魂天は 6 と 7 を同一視）
export function isAllowedMode(level: Level, mode: GameMode): boolean;

export function getMaxPoint(level: Level): number;     // 魂天20 → 0、魂天 → 2000
export function getPenaltyPoint(level: Level, mode: GameMode): number;
export function getStartingPoint(level: Level): number;
export function getNextLevel(level: Level): Level;
export function getPreviousLevel(level: Level): Level;

export function getVersionAdjustedLevel(level: Level): Level;
export function getVersionAdjustedScore(level: Level, score: number): number;
/** 現在ポイントを与えたときの実効段位（本家 getAdjustedLevel。1ステップのみ） */
export function getAdjustedLevel(level: Level, score: number): Level;

export function getLevelTag(level: Level): string;          // '雀傑2' / '魂天'（旧） / '魂天3'
export function getLevelTagFromId(levelId: number): string;
export function getScoreDisplay(level: Level, score: number): string;   // 魂天は score/100 の小数1桁
/** 本家 formatAdjustedScore。'232/1400' / 上限0のときは数値のみ */
export function formatAdjustedScore(level: Level, score: number): string;
/** 本家 LevelWithDelta.format。'雀傑2 232/1400' */
export function formatLevelWithDelta(lv: LevelWithDelta): string;
export function currentPoint(lv: LevelWithDelta): number;   // score + delta
```

- `LevelWithDelta` は `src/api` の公開型をそのまま使う（再定義しない）
- `getPenaltyPoint` の添字は `(majorRank-1)*3 + minorRank-1`。魂天では 0 を返す（§1.3-4）
- `formatAdjustedScore` は本家逐語移植（段位が変わる場合は新段位の初期ポイントを表示する分岐がある）

---

## 4. points.ts / transitions.ts / growth.ts / stableLevel.ts（スコープ2〜5）

### 4.1 points.ts

```ts
export type DeltaOptions = { includePenalty?: boolean; trimNumber?: boolean };  // 既定 true / true

/** §1.3 の逐語移植。level は「変動を受ける側の段位」 */
export function calculateDeltaPoint(
  score: number, rank: number, mode: GameMode, level: Level, options?: DeltaOptions,
): number;

/** rank_avg_score を順位ごとに代入した変動値。長さは rank_avg_score と同じ */
export function rankDeltaPoints(
  rankAvgScores: readonly number[], mode: GameMode, level: Level, options?: DeltaOptions,
): number[];

/** Σ(rank_rates[i] × rankDeltaPoints[i])。rank_rates は正規化しない（API は合計1で返す） */
export function expectedPointPerGame(
  rankRates: readonly number[], rankAvgScores: readonly number[], mode: GameMode, level: Level,
  options?: DeltaOptions,
): number;
```

- モードの人数と `rankRates.length` が食い違う場合（四麻モードに長さ3の配列など）は `Error` を throw する。API 層から来る限り起きないが、UI のモード切替で三麻データに四麻モードを渡す事故を早期に殺すため

### 4.2 transitions.ts（スコープ3）

**旧 CLI 実装は移植しない**（モードボーナス欠落・ラスペナ欠落の 2 バグ。要件 §6.4）。素点境界を探索して求める。

```ts
export type RankCondition =
  | { rank: number; kind: 'always' }                     // 素点域全体で成立
  | { rank: number; kind: 'never' }                      // 素点域全体で不成立
  | { rank: number; kind: 'atLeast'; score: number }     // score 以上で成立（昇格側）
  | { rank: number; kind: 'atMost'; score: number };     // score 以下で成立（降格側）

export function promotionConditions(
  lv: LevelWithDelta, mode: GameMode,
): RankCondition[];   // 「この1戦で昇段するか」= delta >= (上限pt − 現在pt)

export function demotionConditions(
  lv: LevelWithDelta, mode: GameMode,
): RankCondition[];   // 「この1戦で降段するか」= 現在pt + delta < 0
```

**探索域（確定）**: 素点は 100 点刻み。下限 `0`、上限 `numPlayers * MODE_BASE_POINT[mode]`（四麻 100000 / 三麻 105000 = 卓の総素点）。

- `calculateDeltaPoint` は素点について**単調非減少**（`ceil` は単調）なので、境界は 100 点刻みグリッド上の**二分探索で厳密に**求まる。逆算式（`ceil` の逆）は使わない（要件 §6.4 の指示）
- 下限を 0 にする根拠: 負の最終素点は飛び終局した最下位のみに生じ、そのとき変動は 0 点時より小さいだけ。「昇段する」側の判定では負素点で成立することは実質ありえず、「降段する」側の判定では負素点は必ず成立側に落ちるため、0 を下限とした `atMost` 判定と結論が変わらない
- 上限を卓の総素点にする根拠: 個人の最終素点がこれを超えるには他家が合計でマイナスになる必要があり、実戦域外。これを超える境界は `never`（＝現実的に起こらない）と報告するほうが有用
- **昇段上限が 0 の段位（魂天20）**は `promotionConditions` が全て `never` を返す。**降段できない段位**（初心・雀士1・魂天20）は `demotionConditions` が全て `never`
- **魂天（KONTEN_DELTA があるモード）** は素点非依存（§1.3-1）なので、結果は `always` / `never` のみ

境界の定義（テストで固定する）:
- `atLeast.score` は「条件が成立する最小のグリッド点」。`f(score)` が成立し `f(score - 100)` が不成立
- `atMost.score` は「条件が成立する最大のグリッド点」。`f(score)` が成立し `f(score + 100)` が不成立

### 4.3 growth.ts（スコープ4）

```ts
export type LevelPoint = { levelId: number; point: number };  // point = score + delta 相当

/** 入れる最上の卓・半荘。allModes(numPlayers) の並び（王座半荘が先頭）で最初に入室可能なもの */
export function preferredMode(levelId: number): GameMode | null;

/** 1戦分のポイント変動を適用し、必要なら段位を1段だけ動かす（§1.4 準拠） */
export function applyPointDelta(lp: LevelPoint, delta: number): LevelPoint;

/** 昇段まで◯戦。delta <= 0 / 上限 0 のときは null */
export function gamesToPromotion(lp: LevelPoint, deltaPerGame: number): number | null;
/** 降段まで◯戦。delta >= 0 / 降段できない段位のときは null */
export function gamesToDemotion(lp: LevelPoint, deltaPerGame: number): number | null;

/** n 戦後の見込み。1戦ずつ applyPointDelta を適用する（段位跨ぎを本家規則で処理） */
export function projectAfterGames(lp: LevelPoint, deltaPerGame: number, games: number): LevelPoint;
```

- `gamesToPromotion = ceil((getMaxPoint − point) / delta)`
- `gamesToDemotion = floor(point / (−delta)) + 1`（`point + n*delta < 0` を満たす最小の n）
- `projectAfterGames` は**逐次適用**にする。理由: §1.4 のとおり昇降段時のポイントは「新段位上限の 1/2」にリセットされるので、要件 §6.5 の「pt 表で累積換算」は実挙動と一致しない。要件側を訂正対象とする（§9 引き継ぎ）
- 複数モードを跨いだ集計統計に対しては `preferredMode(現在段位)` を既定モードとして使い、UI 側で「◯◯の間・半荘基準」と注記する（要件 §6.5）

### 4.4 stableLevel.ts（スコープ5）

```ts
export type StableLevel =
  | { kind: 'number'; value: number }                                        // 玉/王座（四麻半荘）
  | { kind: 'level'; levelId: number; bound: 'exact' | 'plus' | 'minus'; expectedPoint: number }
  | { kind: 'konten'; levelId: number; expectedPoint: number }
  | { kind: 'unavailable' };

export function estimateStableLevel(input: StableLevelInput, mode: GameMode): StableLevel;
export function estimateStableLevel2(input: StableLevelInput, mode: GameMode): StableLevel;

export type StableLevelInput = {
  levelId: number; score: number; delta: number;
  rankRates: readonly number[]; rankAvgScores: readonly number[];
};

/** kind:'number' の表示分解。value >= 4 → 雀聖(value-3) / それ以外 → 雀豪(value)。小数2桁「切り捨て」 */
export function splitStableLevelNumber(value: number): { majorRank: 4 | 5; value: number; text: string };
```

- §1.7 の擬似コードを逐語移植する。文字列生成（`"雀豪3.00"` 等）は `splitStableLevelNumber` に閉じ込め、判定ロジックは構造化データで返す
- `formatStableLevel2` の小数処理は**四捨五入ではなく切り捨て**（本家は文字列を `slice` している）。`text` はこれを再現する
- 無限ループ防止: 上昇/下降ループは最大 32 反復で打ち切り、それ以上回ったら `{ kind: 'unavailable' }` を返す（本家には無いガード。段位数は 15 + 魂天20 なので正常系では到達しない）

---

## 5. distribution.ts / radar.ts / tendency.ts（スコープ6〜8）

### 5.1 分布統計（σ の定義を確定する）

**本家は σ を計算していない**（§1.8）。以下を本設計の定義として確定する。

```ts
export type MetricDistribution = { mean: number; sd: number; count: number };

/** band 0 の histogramFull から、ビン中央値 c_i = min + step*(i+0.5) を代表値として算出。
 *  μ = Σ(n_i·c_i)/N,  σ = sqrt(Σ(n_i·c_i²)/N − μ²)   ← 母集団標準偏差（N で割る。N-1 ではない） */
export function histogramStats(h: HistogramData): MetricDistribution;

/** 偏差値 = 50 + 10(x − μ)/σ。σ === 0 のときは 50 を返す */
export function deviationValue(x: number, d: MetricDistribution): number;

/** パーセンタイル（0..1）。§1.8 の getValueAccumulation を移植し N で割る */
export function percentile(x: number, h: HistogramData): number;

/** GlobalHistogram から band "0" の histogramFull を引く。無ければ null */
export function getBandZeroHistogram(
  gh: GlobalHistogram, mode: GameMode, metric: string,
): HistogramData | null;

/** metric → MetricDistribution の遅延ルックアップ（同一 histogram を何度も走査しないようキャッシュを内部に持つ） */
export function createStatsLookup(gh: GlobalHistogram, mode: GameMode): (metric: string) => MetricDistribution | null;
```

- **`histogramClamped` は使わない**（σ が過小になり偏差値が過大に出る。要件 §6.1）。`getBandZeroHistogram` は `histogramFull` だけを見る
- 母集団 σ（N 除算）を採る根拠: bins は母集団の全数集計であり標本ではない。N は 10^5〜10^6 オーダーなので N/N-1 の差は 10^-6 未満で、どちらでも受け入れ条件の許容誤差に収まるが、定義を一つに固定しておく
- `createStatsLookup` の内部キャッシュは**関数呼び出しごとに新規生成される閉包**であり、モジュールスコープの可変状態ではない（§0 の制約に抵触しない）
- 段位帯 band（`"10301"` 等）には `mean` しか無い（issue-3 §1.3 差分7）。μ・σ が要るものは必ず band `"0"` を使う
- **魂天の段位帯は王座の間で `"10799"` に合算される**（issue-3 §9）。band 0 を使う本設計には影響しない

### 5.2 radar.ts（スコープ7）

```ts
export type RadarInput = Pick<PlayerExtendedStats, '打点效率' | '铳点损失' | '和牌率' | '立直率' | '里宝率' | '一发率'>;
export type RadarAxes = {
  攻: number | null; 守: number | null; 速: number | null; 制: number | null; 運: number | null;
};
export function calcRadar(stats: RadarInput, lookup: (metric: string) => MetricDistribution | null): RadarAxes;
```

| 軸 | 式 |
|---|---|
| 攻 | `deviationValue(打点效率)` |
| 守 | `100 − deviationValue(铳点损失)` |
| 速 | `deviationValue(和牌率)` |
| 制 | `deviationValue(立直率)` |
| 運 | `50 × (里宝率 + 一发率) ÷ (μ(里宝率) + μ(一发率))` |

- 必要な metric の分布が引けない軸は `null`（UI 側で欠測表示。クランプは行わない — 素の値を返し、`[0,100]` への丸めは UI の責務）
- 運の分母が 0 のときも `null`
- `PlayerExtendedStats` は `RadarInput` に構造的に代入可能なので、呼び出し側は API の戻り値をそのまま渡せる

### 5.3 tendency.ts（スコープ8）— **係数を確定する**

```ts
export type TendencyInput = Pick<PlayerExtendedStats, '立直率' | '追立率' | '放铳率' | '默听率' | '副露率' | '和了巡数'>;
export type TendencyAxis = { value: number; band: 0 | 1 | 2 | 3 | 4 } | null;
export type Tendency = { offenseDefense: TendencyAxis; concealedSpeed: TendencyAxis };
export function calcTendency(stats: TendencyInput, lookup: (m: string) => MetricDistribution | null): Tendency;
export function toBand(value: number): 0 | 1 | 2 | 3 | 4;   // 単体でもテストする
```

**係数の確定（Issue 8-2 の宿題への回答）**: **全項目を等係数（符号のみ）とし、有効な項の単純平均を取る。**

```
offenseDefense = mean( +z(立直率), +z(追立率), +z(放铳率), −z(默听率) )   正 = 攻 / 負 = 守
concealedSpeed = mean( +z(副露率), −z(默听率), −z(和了巡数) )             正 = 速度 / 負 = 門前
z(metric) = (x − μ) / σ = (deviationValue(x) − 50) / 10
```

等係数に決め打ちする根拠:

1. 重み付けを正当化できる教師データが無い。参照元（`yurakuurame/4ma-majang-type-check`）はライセンス表記が無く定数を流用できない（要件 §6.2）ため、外部から重みを持ち込む経路が存在しない
2. Issue が定める閾値 ±0.5 / ±1.5 は「合成値がおよそ単位分散」を前提とした値。等係数の単位分散 z の平均は分散が `[1/k, 1]` の範囲に収まり、この前提から最も外れにくい。重みを非一様にすると合成値のスケールが根拠なく変わり、閾値の意味が崩れる
3. 軸の意味づけ（どの指標が「攻」側か）は Issue が確定しており、残る自由度は重みだけ。恣意的な重みは後から検証不能な定数として残る

**未検証として明記する点（実挙動未確認）**: 「±0.5/±1.5 → 約 7/24/38/24/7%」という帯人数比は**名目値**。実際には各 z が正相関するため合成値の SD は 1 未満になり、中央帯がこれより厚くなる見込み。実データでの帯分布は確認していない。UI 実装時に実分布を測って閾値を再調整する余地を残す（§9 引き継ぎ）。

- 分布が引けない metric は**その項を落として残りで平均**する。全項が落ちたら軸は `null`
- バンド境界（確定・テストで固定）: `v < -1.5 → 0` / `v < -0.5 → 1` / `v < 0.5 → 2` / `v < 1.5 → 3` / `else 4`

---

## 6. derived.ts（スコープ9）

```ts
/** 局収支 = (Σ rankRates[i]×rankAvgScores[i] − 配給原点) × 試合数 ÷ 局数 */
export function roundBalance(input: {
  rankRates: readonly number[]; rankAvgScores: readonly number[];
  mode: GameMode; gameCount: number; roundCount: number;
}): number | null;                          // roundCount === 0 → null

export function averageScore(rankRates: readonly number[], rankAvgScores: readonly number[]): number;
export function rentaiRate(rankRates: readonly number[]): number;   // rankRates[0] + rankRates[1]
export function lastPlaceRate(rankRates: readonly number[]): number; // 末尾要素

/** 和了/放銃の相手内訳（ドーナツ用）。合計 0 のときは null */
export function winBreakdown(s: Pick<PlayerExtendedStats, '立直和了'|'副露和了'|'默听和了'>): { 立直: number; 副露: number; 默听: number } | null;
export function dealInBreakdown(s: Pick<PlayerExtendedStats, '放铳至立直'|'放铳至副露'|'放铳至默听'>): { 立直: number; 副露: number; 默听: number } | null;

/** level_statistics を全 zone 合算し、自分の levelId 以下の累積割合（0..1）を返す（要件 §6.6） */
export function levelDistributionPosition(stats: LevelStatistics, levelId: number): number | null;
```

- 配給原点は `MODE_BASE_POINT[mode]`（四麻 25000 / 三麻 35000）
- `rentaiRate` は三麻でも「1位率 + 2位率」とする（三麻の連対の定義に議論はあるが、四麻と同一式で揃えるほうが比較タブで一貫する）
- `levelDistributionPosition` は `numPlayerId` が一致するエントリだけを対象にし（`level_statistics` は 1xxxx/2xxxx が混在しうる）、`levelId` 昇順の累積を全体で割る。`10799`（魂天合算）は 1 エントリとして扱う
- `levelDistributionPosition` は Issue 本文のスコープ9には明記が無いが、要件 §6.6 が求める純ドメイン計算であり、ここに置かないと比較タブ Issue で改めてドメイン層を触ることになるため含める

---

## 7. フィクスチャ（`src/domain/__fixtures__/`）

**ネットワークアクセス 0 回で作る。** 実在プレイヤーの ID・ニックネームは一切含めない。

| ファイル | 内容 | 由来 |
|---|---|---|
| `player_stats_3p.json` | 三麻・雀傑2・mode 22 検証用 | 合成（Issue 記載の実測値を再現するよう逆算） |
| `player_stats_4p.json` | 四麻・雀聖1・mode 16 検証用 | 合成 |
| `extended_stats_4p.json` | レーダー・傾向の入力（`RadarInput ∪ TendencyInput` の6+6キー） | 合成 |
| `global_histogram.json` | pl4 mode `"16"` band `"0"` の 11 metric | 合成（生成スクリプトで再現可能） |
| `level_statistics.json` | 段位分布 | 合成 |

### 7.1 `player_stats_3p.json`（Issue の実測値を再現する）

```json
{ "id": 123456789, "nickname": "テストプレイヤー3", "gameCount": 814,
  "level": { "id": 20302, "score": 58, "delta": 174 },
  "max_level": { "id": 20302, "score": 1000, "delta": 0 },
  "rank_rates": [0.3002, 0.3400, 0.3598],
  "rank_avg_score": [62500, 35700, 6800],
  "avg_rank": 2.0596, "negative_rate": 0.09, "played_modes": [22] }
```

**この数値は「Issue 本文の検証済み実測値（雀傑2 / pt=232/1400 / mode22 順位別変動 [+148, +1, −143] / 期待値 ≈ −6.68pt/戦）を厳密に再現する入力」として逆算した合成値**である。実プレイヤーの `rank_rates` / `rank_avg_score` そのものではない（Issue に載っていないため）。Node で実測した結果:

- `rank_avg_score` の合計 = 105000（三麻の卓総素点と一致する自然な値）
- 順位別変動 = `[ceil(27.5+15)+105, ceil(0.7+0)+0, ceil(−28.2−15)+0−100]` = **`[148, 1, -143]`** ✔
- 期待値 = `148×0.3002 + 1×0.3400 − 143×0.3598` = **`-6.6818`** ✔（Issue の ≈ −6.68 と一致）
- `avg_rank` = `1×0.3002 + 2×0.3400 + 3×0.3598` = 2.0596（内部整合）

### 7.2 `player_stats_4p.json`

```json
{ "id": 123456790, "nickname": "テストプレイヤー4", "gameCount": 1200,
  "level": { "id": 10501, "score": 700, "delta": 100 },
  "max_level": { "id": 10501, "score": 1500, "delta": 0 },
  "rank_rates": [0.26, 0.25, 0.25, 0.24],
  "rank_avg_score": [42000, 27000, 21000, 10000],
  "avg_rank": 2.47, "negative_rate": 0.07, "played_modes": [16] }
```

Node 実測（mode 16 / 雀聖1 / ラスペナ `LEVEL_PENALTY[12] = 210` / 上限 `LEVEL_MAX_POINTS[12] = 4000`）:

- 順位別変動（既定オプション） = **`[152, 67, -9, -240]`**
- 期待値 = **`-3.58`**
- `includePenalty=false, trimNumber=false` の順位別変動 = `[152, 67, -9, -30]`、期待値 = `46.82`
- 安定段位2 の生値 = `46.82 / (0.24×15) − 10` = **`3.0055555…`** → 表示 `雀豪3.00`

### 7.3 `extended_stats_4p.json`

```json
{ "打点效率": 1380, "铳点损失": 600, "和牌率": 0.2280, "立直率": 0.2200,
  "里宝率": 0.1450, "一发率": 0.1050, "追立率": 0.1700, "放铳率": 0.1150,
  "默听率": 0.1600, "副露率": 0.2900, "和了巡数": 11.00 }
```

### 7.4 `global_histogram.json` — 生成スクリプトで再現可能にする

**唯一「実測値そのもの」を持ち込む必要があるのがここ。** Issue の検証済み実測値「四麻王座(16) band0 和了率 μ≈0.2093 σ≈0.0239 → 値 0.24 の偏差値 ≈ 62.8」を満たす bins が要る。

**採用する方式（決定）**: 実 API を叩かず、**指定した μ・σ を持つ離散正規分布を決定的に生成する**スクリプト `scripts/build-domain-fixtures.mjs` を追加し、その出力を `src/domain/__fixtures__/global_histogram.json` としてコミットする。生成ロジック（逐語・これをそのまま実装する）:

```js
const N = 1_000_000, NB = 100;
function buildBins(min, max, mu, sigma) {
  const step = (max - min) / NB, bins = [];
  for (let i = 0; i < NB; i++) {
    const c = min + step * (i + 0.5);
    bins.push(Math.round(N * Math.exp(-0.5 * ((c - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI)) * step));
  }
  return bins;
}
// 出力形状: { "16": { "0": { "<metric>": { mean: <μ指定値>, histogramFull: { min, max, bins } } } } }
```

metric テーブル（`min, max, μ指定, σ指定`）:

| metric | min | max | μ指定 | σ指定 |
|---|---|---|---|---|
| `和牌率` | 0 | 1 | **0.2093** | **0.0239** |
| `放铳率` | 0 | 1 | 0.1220 | 0.0180 |
| `副露率` | 0 | 1 | 0.3200 | 0.0700 |
| `立直率` | 0 | 1 | 0.1950 | 0.0290 |
| `默听率` | 0 | 1 | 0.1800 | 0.0500 |
| `追立率` | 0 | 1 | 0.1500 | 0.0400 |
| `一发率` | 0 | 1 | 0.0980 | 0.0160 |
| `里宝率` | 0 | 1 | 0.1350 | 0.0230 |
| `和了巡数` | 0 | 20 | 11.20 | 0.45 |
| `打点效率` | 0 | 10000 | 1250 | 180 |
| `铳点损失` | 0 | 10000 | 640 | 110 |

- **`和牌率` の μ・σ のみが Issue 記載の実測値**。他の 10 metric は「四麻王座帯としてありそうな値」で置いた**合成値**であり、実測ではない（各テーブル行の性質を設計書に明記しておく）。テストはこれらの絶対値には依存させず、内部整合（μ での偏差値 = 50 等）と `和了率` の実測値だけを検証する
- `histogramClamped` を **`和牌率` にだけ意図的に付ける**（min 0.15 / max 0.28、bins は同じ生成器で 30 分割）。「clamped があっても使わない」ことをテストで固定するため
- `mean` フィールドには μ 指定値をそのまま入れる（実 API でも `mean` は真の平均であり bins から再計算した値とは微差がある。ドメイン層が `mean` を使わず bins から算出することを固定するため、両者を微妙に食い違わせる意味がある）

Node で実測した生成結果（**この値を受け入れ条件の期待値にする**）:

| metric | N | bins から算出した μ | bins から算出した σ |
|---|---|---|---|
| `和牌率` | 1000001 | 0.2092998157 | 0.0238997781 |
| `放铳率` | 1000000 | 0.122000 | 0.018000 |
| `副露率` | 999996 | 0.320001 | 0.069996 |
| `立直率` | 999998 | 0.195000 | 0.028999 |
| `默听率` | 999849 | 0.180030 | 0.049946 |
| `追立率` | 999917 | 0.150014 | 0.039975 |
| `一发率` | 999999 | 0.098000 | 0.016000 |
| `里宝率` | 999999 | 0.135000 | 0.023000 |
| `和了巡数` | 999996 | 11.200000 | 0.449990 |
| `打点效率` | 999999 | 1250.000000 | 179.999201 |
| `铳点损失` | 1000000 | 640.000200 | 110.000291 |

### 7.5 `level_statistics.json`

```json
[[1, 10301, 15302], [1, 10501, 1204], [1, 10799, 87], [1, 10101, 20411],
 [2, 10301, 5000],  [2, 10501, 400],  [3, 10101, 1000], [2, 20302, 900]]
```

（zone は 1=中国 / 2=日本 / 3=英語圏。四麻分の合計 = 15302+1204+87+20411+5000+400+1000 = 43404）

### 7.6 実 API から取り直したくなった場合の手順（**今回は実施しない**）

将来 `global_histogram` を実データに差し替えたくなった場合に限り、以下の手順を取る。**製造・検収では実行しない。**

1. `https://5-data.amae-koromo.com/robots.txt` を先に取得して意向を確認する（issue-3 §1.1 の実測では 400 = robots.txt 不存在）
2. `GET https://5-data.amae-koromo.com/api/v2/pl4/global_histogram`（**パラメータなし・1リクエスト・約380KB**）
3. レスポンスから `["16"]["0"]` の必要 metric だけを抜き出して縮約し、`src/domain/__fixtures__/global_histogram.json` に保存
4. 三麻が要る場合は `api/v2/pl3/global_histogram` を同様に1回
5. UA 偽装をしない。CAP 保護下（`games` / `player_records`）には触れない。同じエンドポイントを繰り返し叩かない
6. 差し替えたら §7.4 の期待値表を実測し直して本設計書を更新する

---

## 8. 受け入れ条件（検収チェックリスト）

前提: `npm ci` 済み・ブランチ `feat/issue-4-domain-logic`。**実 API アクセスは 0 回**（製造・検収とも）。UI 逆発注は無し（本 Issue は UI を持たない）。

各項目は「実行するコマンド」と「合格の判定」を書いてある。数値は `expect(x).toBeCloseTo(期待値, 桁)` で判定する（許容誤差を明記）。

### A. ビルド・品質ゲート

1. `npm run build` が exit 0（型エラー 0）。`npm run lint` が exit 0。`npm run test` が exit 0
2. `git grep -nE "games/|player_records" -- src/domain` が **0 件**（CAP 保護下エンドポイントに触れていない）
3. `git grep -rn "fetch\|XMLHttpRequest\|node:fs\|require(" -- src/domain` が **0 件**（ドメイン層はネットワーク・I/O を持たない純関数）
4. `git grep -rn "#[0-9a-fA-F]\{3,6\}\|--md-sys-color" -- src/domain` が **0 件**（色に触れていない＝ CLAUDE.md 制約5）
5. `src/domain` 配下に CSS 以外の bare import（`import './xxx'`）が無い（`git grep -n "^import '" -- src/domain` が 0 件）
6. 依存追加が無い（`git diff main -- package.json` に dependencies の追加が無い。`scripts` への 1 行追加は可）

### B. スコープ1（Level）

7. `getLevelTagFromId(20302) === '雀傑2'` / `getLevelTagFromId(10101) === '初心1'` / `getLevelTagFromId(10601) === '魂天'`（旧魂天は数字なし）/ `getLevelTagFromId(10703) === '魂天3'`
8. `getMaxPoint(parseLevelId(20302)) === 1400`（`LEVEL_MAX_POINTS[7]`）/ `getMaxPoint(parseLevelId(10501)) === 4000` / `getMaxPoint(parseLevelId(10701)) === 2000` / `getMaxPoint(parseLevelId(10720)) === 0`
9. `formatLevelWithDelta({ id: 20302, score: 58, delta: 174 }) === '雀傑2 232/1400'`（Issue 本文の実測値そのもの）
10. 魂天のポイント表示: `getScoreDisplay(parseLevelId(10601), 6871) === '8.9'`（旧魂天の補正 `ceil(6871/100)*10+200 = 890`）/ `getScoreDisplay(parseLevelId(10701), 6871) === '68.7'`
11. `getNextLevel(parseLevelId(10503))` の levelId が `10701`（雀聖3 → 魂天1。majorRank 6 を飛ばす）/ `getPreviousLevel(parseLevelId(10701))` の levelId が `10503`
12. `getPreviousLevel(parseLevelId(10101))` は自分自身（levelId 10101）を返す
13. `getPenaltyPoint(parseLevelId(20302), 22) === 100`（`LEVEL_PENALTY_3[7]`）/ `getPenaltyPoint(parseLevelId(20302), 21) === 50`（`LEVEL_PENALTY_E_3[7]`）/ `getPenaltyPoint(parseLevelId(10501), 16) === 210`
14. `isAllowedMode(parseLevelId(10401), 16) === false` かつ `isAllowedMode(parseLevelId(10401), 12) === true`（雀豪は王座に入れない）

### C. スコープ2（pt 変動）— Issue の実測値

15. `rankDeltaPoints([62500, 35700, 6800], 22, parseLevelId(20302))` が **`[148, 1, -143]`**（完全一致・ラスペナ 100 込み）
16. `expectedPointPerGame([0.3002, 0.3400, 0.3598], [62500, 35700, 6800], 22, parseLevelId(20302))` が **`-6.6818`**（`toBeCloseTo(-6.68, 2)`）
17. `rankDeltaPoints([42000, 27000, 21000, 10000], 16, parseLevelId(10501))` が **`[152, 67, -9, -240]`**、期待値が `-3.58`（`toBeCloseTo(-3.58, 2)`）
18. `includePenalty: false` で 4 位の変動が `-30` になり（ラスペナ 210 が引かれない）、`trimNumber: false` でも同じ `[152, 67, -9, -30]`、期待値 `46.82`（`toBeCloseTo(46.82, 2)`）
19. **魂天は素点非依存**: `calculateDeltaPoint(0, 0, 16, parseLevelId(10701))` と `calculateDeltaPoint(120000, 0, 16, parseLevelId(10701))` がどちらも `50`（`KONTEN_DELTA[16][0]`）。4位はどちらも `-50`
20. `KONTEN_DELTA` の無いモード（例 mode 9）に魂天を渡すと雀聖3（levelId 503 相当）のペナルティ表で計算される: `calculateDeltaPoint(0, 3, 9, parseLevelId(10701))` が `ceil(-25-15) + 0 - LEVEL_PENALTY[14]` = `-40 - 240` = **`-280`**
21. 人数不一致（例: `rankDeltaPoints([1,2,3], 16, ...)`）が `Error` を throw する

### D. スコープ3（昇降条件）— Issue 完了条件そのもの

22. **「残 50pt の雀傑2（三金 mode 22）」で 1 位が `{ kind: 'always' }`**（旧実装の誤り「1位で 70000 点以上」にならない）。入力 `{ id: 20302, score: 1350, delta: 0 }`。合格判定: `promotionConditions(lv, 22)[0]` が `{ rank: 0, kind: 'always' }`
23. 同ケースの 2 位が `{ kind: 'atLeast', score: 84100 }`、3 位が `{ kind: 'never' }`（境界 199100 は卓総素点 105000 を超えるため）
24. 境界の厳密性: 23 の 2 位について `calculateDeltaPoint(84100, 1, 22, 雀傑2) >= 50` かつ `calculateDeltaPoint(84000, 1, 22, 雀傑2) < 50` をテスト内で直接確認する
25. 四麻の閾値ケース: `{ id: 10501, score: 3900, delta: 0 }`（残 100pt）/ mode 16 で `[always, atLeast 59100, never, never]`（3 位の境界 129100 は卓総素点 100000 超のため never、4 位は達成不能）
26. 降格条件: `{ id: 10501, score: 100, delta: 0 }` / mode 16 で 1 位 `never`・2 位 `never`・3 位 `never`（境界 −71000 が探索域外）・**4 位 `always`**
27. **魂天の昇降条件は `always` / `never` のみ**（`atLeast` / `atMost` が現れない）。`{ id: 10701, score: 1960, delta: 0 }`（魂天1・上限 2000・残 40pt）/ mode 16 → `promotionConditions` が `[always(+50≥40), never(+20), never(−20), never(−50)]`。同じ入力の `demotionConditions` は 4 つとも `never`（`−50 < −1960` にならない）
28. 上限 0 の魂天20（`{ id: 10720, ... }`）で `promotionConditions` が全て `never`、`demotionConditions` も全て `never`

### E. スコープ4（成長指標）

29. `preferredMode(10501) === 16` / `preferredMode(10401) === 12` / `preferredMode(10301) === 9` / `preferredMode(20302) === 22` / `preferredMode(10201) === null`（雀士は入室可能モードなし）
30. `gamesToDemotion({ levelId: 20302, point: 232 }, -6.6818) === 35`（`floor(232/6.6818)+1`。34 戦後は残 4.82pt で降段しないことも併せて確認）
31. `gamesToPromotion({ levelId: 20302, point: 232 }, -6.6818) === null`（期待値が負）
32. `gamesToPromotion({ levelId: 20302, point: 1350 }, 6.6818) === 8`（`ceil(50/6.6818)`）
33. **`projectAfterGames({ levelId: 20302, point: 232 }, -6.6818, 50)` が `{ levelId: 20301, point: 499.773 }`**（`toBeCloseTo(499.773, 3)`）。35 戦目で雀傑1 に降段し `point = 1200/2 = 600` にリセットされ、残り 15 戦で `600 − 15×6.6818 = 499.773`
34. `applyPointDelta({ levelId: 20302, point: 1399 }, 10)` が `{ levelId: 20303, point: 1000 }`（雀傑3 の上限 2000 の半分）
35. `applyPointDelta({ levelId: 10201, point: 5 }, -100)` が `{ levelId: 10201, point: 0 }`（雀士1 は降段しない）

### F. スコープ5（安定段位）

36. `estimateStableLevel2(4p フィクスチャ, 16)` が `{ kind: 'number', value: 3.0055555… }`（`toBeCloseTo(3.005556, 5)`）。`splitStableLevelNumber(3.00555)` が `{ majorRank: 4, text: '雀豪3.00' }`（**切り捨て**であること: `3.0099` でも `'雀豪3.00'`）
37. `splitStableLevelNumber(4.5)` が `{ majorRank: 5, text: '雀聖1.50' }`
38. mode 12/16 以外は `estimateStableLevel` にフォールバックする。三麻フィクスチャ（雀傑2 / mode 22）で **`{ kind: 'level', levelId: 20301, bound: 'exact', expectedPoint: 0.5142 }`**（`toBeCloseTo(0.5142, 4)`）。導出: 雀傑2 の E = −6.6818 < 0 かつ上位に正の段位が無いため下降し、雀傑1（ラスペナ `LEVEL_PENALTY_3[6] = 80`）で順位別変動 `[148, 1, −123]`・E = +0.5142 > −0.001 となって停止する
39. `rank_rates[3]` が 0 の四麻入力に対して `estimateStableLevel2(..., 16)` が `{ kind: 'unavailable' }`
40. `estimateStableLevel` が 32 反復以内で必ず停止する（無限ループしない）: 全 15 段位 × mode 16/12/9 の組み合わせを回して例外・タイムアウトが出ない

### G. スコープ6（分布統計）

41. **`histogramStats(和牌率 の histogramFull)` が μ ≈ 0.2093（`toBeCloseTo(0.2093, 4)`）、σ ≈ 0.0239（`toBeCloseTo(0.0239, 4)`）**（Issue の実測値）
42. **`deviationValue(0.24, 和牌率の分布)` ≈ 62.8**（実測値 **62.8454**。`toBeCloseTo(62.845, 3)`。Issue 本文の「≈62.8」と一致）
43. `deviationValue(μ, d) === 50`（`toBeCloseTo(50, 6)`）。σ が 0 の分布に対して 50 を返す
44. `percentile(0.24, 和牌率の histogramFull)` ≈ 0.9022（`toBeCloseTo(0.902, 3)`）。`percentile(0.18, …)` ≈ 0.1084（`toBeCloseTo(0.108, 3)`）
45. `percentile` が域外で飽和する: `percentile(-1, h) === 0`、`percentile(999, h) === 1`
46. **`histogramClamped` を使っていない**: `和牌率` は clamped を持つが、`histogramStats` の結果が clamped から計算した値と一致しないことを確認する（clamped から計算した σ を同じテスト内で算出し、`expect(σ_full).not.toBeCloseTo(σ_clamped, 3)`）。加えて `git grep -n "histogramClamped" -- src/domain` が 0 件
47. `getBandZeroHistogram(gh, 16, '存在しない指標')` が `null`。band `"10301"` しか持たない metric でも `null`

### H. スコープ7・8（レーダー・傾向）

48. `calcRadar(extended_stats_4p, lookup)` が
    `攻 ≈ 57.2223` / `守 ≈ 53.6364` / `速 ≈ 57.8244` / `制 ≈ 58.6209` / `運 ≈ 53.6481`（各 `toBeCloseTo(値, 3)`）
49. 分布が引けない metric があるとその軸だけ `null` になり、他の軸は算出される（lookup をラップして `打点效率` だけ `null` を返させて確認）
50. `calcTendency(extended_stats_4p, lookup)` が `offenseDefense.value ≈ 0.3436`、`concealedSpeed.value ≈ 0.1390`（`toBeCloseTo(値, 4)`）。両方 `band === 2`
51. 係数が等係数の単純平均であること: 同テスト内で `z` を個別に求め、`(z立直 + z追立 + z放铳 − z默听)/4` と関数の返り値が一致する（`toBeCloseTo(…, 10)`）
52. `toBand` の境界: `toBand(-1.5) === 1` / `toBand(-1.51) === 0` / `toBand(-0.5) === 2` / `toBand(0.5) === 3` / `toBand(1.5) === 4` / `toBand(0) === 2`
53. 一部 metric の分布が欠けても残りの項で平均される（`追立率` の分布を `null` にしたとき `offenseDefense.value === (z立直 + z放铳 − z默听)/3`）。全項欠けたら軸が `null`

### I. スコープ9（その他導出）

54. `roundBalance({ rankRates: [0.3002,0.34,0.3598], rankAvgScores: [62500,35700,6800], mode: 22, gameCount: 814, roundCount: 3256 })` ≈ **`-413.215`**（`toBeCloseTo(-413.215, 3)`）
55. `averageScore(…)` ≈ `33347.14`（`toBeCloseTo(33347.14, 2)`）/ `rentaiRate` ≈ `0.6402` / `lastPlaceRate` ≈ `0.3598`
56. `roundCount === 0` で `roundBalance` が `null`
57. `levelDistributionPosition(level_statistics フィクスチャ, 10301)` が「10301 以下の四麻人数 ÷ 四麻総数」= `(20411 + 1000 + 15302 + 5000) / 43404` = `41713 / 43404` ≈ **`0.961040`**（`toBeCloseTo(0.96104, 5)`）。三麻エントリ `[2, 20302, 900]` は除外される

### J. 純粋性・不変性

58. **入力を変更しない**: `Object.freeze` した引数（配列・オブジェクト）を全公開関数に通しても TypeError が出ない。`src/api` の `deepFreeze` 相当を fixture に適用してから全テストを回すヘルパーを1つ用意し、少なくとも `rankDeltaPoints` / `expectedPointPerGame` / `promotionConditions` / `calcRadar` / `calcTendency` / `roundBalance` / `levelDistributionPosition` に適用する
59. **参照透過**: 同じ引数で 2 回呼ぶと deep-equal な結果になる（`Date.now()` 等に依存しない）。`git grep -n "Date\.\|Math.random" -- src/domain` が 0 件
60. `src/domain/index.ts` が §2 の各モジュールの公開シンボルを再 export し、内部ヘルパーを export していない

### K. フィクスチャ

61. `node scripts/build-domain-fixtures.mjs` を実行しても `git status --porcelain` が空（コミット済み JSON と生成結果がバイト一致する＝生成が決定的で、期待値表と対応している）
62. `git grep -rnE "[0-9]{8,}" -- src/domain/__fixtures__` にヒットする ID が `123456789` / `123456790` 以外に無い。ニックネームが「テストプレイヤー」系のみ
63. `src/domain/__fixtures__` に本物のプレイヤー ID・ニックネームが無い（62 と併せて目視）

### L. 作業ツリー

64. 完了時 `git status --porcelain` の差分が `src/domain/**` / `scripts/build-domain-fixtures.mjs` / `package.json`（script 1 行）/ `docs/design/issue-4-domain-logic.md` のみ

---

## 9. 後続 Issue への引き継ぎ事項 / 統括担当への申し送り

### 9.1 要件書の訂正提案（統括判断が要る）

- **要件 §6.5「50戦後見込み = 現在pt + 期待値×50（段位跨ぎは pt 表で換算）」は実挙動と一致しない。** 本家 `getAdjustedLevel`（§1.4 実物確認）では昇降段時のポイントは**新段位上限の 1/2 にリセット**される。累積 pt の線形換算では 50 戦後の値がずれる。本設計は本家準拠（逐次シミュレーション）を採用した。要件書 §6.5 の記述を更新することを推奨する

### 9.2 未確定・実挙動未確認として残るもの

- **傾向2軸の帯人数比**（±0.5/±1.5 → 7/24/38/24/7%）は名目値。各 z が正相関するため実際は中央帯が厚くなる見込み。実データでの検証は未実施。UI 実装 Issue で実分布を測って閾値を再調整する余地を残す
- **`global_histogram` フィクスチャは 1 metric（和牌率）を除いて合成値**。実分布の形（歪度・裾）は再現していない。μ・σ・パーセンタイルの計算式は検証できるが、「実データでの偏差値の妥当性」は検証していない。実データに差し替えるなら §7.6 の手順で
- **三麻の `global_histogram`（pl3）は一切未取得・未検証**。三麻でレーダー・傾向を出す Issue では pl3 の band 0 に必要 metric が揃っているかを最初に確認すること（`打点效率` / `铳点损失` が三麻にもあるかは未確認）
- `local_statistics` の zone 別内訳、`10799`（魂天合算）の扱いは fixture 上の仮定でしか検証していない

### 9.3 UI Issue への引き継ぎ

- レーダー軸の値は **クランプせずに素で返す**（0 未満・100 超がありうる）。`[0, 100]` への丸めは UI 側の責務
- 傾向2軸の**タイプ名見出し**（「鉄壁」「速攻全振り」等）は文言であり UI 側で持つ。ドメインは `band: 0..4` と数値だけを返す
- 成長指標を「入れる最上の卓・半荘基準」で計算していることの注記表示は UI 側（`preferredMode` の戻り値をそのまま使う）
- 安定段位の表示は `splitStableLevelNumber().text` をそのまま使えるが、`kind: 'level' | 'konten'` の場合は `bound`（`exact` / `plus` / `minus`）に応じた表現を UI が組む必要がある（本家は `"雀聖1+ (12.34)"` のような文字列を作っている）
- `nullable` が多い（分布欠測・0 除算）。UI は全軸 `null` のケースを持つ

### 9.4 実装上の落とし穴（製造担当向け）

- `LEVEL_PENALTY*` は長さ **16**、`LEVEL_MAX_POINTS` は長さ **15**。同じ添字式で引くが配列長が違う。片方をコピペして長さを揃えないこと
- `isKonten()` は majorRank **6 以上**（7 だけではない）
- `calculateDeltaPoint` の魂天分岐は `score` を**完全に無視して即 return** する。境界探索側でこれを踏まえないと「単調非減少なので二分探索で境界が求まる」前提のまま定数関数を二分探索することになる（結果は `always` / `never` に落ちるので正しいが、実装は明示的に分岐しておくほうが安全）
- `Math.ceil` の対象は `(score − 原点)/1000 + 順位点` **全体**。`ceil((score−原点)/1000) + 順位点` ではない
- 期待値計算で `rank_rates` を正規化しない（API は合計 1 で返す）。本家 `RankRates.normalize` は別用途
