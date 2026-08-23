# Issue 7 設計書: 最小検索導線（ニックネーム検索 → プレイヤーページ遷移）

- Issue: #7「最小検索導線」（M2 シェル）
- 依存: #3（API層・完了） / #5（アプリシェル・完了） / #4（ドメイン計算・完了）
- 参照: `docs/requirements.md` §3・§4・§8 / `docs/design/issue-3-api-layer.md` / `docs/design/issue-5-app-shell.md` / `docs/design/issue-4-domain-logic.md`
- スコープ外（Issue 本文に明記）: トップ画面のデザイン・おすすめ表示・ランキング

---

## 0. 結論サマリ（先に読む）

| 判断 | 内容 | 根拠 |
|---|---|---|
| 検索ボックス | `OutlinedTextField`（`type="search"`）を制御コンポーネントとして使う | §1.3 §1.4 の実物調査で「制御が壊れない」ことを確認。バンドル +62.95 kB は許容（§1.5） |
| 候補リスト | **`md-list` は使わない**。`<ul>/<li>/<button>` + `Ripple`（既存 `nav-rail__item` と同じ手法） | `md-list`+`md-list-item` は +14.04 kB。既存シェルに素の button + Ripple の precedent がある（§1.5・§2.2） |
| ローディング | **`CircularProgress` / `LinearProgress` を使わない**。CSS スケルトン行 | Progress ラッパーは片方の import で両方入り +12.07 kB。要件 §3「スケルトンローディング」とも一致（§1.5・§2.2） |
| 段位表示 | ドメインの `formatLevelWithDelta(level)` を**そのまま**呼ぶ（自前変換をしない） | §1.2。実測で `'雀傑1 684/1200'` を確認 |
| 四麻/三麻 | SearchPage の**ローカル state**（URL に載せない） | §2.4。URL クエリ方式は実挙動未確認の前提を1つ増やすため今回は採らない |
| デバウンス | 300 ms。**純モジュール `createDebouncer` に切り出す**（フェイクタイマーでユニットテスト可能にする） | §1.6（jsdom / testing-library が無くコンポーネントテストが書けない） |
| IME | `isComposing` による分岐を**入れない**。デバウンス＋文字列の同一性で吸収する | §1.4 末尾（`input` と `compositionend` の発火順がブラウザ間で異なり、片方で「確定しても検索されない」故障になる） |

---

## 1. 実物調査の結果（設計判断の根拠）

### 1.1 `searchPlayer` の戻り値（`src/api/endpoints.ts` / `normalize.ts` / `types.ts` 実読）

```ts
// src/api/endpoints.ts
export async function searchPlayer(
  numPlayers: NumPlayers, prefix: string, limit = 20,
): Promise<PlayerSearchResult[]>
```

- `prefix.trim() === ''` のとき **fetch を発行せず `[]` を返す**（呼び出し側で空チェックを二重に書く必要はないが、本設計では「空なら呼ばない」も併せて守る。無駄な Promise とローディング表示を避けるため）
- パスは `api/v2/pl{4|3}/search_player/{encodeURIComponent(trimmed)}?limit=20&tag=all`
- 公開型（`src/api/types.ts`）:

```ts
export type PlayerSearchResult = {
  id: number;              // プレイヤーID（遷移先の :id）
  nickname: string;
  level: LevelWithDelta;   // { id: levelId, score, delta }
  lastPlayedAtMs: number;  // ワイヤ latest_timestamp（秒）× 1000。Date ではない
};
```

- 候補表示に使う3フィールドはこれで揃う: `nickname` / `level` / `lastPlayedAtMs`
- 戻り値は `deepFreeze` 済み（`normalize.ts`）。**配列要素を書き換えたりソートし直したりしない**こと（`[...results]` で複製してから）
- **`level` は四麻/三麻横断**: `types.ts` に明記のとおり「pl4 検索でも三麻 levelId (2xxxx) が返りうる」（`docs/amae-koromo-api-spec.md` §3.1 の 2026-08-21 実測）。→ §2.3 の「別モード段位マーカー」の根拠

### 1.2 段位表示は `formatLevelWithDelta` の再利用で足りる（自前変換は不要・禁止）

`src/domain/level.ts` の `formatLevelWithDelta(lv: LevelWithDelta): string` は、
`parseLevelId` → 旧魂天（majorRank 6）の version 補正 → `getAdjustedLevel`（現在ptによる実効段位）→ `formatAdjustedScore` を通して `'雀傑1 684/1200'` 形式の文字列を返す。`LevelWithDelta` は `search_player` の `level` と**同じ型**なので、そのまま渡せる。

**実測**（`src/api/testdata/search_player.json` の1件目の値で vitest 上から実行）:

```
formatLevelWithDelta({ id: 10301, score: 695, delta: -11 })  →  "雀傑1 684/1200"
parseLevelId(10301).numPlayerId                              →  1   （1=四麻 / 2=三麻）
parseLevelId(20301).numPlayerId                              →  2
```

→ 検索画面で段位 ID を自前で解釈したり、`getLevelTagFromId`（delta を無視する）を使ったりしない。**`formatLevelWithDelta` 一本**にする。これが Issue 本文の言う「正規化ずれ」を確実に避ける唯一の方法。
なお `numPlayerId` の判定にだけ `parseLevelId` を使う（§2.3）。

