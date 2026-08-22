# Issue 5 設計書: アプリシェル（ルーティング・タブナビ・レイアウト骨格）

作成日: 2026-08-23
対象 Issue: #5 アプリシェル: ルーティング・タブナビ・レイアウト骨格
前提資料: `docs/requirements.md` §3・§4・§9 / `docs/design/issue-1-md3-theme.md`（テーマトークン）/ `docs/design/issue-2-md-react-wrappers.md`（ラッパー規約・`sideEffects`）
検証環境: `react-router` / `react-router-dom` **7.18.2** / `@material/web` **2.5.0** / React 19.2.8 / Vite 8.2.2
（ライブラリ挙動はすべて `node_modules` 配下の実物 `.js` / `.d.ts` を読み、一部は Node から実行して確認。バンドルサイズは本設計時に `npm run build` で実測）

---

## 0. 確定済み前提（統括担当が確定。変更不可）

- **ルーティング方式 = HashRouter**、ホスティングは **GitHub Pages 想定**
  - 根拠: `docs/requirements.md` §9 に「HashRouter + GitHub Pages想定」が既に記録されている。GitHub Pages は静的ホスティングであり、`BrowserRouter` では `/4/player/123` の直リンク・リロードが 404 になるため `404.html` リライトハックが必須になる。HashRouter はサーバー側設定ゼロで直リンク・リロード・戻る/進むが機能する
  - ホスティング先の最終確定は #16（CI・デプロイ）で行う。本 Issue ではルーティング方式のみ確定する
  - ライブラリは既に `package.json` に `react-router-dom@^7.18.2` が入っている（**追加インストール不要**）
- 履歴タブは**定義のみで非表示**（承諾後に有効化）
- 各タブの中身・検索画面の作り込みは本 Issue の対象外（プレースホルダのみ）

---

## 1. ライブラリ実態調査結果（設計の根拠）

### 1.1 【重要・Issue 本文の訂正】react-router v7 は `:param(regex)` 構文をサポートしない

Issue 本文のルート表記 `/:np(4|3)/player/:id` は **v7 では機能しない**。`node_modules/react-router/dist/development/chunk-HHGH3NKS.js` の `compilePath()`（812行〜）を読むと、パス文字列に対して

1. `.replace(/[\\.*+^${}|()[\]]/g, "\\$&")` で**正規表現メタ文字を先にエスケープ**し、
2. その後に `.replace(/\/:([\w-]+)(\?)?/g, …)` でパラメータを `([^\/]+)` に変換する

という順序になっている。つまり `(4|3)` は「リテラル文字列 `(4|3)`」として扱われる。Node で実測した結果:

```
matchPath('/:np(4|3)/player/:id', '/4/player/abc')        → null
matchPath('/:np(4|3)/player/:id', '/4(4|3)/player/abc')   → match（np='4', id='abc'）
matchPath('/:np/player/:id',      '/4/player/abc')        → match（np='4', id='abc'）
matchPath('/:np/player/:id/:tab?','/4/player/abc')        → match（tab=undefined）
matchPath('/:np/player/:id/:tab?','/4/player/abc/stats')  → match（tab='stats'）
```

（`:param(regex)` は react-router v5 の path-to-regexp 時代の構文で、v6 で削除されている）

**設計判断**: パスパターンは `/:np/player/:id/:tab` とし、`np` の 4|3 制約は**ルート定義ではなくコンポーネント側のガード**で行う（§2.3）。オプショナルセグメント `:tab?` も使わず、タブごとに明示ルートを切る（§2.1。`useParams` の型が `string | undefined` になるのを避け、インデックスルートでのリダイレクト先を1箇所に固定するため）。

### 1.2 `md-navigation-bar`（labs）の実挙動

`labs/navigationbar/internal/navigation-bar.js` の実装で確認:

- プロパティは `activeIndex: number` / `hideInactiveLabels: boolean` / `tabs: NavigationTab[]`（`tabs` は `queryAssignedElements` で `firstUpdated()` 内の `layout()` が埋める）
- **`activeIndex` が範囲外だと `updated()` 内の `onActiveIndexChange()` が `throw new Error('NavigationBar: activeIndex is out of bounds.')` する**。`-1`（`indexOf` の失敗値）も範囲外。→ 本設計では `activeIndex` に渡す値を必ず `0..VISIBLE_TABS.length-1` にクランプする（§3.1 `visibleTabIndex()` が該当なしで `0` を返す仕様にした理由）
- **`navigation-bar-activated` は `activeIndex` が変わるたびに `updated()` から発火する。ユーザー操作かプログラム設定かを区別しない**。したがって「ルート → `activeIndex` プロップ → `activated` → `navigate()`」というフィードバック経路が成立する。ブラウザの「戻る」で activeIndex が変わっただけでも navigate が走り、履歴が壊れる
  - **対策（必須）**: ナビの遷移ハンドラは `md-navigation-bar` の `onNavigationBarActivated` を**使わない**。個々の `md-navigation-tab` の `navigation-tab-interaction`（`handleClick()` からのみ dispatch。実装で確認済み）を使う。加えて遷移先パスが現在パスと同一なら `navigate()` を呼ばない
