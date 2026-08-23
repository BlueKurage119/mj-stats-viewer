# Issue 6 設計書: グローバルフィルタ（モード複数選択・期間プリセット・URLクエリ同期）

対象 Issue: #6「グローバルフィルタ: モード複数選択と期間プリセット」
依存: #3（API層）/ #4（ドメイン）/ #5（アプリシェル）/ #7（検索）— いずれもマージ済み

---

## 0. 結論サマリ（先に読む）

1. **`md-filter-chip` には選択変更イベントが存在しない**。`selected` の変化は「内部 `<button>` の `click` を `redispatchEvent` でホストから再発行する」形でしか外に出ない。React 側は `onClick` で受け、`e.currentTarget.selected` を読む（§1.1）
2. **`preventDefault()` による「制御コンポーネント化」は採用しない**。`handleClickOnChild` は preventDefault されると `selected` を **クリック前の値へ巻き戻す**が、その巻き戻しは React の同期フラッシュ（＝正しい新値の書き込み）より**後**に走りうるため、正しい値を古い値で上書きする経路がある（§1.2）。代わりに **クリックハンドラ内で `e.currentTarget.selected` に期待値を直接代入する**（順序に依存せず必ず正しい値に落ちる）
3. **URL クエリを唯一の情報源**にする。`?mode=16.12&period=90d`。`.` 区切りは既存 `joinModes` と一貫（§2.2）
4. **HashRouter 下でも `useSearchParams` はそのまま動く**ことをソースで確認済み（§1.3）。`setSearchParams` は現在の**フルパス名**を維持する（`/summary` を落とさない）ことも確認済み
5. **チップ導入コストは実測 +23.84 kB**（435.64 → 459.48 kB、gzip +3.90）。期間側を segmented button にしても削減にならないため、モード・期間とも filter-chip で統一する（§1.4）
6. **`selectRepresentativeMode()` に必要な「モード別対局数」は、集約された `player_stats` 1本からは取得できない**。要件 §4.2 と「1操作2リクエスト」は原理的に両立しない。本 Issue では**対局数を呼び出し側から受け取る純セレクタ**として用意し、未提供時は卓順フォールバックにする。統括担当の判断を仰ぐ点（§7）

---

## 1. 実物調査の結果（設計判断の根拠）

### 1.1 `md-filter-chip` に選択変更イベントは無い

`node_modules/@material/web/chips/internal/filter-chip.d.ts`:

```
/**
 * A filter chip component.
 *
 * @fires remove {Event} Dispatched when the remove button is clicked.
 */
```

宣言されているイベントは `remove` **のみ**。`src/components/md/Chips.ts` の `events: { onRemove: 'remove' }` はこれに対応しており、**選択用のイベントは意図的に無い**（追加もできない）。

実装（`filter-chip.js`）:

```js
renderPrimaryAction(content) {
  return html`<button class="primary action" id="button" aria-pressed=${this.selected}
    @click=${this.handleClickOnChild}>${content}</button>`;
}
handleClickOnChild(event) {
  if (this.disabled || this.softDisabled) return;
  const prevValue = this.selected;
  this.selected = !this.selected;            // ← 先に自分で反転する
  const preventDefault = !redispatchEvent(this, event);
  if (preventDefault) { this.selected = prevValue; return; }   // ← 巻き戻し
}
```

`redispatchEvent`（`@material/web/internal/events/redispatch-event.js`）は、元イベントが `bubbles && composed` なので **元イベントの伝播を止め**、`Reflect.construct(MouseEvent, ['click', event])` のコピーをホストから再ディスパッチする。

帰結:

- React が受け取る `click` は**コピー1本だけ**（元イベントは `stopPropagation()` 済み）。二重発火は起きない
- コピーは `bubbles: true / composed: true` を引き継ぐので React 19 のルート委譲に届く。`e.currentTarget` は `md-filter-chip`（＝ `MdFilterChip`）
- ハンドラが呼ばれた時点で `e.currentTarget.selected` は**すでに反転後の値**
- 既存の `src/dev/ComponentGallery.tsx:206` が `onClick={(e) => ... e.currentTarget.selected}` を使っており、型が通ることは現行ビルドで実証済み

### 1.2 【重要】`preventDefault()` による制御は安全でない

`@lit/react` の `setProperty` は**プロパティをダーティチェックしない**（issue-7 §1.3 で既出。今回も `node_modules/@lit/react/development/create-component.js` を再確認）:

```js
// But don't dirty check properties; elements are assumed to do this.
node[name] = value;
```

これは**依存配列なしの `useLayoutEffect`** から毎レンダー呼ばれる。したがって「React が再レンダーしさえすれば `selected` は必ず props の値へ戻る」。

問題は**順序**である。React 19 の discrete event（click）は、React のルートリスナが**戻る前に同期フラッシュ**しうる。その場合の時系列は:

```
button click
 → chip.handleClickOnChild: this.selected = !selected      （仮の値）
 → redispatchEvent → element.dispatchEvent(copy)
      → React ルートリスナ → onClick ハンドラ → setSearchParams
      → React 同期フラッシュ → useLayoutEffect → chip.selected = <正しい新値>
 → dispatchEvent が返る
 → preventDefault されていれば: this.selected = prevValue   ← 正しい新値を古い値で上書き
```

一方 React がマイクロタスクへ遅延する実装だと巻き戻しが先・React の書き込みが後になり、こちらは正しく着地する。**どちらの順序になるかは React の内部実装依存**であり、これに賭ける設計はしない。

さらに `preventDefault()` を使わない場合も、**React state が変わらないクリック**（＝唯一選択中のモードチップを押す・すでに選択中の期間チップを押す）では再レンダーが起きず、チップだけが勝手に反転したままになる。

→ **採用する規約（両方の順序で必ず正しくなる）**

> filter-chip の `onClick` ハンドラは、次の filter 状態を計算したうえで
> **`e.currentTarget.selected = <そのチップの期待選択状態>` を必ず代入する**。
> `e.preventDefault()` は**呼ばない**。

理由: この代入は「React の書き込みより前」でも「後」でも同じ正しい値になる（React が後から書くならその値も同じ正しい値、React が先に書いていたなら上書きしても同値、React が再レンダーしないなら本代入だけが効く）。`preventDefault` を呼ばないので巻き戻し経路自体が発生しない。

補足: `React.memo` でチップをメモ化すると「再レンダーによる自動復旧」という保険が消えるので、**FilterBar とチップをメモ化しない**こと。

### 1.3 HashRouter 下の `useSearchParams` / `setSearchParams` の実挙動（ソース確認）

issue-7 §2.4 が「HashRouter 下でのクエリ解決は実挙動未確認」として保留していた点を、今回ソースで確定させた。