### 1.3 【重要】`@lit/react` の `setProperty` はプロパティをダーティチェックしない

`node_modules/@lit/react/development/create-component.js`:

```js
const setProperty = (node, name, value, old, events) => {
  const event = events?.[name];
  if (event !== undefined) { /* イベントだけはダーティチェックする */ }
  // But don't dirty check properties; elements are assumed to do this.
  node[name] = value;
  ...
};
```

そしてこの `setProperty` は**依存配列なしの `useLayoutEffect`** から、毎レンダー・全 element prop に対して呼ばれる。

→ **`value={query}` の制御コンポーネントとして安全に扱える**。「React 側の再レンダーで prop が同値だと DOM に書き戻されず、要素内部の値と React state が乖離する」という一般的な web component ラッパーの落とし穴は、このラッパーには存在しない。
（ただし前提として **`input` イベントごとに必ず state を更新する**こと。state 更新をサボると、次のレンダーで古い値が要素へ書き戻され、入力が巻き戻る。）

### 1.4 `md-outlined-text-field` の `input` イベントの実挙動

`node_modules/@material/web/textfield/internal/text-field.js`:

```js
handleInput(event) {
  this.dirty = true;
  this.value = event.target.value;   // ← redispatch していない
}
redispatchEvent(event) { redispatchEvent(this, event); }  // change / select 用
```

テンプレートは `@change=${this.redispatchEvent}` / `@input=${this.handleInput}` / `@select=${this.redispatchEvent}`。
`.d.ts` の JSDoc も `@fires input {InputEvent} ... --bubbles --composed` / `@fires change {Event} ... --bubbles`（composed なし）と書いており整合する。

つまり:

- **`input` はホストで再発行されていない**。ネイティブ `input` が `composed: true` なのでシャドウ境界を越えてホストへ retarget されてくる。したがって React ハンドラが受け取るのは**元の `InputEvent` そのもの**（`isComposing` も保持される）
- シャドウ内側のリスナ（`handleInput`）はホストへバブルする**前**に走るので、React ハンドラの時点で `e.currentTarget.value` は最新
- → ハンドラでは **`e.currentTarget.value` を読む**（`e.target` も retarget でホストになるが、ラッパーの型が `currentTarget` に付いているので `currentTarget` に統一する）

**IME について（実挙動未確認・記憶ベースの注意）**: `input`（`isComposing: true`）と `compositionend` の発火順は Chromium 系と Firefox で逆になることが知られている。`isComposing === true` の間 fetch を止める実装は、順序次第で「変換確定しても検索が走らない」故障になる。本設計では **IME 分岐を入れない**（変換途中の文字列でも 300 ms 止まれば検索が走る。ノイズは1リクエスト程度で、`apiGet` のキャッシュもある）。IME での体感は §7 の逆発注で人手確認する。

### 1.5 バンドルサイズ実測（`npm run build` の `dist/assets/index-*.js`）

いずれも `src/shell/HomePlaceholder.tsx` を一時的に差し替えて計測し、計測後に元へ戻した（作業ログ §8）。

| 構成 | サイズ | ベースライン差 |
|---|---|---|
| **ベースライン（現在の main）** | **363.66 kB** (gzip 106.78) | — |
| `searchPlayer` + `formatLevelWithDelta` + `getLevelTagFromId` のみ | 365.16 kB (gzip 107.10) | **+1.50 kB** |
| ↑ + `OutlinedTextField` | 428.11 kB (gzip 118.59) | **+64.45 kB**（TextField 単体で +62.95） |
| ↑ + `List` + `ListItem` | 442.15 kB (gzip 121.81) | +78.49（md-list で **+14.04**） |
| TextField + `CircularProgress` | 440.18 kB (gzip 121.20) | +76.52（Progress で **+12.07**） |
| TextField + `LinearProgress` | **440.18 kB**（Circular と完全同値） | 同上 |
| 素の `<input>` + 素の `<button>` + `Ripple` | 365.26 kB (gzip 107.09) | +1.60 |

読み取れること:

1. `LinearProgress` と `CircularProgress` は**サイズが完全に一致**する。`src/components/md/Progress.ts` が両方の element class を import している1モジュールなので、**片方だけ import しても両方バンドルに入る**。ローディング表示のために 12 kB は払わない
2. `Ripple` / `Icon` / `OutlinedSegmentedButton*` は**すでにベースラインに入っている**（シェルが使用中）ので追加コスト 0
3. `OutlinedTextField` の +62.95 kB は、`field` + `labs/behaviors`（form-associated / constraint-validation / validators）を引き込むためで削れない。**検索ボックスはアプリの入口であり MD3 の見た目を落としたくない**ため、ここだけは払う判断とする（素の `<input>` を MD3 トークンで似せる案は、フローティングラベル・フォーカスインジケータの自作コストに見合わない）

→ **本 Issue の想定着地は 428〜435 kB**。受け入れ条件 A1 の上限を **435 kB** に置く。

### 1.6 テスト環境の実態: jsdom も testing-library も入っていない

`node_modules/jsdom` `node_modules/happy-dom` `node_modules/@testing-library` はいずれも**存在しない**。`vitest.config.ts` も無く（`vite.config.ts` のみ）、既存テストは全て Node 環境の純ロジックテスト（`src/api/*.test.ts` / `src/domain/*.test.ts` / `src/shell/paths.test.ts`）。