- コンテナ高さの既定は `--md-navigation-bar-container-height` = **80px**（`navigation-bar-styles.css` 実測）。コンテンツ下部の余白計算に使う
- テーマは `--md-navigation-bar-*`（41変数）で上書き可能。既定値は `--md-sys-color-*` を参照しているため**本 Issue では上書き不要**

### 1.3 `md-tabs` の実挙動

`tabs/internal/tabs.js` で確認:

- `activeTabIndex` setter → `activateTab()` は、**プログラム設定であっても `previousTab` が存在すれば `change` イベントを dispatch する**（174行）。md-navigation-bar と同じフィードバック経路の危険がある
- **設計判断**: 本 Issue では **`md-tabs` を採用しない**。理由は3点:
  1. モバイル=ボトムナビ / デスクトップ=レール という Issue のナビ要件に `md-tabs` の居場所がない（トップタブを足すとナビが二重になる）
  2. プログラム設定でも `change` が飛ぶため、ルート駆動との同期に追加のガードが要る
  3. `md-tabs` は `md-divider` と横スクロール機構を持ち込むため、層状シートのヒーロー領域と干渉する

  タブ（サマリー/比較/スタッツ）は**ボトムナビ／レールそのものがタブセレクタを兼ねる**。`Tabs` / `PrimaryTab` ラッパーはバレルに残すが本 Issue では使用しない

### 1.4 `md-outlined-segmented-button-set`（四麻/三麻トグル）の実挙動

`labs/segmentedbuttonset/internal/segmented-button-set.js` で確認:

- 選択状態は**セット側ではなく各 `md-outlined-segmented-button` の `selected` プロパティ**が持つ。React からは各ボタンの `selected` を直接書けばよい（制御コンポーネントとして自然に扱える）
- `segmented-button-set-selection` は `emitSelectionEvent()` からのみ発火し、その呼び出し元は `setButtonSelected()`。React が子ボタンの `selected` プロパティを直接書く経路はこれを通らないため、**プログラム更新でイベントは飛ばない**（md-navigation-bar と違いフィードバック経路が無い）
- 単一選択モードでは**選択済みボタンの再クリックはイベントを発火しない**（`setButtonSelected(i, false)` が早期 return）。「同じ人数を選び直す」空 navigate は構造的に起きない

### 1.5 `@material/web` 2.5.0 にナビゲーションレールと Top App Bar は**存在しない**

`node_modules/@material/web/` 直下と `labs/` を列挙して確認した。labs にあるのは `badge / behaviors / card / gb / item / navigationbar / navigationdrawer / navigationtab / segmentedbutton / segmentedbuttonset` のみ。**navigation rail も top-app-bar も無い**（`navigationdrawer` はモーダル/標準ドロワーでレールではない）。

**設計判断**: デスクトップのナビレールとヘッダー（app bar）は**自前実装**する（§3.4 / §3.5）。MD3 トークンと `md-ripple` / `md-icon` で見た目を揃える。`md-focus-ring`（`@material/web/focus/md-focus-ring.js`。未ラップ）はフォーカスリング用に使えるが、本設計では CSS の `:focus-visible` アウトラインで代替し**新規ラッパーは追加しない**（§7）。

### 1.6 バンドルサイズ実測（react-router の導入コスト）

一時的に `src/App.tsx` を HashRouter + Routes + Route + Outlet + Navigate + useParams + useNavigate + useLocation を使う形に差し替えて `npm run build` を実行し、測定後に元へ戻した（計測ファイルは削除済み。`git status` クリーン確認済み）。

| ケース | JS | gzip |
|---|---|---|
| ベースライン（現状の `App.tsx`） | 238.36 kB | 74.50 kB |
| + react-router 宣言的API一式（HashRouter/Routes/Route/Outlet/Navigate/hooks） | **278.17 kB** | **88.07 kB** |
| 差分 | **+39.81 kB** | **+13.57 kB** |

`react-router-dom` の `package.json` は `"sideEffects": false` を宣言しており、データルーター（`createHashRouter` / loader / Form 等）は上記の宣言的APIを使う限り取り込まれない。**`createHashRouter` + `RouterProvider` は使わず、JSX 宣言的 `<HashRouter><Routes>` を採用する**（データローディングは Issue 6 以降で React の状態管理側に置くため、ルーター側のデータAPIは不要。取り込みも増える）。

---

## 2. ルーティング設計

### 2.1 ルート表

`<HashRouter>` 直下の `<Routes>`。パスはすべてハッシュ以降（例: `https://example.com/#/4/player/123456/summary`）。

| パス | 要素 | 備考 |
|---|---|---|
| `/` | `HomePlaceholder` | #7 で検索画面に差し替える。本 Issue ではプレースホルダ |
| `/:np/player/:id` | `PlayerLayout`（レイアウトルート） | `np` ガードはここ（§2.3） |
| └ index | `<Navigate to="summary" replace />` | 末尾なし URL を正規化 |
| └ `summary` | `PlaceholderPanel tab="summary"` | Issue 8〜 |
| └ `compare` | `PlaceholderPanel tab="compare"` | Issue 12〜 |
| └ `stats` | `PlaceholderPanel tab="stats"` | Issue 14〜 |
| `*` | `<Navigate to="/" replace />` | 未知パス（`/4/player/123/history` を含む） |