`react-router/dist/development/chunk-62JRHF6Z.mjs:163` `createHashLocation`:

```js
let { pathname = "/", search = "", hash = "" } = parsePath(window.location.hash.substring(1));
```

`parsePath`（同 261 行）は `#` → `?` の順に切り出す。すなわち `#/4/player/123/summary?mode=16&period=90d` は
`pathname='/4/player/123/summary'` / `search='?mode=16&period=90d'` に正しく分解される。**HashRouter でクエリは使える。**

`useSearchParams`（同 10830 行）:

```js
let searchParams = React.useMemo(() => getSearchParamsForLocation(location.search, ...), [location.search]);
let setSearchParams = React.useCallback((nextInit, navigateOptions) => {
  const newSearchParams = createSearchParams(typeof nextInit === "function" ? nextInit(new URLSearchParams(searchParams)) : nextInit);
  hasSetSearchParamsRef.current = true;
  navigate("?" + newSearchParams, navigateOptions);
}, [navigate, searchParams]);
```

`navigate("?...")` の解決は `resolveTo`（同 925 行）:

```js
let toPathname = isEmptyPath ? "/" : to.pathname;   // "?x=1" → to.pathname === undefined
let from;
if (toPathname == null) { from = locationPathname; }   // ← フルの現在パス名
```

→ **`setSearchParams` は「現在のロケーションのフルパス名」を維持する**。`PlayerLayout`（親ルート `/:np/player/:id`）から呼んでも子セグメント `/summary` は落ちない。相対解決で子タブが消える、という当初の懸念は**実物調査により否定**された。

`setSearchParams` の既定は `push`。連続したチップ操作で履歴が汚れるため、本 Issue では**すべて `{ replace: true }`** を使う（§2.3）。

### 1.4 バンドルサイズ実測（`npm run build`）

`src/shell/PlaceholderPanel.tsx` を一時的に差し替えて計測し、計測後に元へ戻した（作業ログ §9）。

| 構成 | `dist/assets/index-*.js` | ベースライン差 |
|---|---|---|
| ベースライン（現在の main） | **435.64 kB** (gzip 121.30) | — |
| ＋ `ChipSet` + `FilterChip`（`src/components/md` バレル経由） | **459.48 kB** (gzip 125.20) | **+23.84 kB** (gzip +3.90) |

読み取れること:

- `md-chip-set` + `md-filter-chip` は 1 モジュール（`src/components/md/Chips.ts`）にまとまっているため、**片方だけ使っても両方入る**（`Progress.ts` と同じ構造。issue-7 §1.5 の教訓が再現）
- したがって「期間チップだけ `OutlinedSegmentedButton`（追加コスト 0）にする」案に**サイズ上の利益は無い**。モードチップで 23.84 kB を払う以上、期間側も filter-chip で統一するのが一貫性・実装量の両面で有利
- **想定着地 460〜465 kB**。受け入れ条件 A2 の上限を **465 kB** に置く

### 1.5 チップのラベル指定（`label` prop）

`chip.js:113` `renderPrimaryContent`:

```js
<span class="label-text" id="label">${this.label ? this.label : html`<slot></slot>`}</span>
```

`label` プロパティは `.d.ts` 上 `@deprecated`（「テキストは子要素で渡せ」）だが、実装は現役で `label` が子要素より優先される。既存 `ComponentGallery.tsx` も `label` を使っている。**本 Issue も `label` prop を使う**（子要素にすると `slot` 経由になり、`ChipSet` のフォーカス管理と組み合わせたときの差分を追加検証する必要が出るため、precedent を踏襲する）。

### 1.6 既存 API 層・ドメイン層の実シグネチャ（再利用するもの・自前実装しないもの）

`src/api/gameMode.ts`:

- `ALL_MODES_4 = [16, 12, 9, 15, 11, 8]` / `ALL_MODES_3 = [26, 24, 22, 25, 23, 21]`
  — コメントに「**表示順を兼ねた全モードリスト（上位卓・半荘優先）**」と明記されている。
  **「自分が入れる最上の卓・半荘優先」という既定値規則は、この配列順で先頭から探すだけで満たせる**（自前の優先度表を作らない）
- `allModes(numPlayers)` / `joinModes(modes)`（`.` 連結・空配列は throw）

`src/api/range.ts`:

- `export type PeriodPreset = 'all' | '1y' | '90d' | '30d' | '7d'` — **Issue の期間プリセットと完全一致。新しい型を作らない**
- `resolveRange(spec, numPlayers, playerId): Promise<ResolvedRange>` が既にあり、`{ kind: 'preset', preset }` を渡せばよい。**期間→日付の計算を自前で書かない**
- `currentHourEnd()` は `Math.ceil(Date.now() / HOUR_MS) * HOUR_MS`。**1時間量子化されているので、レンダーのたびに呼んでも URL は変わらない**（キャッシュバスターにならない）

`src/api/endpoints.ts`:

- `getPlayerStats(numPlayers, playerId, start, end, modes?)` / `getPlayerExtendedStats(...)`（同シグネチャ）。`modes` 省略・空配列なら `allModes()` を明示列挙
- `getCurrentLevel(numPlayers, playerId)` は `getPlayerStats(np, id, dataMinDate(), currentHourEnd(), allModes(np))` の薄いラッパー。戻り値 `CurrentLevelInfo = { level, maxLevel, nickname, gameCount, playedModes }`
  → **カード1除外規則の API 側はすでに実装済み。`useCurrentIdentity()` はこれを React に載せるだけ**

`src/api/client.ts`:

- キャッシュキーは **クエリ込みの path**、Promise を格納して in-flight dedupe。成功結果は残る（上限500、超過で全クリア）、失敗は削除
- 帰結A: **`period='all'` かつ全モード選択のときの `player_stats` は `getCurrentLevel` と URL が完全一致する** → ネットワークリクエストは合流して 1 本になる。受け入れ条件 C の「2本」計測は**この組み合わせを避けて**行う（§4 C2 に明記）
- 帰結B: StrictMode の effect 二重実行はネットワークを増やさない。**二重実行を欠陥と誤診しないこと**

`src/domain/levelConstants.ts` / `src/domain/level.ts`:

- `LEVEL_ALLOWED_MODES` のキーは **`numPlayerId * 100 + majorRank`**（`level.ts` の `isAllowedMode` と同じ算出）。`101`/`102`/`201`/`202`（初心・雀士）は **`[]`**
- `parseLevelId(levelId) → { numPlayerId, majorRank, minorRank }` を使う。**桁分解を自前で書かない**
- `formatLevelWithDelta(lv)` が `'雀傑2 232/1400'` を返す（issue-7 §1.2 と同じ再利用）

`src/api/types.ts`:

- `PlayerStats` に**モード別の対局数は無い**（`gameCount` は集約値、`played_modes` は「プレイしたことのあるモードの集合」でしかない）。§7 の課題の根拠

### 1.7 既存デバウンサ

`src/search/debounce.ts` の `createDebouncer<T>(delayMs, onFire)` が要件を満たす。import 元が `src/search/` のままだと `src/filters/` → `src/search/` の横断依存になるため、**`src/util/debounce.ts` へ移動**して両者から使う（§3.8）。

---

## 2. 設計

### 2.1 全体データフロー

```
URL (#/:np/player/:id/:tab?mode=…&period=…)      ← 唯一の情報源
   │
   ├─ useCurrentIdentity(np, playerId)           ← フィルタと無関係。deps は [np, playerId] のみ
   │     └ getCurrentLevel()  … 全モード・全期間・終端=現在（1リクエスト、プレイヤー切替時のみ）
   │
   ├─ useGlobalFilter(np, identity)              ← URL を読み、欠落時は identity から既定値を解決して URL へ書き戻す
   │     └ filter: { modes, period } | null
   │
   └─ useFilteredStats(np, playerId, filter)     ← filter をキーに debounce（250ms）してから
         └ Promise.all([ getPlayerStats(…, modes), getPlayerExtendedStats(…, modes) ])   … 常に 2 リクエスト
```

`PlayerLayout` がこの3フックを呼び、結果を **`<Outlet context={scope} />`** で各タブへ配る。

### 2.2 URL クエリのキー設計

| キー | 形式 | 例 | 不正・欠落時 |
|---|---|---|---|
| `mode` | `GameMode` を `.` 連結（`joinModes` と同形式） | `mode=16.12` / `mode=16.12.9.15.11.8` | 既定値を解決して `{replace:true}` で書き戻す |
| `period` | `PeriodPreset` の文字列そのもの | `period=90d` | `all` として扱い、書き戻す |

**`.` 区切りを採用する理由**: `joinModes()` が生成する文字列と完全に同じで、`serializeModes()` が `joinModes()` の薄いラッパーで済む（区切り文字を2種類持たない）。`,` は `URLSearchParams` によって `%2C` にエンコードされ URL 可読性がむしろ落ちる。`.` はエンコードされない。

**`mode=all` のような別名は導入しない**。全モードは 6 個の明示列挙（`16.12.9.15.11.8`、17文字）で表す。理由: 「全モード」の実体が `allModes()` の明示列挙である（API が空 `mode` を 400 で拒否するため）という API 層の事実と表現が一致し、パーサに特殊ケースが増えない。

**正規化**: パース結果は `canonicalizeModes()` で「重複除去 → 当該 `numPlayers` に属さない ID を除去 → `allModes(np)` の順に並べ替え」を行う。正規化後の文字列が URL の生値と異なる場合のみ `{replace:true}` で書き戻す（`canonicalizeModes` は冪等なので無限ループしない）。

**四麻⇔三麻の切替**: `AppHeader` はパスだけを変えクエリは持ち越す。持ち越された `mode` は新しい `numPlayers` では全 ID が無効になるため、`canonicalizeModes` の結果が空 → 「`mode` 欠落」と同じ扱いになり、新しい `numPlayers` の既定値が解決・書き戻される。**`AppHeader` は改造しない**（Issue 5 の受け入れ条件 C9/C10 が固定した挙動を壊さない）。

### 2.3 履歴の扱い: すべて `{ replace: true }`

- 採用理由: チップは連打される前提の UI であり、1タップ1履歴エントリだと「戻る」が実質使えなくなる。「戻る」はタブ移動・プレイヤー遷移という**粒度の大きい操作**にだけ対応させる
- 代償: フィルタ操作は「戻る」で取り消せない。これは受け入れる（明示的なリセット UI は本 Issue のスコープ外）
- 共有・リロードでの復元は `replace` でも成立する（アドレスバーの URL は更新されるため）

### 2.4 既定モードの解決規則

```
defaultModes(numPlayers, levelId, playedModes):
  order   = allModes(numPlayers)                       // 上位卓・半荘優先の順
  allowed = LEVEL_ALLOWED_MODES[numPlayerId * 100 + majorRank] ?? []   // levelId から parseLevelId で分解
  1) order の中で allowed に含まれる最初の1件があれば [それ]
  2) 無ければ order の中で playedModes に含まれる最初の1件があれば [それ]
  3) それも無ければ [...order]   // 全モード
```

- `levelId` が `null`（identity 取得失敗・404）のときは 1) を飛ばす
- `levelId` の `numPlayerId` が `numPlayers` と食い違う場合（`search_player` では起こりうるが `getCurrentLevel` では起こらない）、`LEVEL_ALLOWED_MODES` のキーが噛み合わず 1) は自然に空になり 2)→3) へ落ちる。追加のガードは不要
- 期待値の例（ユニットテストで固定する）: 四麻雀傑(103)→`[9]` / 四麻雀豪(104)→`[12]` / 四麻雀聖(105)→`[16]` / 四麻魂天(107)→`[16]` / 三麻雀聖(205)→`[26]` / 四麻初心(101) + `playedModes=[8,9]`→`[9]` / 四麻初心 + `playedModes=[]`→`[16,12,9,15,11,8]`

**既定期間は `'all'`**（要件 §5.2 に既定の記載が無いため設計判断）。理由: カード1（常に全期間）と初期表示が一致し、「フィルタを絞ると段位が変わって見える」誤解を初回描画で生まない。

**既定値を URL へ書き戻す**: 解決した既定値は `{replace:true}` で URL に載せる。これにより「URL は常に明示的で、コピーすれば同じ状態が再現する」（完了条件2）が例外なく成立する。代償として、共有された URL は共有者の既定モードを固定する — これは完了条件2 が要求している挙動そのものなので受け入れる。

### 2.5 モードチップのトグル規則（最低1つ不変条件）

`modes` は**空にできない**（`joinModes` が空配列で throw する＝API の `mode_is_required` を型より手前で防いでいる契約）。

```
toggleMode(current, mode, numPlayers):
  含まれていれば取り除く。ただし取り除くと空になる場合は current をそのまま返す（no-op）
  含まれていなければ加えて canonicalize する
```

UI 上、唯一選択されたチップをタップしても選択は外れない。§1.2 の規約により、この **no-op ケースこそがチップの `selected` を明示代入しなければならない唯一のケース**（React state が変わらず再レンダーが起きないため）。受け入れ条件 C6 がこれを直接検証する。

**「全モード」チップは置かない**。理由: 「全選択」は 6 チップの選択で表現でき、「全モードチップを外す」の意味が定義できない（空集合は不変条件違反）ため、押しても外れないチップを1つ増やすことになる。将来 UX 上必要になれば「全モード」ボタン（chip ではなく TextButton）として追加できる。