→ **本 Issue で DOM テスト環境を導入しない**（+依存 / +CI 時間 / 設計の焦点がぶれる）。代わりに、

- **テスト可能なロジックを純モジュールへ切り出す**（`debounce.ts` / `format.ts` / `searchState.ts`）→ vitest でユニットテスト
- React 配線・実際のリクエスト抑制は**ブラウザ実測**で検証する（受け入れ条件 C 群）

### 1.7 `apiGet` のキャッシュがデバウンス検証に与える影響（`src/api/client.ts` 実読）

- キーは `path`（クエリ込み）。**Promise を格納して in-flight dedupe** し、解決後もキャッシュに残る（上限 500 件、超えたら全クリア）。失敗した Promise だけは削除される
- 帰結1: 同じクエリ文字列を2回目に検索してもネットワークリクエストは**増えない**。デバウンス検証（C4）では**毎回異なる文字列**を使うこと
- 帰結2: React StrictMode の effect 二重実行でも、同一パスは1リクエストに合流するので**ネットワークリクエストは1本**。二重実行を欠陥と誤診しないこと
- 帰結3: エラーはキャッシュされないので「再試行」ボタンは実際に再リクエストする

### 1.8 シェル側の既存実装（`src/shell/` 実読）

- `AppRouter.tsx`: `HashRouter` + `<Route path="/" element={<HomePlaceholder />} />`。`*` は `/` へ replace
- `AppHeader.tsx`: **`playerId` と `activeTab` が必須 props**で、四麻/三麻トグルは `playerPath()` への遷移を行う。ホーム（プレイヤー未選択）では**そのまま再利用できない**
- `NavigationRail.tsx`: 素の `<button className="nav-rail__item">` の中に `<Ripple />` を置き、`.nav-rail__item { position: relative }` で受けている。**候補リスト行はこのパターンを踏襲する**
- `paths.ts` の `playerPath({numPlayers, playerId, tab})` が `encodeURIComponent` 込みでパスを組む。**パス文字列を手書きしない**

---

## 2. 設計

### 2.1 画面構成（最小）

```
SearchPage（ルート "/"）
├─ header.app-header                     ← 既存 .app-header クラスを再利用
│   ├─ タイトル "mj-stats-viewer"（ホームなのでリンクにしない）
│   └─ OutlinedSegmentedButtonSet[四人打ち|三人打ち]   data-testid="search-np-toggle"
└─ main.search-main
    ├─ OutlinedTextField (type=search, label="ニックネーム")  data-testid="search-input"
    ├─ div[aria-live=polite].search-status                    data-testid="search-status"
    └─ ul.search-results                                      data-testid="search-results"
        └─ li > button.search-result                          data-testid="search-result"
             ├─ <Ripple />
             ├─ span.search-result__nick     （ニックネーム）
             ├─ span.search-result__level    （段位。formatLevelWithDelta）
             ├─ span.search-result__mode     （別モード段位のときだけ "三麻"/"四麻"）
             └─ span.search-result__date     （最終対局日 YYYY/MM/DD）
```

状態ごとの表示（要件 §3「空・エラー状態の作り込み」）:

| state | `search-status` の内容 | `search-results` |
|---|---|---|
| `idle`（入力が空） | 「ニックネームを入力してください」 | 描画しない |
| `loading` | 「検索中…」 | **スケルトン行を3行**（`data-testid="search-skeleton"`） |
| `results`（1件以上） | 「N件」 | 候補行 |
| `results`（0件） | 「該当するプレイヤーが見つかりませんでした」 | 描画しない |
| `error` | エラー文言 ＋ 再試行ボタン（`data-testid="search-retry"`） | 描画しない |

### 2.2 コンポーネント選定の理由（バンドルと precedent）

- 候補行に `md-list-item` を使わない理由は §1.5 のサイズ（+14.04 kB）に加えて、`md-list` が独自のキーボードナビゲーション controller（`list-navigation-helpers`）を持ち、こちらで実装するキー操作（§2.6）と競合しうるため。素の `<button>` は tab 順・Enter/Space が無料で付いてくる
- ローディングにスケルトンを使うのは、サイズだけでなく要件 §3 の「スケルトンローディング」に一致するため

### 2.3 別モード段位のマーカー

`search_player` の検索インデックスは四麻/三麻横断で、`pl4` の検索でも三麻 levelId (`2xxxx`) が返る（§1.1）。段位だけを出すと「四麻を検索したのに三麻の段位が出ている」ことが利用者に分からない。

→ `parseLevelId(level.id).numPlayerId` が現在選択中の人数（4→1 / 3→2）と**異なるときだけ**、段位の隣に小さく `三麻` / `四麻` のラベルを出す。

遷移先は**常に現在選択中の人数**（`numPlayers`）で組む。「三麻段位のプレイヤーを四麻で開いたらデータが無い」ケースは、プレイヤーページ側のデータなし表示（Issue 8 以降）に委ねる。本 Issue で遷移先を段位から推測しない（推測すると、四麻も三麻も打つプレイヤーで誤誘導になる）。

### 2.4 四麻/三麻の保持場所: ローカル state（URL に載せない）