- **`history` のルートは登録しない**。タブ定義（`PLAYER_TABS`）には `enabled: false` で存在するが、ルート生成は `VISIBLE_TABS`（= `enabled` のみ）から行う。結果として `#/4/player/123/history` は `*` に落ちてホームへ `replace` される。承諾後は `PLAYER_TABS` の1行を `enabled: true` にするだけでタブ・ルート・ナビの3箇所が同時に有効化される
- インデックスルートは `Navigate` で `summary` に**置換遷移**する（`replace` により「戻る」で無限往復しない）

### 2.2 dev 専用ルートとの共存

`src/main.tsx` は `location.hash.startsWith('#/__theme' | '#/__components')` を `import.meta.env.DEV` の内側で判定し、一致時は `App` の代わりにギャラリーを描画する（CLAUDE.md 制約4）。HashRouter 導入後もこの分岐は**アプリのルーターより手前**で効くため共存する。

- **`#/__` 始まりのハッシュはアプリのルート名前空間から予約**とする。アプリ側のルート先頭セグメントは `:np`（`3`/`4`）のみなので実質衝突しない
- `main.tsx` の構造（`import.meta.env.DEV` のリテラル分岐の内側に動的 `import()` を直書き）は**一切変更しない**。`App.tsx` の中身だけを差し替える

### 2.3 パラメータ検証

`PlayerLayout` の先頭で `useParams()` を検証する。

| 条件 | 挙動 |
|---|---|
| `np` が `'4'` / `'3'` 以外 | `<Navigate to="/" replace />` |
| `id` が空文字 | ルートがそもそもマッチしない（`([^/]+)` は1文字以上） |
| `id` の形式検証 | **行わない**。存在しない ID の扱いは API 層（404 → `id_not_found`）の責務で Issue 8 以降 |

不正な `np` を「4 とみなして続行」しないのは、ユーザー意図の推測になるため。ホームへ戻して #7 の検索導線に載せる。

---

## 3. モジュール構成と公開シグネチャ

新規ディレクトリ `src/shell/` にシェル関連を集約する。**`src/components/md` のバレル以外から `@material/web` を import しない**（CLAUDE.md 制約3）。CSS 以外の副作用専用 bare import を書かない（制約1）。`import './shell.css'` は `sideEffects: ["*.css"]` の allowlist に載るため**唯一許可される bare import**。

### 3.1 `src/shell/paths.ts`（純粋・依存なし。ユニットテスト対象）

```ts
import type { NumPlayers } from '../api';

export type PlayerTab = 'summary' | 'compare' | 'stats' | 'history';

export interface TabDescriptor {
  readonly id: PlayerTab;
  readonly label: string;        // 'サマリー' | '比較' | 'スタッツ' | '履歴'
  readonly icon: string;         // Material Symbols のリガチャ名
  readonly enabled: boolean;     // history のみ false（承諾後に true）
}

/** 表示順を兼ねた全タブ定義。history は enabled:false */
export const PLAYER_TABS: readonly TabDescriptor[];

/** enabled のみ。ルート生成・ナビ描画・activeIndex 算出はすべてこれを唯一の情報源にする */
export const VISIBLE_TABS: readonly TabDescriptor[];

export const HOME_PATH = '/';

export function isNumPlayersParam(value: string | undefined): value is '3' | '4';
export function toNumPlayers(value: '3' | '4'): NumPlayers;
export function isVisibleTab(value: string | undefined): value is PlayerTab;

/** 例: playerPath({ numPlayers: 4, playerId: '123456', tab: 'compare' }) → '/4/player/123456/compare' */
export function playerPath(args: {
  numPlayers: NumPlayers;
  playerId: string;
  tab: PlayerTab;
}): string;

/**
 * VISIBLE_TABS 上のインデックス。該当なしは 0 を返す。
 * md-navigation-bar は activeIndex が範囲外だと throw するため、-1 を返してはならない（§1.2）。
 */
export function visibleTabIndex(tab: PlayerTab | undefined): number;
```

アイコン（Material Symbols リガチャ、叩き台）: summary=`dashboard` / compare=`bar_chart` / stats=`list` / history=`history`。

**`playerId` の URL エンコード**: `playerPath()` は `encodeURIComponent(playerId)` を通す。amae-koromo の ID は数値文字列だが、URL 組み立て関数として安全側に倒す（テスト対象）。

### 3.2 `src/shell/AppRouter.tsx`

```ts
export function AppRouter(): ReactElement;   // <HashRouter><Routes>…</Routes></HashRouter>
```

`src/App.tsx` は `AppRouter` を描画するだけにする（`main.tsx` は変更しない）。

### 3.3 `src/shell/PlayerLayout.tsx`

```ts
export function PlayerLayout(): ReactElement;   // レイアウトルートの element
```

責務:
1. `useParams()` の検証（§2.3）
2. 現在タブの決定: `useMatch` ではなく `useParams`/`useLocation` の末尾セグメントから `isVisibleTab` で判定
3. 遷移方向の算出: 直前のタブインデックスを `useRef` に保持し、`sign(next - prev)` を `-1 | 0 | 1` で `TabTransition` に渡す
4. `AppHeader` / `LayeredSheet` / `TabTransition`+`Outlet` / `PlayerNav` の組み立て