### 2.6 期間チップの単一選択

`md-filter-chip` は複数選択前提だが、ハンドラ側で「タップされたプリセットを `period` に設定する」だけにすれば単一選択として振る舞う。すでに選択中のチップをタップした場合は no-op（§1.2 の明示代入で `selected = true` を保つ）。

`OutlinedSegmentedButtonSet`（本来の単一選択コンポーネント）を使わない理由: §1.4 の通りサイズ上の利益が無く、モード行と期間行で見た目・挙動の系統が割れるため。

### 2.7 リクエスト協調

- `useFilteredStats` は `key = ${np}|${playerId}|${serializeModes(modes)}|${period}` を作り、**キー変化を 250ms デバウンス**してから effect を起動する
- **初回だけデバウンスしない**（`hasFiredRef` で判定）。初期表示を 250ms 遅らせない
- effect は `resolveRange({kind:'preset', preset}, np, playerId)` を await した後、`Promise.all([getPlayerStats(...), getPlayerExtendedStats(...)])` を **1回だけ**呼ぶ。ここ以外で API を呼ばない
- 競合応答は issue-7 と同じ `cancelled` フラグ方式で捨てる（`apiGet` は `AbortSignal` 非対応）
- アンマウント時に `debouncer.cancel()`

**「フィルタ変更1回 = 2リクエスト」の成立範囲**: `getCurrentLevel` は deps が `[numPlayers, playerId]` のみなのでフィルタ変更では再発火しない。したがってフィルタ変更あたりの新規ネットワークリクエストは常に 0 本（キャッシュヒット時）または 2 本。

### 2.8 「この期間の対局はありません」

`getPlayerStats` が `null`（HTTP 404 の正常系変換、#3 の `nullOn404`）を返したときを `{ kind: 'empty' }` とする。`getPlayerExtendedStats` だけが `null` の場合は `stats` を採用し `extended: null` で `ready` とする（拡張統計の欠落だけでカード全体を消さない）。文言は `src/filters/filterState.ts` に定数 `NO_GAMES_IN_PERIOD_MESSAGE = 'この期間の対局はありません'` として置き、表示側はそれを使う。

### 2.9 配置: `src/filters/`（新設）

`src/shell/` ではなく `src/filters/` に置く。根拠:

- `src/shell/` は Issue 5 が「ルーティング・ナビ・レイアウト骨格」として定義した層で、API 層への依存を1つも持っていない。フィルタは **API 呼び出しとドメイン規則（`LEVEL_ALLOWED_MODES`）を持ち込む**ため、shell の性格が変わる
- 既存の `src/search/`（機能単位ディレクトリ・純ロジックを `.ts` に切り出して vitest でテスト）が先例になっており、それを踏襲するほうが読み手の予測に合う
- `useCurrentIdentity()` はフィルタ**適用外**のフックだが、「グローバルフィルタの適用範囲を定義する」という同一の関心事に属するため同居させる（要件 §5.3 の表がそのまま `src/filters/` の責務表になる）

`FilterBar` の描画位置は `PlayerLayout` の **`LayeredSheet` の `hero` プロップ内・アイデンティティ表示の直下**。issue-5 §8 の想定（「hero 内 or 直下」）のうち **hero 内**を採る。理由: hero は `position: sticky` なので、スクロールしてもフィルタが視界から消えない。

---

## 3. モジュール構成と公開シグネチャ

### 3.1 `src/filters/filterState.ts`（純粋・DOM 非依存・ユニットテスト対象）

```ts
import type { GameMode, NumPlayers, PeriodPreset } from '../api';

export const MODE_QUERY_KEY = 'mode';
export const PERIOD_QUERY_KEY = 'period';
export const DEFAULT_PERIOD: PeriodPreset = 'all';
export const NO_GAMES_IN_PERIOD_MESSAGE = 'この期間の対局はありません';

export interface GlobalFilter {
  readonly modes: readonly GameMode[]; // 空にならない（§2.5）
  readonly period: PeriodPreset;
}

/** 表示順・ラベル。全12 GameMode を網羅する */
export const MODE_LABELS: Readonly<Record<GameMode, string>>;
export const PERIOD_OPTIONS: readonly { readonly preset: PeriodPreset; readonly label: string }[];
// [{'all','全期間'},{'1y','1年'},{'90d','90日'},{'30d','30日'},{'7d','7日'}]

/** 重複除去 → numPlayers に属さない ID を除去 → allModes(numPlayers) の順に整列。冪等 */
export function canonicalizeModes(
  modes: readonly number[],
  numPlayers: NumPlayers,
): readonly GameMode[];

/** '16.12' → [16,12]。空・全要素不正なら null（＝「指定なし」） */
export function parseModes(raw: string | null, numPlayers: NumPlayers): readonly GameMode[] | null;

/** joinModes(canonicalizeModes(...)) の薄いラッパー */
export function serializeModes(modes: readonly GameMode[]): string;

/** PeriodPreset として妥当なら返す。それ以外は null */
export function parsePeriod(raw: string | null): PeriodPreset | null;

/** §2.4 の規則。levelId が null なら手順1)を飛ばす。戻り値は必ず非空 */
export function defaultModes(
  numPlayers: NumPlayers,
  levelId: number | null,
  playedModes: readonly GameMode[],
): readonly GameMode[];

/** §2.5。空になる除去は no-op（current をそのまま返す） */
export function toggleMode(
  current: readonly GameMode[],
  mode: GameMode,
  numPlayers: NumPlayers,
): readonly GameMode[];

/**
 * #13（比較タブ）向けの代表モードセレクタ。
 * gameCountByMode が与えられればその最大値のモード、同数・未提供のときは
 * allModes(numPlayers) の順（上位卓・半荘優先）で selected の先頭を返す。
 * selected が空なら Error を throw する（不変条件違反の早期検出）。
 * ※ モード別対局数は player_stats 1本からは取れない。§7 参照
 */
export function selectRepresentativeMode(
  numPlayers: NumPlayers,
  selected: readonly GameMode[],
  gameCountByMode?: Readonly<Partial<Record<GameMode, number>>>,
): GameMode;
```

### 3.2 `src/filters/useCurrentIdentity.ts`

```ts
import type { CurrentLevelInfo, NumPlayers } from '../api';

export type CurrentIdentityState =
  | { kind: 'loading' }
  | { kind: 'ready'; identity: CurrentLevelInfo }
  | { kind: 'notFound' }                 // getCurrentLevel が null
  | { kind: 'error'; message: string };

/**
 * カード1除外規則: グローバルフィルタと無関係に「全モード・全期間・終端=現在」で取得する。
 * useEffect の deps は [numPlayers, playerId] のみ。filter を絶対に deps に入れないこと。
 */
export function useCurrentIdentity(numPlayers: NumPlayers, playerId: number): CurrentIdentityState;
```