- 採用: `useState<NumPlayers>(4)` を SearchPage が持つ
- 不採用: `#/?np=3`（`useSearchParams`）。HashRouter 下でのクエリ解決は今回**実挙動未確認**であり、検証を1つ増やしてまで得るもの（リロード保持・戻る操作）が「最小導線」の範囲を超える
- 引き継ぎ: トップ画面 Issue で `np` を URL に載せるときに再検討する（§9）

`AppHeader` は改造しない（Issue 5 の受け入れ条件 C9/C10 が固定した挙動を壊さないため）。ホーム用ヘッダーは SearchPage 内に約15行で持つ。ヘッダーの共通化はトップ画面 Issue に送る（§9）。

### 2.5 データフロー

```
入力 (input イベント)
  → setQuery(e.currentTarget.value)             ... query state を即時更新（制御・§1.3）
  → normalizeQuery(query)
       ''      → debouncer.cancel() + setDebouncedQuery('')
       それ以外 → debouncer.schedule(normalized)      ... 300ms
                    → onFire で setDebouncedQuery(v)

useEffect([debouncedQuery, numPlayers, retryNonce])
  debouncedQuery === ''  → setState({kind:'idle'}) して終了（fetch しない）
  それ以外               → setState({kind:'loading'})
                           searchPlayer(numPlayers, debouncedQuery)
                             .then  → cancelled でなければ {kind:'results', items}
                             .catch → cancelled でなければ {kind:'error', message: describeError(e)}
  cleanup: cancelled = true       ... 競合する応答の取りこぼし・アンマウント後の setState を防ぐ
```

- **順序逆転の防止は effect の cleanup フラグで行う**（`AbortController` は `apiGet` が対応していないので使えない。リクエスト自体は飛ぶが、古い応答は state に書かない）
- 人数トグルの切替は effect の依存に入っているので**デバウンス無しで即時**再検索される（離散操作なので待たせる理由がない）
- アンマウント時は cleanup で `cancelled = true`、加えて SearchPage のアンマウント時に `debouncer.cancel()`

### 2.6 キーボード操作

| キー | 位置 | 動作 |
|---|---|---|
| `ArrowDown` | 入力欄 | 先頭の候補行へフォーカス |
| `ArrowDown` / `ArrowUp` | 候補行 | 次/前の候補行へフォーカス（端で止まる。ループしない） |
| `Escape` | 入力欄 | クエリを空にする（`idle` に戻る） |
| `Enter` / `Space` | 候補行 | 遷移（素の `<button>` の既定動作） |

候補行の DOM 参照は `useRef<(HTMLButtonElement|null)[]>` で保持する。

---

## 3. モジュール構成と公開シグネチャ

新規ディレクトリ `src/search/` を作る。

### 3.1 `src/search/debounce.ts`（純粋・DOM 非依存・ユニットテスト対象）

```ts
export interface Debouncer<T> {
  /** 直近の値で delayMs 後に1回だけ onFire を呼ぶ。呼ぶたびにタイマーは張り直される */
  schedule(value: T): void;
  /** 予約中の発火を取り消す。取り消し後に schedule すれば再び予約できる */
  cancel(): void;
}

export function createDebouncer<T>(delayMs: number, onFire: (value: T) => void): Debouncer<T>;
```

- 実装は `setTimeout` / `clearTimeout` のみ。leading edge 発火はしない（trailing のみ）
- **モジュールスコープの可変変数を持たない**（インスタンスごとにクロージャで閉じる。CLAUDE.md 的な共有可変状態を作らない）

### 3.2 `src/search/format.ts`（純粋・ユニットテスト対象）

```ts
import type { LevelWithDelta, NumPlayers } from '../api';

/** ローカル時刻の 'YYYY/MM/DD'。ゼロ埋めする */
export function formatLastPlayedDate(ms: number): string;

/** ドメインの formatLevelWithDelta をそのまま通す薄いラッパー（例: '雀傑1 684/1200'） */
export function formatLevel(level: LevelWithDelta): string;

/**
 * level が現在選択中の人数と別モードのときだけラベルを返す。同一なら null。
 * 例: crossModeLabel(20301, 4) === '三麻' / crossModeLabel(10301, 4) === null
 */
export function crossModeLabel(levelId: number, numPlayers: NumPlayers): '四麻' | '三麻' | null;
```

`formatLevel` は `formatLevelWithDelta` の再エクスポート相当だが、将来の表記変更点を1か所に閉じるために置く。**独自の段位計算を書かないこと**。

### 3.3 `src/search/searchState.ts`（純粋・ユニットテスト対象）

```ts
import type { PlayerSearchResult } from '../api';

export type SearchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'results'; items: readonly PlayerSearchResult[] }   // items.length === 0 は「0件」
  | { kind: 'error'; message: string };

/** 前後の空白を落とす。全て空白なら '' */
export function normalizeQuery(raw: string): string;

/** 例外を利用者向け日本語メッセージへ。サーバ由来の生文言は出さない */
export function describeError(err: unknown): string;
```

`describeError` の分岐（`src/api/errors.ts` の3クラス実読に基づく）:

| 入力 | 戻り値 |
|---|---|
| `MaintenanceError` | `'サーバーがメンテナンス中です。しばらくしてからお試しください。'` |
| `ApiError`（`status === 0`） | `'ネットワークに接続できませんでした。'` |
| `ApiError`（それ以外） | `` `検索に失敗しました（HTTP ${status}）` `` |
| その他 | `'検索に失敗しました。'` |