ヒーロー領域の中身（主要数値）は Issue 8 の担当。本 Issue ではプレースホルダ（プレイヤーID・人数表示のみ）を置く。

### 3.4 `src/shell/AppHeader.tsx`

```ts
export interface AppHeaderProps {
  numPlayers: NumPlayers;
  playerId: string;
  activeTab: PlayerTab;
}
export function AppHeader(props: AppHeaderProps): ReactElement;
```

- 高さ 64px 固定。`position: sticky; top: 0; z-index: 2`、背景 `--md-sys-color-surface`
- 左: アプリ名（`md-typescale-title-medium`）。ホームへの `<Link>`
- 右: **四麻/三麻トグル** = `OutlinedSegmentedButtonSet` + `OutlinedSegmentedButton`×2（`selected={numPlayers === 4}` / `=== 3`）
  - `onSegmentedButtonSetSelection` の `e.detail.index`（0=四麻 / 1=三麻）→ `navigate(playerPath({ numPlayers: next, playerId, tab: activeTab }))`
  - **タブは保持する**（`/4/player/x/compare` → `/3/player/x/compare`）
  - `navigate()` は `replace: false`（人数切替は戻れるべき操作）
- **スクロール連動のエレベーション変化は本 Issue の対象外**（M3 の on-scroll app bar は将来課題。§9）

### 3.5 `src/shell/PlayerNav.tsx` / `src/shell/NavigationRail.tsx`

```ts
export interface PlayerNavProps {
  numPlayers: NumPlayers;
  playerId: string;
  activeTab: PlayerTab;
}
export function PlayerNav(props: PlayerNavProps): ReactElement;      // ボトムナビ＋レールを両方描画（表示切替はCSS）
export function NavigationRail(props: PlayerNavProps): ReactElement; // 自前実装（§1.5）
```

**ブレークポイント（CSS メディアクエリのみ。`matchMedia` を使わない）**

| 幅 | ボトムナビ | レール |
|---|---|---|
| < 600px | 表示 | 非表示 |
| 600–839px | 表示 | 非表示 |
| ≥ 840px | 非表示 | 表示 |

CSS だけで切り替えるのは、JS 状態を挟まないぶんリサイズ時の再描画・同期ズレが原理的に起きず、受け入れ確認も `getComputedStyle().display` だけで済むため。両方が DOM に存在するが、`md-navigation-bar` のインスタンスは1つだけ（レールは自前実装なのでカスタム要素の重複登録・重複イベントは発生しない）。

**ボトムナビ**（`NavigationBar` / `NavigationTab`）:
- `activeIndex={visibleTabIndex(activeTab)}`（必ず 0..2。§1.2）
- 遷移は各 `NavigationTab` の `onNavigationTabInteraction`（クリック時のみ発火）で行う。**`onNavigationBarActivated` は使わない**（§1.2 のフィードバック経路回避）
- 遷移先パスが `location.pathname` と等しい場合は `navigate()` を呼ばない（履歴の重複エントリ防止）
- `position: fixed; left: 0; right: 0; bottom: 0; z-index: 2`
- 各タブは `<Icon slot="active-icon">` / `<Icon slot="inactive-icon">`（`src/dev/ComponentGallery.tsx` の既存パターンに合わせる）

**レール**（自前実装）:
- `position: fixed; left: 0; top: 0; bottom: 0; width: 80px; padding-top: 64px`（ヘッダー分）、背景 `--md-sys-color-surface`
- 各項目は `<button type="button">`（`position: relative`）内に `<Ripple>`（親要素に自動アタッチされることを `internal/controller/attachable-controller.js` の `control` ゲッター実物で確認済み: `return this.currentControl || this.host.parentElement`）＋ `<Icon>` ＋ ラベル（`md-typescale-label-medium`）
- 選択中: アイコン背後にピル（`width:56px; height:32px; border-radius:16px; background: var(--md-sys-color-secondary-container)`）、アイコン色 `--md-sys-color-on-secondary-container`
- 非選択: アイコン色 `--md-sys-color-on-surface-variant`
- `aria-current="page"` を選択中に付与。`:focus-visible { outline: 2px solid var(--md-sys-color-secondary); outline-offset: 2px; }`

### 3.6 `src/shell/LayeredSheet.tsx`（層状シートの共通化）

```ts
export interface LayeredSheetProps {
  /** テーマ背景の上に置く主要数値領域（Issue 8 が中身を差し込む） */
  hero: ReactNode;
  /** せり上がるカード層 */
  children: ReactNode;
}
export function LayeredSheet(props: LayeredSheetProps): ReactElement;
```

DOM 構造と CSS（`src/shell/shell.css`）:

```
.layered-sheet
├ .layered-sheet__hero    position: sticky; top: var(--app-header-height,64px); z-index: 0;
│                         background: var(--md-sys-color-surface-container-high);
│                         color: var(--md-sys-color-on-surface);
│                         min-height: 180px; padding: 24px 16px 48px;
└ .layered-sheet__layer   position: relative; z-index: 1; margin-top: -28px;
                          border-radius: 28px 28px 0 0;
                          background: var(--md-sys-color-surface);
                          min-height: 100svh; padding: 24px 16px;
```