エラー文言は `src/search/searchState.ts` の `describeError` と同種のものを `src/filters/filterErrors.ts` に置く（`describeError` は「検索に失敗しました」固定文言なので流用しない）。

```ts
// src/filters/filterErrors.ts
export function describeStatsError(err: unknown): string;
// MaintenanceError → 'サーバーがメンテナンス中です。しばらくしてからお試しください。'
// ApiError(status 0) → 'ネットワークに接続できませんでした。'
// ApiError(その他)   → `データの取得に失敗しました（HTTP ${status}）`
// それ以外           → 'データの取得に失敗しました。'
```

### 3.3 `src/filters/useGlobalFilter.ts`

```ts
import type { GameMode, NumPlayers, PeriodPreset } from '../api';
import type { GlobalFilter } from './filterState';
import type { CurrentIdentityState } from './useCurrentIdentity';

export interface UseGlobalFilter {
  /** null = 既定値の解決待ち（URL に mode 指定が無く identity がまだ loading） */
  filter: GlobalFilter | null;
  setModes(next: readonly GameMode[]): void;
  setPeriod(next: PeriodPreset): void;
}

export function useGlobalFilter(
  numPlayers: NumPlayers,
  identity: CurrentIdentityState,
): UseGlobalFilter;
```

動作:

1. `const [searchParams, setSearchParams] = useSearchParams()`（`react-router-dom` から import）
2. `period = parsePeriod(searchParams.get('period')) ?? DEFAULT_PERIOD`
3. `urlModes = parseModes(searchParams.get('mode'), numPlayers)`
4. `urlModes !== null` → `filter = { modes: urlModes, period }`
5. `urlModes === null` かつ `identity.kind === 'loading'` → `filter = null`
6. `urlModes === null` かつ `ready` → `modes = defaultModes(numPlayers, identity.identity.level.id, identity.identity.playedModes)`、`filter = { modes, period }`
7. `urlModes === null` かつ `notFound | error` → `modes = defaultModes(numPlayers, null, [])`（＝全モード）、`filter = { modes, period }`
8. **書き戻し effect**: `filter !== null` のとき、`searchParams.get('mode') !== serializeModes(filter.modes)` または `searchParams.get('period') !== filter.period` なら `setSearchParams(prev => {...prev で mode/period を上書き}, { replace: true })`。他のクエリキーは保持する
9. `setModes` / `setPeriod` も `setSearchParams(prev => ..., { replace: true })`

> 実装上の注意: 8 の比較は**書き戻し後に必ず等値になる**（`canonicalizeModes` と `serializeModes` が冪等）。等値比較を怠ると無限レンダーループになる。

### 3.4 `src/filters/useFilteredStats.ts`

```ts
import type { NumPlayers, PlayerExtendedStats, PlayerStats } from '../api';
import type { GlobalFilter } from './filterState';

export type FilteredStatsState =
  | { kind: 'loading' }
  | { kind: 'empty' }                                   // player_stats が null（§2.8）
  | { kind: 'ready'; stats: PlayerStats; extended: PlayerExtendedStats | null }
  | { kind: 'error'; message: string };

export function useFilteredStats(
  numPlayers: NumPlayers,
  playerId: number,
  filter: GlobalFilter | null,
  delayMs?: number,          // 既定 250
): FilteredStatsState;
```

### 3.5 `src/filters/playerScope.ts`

```ts
import type { NumPlayers, GameMode, PeriodPreset } from '../api';
import type { GlobalFilter } from './filterState';
import type { CurrentIdentityState } from './useCurrentIdentity';
import type { FilteredStatsState } from './useFilteredStats';

export interface PlayerScope {
  readonly numPlayers: NumPlayers;
  readonly playerId: number;
  readonly identity: CurrentIdentityState;
  readonly filter: GlobalFilter | null;
  readonly stats: FilteredStatsState;
  readonly setModes: (next: readonly GameMode[]) => void;
  readonly setPeriod: (next: PeriodPreset) => void;
}

/** 各タブ（Outlet の子ルート）はこれで scope を取る。useOutletContext<PlayerScope>() の薄いラッパー */
export function usePlayerScope(): PlayerScope;
```

`useOutletContext` は `react-router-dom` から export されている（`react-router-dom/dist/index.mjs` が `export * from "react-router"`、`react-router` に `declare function useOutletContext<Context = unknown>(): Context` — 実物確認済み）。

### 3.6 `src/filters/FilterBar.tsx`

```tsx
export interface FilterBarProps {
  numPlayers: NumPlayers;
  filter: GlobalFilter | null;      // null のときはチップを disabled で描画（レイアウトシフトを避ける）
  onModesChange: (next: readonly GameMode[]) => void;
  onPeriodChange: (next: PeriodPreset) => void;
}
export function FilterBar(props: FilterBarProps): ReactElement;
```

構造（`md-*` 生タグは書かない。`../components/md` バレルから `ChipSet` / `FilterChip` を import）:

```tsx
<div className="filter-bar" data-testid="filter-bar">
  <ChipSet className="filter-bar__row" data-testid="mode-chips">
    {allModes(numPlayers).map((mode) => (
      <FilterChip key={mode} data-mode={mode} label={MODE_LABELS[mode]}
        selected={selectedSet.has(mode)}
        onClick={(e) => {
          const next = toggleMode(current, mode, numPlayers);
          e.currentTarget.selected = next.includes(mode);   // §1.2 の必須規約
          onModesChange(next);
        }} />
    ))}
  </ChipSet>
  <ChipSet className="filter-bar__row" data-testid="period-chips">
    {PERIOD_OPTIONS.map(({ preset, label }) => (
      <FilterChip key={preset} data-period={preset} label={label}
        selected={filter?.period === preset}
        onClick={(e) => { e.currentTarget.selected = true; onPeriodChange(preset); }} />
    ))}
  </ChipSet>
</div>
```

- `e.preventDefault()` を**呼ばない**（§1.2）
- `FilterBar` および内部のチップを `React.memo` / `useMemo` で**メモ化しない**（§1.2 末尾）
- `data-mode` / `data-period` 属性は受け入れ条件 C の DOM フックとして**必須**

### 3.7 `src/filters/filters.css`

- 色は `--md-sys-color-*` のみ。HEX を書かない（CLAUDE.md 制約5）
- `.filter-bar__row { display: flex; overflow-x: auto; scrollbar-width: none; }` — 狭幅で横スクロール、縦には積まない
- `md-chip-set` の内部余白は `--md-chip-set-*` ではなく親の `gap` で調整する
- タイポは `md-typescale-*` クラス（CSS 直 import 済み。CLAUDE.md 制約6）