`MaintenanceError.message` はサーバー由来（中国語混じり）なので**そのまま画面に出さない**。

### 3.4 `src/search/useSearch.ts`

```ts
import type { NumPlayers } from '../api';
import type { SearchState } from './searchState';

export interface UseSearch {
  query: string;                    // 入力欄にそのまま渡す（制御コンポーネント）
  setQuery: (next: string) => void;
  state: SearchState;
  retry: () => void;                // 現在のクエリで即時再検索（デバウンスを挟まない）
}

export function useSearch(numPlayers: NumPlayers, delayMs?: number): UseSearch;  // delayMs 既定 300
```

挙動は §2.5 のとおり。`delayMs` を引数にしているのはテスト・調整のためで、SearchPage からは既定値で使う。

### 3.5 `src/search/SearchPage.tsx`

```ts
export function SearchPage(): ReactElement;
```

- `import './search.css'`（CSS の副作用 import は `package.json` の `sideEffects: ["*.css"]` により**許可されている唯一の形**）
- md コンポーネントは `../components/md` バレルからのみ import（`OutlinedTextField` / `OutlinedSegmentedButton` / `OutlinedSegmentedButtonSet` / `Ripple` / `Icon`）
- 候補クリック時: `navigate(playerPath({ numPlayers, playerId: String(item.id), tab: 'summary' }))`
- 人数トグルは `AppHeader.tsx` と同じく `onSegmentedButtonSetSelection` で `e.detail.index`（0=四人打ち / 1=三人打ち）を読む

### 3.6 `src/search/search.css`

- 色は `--md-sys-color-*` のみ（`#` で始まる色リテラルを書かない。CLAUDE.md 制約5）
- 必須クラス: `.search-main` / `.search-field` / `.search-status` / `.search-results` / `.search-result`（`position: relative` — Ripple のため）/ `.search-result__*` / `.search-skeleton`
- スケルトンは `--md-sys-color-surface-variant` 相当の矩形。アニメーションは `@media (prefers-reduced-motion: reduce)` で止める
- 候補リストは `max-height` + `overflow-y: auto` で高さを抑える（`limit=20`）
- タイポは `md-typescale-*` クラスを付ける（typescale CSS は既に `index.css` 経由で読み込み済み。ここで typescale を再 import しない）

### 3.7 変更・削除

| ファイル | 操作 |
|---|---|
| `src/search/debounce.ts` / `.test.ts` | 新規 |
| `src/search/format.ts` / `.test.ts` | 新規 |
| `src/search/searchState.ts` / `.test.ts` | 新規 |
| `src/search/useSearch.ts` | 新規 |
| `src/search/SearchPage.tsx` | 新規 |
| `src/search/search.css` | 新規 |
| `src/shell/AppRouter.tsx` | `HomePlaceholder` → `SearchPage` に差し替え（import 元は `../search/SearchPage`） |
| `src/shell/HomePlaceholder.tsx` | **削除** |
| `docs/design/issue-7-search.md` | 本書（設計フェーズで作成済み） |

`package.json` / `index.html` / `src/main.tsx` / `src/theme/` / `src/api/` / `src/domain/` / `src/components/md/` は**変更しない**（新規ラッパーの追加も不要 — 使用する5コンポーネントは全てバレルに存在することを確認済み）。

---

## 4. 受け入れ条件（検収担当はこれを1項目ずつ実行する）

### A. 静的検証

| # | 実行 | 合格 |
|---|---|---|
| A1 | `npm run build` | 型エラー0で成功。`dist/assets/index-*.js` のサイズが **435 kB 以下**（ベースライン 363.66 kB、TextField 実測 +62.95 kB。§1.5）。実測値を報告に記載する。超過したら原因（どの import か）を特定して報告する |
| A2 | `npm run lint` | エラー0・警告0 |
| A3 | `npm test` | 全通過 |
| A4 | `grep -rn "<md-" src/ --include=*.tsx --include=*.ts` | 0件（生タグ禁止・制約3） |
| A5 | `grep -rn "^import '" src/search/` | `.css` で終わるもの以外0件（制約1） |
| A6 | `grep -rniE "#[0-9a-f]{3,8}\b" src/search/` | 0件（色ハードコード禁止・制約5） |
| A7 | `grep -rn "material/web" src/search/` | 0件（md は必ず `../components/md` バレル経由） |
| A8 | `grep -rn "player/" src/search/ \| grep -v playerPath` | 0件（パス手書き禁止。遷移は `playerPath()` のみ） |
| A9 | `grep -rn "parseLevelId\|getLevelTag\|LEVEL_" src/search/` | `crossModeLabel` 内の `parseLevelId` **1箇所のみ**。段位文字列の自前組み立てが無いこと（§1.2） |
| A10 | `git status --porcelain` / `git diff --name-only main` | §3.7 の一覧と一致。`HomePlaceholder.tsx` が削除されている |
| A11 | `grep -rn "HomePlaceholder" src/` | 0件 |

### B. ユニットテスト（**red を先に確認する**）

`src/search/debounce.test.ts`（`vi.useFakeTimers()`）