- 方式: **sticky ヒーロー ＋ 負の `margin-top` を持つ角丸カード層**。スクロールするとヒーローがビューポート上部に留まったままカード層がその上に重なって覆う＝「せり上がる」。`animation-timeline: scroll()`（Firefox 未対応）も `IntersectionObserver` も `scroll` リスナーも使わない**純CSS**で、全ブラウザで同じ挙動になる
- スクロール容器は**ページ（body）**とする。内部スクローラを作らないことで sticky の包含ブロックがビューポートになり、`overflow` 由来の sticky 不発を構造的に防ぐ
- `surface-container-high` は Issue 1 の `applyTheme.ts` が neutral パレットから合成して供給しているトークン（light: N92 / dark: N17）。実在を確認済み
- カード層の下余白: `padding-bottom: calc(80px + 16px + env(safe-area-inset-bottom, 0px))`（80px = `md-navigation-bar` の既定コンテナ高さ実測値）。≥840px では `padding-bottom: 24px` に戻す
- ≥840px ではページ全体に `padding-left: 80px`（レール幅）

**`index.html` の viewport は変更しない**。`env(safe-area-inset-bottom)` は `viewport-fit=cover` が無いと常に 0 を返すが、`calc()` のフォールバック（`0px`）で破綻しない。ノッチ対応は実機検証が要るため #16 以降に送る（§9）。

### 3.7 `src/shell/TabTransition.tsx`（shared-axis 風）

```ts
export interface TabTransitionProps {
  /** 変化したら再生し直すキー。タブID を渡す */
  transitionKey: string;
  /** 1 = 次のタブへ（右→左）, -1 = 前のタブへ, 0 = 方向なし（フェードのみ） */
  direction: -1 | 0 | 1;
  children: ReactNode;
}
export function TabTransition(props: TabTransitionProps): ReactElement;
```

- 実装は `<div key={transitionKey} className="tab-transition" data-direction={direction}>`。`key` の変化で React が要素を作り直し、CSS アニメーションが再生される（JS のアニメーション API を使わない）
- CSS keyframes（`shell.css`）:
  - `@keyframes shared-axis-in-forward { from { opacity:0; transform: translateX(24px) } to { opacity:1; transform:none } }`
  - `@keyframes shared-axis-in-backward { from { opacity:0; transform: translateX(-24px) } to { opacity:1; transform:none } }`
  - `@keyframes shared-axis-in-fade { from { opacity:0 } to { opacity:1 } }`
  - duration 300ms / easing `cubic-bezier(0.05, 0.7, 0.1, 1)`（M3 emphasized-decelerate）
  - `@media (prefers-reduced-motion: reduce) { .tab-transition { animation: none } }`
- **退場アニメーションは行わない**（入場のみ）。CSS のみで両方向をやるには旧要素を残す仕組み（TransitionGroup 相当）が要り、Issue の「CSS実装で可」の範囲を超えるため。M3 shared-axis の見た目としては入場のみでも成立する。この割り切りは設計判断として記録する

### 3.8 プレースホルダ

```ts
// src/shell/PlaceholderPanel.tsx
export function PlaceholderPanel(props: { tab: PlayerTab }): ReactElement;
// src/shell/HomePlaceholder.tsx
export function HomePlaceholder(): ReactElement;
```

`HomePlaceholder` は「プレイヤーを検索してください（検索画面は #7）」の文言＋動作確認用のサンプルリンク1本（`/4/player/…` 形式）程度に留める。**API を叩かない**。

### 3.9 検収用の DOM フック（必須。受け入れ条件がこれを参照する）

| 属性 | 付与先 |
|---|---|
| `data-testid="app-header"` | ヘッダー要素 |
| `data-testid="np-toggle"` | `OutlinedSegmentedButtonSet` |
| `data-testid="bottom-nav"` | `NavigationBar` |
| `data-testid="nav-rail"` | レールのルート要素 |
| `data-testid="tab-panel"` ＋ `data-tab="<tabId>"` | `TabTransition` が描画する div |
| `data-testid="sheet-hero"` / `data-testid="sheet-layer"` | 層状シートの2層 |

---

## 4. テーマとの関係

- 色は**すべて `--md-sys-color-*` を参照**する。HEX を書かない（CLAUDE.md 制約5）
- `ThemeProvider.setRank()` は**本 Issue では呼ばない**。段位に応じたシード切替はプレイヤーデータ取得後（Issue 8）の責務。本 Issue のシェルは既定シード（`DEFAULT_SEED`）のまま動く
- セクション色4系統（`--md-custom-color-*`）は使わない（CLAUDE.md「保留中の設計判断」により、色分け自体が行われない可能性があるため依存しない）

---

## 5. 変更するファイル一覧

新規:
```
src/shell/paths.ts
src/shell/paths.test.ts
src/shell/AppRouter.tsx
src/shell/PlayerLayout.tsx
src/shell/AppHeader.tsx
src/shell/PlayerNav.tsx
src/shell/NavigationRail.tsx
src/shell/LayeredSheet.tsx
src/shell/TabTransition.tsx
src/shell/PlaceholderPanel.tsx
src/shell/HomePlaceholder.tsx
src/shell/shell.css
```
変更:
```
src/App.tsx        （AppRouter を描画するだけにする）
```
**変更しない**: `src/main.tsx` / `index.html` / `vite.config.ts` / `package.json`（依存追加なし）/ `src/theme/*` / `src/api/*` / `src/domain/*`