### 3.8 `src/util/debounce.ts`（`src/search/debounce.ts` からの移動）

- `src/search/debounce.ts` → `src/util/debounce.ts`、`src/search/debounce.test.ts` → `src/util/debounce.test.ts` に **`git mv` で移動**（内容は変更しない）
- import 元の更新は `src/search/useSearch.ts` の1行のみ（他に import 元が無いことを `grep -rn "from './debounce'\|from '../search/debounce'" src/` で確認済み）
- テストの内容も変更しない（移動だけ。既存の red/green 実績を保つ）

### 3.9 `src/shell/paths.ts` への追加（既存 export は変更しない）

```ts
/** ルートの :id を数値 playerId へ。10進の非負整数でなければ null */
export function parsePlayerId(raw: string | undefined): number | null;
```

### 3.10 `src/shell/PlayerLayout.tsx` の変更

- `parsePlayerId(id)` が `null` なら `<Navigate to="/" replace />`
- 3フックを呼び、`hero` に「ニックネーム・段位・pt（`formatLevelWithDelta(identity.level)`）」＋ `<FilterBar />` を描画する
  - `data-testid="identity-level"` を段位・pt のテキスト要素に付ける（受け入れ条件 C5 が読む）
  - 段位・pt は **`identity` からのみ**描画する。`useFilteredStats` の `stats.level` を**絶対に使わない**（要件 §5.3 / Issue の設計メモ）
  - この hero 表示は Issue 8 が正式なカード1に差し替える暫定実装。凝らないこと
- `<Outlet context={scope} />` に差し替える（`TabTransition` の内側でよい）
- 既存の `data-testid="sheet-hero"` / `"sheet-layer"` / タブ遷移方向ロジックは**変更しない**

### 3.11 変更・追加ファイル一覧

| ファイル | 種別 |
|---|---|
| `src/filters/filterState.ts` | 新規 |
| `src/filters/filterState.test.ts` | 新規 |
| `src/filters/filterErrors.ts` | 新規 |
| `src/filters/useCurrentIdentity.ts` | 新規 |
| `src/filters/useGlobalFilter.ts` | 新規 |
| `src/filters/useFilteredStats.ts` | 新規 |
| `src/filters/playerScope.ts` | 新規 |
| `src/filters/FilterBar.tsx` | 新規 |
| `src/filters/filters.css` | 新規 |
| `src/util/debounce.ts` / `src/util/debounce.test.ts` | `src/search/` から `git mv` |
| `src/search/useSearch.ts` | import パス1行のみ変更 |
| `src/shell/paths.ts` | `parsePlayerId` 追加 |
| `src/shell/paths.test.ts` | `parsePlayerId` のテスト追加 |
| `src/shell/PlayerLayout.tsx` | 変更（§3.10） |
| `src/shell/PlaceholderPanel.tsx` | 変更（`usePlayerScope()` を読んで現在のフィルタとリクエスト状態を素で表示。受け入れ条件 C8 が読む） |

**`src/components/md/Chips.ts` は変更しない**（`ChipSet` / `FilterChip` は既にバレルに載っている）。

---

## 4. 受け入れ条件（検収担当はこれを1項目ずつ実行する）

### A. 静的検証

- **A1** `npm run lint` が警告0で通る
- **A2** `npm run build` が型エラー0で通り、`dist/assets/index-*.js` が **465 kB 以下**（ベースライン 435.64 kB ＋ チップ実測 23.84 kB ＝ 459.48 kB が下限見込み）。実測値を報告に記載する
- **A3** `grep -rn "<md-" src/ --include=*.tsx` が 0 件（CLAUDE.md 制約3）
- **A4** `grep -rniE "#[0-9a-f]{3,8}\b" src/filters/` が 0 件（CLAUDE.md 制約5）
- **A5** `grep -rn "^import '" src/filters/ src/util/` が CSS 以外 0 件（CLAUDE.md 制約1）
- **A6** `grep -rn "all.js" src/` が 0 件
- **A7** `grep -rn "preventDefault" src/filters/FilterBar.tsx` が **0 件**（§1.2 の規約）
- **A8** `grep -rn "React.memo\|memo(" src/filters/` が 0 件（§1.2 末尾）
- **A9** `grep -rn "from './debounce'" src/search/` が 0 件（移動漏れが無い）
- **A10** `useCurrentIdentity.ts` の `useEffect` の依存配列に `filter` / `modes` / `period` が現れないことを目視確認（`grep -n "useEffect" -A 2 src/filters/useCurrentIdentity.ts`）

### B. ユニットテスト（**red を先に確認する**）

`src/filters/filterState.test.ts`。各ケースについて、実装を1箇所壊すと落ちることを先に確認してから green にすること。

- **B1** `canonicalizeModes([9, 16, 9, 21], 4)` → `[16, 9]`（重複除去・三麻 ID 除去・`ALL_MODES_4` 順）
- **B2** `canonicalizeModes(canonicalizeModes(x, 4), 4)` が `canonicalizeModes(x, 4)` と等しい（冪等。§3.3-8 の無限ループ防止の根拠）
- **B3** `parseModes('16.12', 4)` → `[16, 12]` / `parseModes('26.24', 4)` → `null` / `parseModes('', 4)` → `null` / `parseModes(null, 4)` → `null` / `parseModes('16.abc.12', 4)` → `[16, 12]`
- **B4** `serializeModes(parseModes('9.16', 4)!)` → `'16.9'`（正規化されて往復する）
- **B5** `parsePeriod('90d')` → `'90d'` / `parsePeriod('all')` → `'all'` / `parsePeriod('1w')` → `null` / `parsePeriod(null)` → `null`
- **B6** `defaultModes(4, 10402, [])` → `[12]`（四麻雀豪2。`LEVEL_ALLOWED_MODES[104] = [9,12,8,11]` のうち `ALL_MODES_4` 順で最初は 12）
- **B7** `defaultModes(4, 10301, [])` → `[9]` / `defaultModes(4, 10502, [])` → `[16]` / `defaultModes(4, 10701, [])` → `[16]`
- **B8** `defaultModes(3, 20502, [])` → `[26]`
- **B9** `defaultModes(4, 10102, [8, 9])` → `[9]`（初心は `LEVEL_ALLOWED_MODES` が空 → `playedModes` へフォールバック、`ALL_MODES_4` 順で 9 が先）
- **B10** `defaultModes(4, 10102, [])` → `[16, 12, 9, 15, 11, 8]` / `defaultModes(4, null, [])` → 同じ
- **B11** `toggleMode([16, 12], 16, 4)` → `[12]` / `toggleMode([12], 12, 4)` → `[12]`（no-op）/ `toggleMode([12], 16, 4)` → `[16, 12]`（正規化順）
- **B12** `selectRepresentativeMode(4, [9, 16], { 9: 100, 16: 5 })` → `9` / `selectRepresentativeMode(4, [9, 16], { 9: 5, 16: 5 })` → `16`（同数は卓順）/ `selectRepresentativeMode(4, [9, 16])` → `16`（未提供は卓順）/ `selectRepresentativeMode(4, [])` → throw
- **B13** `MODE_LABELS` が `ALL_MODES_4` と `ALL_MODES_3` の全12 ID を網羅している（`allModes(4).concat(allModes(3)).every(m => MODE_LABELS[m])`）