| # | 検証 | 期待 |
|---|---|---|
| B1 | `schedule('a')`→advance 299ms | `onFire` 未呼び出し |
| B2 | B1 の続きで advance 1ms | `onFire` が **1回** `'a'` で呼ばれる |
| B3 | `schedule('a')`,`schedule('ab')`,`schedule('abc')` を 0ms 間隔で行い advance 300ms | `onFire` が **1回だけ**、引数は `'abc'`（最後の値） |
| B4 | `schedule('a')`→advance 200ms→`schedule('ab')`→advance 200ms | まだ0回（タイマーが張り直されている）。さらに advance 100ms で1回 `'ab'` |
| B5 | `schedule('a')`→advance 300ms→`schedule('b')`→advance 300ms | 合計2回（`'a'`,`'b'`） |
| B6 | `schedule('a')`→advance 100ms→`cancel()`→advance 1000ms | 0回 |
| B7 | B6 の後に `schedule('c')`→advance 300ms | 1回 `'c'`（cancel 後も再利用できる） |
| B8 | 2つの `createDebouncer` を作り片方だけ `cancel()` | もう片方は発火する（インスタンス間で状態を共有していない） |

`src/search/format.test.ts`

| # | 検証 | 期待 |
|---|---|---|
| B9 | `formatLastPlayedDate(new Date(2021, 3, 15, 22, 54).getTime())` | `'2021/04/15'`（ローカル成分から作るのでタイムゾーン非依存） |
| B10 | `formatLastPlayedDate(new Date(2024, 0, 5, 0, 0).getTime())` | `'2024/01/05'`（月日のゼロ埋め） |
| B11 | `formatLevel({ id: 10301, score: 695, delta: -11 })` | `'雀傑1 684/1200'`（§1.2 の実測値） |
| B12 | `crossModeLabel(10301, 4)` / `crossModeLabel(20301, 3)` | どちらも `null` |
| B13 | `crossModeLabel(20301, 4)` | `'三麻'` |
| B14 | `crossModeLabel(10301, 3)` | `'四麻'` |

`src/search/searchState.test.ts`

| # | 検証 | 期待 |
|---|---|---|
| B15 | `normalizeQuery('  ')` / `normalizeQuery('')` | `''` |
| B16 | `normalizeQuery('  たなか  ')` | `'たなか'` |
| B17 | `describeError(new MaintenanceError('维护中'))` | メンテナンス文言。**`'维护中'` を含まない** |
| B18 | `describeError(new ApiError('x', 0, 'p'))` | ネットワーク文言 |
| B19 | `describeError(new ApiError('x', 500, 'p'))` | `'500'` を含む |
| B20 | `describeError(new Error('boom'))` | 汎用文言。**`'boom'` を含まない** |

**red 確認の手順**（各1回、確認後に必ず元へ戻す）:
- B3: `createDebouncer` の `schedule` から `clearTimeout` を消す → B3 が「3回呼ばれた」で落ちること
- B6: `cancel()` の中身を空にする → B6 が落ちること
- B11: `formatLevel` を `getLevelTagFromId(level.id)` に差し替える → B11 が落ちること（= delta 反映の有無をテストが検知できている）
- B17: `describeError` の `MaintenanceError` 分岐を `err.message` を返すよう改変 → B17 が落ちること

### C. ブラウザ実測（`npm run dev` → ブラウザペイン。`javascript_tool` を使う）

前提ヘルパー（各手順で使う）:

```js
const q = (s) => document.querySelector(s);
const field = () => q('[data-testid="search-input"]');
// 入力のシミュレーション: 要素の value を書いてから input を発火させる（§1.4 のとおり
// React 側のリスナはホストに付いており、ハンドラは e.currentTarget.value を読む）
const typeInto = (v) => { const f = field(); f.value = v; f.dispatchEvent(new Event('input', {bubbles: true, composed: true})); };
```