---

## 6. 受け入れ条件（検収担当はこれを1項目ずつ実行する）

### A. 静的検証

| # | 実行 | 合格 |
|---|---|---|
| A1 | `npm run build` | 型エラー0で成功。出力 JS サイズを記録する。**ベースライン 238.36 kB に対し +70 kB 以内**（設計時実測: react-router のみで +39.81 kB。シェル実装分の余裕を含む）。超過したら原因を報告する |
| A2 | `npm run lint` | エラー0・警告0 |
| A3 | `npm test` | 全通過 |
| A4 | `grep -rn "<md-" src/ --include=*.tsx --include=*.ts` | **0件**（生タグ直書き禁止。CLAUDE.md 制約3） |
| A5 | `grep -rn "^import '" src/ --include=*.ts --include=*.tsx` の結果を目視 | CSS（`.css` で終わる）以外の副作用専用 bare import が**0件**（制約1） |
| A6 | `grep -rn "createHashRouter\|RouterProvider" src/` | **0件**（§1.6 の宣言的API方針） |
| A7 | `grep -rn "(4|3)" src/ --include=*.tsx --include=*.ts` | **0件**（§1.1 の非対応構文が混入していない） |
| A8 | `grep -rn "onNavigationBarActivated" src/shell/` | **0件**（§1.2 のフィードバック経路回避。`src/dev/ComponentGallery.tsx` にあるのは可） |
| A9 | `grep -rniE "#[0-9a-f]{3,8}\b" src/shell/` | **0件**（色のハードコード禁止。制約5） |
| A10 | `git diff --name-only main` | §5 の一覧と一致。`src/main.tsx` / `index.html` / `package.json` が含まれない |

### B. ユニットテスト（`src/shell/paths.test.ts`。red 確認を先に行うこと）

| # | 検証内容 | 期待値 |
|---|---|---|
| B1 | `playerPath({numPlayers:4, playerId:'123456', tab:'summary'})` | `'/4/player/123456/summary'` |
| B2 | `playerPath({numPlayers:3, playerId:'123456', tab:'compare'})` | `'/3/player/123456/compare'` |
| B3 | `playerPath({numPlayers:4, playerId:'a/b c', tab:'stats'})` | `'/4/player/a%2Fb%20c/stats'`（エンコードされる） |
| B4 | `visibleTabIndex('summary'/'compare'/'stats')` | `0` / `1` / `2` |
| B5 | `visibleTabIndex('history')` と `visibleTabIndex(undefined)` | **どちらも `0`**（`-1` を返さない。§1.2） |
| B6 | `VISIBLE_TABS.length` / `PLAYER_TABS.length` | `3` / `4` |
| B7 | `VISIBLE_TABS.some(t => t.id === 'history')` | `false` |
| B8 | `isNumPlayersParam` に `'4'`,`'3'`,`'2'`,`'44'`,`undefined` | `true,true,false,false,false` |
| B9 | react-router の実挙動固定: `matchPath('/:np/player/:id/:tab', '/4/player/123/stats')` が `{np:'4',id:'123',tab:'stats'}` を返す | 一致（ライブラリ更新で §1.1 の前提が崩れたら落ちる回帰テスト） |

**red 確認の手順**: B1 は `playerPath` の `/player/` を `/p/` に、B5 は戻り値 `0` を `-1` に、B9 はパターンを `/:np(4|3)/player/:id/:tab` に一時改変し、それぞれ該当テストが**落ちること**を確認してから元に戻す。

### C. ブラウザ実測（`npm run dev` → ブラウザペイン）

各項目、実行手順と期待される観測値を書いた。`document.querySelector` は `javascript_tool` から実行する。