`src/shell/paths.test.ts` 追加:

- **B14** `parsePlayerId('123456')` → `123456` / `parsePlayerId('abc')` → `null` / `parsePlayerId('-1')` → `null` / `parsePlayerId('')` → `null` / `parsePlayerId(undefined)` → `null` / `parsePlayerId('1.5')` → `null`

`src/util/debounce.test.ts`:

- **B15** 移動後もそのまま通る（内容は変更しないこと）

### C. ブラウザ実測（`npm run dev` → ブラウザペイン。`javascript_tool` / `read_network_requests` を使う）

事前準備: 実在プレイヤーIDを1つ用意する（検収担当は amae-koromo の検索画面から取得してよいが、**設計書・PR 本文・コミットメッセージに ID とニックネームを書かない**）。

- **C1（既定値の解決と書き戻し）** `#/4/player/<id>/summary`（クエリ無し）を開く。identity 解決後に `location.hash` が `?mode=…&period=all` を含むようになること。`mode` の値が §2.4 の規則どおり当該プレイヤーの段位から導かれた**単一モード**であること（`getCurrentLevel` のレスポンスの `level.id` を DevTools で確認して突き合わせる）
- **C2（1操作＝2リクエスト）** C1 の状態で、期間チップ「90日」をクリックする。`read_network_requests` で新規リクエストを数え、**`player_stats` 1本＋`player_extended_stats` 1本の計2本ちょうど**であることを確認する。
  **注意**: `period=all` かつ全モード選択の状態から測ると、`player_stats` の URL が初期の `getCurrentLevel` と完全一致してキャッシュに合流し 1 本しか飛ばない（§1.6 帰結A）。計測は「単一モード × 90日」のような**全期間全モード以外の遷移**で行うこと
- **C3（連打の debounce）** モードチップを 250ms 以内に 5 回（互いに異なるモードを）クリックする。落ち着いた後の新規リクエストが **2本以下**であること
- **C4（URL 共有）** `#/4/player/<id>/summary?mode=9.8&period=30d` を直接開く。金半荘・金東の2チップだけが `selected`（`document.querySelectorAll('[data-testid="mode-chips"] md-filter-chip[selected]')` が2件で `data-mode` が 9 と 8）、期間チップは「30日」のみ `selected` であること。リロードしても同じであること
- **C5（カード1除外規則）** C4 の状態で `[data-testid="identity-level"]` のテキストを記録 → モードチップを1つ足す・期間を「7日」に変える、を各1回行う → **テキストが1文字も変わらない**こと。あわせて、これらの操作で `player_stats` の**全期間・全モード URL が再送されない**（`getCurrentLevel` が再発火しない）ことを `read_network_requests` で確認する
- **C6（最低1つ不変条件とチップ同期）** モードチップを1つだけ選択した状態にし、その**唯一選択中のチップをクリック**する。クリック後に
  (a) `chip.selected === true`（JS プロパティ）、(b) `chip.hasAttribute('selected') === true`（reflect 済み属性）、(c) 見た目のチェックマークが残る、(d) 新規ネットワークリクエストが **0本**、(e) `location.hash` の `mode` が変わらない
  — の5点すべてを満たすこと。**これは §1.2 の明示代入規約が効いているかを直接測る項目であり、落ちたら設計書 §1.2 に戻ること**
- **C7（四麻⇔三麻の切替）** `?mode=16.12&period=90d` の状態でヘッダーの「三人打ち」をクリックする。パスが `/3/player/...` になり、`mode` が三麻の既定値（単一の三麻 ID）へ**書き戻され**、`period=90d` が**保持される**こと
- **C8（期間データなし）** 直近7日に対局が無いプレイヤーで `period=7d` にする。`PlaceholderPanel` が **「この期間の対局はありません」** を表示し、コンソールに未処理例外が出ないこと（`read_console_messages`）
- **C9（履歴）** チップを3回操作した後にブラウザの「戻る」を1回押す。**チップ操作が巻き戻るのではなく、プレイヤーページに入る前の画面（検索画面）へ戻る**こと（`{replace:true}` の意図どおり）
- **C10（既存挙動の非退行）** Issue 5 の受け入れ条件のうち、タブ切替（`data-testid="tab-panel"` の `data-tab` が変わる）・四麻三麻トグル・ボトムナビが引き続き動作すること。`data-testid="sheet-hero"` / `"sheet-layer"` が残っていること

### D. オーナーへの UI 検証逆発注（機械で測れないもの）

`docs/ui-verification/issue-6-global-filter.md` を作成し、以下を委託する。

- **D1** 360px 幅の実機で、モード6チップの横スクロールが指で無理なく操作できるか（縦2段折り返しのほうが良いか）
- **D2** hero が sticky したときにフィルタバーが視界に残り、下のカード層と視覚的に分離できているか
- **D3** ライト/ダーク両方で、選択チップ・非選択チップのコントラストが十分か
- **D4** 「全モード」を選ぶのに6タップ必要な体験が許容できるか（許容できなければ「全モード」ボタンを別 Issue で追加する）

---

## 5. 実挙動未確認の箇所（推定で書いた部分）

正直に列挙する。製造・検収時に食い違ったら設計書側を直すこと。

1. **React 19 の discrete event 同期フラッシュと `redispatchEvent` の戻りの前後関係**: §1.2 の時系列は `filter-chip.js` と `@lit/react` のソースから導いた**推論**であり、実行して観測してはいない。ただし採用した規約（明示代入・`preventDefault` を呼ばない）は**どちらの順序でも正しく着地する**ように選んであるので、推論が外れても設計は壊れない。C6 が実質の検証になる
2. **`md-chip-set` の中で `selected` を外部から書き換えたときの `updateTabIndices` の再計算**: `chip-set.js` の `handleKeyDown` / `updateTabIndices` は読んだが、React 側からの `selected` 変更でフォーカス順が壊れないことは実行確認していない。C4/C6 で目視すること
3. **`FilterChip` の `label` prop と `ChipSet` の組み合わせ**: `ComponentGallery.tsx` に precedent はあるが、6個並べたときのレイアウトは未確認
4. **hero を sticky にしたままフィルタバーを内包したときの高さ**: issue-5 §10-1 が「sticky の実挙動は未確認」と残しており、その未確認が本 Issue にも継承される。D2 で逆発注
5. **`resolveRange` の `'all'` が返す `start` が `getCurrentLevel` の `dataMinDate()` とミリ秒まで一致する**ことは、両方が `DATA_MIN_MS` を使うことから型・コード上は自明だが、実際に URL が文字列一致してキャッシュに合流するのは未観測。§1.6 帰結A と C2 の注意書きはこの前提に立っている
6. **404 の発生条件**: 「期間内に対局が無いと `player_stats` が 404」は #3 の設計書記載に依拠しており、本 Issue では実叩きしていない（外部 API へのアクセス許可を受けていないため）