| # | 実行 | 合格 |
|---|---|---|
| C1 | `http://localhost:5173/#/` を開く | `[data-testid="search-page"]` が存在。`[data-testid="search-status"]` に「ニックネームを入力してください」。`[data-testid="search-results"]` が**無い**。コンソールエラー0 |
| C2 | `read_network_requests` を `search_player` で絞る | C1 の時点で **0件**（空入力ではリクエストしない） |
| C3 | `typeInto('   ')`（空白のみ）→ 1秒待つ | `search_player` リクエストは依然 **0件**。status は idle 文言のまま |
| C4 | **デバウンス検証**: `typeInto` を `'a'`,`'ab'`,`'abc'`,`'abcd'`,`'abcde'` の順に**50ms 間隔**で実行 → 1秒待つ → `read_network_requests`（`search_player` で絞る） | 新規リクエストが **1本だけ**、URL が `.../search_player/abcde?...` で終わる。5本になっていたら不合格。※C3 までのリクエスト数を先に記録して差分で数えること。※`apiGet` のキャッシュがあるので**この検証で同じ文字列を使い回さない**（§1.7） |
| C5 | 実在しそうな2文字（例 `'ab'`）で検索し結果を待つ | `[data-testid="search-result"]` が1件以上。各行に ニックネーム / 段位（`/` を含む `雀xN nnn/nnnn` 形式か魂天表記）/ `YYYY/MM/DD` 形式の日付が入っている。`search-status` に件数 |
| C6 | **0件表示**: 該当しない長い文字列（例 `'zzzzzzzzzzqqqq'`）を入力して待つ | `search-results` が無く、`search-status` が「該当するプレイヤーが見つかりませんでした」 |
| C7 | **ローディング表示**: C5 と別の新規文字列を入力し、応答が返る前に `[data-testid="search-skeleton"]` の数を数える | 3（応答が速すぎて捕まえられない場合は、devtools のネットワークスロットリングではなく `useSearch` の `delayMs` に頼らず、`javascript_tool` で `performance` を見ながら数回試す。捕まえられなければ「未確認」として報告し、代わりに C7' を実施） |
| C7' | （C7 が捕まらない場合）`fetch` を一時的に無限 pending へ差し替えてから入力: `const of=window.fetch; window.fetch=()=>new Promise(()=>{});` → 新規文字列を入力 → 1秒後に skeleton を数える → `window.fetch=of` | skeleton が 3 行、`search-status` が「検索中…」 |
| C8 | **エラー表示**: `const of=window.fetch; window.fetch=()=>Promise.resolve(new Response('x',{status:500}));` → 新規文字列を入力 → 待つ → `window.fetch=of` | `search-status` に `500` を含むエラー文言、`[data-testid="search-retry"]` が存在。コンソールに未処理の Promise 拒否が出ていない |
| C9 | C8 の直後（fetch を戻した状態）で `[data-testid="search-retry"]` をクリック | 新しい `search_player` リクエストが飛ぶ（失敗はキャッシュされない・§1.7）。成功すれば候補が出る |
| C10 | **遷移**: C5 の状態で先頭の `[data-testid="search-result"]` をクリック | `location.hash` が `#/4/player/<id>/summary` になる（`<id>` はその行の `data-player-id` と一致）。プレイヤーページのシェルが描画される |
| C11 | 戻って `#/` を開き、`[data-testid="search-np-toggle"]` の「三人打ち」をクリック→新規文字列で検索 | リクエスト URL が `api/v2/pl3/search_player/...`（四人打ちのままなら不合格）。トグルの `children[1].selected === true` |
| C12 | C11 の状態で候補をクリック | `location.hash` が `#/3/player/<id>/summary` |
| C13 | **人数切替の即時再検索**: 文字列を入力して結果が出た状態で人数トグルを切り替える | デバウンス待ちなしで新しいリクエストが飛び、結果が置き換わる |
| C14 | **別モード段位マーカー**: 四人打ちで検索し、`document.querySelectorAll('[data-testid="search-result"] .search-result__mode')` を調べる | 三麻 levelId のプレイヤーが混ざっていれば `'三麻'` が表示され、同モードの行にはマーカーが無い。※検索語によっては混ざらないので、混ざらなかった場合は `javascript_tool` から `crossModeLabel` 相当の表示を確認できない旨を報告し、B12〜B14 のユニットテストで代替とする |
| C15 | **キーボード**: 入力欄にフォーカスして `ArrowDown` を dispatch | `document.activeElement` が先頭の `[data-testid="search-result"]` |
| C16 | 続けて候補行で `ArrowDown` / `ArrowUp` | 次/前の行へ移り、先頭で `ArrowUp` しても先頭に留まる |
| C17 | 入力欄で `Escape` | 入力欄の `value` が `''`、`search-status` が idle 文言、`search-results` が消える |
| C18 | 幅 375px（`resize_window` mobile）で表示 | 横スクロールが発生しない（`document.documentElement.scrollWidth <= clientWidth`）。候補行のテキストが重ならない |
| C19 | `localStorage.setItem('mjsv:color-mode','dark')` → リロード → C5 を再実行 | `getComputedStyle(q('[data-testid="search-result"]')).color` がライト時と**異なる値**。ハードコード色が無いことの実地確認 |
| C20 | 全操作後に `read_console_messages`（`onlyErrors`） | 0件 |

**C の実行にあたっての API 利用規律**: C4〜C14 で amae-koromo の実 API を叩く。CAP 保護下のエンドポイントには触れない（`search_player` は非保護・仕様書 §2.4）。同じ文字列の使い回しはキャッシュで無効になるので新しい文字列を使うが、**合計リクエストは 20 回以内**に収める。UA の偽装をしない。**取得した実在プレイヤーのID・ニックネームを設計書・PR 本文・コミットメッセージに書かない**（検証結果は「1件以上」「形式が一致」といった形で報告する）。

### D. オーナーへの UI 検証逆発注（機械で測れないもの）

`docs/ui-verification/TEMPLATE.md` を複製して手順書化する（`README.md` の規約に従う）。**回収を待たずに PR を作成してよい**が、未回収である旨を PR 本文に書く。

- D1: **日本語 IME での入力体感**（最重要）。「たなか」と変換しながら入力したとき、変換途中の候補で検索が走ってちらつかないか / 変換確定後にきちんと検索されるか。※§1.4 のとおりエージェントは原理的に IME を再現できない
- D2: デバウンス 300 ms の体感（速すぎ/遅すぎ）
- D3: スケルトン3行の見え方（ちらつき・高さジャンプ）
- D4: 実機（スマホ）でのソフトキーボード表示時に候補リストが隠れないか
- D5: 候補行の情報量（段位を `雀傑1 684/1200` のフル表記で出すか、段位名だけにするか）

---

## 5. 実挙動未確認の箇所（推定で書いた部分）