| # | 実行 | 合格 |
|---|---|---|
| C1 | `http://localhost:5173/#/4/player/123456` を直接開く（リロード直叩き） | `location.hash === '#/4/player/123456/summary'`（index → summary の replace 正規化）。`document.querySelector('[data-testid="tab-panel"]').dataset.tab === 'summary'` |
| C2 | `#/4/player/123456/compare` を直叩き | `[data-testid="tab-panel"].dataset.tab === 'compare'`。ボトムナビの `md-navigation-bar` の `activeIndex` が `1`（`document.querySelector('[data-testid="bottom-nav"]').activeIndex`） |
| C3 | C2 の状態でボトムナビの3番目のタブをクリック | `location.hash === '#/4/player/123456/stats'`、`dataset.tab === 'stats'` |
| C4 | C3 の後にブラウザ「戻る」（`history.back()`） | `location.hash` が `#/4/player/123456/compare` に戻り、`dataset.tab === 'compare'`。**さらに勝手な遷移が起きない**（1回の back で1段だけ戻る。§1.2 のフィードバック検証） |
| C5 | 幅 375px（`resize_window` mobile）で `getComputedStyle(q('[data-testid="bottom-nav"]')).display` と `...('[data-testid="nav-rail"]').display` | ボトムナビ ≠ `'none'` / レール = `'none'` |
| C6 | 幅 700px | ボトムナビ ≠ `'none'` / レール = `'none'` |
| C7 | 幅 1280px | ボトムナビ = `'none'` / レール ≠ `'none'` |
| C8 | 幅 1280px でレールの2番目の項目をクリック | `location.hash` が `…/compare` になる |
| C9 | `#/4/player/123456/compare` で四麻/三麻トグルの「三人打ち」をクリック | `location.hash === '#/3/player/123456/compare'`（**タブが保持される**）。トグルの選択状態が三人打ち側に付く（`q('[data-testid="np-toggle"]').children[1].selected === true`） |
| C10 | C9 の後に「戻る」 | `#/4/player/123456/compare` に戻り、トグルの選択が四人打ち側に戻る |
| C11 | `#/4/player/123456/history` を直叩き | `location.hash === '#/'`（ホームへ replace）。ホーム表示中にコンソールエラーが出ていない |
| C12 | `#/9/player/123456/summary` を直叩き | `location.hash === '#/'` |
| C13 | ボトムナビ（幅375px）のタブ数を数える: `q('[data-testid="bottom-nav"]').querySelectorAll('md-navigation-tab').length` | **`3`**（履歴タブが出ていない） |
| C14 | 層状シート: `window.scrollTo(0, 0)` 直後の `q('[data-testid="sheet-layer"]').getBoundingClientRect().top` と `q('[data-testid="sheet-hero"]').getBoundingClientRect().bottom` を比較 | layer.top **<** hero.bottom（負マージンでヒーローに重なっている） |
| C15 | 層状シート: `window.scrollTo(0, 600)` 後に `q('[data-testid="sheet-hero"]').getBoundingClientRect().top` | ヘッダー高さ 64 ±2px に留まっている（sticky が効いている）。かつ `q('[data-testid="sheet-layer"]').getBoundingClientRect().top` が 64 未満（シートがヒーローを覆っている） |
| C16 | タブ遷移アニメーションの定義確認: タブを切り替えた直後に `getComputedStyle(q('[data-testid="tab-panel"]')).animationName` | `'shared-axis-in-forward'`（前のタブへ戻るときは `'shared-axis-in-backward'`）。**アニメーションの進行・完了はブラウザペインでは確認しない**（CLAUDE.md「既知の検証環境の制約」。`document.visibilityState === 'hidden'` のため） |
| C17 | ライト/ダーク両方で C1 を実行（`#/4/player/123456` を開いた状態で `localStorage.setItem('mjsv:color-mode','dark')` → リロード） | どちらでもヒーロー・シート・ナビの背景色が変わり、`getComputedStyle(q('[data-testid="sheet-hero"]')).backgroundColor` がライトとダークで**異なる値**になる |
| C18 | 全操作を通してコンソールにエラーが出ていない（`read_console_messages` の `onlyErrors`） | 0件。とくに `NavigationBar: activeIndex is out of bounds.` が出ていないこと（§1.2） |

### D. オーナーへの UI 検証逆発注（機械で測れないもの）

検収担当は `docs/ui-verification/` の `TEMPLATE.md` を複製して以下を手順書化し、オーナーへ渡す（`docs/ui-verification/README.md` の規約に従う）。**この結果を待たずに PR は作成してよい**が、PR 本文に未回収である旨を書く。

- D1: タブ切替時の shared-axis 風モーションの体感（速度・方向の自然さ）。※ブラウザペインでは原理的に再生されない
- D2: スクロール時の層状シートの「せり上がり」の印象（`prefers-reduced-motion` 有効時も含む）
- D3: 実機（スマホ）でのボトムナビのタップ性・ホームインジケータとの干渉（`env(safe-area-inset-bottom)` 未対応の影響）
- D4: レールとボトムナビの切り替わり幅（840px）の妥当性

---

## 7. `src/components/md` へのラッパー追加について

本 Issue で使うコンポーネントは**すべて既にバレルにある**ことを確認した: `NavigationBar` / `NavigationTab` / `Icon` / `Ripple` / `OutlinedSegmentedButton` / `OutlinedSegmentedButtonSet`（＋必要なら `IconButton`）。**新規ラッパーの追加は不要**という前提で設計している。

ただし製造中に未ラップのコンポーネント（例: `md-focus-ring`。`@material/web/focus/md-focus-ring.js` に実在するがバレル未収録）が必要になった場合は、**必ず** `src/components/md/` に `@lit/react` の `createComponent` でラッパーを追加し、`src/components/md/index.ts`（バレル）に載せてから使うこと。以下は禁止:

- JSX に `<md-*>` の生タグを直書きする（型エラー。制約3）
- `@material/web/all.js` を使う（バンドルサイズ管理。制約3）
- カスタム要素登録のための副作用専用 bare import（本番ビルドで黙って除去される。制約1）

---

## 8. 後続 Issue への引き継ぎ