---

## 6. 外部 API へのアクセス

**本 Issue では amae-koromo の実 API を1回も叩いていない**。統括担当からの明示的な許可が無いため、`robots.txt` の取得も行っていない。すべて `docs/amae-koromo-api-spec.md` と #3 の設計書・実装コードに基づく設計である。

検収担当がブラウザ実測（受け入れ条件 C）を行う際は実 API に接続することになる。**C 群は1プレイヤー・十数リクエスト程度に収まる設計**（1画面あたり最大3リクエスト、C1〜C10 で計30リクエスト未満）だが、実施前に統括担当の許可を確認すること。

---

## 7. 統括担当に判断を仰ぐ点（実装前に確定できると望ましい）

### 7.1 【要判断】`selectRepresentativeMode` の対局数がリクエスト予算と両立しない

要件 §4.2 は「グローバルフィルタが複数選択のときは**選択中モードのうち対局数最多**を代表として自動採用」と定めているが、

- `player_stats` はモードを `.` 連結して**集約した結果**を返し、モード別の内訳を含まない（`src/api/types.ts` の `PlayerStats` に該当フィールドが無い）
- `played_modes` は「プレイ経験のあるモードの集合」であり対局数を持たない

したがって「選択中モードそれぞれの対局数」を得るには **選択モード数だけ `player_stats` を追加で叩く**しかなく、要件 §5.2「1操作あたり API コール2回」および CLAUDE.md「1画面表示あたり数リクエスト以内」と正面から衝突する。

選択肢:

| 案 | 内容 | 代償 |
|---|---|---|
| **(a) 卓順フォールバック**（本設計の既定） | 対局数を使わず `allModes()` 順（上位卓・半荘優先）で先頭を代表にする | 要件の文言と異なる。ただし「上位卓ほど本人の主戦場」という近似は概ね妥当 |
| (b) #13 でモード数ぶんリクエスト | 比較タブを開いたときだけ N リクエスト | リクエスト予算超過。比較タブは頻繁に開かれる |
| (c) 代表モードをユーザーに選ばせる | チップで明示選択（#13 のスコープ） | 「自動採用」という要件を落とす。ただし #13 は元々切替 UI を持つ予定 |

本設計は **(a) を既定にしつつ、`gameCountByMode` を任意引数として口だけ開けておく**形にしてある（#13 が (b)(c) いずれかを選んでも API を変えずに済む）。**要件 §4.2 の文言を (a) または (c) に合わせて改訂するかどうかを判断してほしい。**

### 7.2 既定期間を `'all'` にしてよいか

要件 §5.2 に既定の記載が無い。§2.4 の理由で `'all'` を選んだが、「初回は 90日」等の意図があれば `DEFAULT_PERIOD` を1行変えるだけで済む。

### 7.3 フィルタ操作を履歴に積まない（`{replace:true}`）方針でよいか

§2.3 のとおり「戻る」でフィルタ操作を取り消せなくなる。

---

## 8. 後続 Issue への引き継ぎ

| 宛先 | 内容 |
|---|---|
| #8 サマリータブ | `usePlayerScope()` で `identity` / `filter` / `stats` を取得する。**カード1（段位・pt・昇降条件）は `identity` からのみ描画し、`stats.stats.level` を絶対に使わない**（要件 §5.3）。`PlayerLayout` の hero にある暫定のアイデンティティ表示を正式なカード1へ差し替える。`useTheme().setRank(...)` の呼び出しもここで初めて行う |
| #13 比較タブ | `selectRepresentativeMode(numPlayers, filter.modes, gameCountByMode?)` を使う。§7.1 の未決事項を必ず読むこと。単一モード化 UI（コンテキストバーのチップ）は #13 のスコープ |
| 全タブ | フィルタ由来のデータ取得は `usePlayerScope().stats` を読むだけにする。**タブが独自に `getPlayerStats` を呼ばない**（1操作2リクエストの契約が壊れる） |
| 承諾後（直近n戦） | `src/api/range.ts` の `setRangeResolver()` に `player_records` ベースの resolver を差し込み、`filterState.ts` の `PERIOD_OPTIONS` に `lastNGames` 用の選択肢を追加する。`useFilteredStats` は `RangeSpec` を受け取る形へ1箇所広げるだけで済む |
| 「全モード」ボタン | D4 の結果しだいで別 Issue（§2.5 の理由で本 Issue ではチップにしない） |
| フィルタのリセット | 未実装。§2.3 の `{replace:true}` により「戻る」でも取り消せないため、必要なら明示的なリセット UI を別 Issue で |

---

## 9. 作業ログ（実測の再現手順）

1. **バンドル計測**: `src/shell/PlaceholderPanel.tsx` をスクラッチパッドへ退避 → `ChipSet` + `FilterChip` を2個描画する版に差し替え → `npm run build` → 退避したファイルで復元 → `git status --porcelain` が空であることを確認（実施済み）
2. **`md-filter-chip` の挙動**: `node_modules/@material/web/chips/internal/filter-chip.{d.ts,js}`、`chips/internal/chip.{d.ts,js}`、`chips/internal/chip-set.d.ts`、`@material/web/internal/events/redispatch-event.js` を実読
3. **`@lit/react`**: `node_modules/@lit/react/development/create-component.js` の `setProperty` と `useLayoutEffect` を実読
4. **react-router**: `node_modules/react-router/dist/development/chunk-62JRHF6Z.mjs` の `createHashHistory`(163) / `parsePath`(261) / `resolveTo`(925) / `useSearchParams`(10830)、`node_modules/react-router-dom/dist/index.mjs` の再エクスポートを実読
5. **既存コード**: `src/api/{gameMode,range,endpoints,client,types}.ts`、`src/domain/{level,levelConstants}.ts`、`src/shell/{paths,PlayerLayout,LayeredSheet,AppHeader,AppRouter}.tsx`、`src/search/{useSearch,debounce,searchState}.ts`、`src/components/md/{Chips,index}.ts` を実読
6. **実 API へのアクセス: 0 回**