1. **IME（`input` と `compositionend` の発火順）** — §1.4。ブラウザ仕様の記憶に基づく記述で、実測していない。だからこそ「`isComposing` で分岐しない」設計にして、順序に依存しないようにした。体感確認は D1 に委託
2. **`md-outlined-text-field` の `type="search"` でのネイティブクリアボタン** — WebKit のみの挙動で未検証。設計は Escape によるクリア（C17）を正とし、ネイティブクリアボタンの有無に依存しない
3. **`Ripple` を素の `<button>` の中に置いたときの見た目** — `nav-rail__item` の precedent があるので機構としては動くが、候補行（横長・複数行テキスト）でのリップル中心位置は未確認。D3/D5 の観察対象
4. **`search_player` のレスポンス実物** — 本設計では実 API を叩いていない（統括担当からの許可が無いため）。型・形状は `src/api/types.ts` / `normalize.ts` / `src/api/testdata/search_player.json` / `docs/amae-koromo-api-spec.md` §3.1（Issue 3 の設計時に実測済み）に依拠している
5. **`useSearchParams` の HashRouter 下での挙動** — 未検証。だから §2.4 で採用しなかった

---

## 6. 統括担当に判断を仰ぐ点（実装前に確認できるとよい）

いずれも**設計としては推奨案で確定して書いている**ので、異論がなければそのまま製造に進んで問題ない。

| # | 論点 | 推奨（本書の記述） | 代替 |
|---|---|---|---|
| J1 | 検索ボックスに `OutlinedTextField`（+62.95 kB）を使うか | 使う。アプリの入口の見た目を優先 | 素の `<input>` を MD3 トークンで装飾（+約 0 kB、実装コスト増） |
| J2 | 候補行に `md-list`（+14.04 kB）を使うか | 使わない（素の button + Ripple） | `md-list` を使い見た目の統一を優先 |
| J3 | 段位の表示形式 | `雀傑1 684/1200`（フル） | 段位名のみ `雀傑1`（D5 で回収） |
| J4 | `np` を URL に持つか | 持たない（ローカル state） | `#/?np=3`（要 `useSearchParams` の実挙動確認） |

---

## 7. 後続 Issue への引き継ぎ

- **ヘッダーの共通化**: `AppHeader.tsx`（プレイヤーページ用）と SearchPage 内ヘッダーで、タイトル＋四麻/三麻トグルのマークアップが重複する。トップ画面 Issue で `AppHeader` を「playerId が無くても使える」形に一般化し、両者を統合すること。Issue 5 の受け入れ条件 C9/C10（トグルでタブを保持したまま遷移する）を壊さないこと
- **`np` の URL 化**: トップ画面 Issue で `#/?np=3` を導入する場合、SearchPage のローカル state をそこへ移す（§2.4）
- **`formatLevel` の置き場所**: `src/search/format.ts` の `formatLevel` / `crossModeLabel` は検索固有ではない。プレイヤーページのヘッダーでも段位表示が必要になるので、2箇所目の利用者が現れた時点で `src/domain/` か共通の表示層へ移すこと
- **`createDebouncer`**: 期間フィルタ・モードセレクタなど他の入力にも再利用できる。3箇所目で `src/lib/` 等へ移すことを検討する
- **`SearchState` のパターン**: `idle / loading / results / error` の4状態は、プレイヤーページのデータ取得（Issue 8 以降）でも同型になる。そちらを設計するときに一般化した `AsyncState<T>` へ寄せるか検討する
- **キャンセル**: `apiGet` は `AbortController` を受け付けないため、本 Issue の「古い応答を捨てる」は state 書き込みの抑止でしかない（リクエスト自体は飛ぶ）。API 層に signal を通す拡張は、必要が生じた Issue で `src/api/client.ts` ごと再設計すること
- **DOM フック一覧**（後続の検収でも使う）: `search-page` / `search-input` / `search-np-toggle` / `search-status` / `search-results` / `search-result`（＋ `data-player-id`）/ `search-skeleton` / `search-retry`

---

## 8. 作業ログ（実測の再現手順）

1. ベースライン: `git stash` なしのクリーンな main で `npm run build` → 363.66 kB
2. サイズ計測: `src/shell/HomePlaceholder.tsx` を計測用の内容へ一時退避コピー付きで差し替え、`npm run build` の `dist/assets/index-*.js` 行を読む。計測パターンは §1.5 の6行。**毎回 `cp` で元ファイルを復元**し、最後に `git status --porcelain` が空であることを確認した
3. 段位表示の実測: リポジトリ直下に一時的な `probe.test.ts` を置き、`npx vitest run probe.test.ts` で `formatLevelWithDelta` / `parseLevelId` の戻り値を確認（vitest が `console.log` を抑制したため、値を `throw new Error(JSON.stringify(...))` に載せて表示させた）。確認後に削除
4. ライブラリ実物: `node_modules/@lit/react/development/create-component.js`（`setProperty`）、`node_modules/@material/web/textfield/internal/text-field.js`（`handleInput` / `redispatchEvent`）と同 `.d.ts` の `@fires` JSDoc、`node_modules/@material/web/list/internal/listitem/list-item.d.ts` を実読
5. 設計終了時点で `git status --porcelain` が「本設計書1本の未追跡ファイルのみ」であることを確認済み