| 宛先 | 内容 |
|---|---|
| #7 検索画面 | `/` は `HomePlaceholder` が占めている。ここを差し替える。プレイヤー選択後の遷移先は `playerPath({numPlayers, playerId, tab:'summary'})` を使うこと（パス文字列を手書きしない） |
| #8 サマリータブ | `LayeredSheet` の `hero` プロップにカード1（アイデンティティ）相当の主要数値を差し込む。ヒーロー背景は `--md-sys-color-surface-container-high` 前提。段位シード切替（`useTheme().setRank(...)`）はここで初めて呼ぶ |
| #8 以降 全タブ | タブの中身は `PlaceholderPanel` を置き換える形で `src/features/<tab>/` 等に実装する。`TabTransition` は `PlayerLayout` が既に巻いているので各タブ側でアニメーションを書かない |
| グローバルフィルタ（モード・期間） | 本 Issue では**未実装**。要件 §4 のヘッダー直下のフィルタバーは、`PlayerLayout` の `LayeredSheet` の hero 内 or 直下に置く想定。URL クエリに載せるかローカル状態にするかは未決（§9） |
| 承諾後（履歴タブ） | `PLAYER_TABS` の `history` 行を `enabled: true` にするだけで、ルート・ナビ・レールの3箇所が同時に有効化される。ルート要素の追加だけ別途必要 |
| #16 CI・デプロイ | GitHub Pages のプロジェクトページは `/<repo>/` 配下で配信されるため、**`vite.config.ts` に `base: '/mj-stats-viewer/'` の設定が必要**（アセットURLの問題。ルーティングは HashRouter なので影響を受けない）。本 Issue では `vite.config.ts` を触らない |

---

## 9. 未決事項・今回スコープ外（設計として意図的に落としたもの）

| 項目 | 状態 |
|---|---|
| ヘッダーのスクロール連動エレベーション（M3 on-scroll app bar） | 対象外。`IntersectionObserver` のセンチネルで後付け可能 |
| `viewport-fit=cover` とノッチ対応 | 対象外。`env(safe-area-inset-bottom)` はフォールバック `0px` で破綻しない形にしてある。実機検証が必要なため D3 で逆発注 |
| タブの退場アニメーション | 行わない（§3.7 に理由） |
| グローバルフィルタの状態をURLに載せるか | 未決。#8 以降で決める |
| ブレークポイント 840px の妥当性 | Issue 記載値をそのまま採用。D4 で体感確認を逆発注 |
| `tsconfig.app.json` に `strict` が設定されていない | 本 Issue のスコープ外だが**発見事項として記録**する。型の厳密さに依存した設計はしていない |

---

## 10. 実挙動未確認の箇所（推定で書いた部分）

正直に列挙する。製造・検収時に食い違ったら設計書側を直すこと。

1. **`position: sticky` のヒーローと負マージンのカード層の重なり**: CSS 仕様上は成立するはずだが、`src/` に実装して実際に描画した確認はしていない（設計担当はコードを書かないため）。C14/C15 が実質の初回検証になる。もし sticky が効かない場合、原因は「祖先に `overflow: hidden`/`auto` がある」か「祖先が `display: flex` で高さを制限している」のいずれかである可能性が高い。その場合はスクロール容器をページ（body）に戻すこと（§3.6）
2. **`md-navigation-bar` の初回レンダリング時に `activeIndex` を 1 以上で渡したときの挙動**: Lit のライフサイクル上、`firstUpdated()`（→`layout()` で `tabs` を充填）が `updated()` より先に走るため throw しないと読んだが、React 側から初期プロップとして渡すケースを実行して確かめてはいない。C2（`compare` 直叩き = 初回 activeIndex=1）がこの検証を兼ねる。もし throw した場合は「初回は 0 で描画し、`useEffect` で目的インデックスへ更新する」または「`tabs` 充填後まで `activeIndex` を 0 に固定する」で回避する
3. **`@lit/react` が `md-outlined-segmented-button` の `selected` をプロップとして正しく制御し続けるか**: `createComponent` は前回プロップとの差分でのみプロパティを書き込むため、要素側の状態が外部要因で書き換わってプロップ値が変わらないケースでは同期しない理論的可能性がある。§1.4 の解析ではその経路は生じないと判断したが、C9/C10 が実質の検証になる
4. **ボトムナビ 80px ＋ `env(safe-area-inset-bottom)` の実機での見え方**: 実機未確認。D3 で逆発注
5. **`prefers-reduced-motion: reduce` 時の挙動**: ブラウザペインでのエミュレーション手段を確認していない。D2 で逆発注

---

## 付録: 作業ログ（実測の再現手順）

- react-router のバンドル増分測定: `src/App.tsx` を `HashRouter/Routes/Route/Outlet/Navigate/useParams/useNavigate/useLocation` を使う最小構成に一時差し替え → `npm run build` → 元に戻す（`git status --porcelain` がクリーンであることを確認済み）
- `matchPath` の実挙動確認: `node --input-type=module -e "import { matchPath } from 'react-router'; …"`
- 読んだ実物: `node_modules/react-router/dist/development/chunk-HHGH3NKS.js`（`compilePath`）/ `@material/web/labs/navigationbar/internal/navigation-bar.{d.ts,js}` / `@material/web/labs/navigationtab/internal/navigation-tab.{d.ts,js}` / `@material/web/tabs/internal/tabs.{d.ts,js}` / `@material/web/labs/segmentedbuttonset/internal/segmented-button-set.js` / `@material/web/internal/controller/attachable-controller.js` / `@material/web/labs/navigationbar/internal/navigation-bar-styles.css`
