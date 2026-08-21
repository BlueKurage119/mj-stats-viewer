# Issue 2 設計書: @material/web 型付き React ラッパー集

作成日: 2026-08-21
対象 Issue: #2 @material/web 型付き React ラッパー集
前提資料: `docs/requirements.md` §2・§4.3 / `docs/design/issue-1-md3-theme.md`（書式・dev ルート方式の手本）
検証環境: `@material/web` **2.5.0** / `@lit/react` **1.0.8** / React 19 / Vite 8.2.2（すべて node_modules 実物の `.d.ts` / `.js` を確認済み。バンドルサイズは本設計時に実測）

---

## 0. 確定済み前提（変更不可）

- ラップ範囲は Issue の表24点 ＋ 随伴5点（`md-icon` / `md-menu-item` / `md-select-option` / `md-list` / `md-list-item`）= **計29点**。前3点は icon-button / menu / select を実用するのに必須の随伴、リスト2点は要件 §4.3（スタッツタブは MD3 リスト形式）で Issue 14 に必ず要るため先行
- アイコンフォントは **Material Symbols を Google Fonts CDN** で追加（Issue 1 の Noto Sans JP と同じ方式で `index.html` に link）
- 検証サンプルは **dev 専用ルート `#/__components`**。Issue 1 の `#/__theme` と同じ `import.meta.env.DEV` ガード方式で `src/dev/` に配置
- 全量 import の `@material/web/all.js` は**使用禁止**（Issue 明記）
- 生タグ `<md-*>` の JSX 直書きは禁止（型エラーになるため全てラップ）

---

## 1. ライブラリ実態調査結果（設計の根拠）

### 1.1 `@lit/react` 1.0.8 の `createComponent`（`create-component.d.ts` 実物で確認）

```ts
createComponent<I extends HTMLElement, E extends EventNames = {}>(options: {
  react: typeof React;          // React モジュール本体
  tagName: string;              // customElements.define 済みタグ名
  elementClass: Constructor<I>; // カスタム要素クラス
  events?: E;                   // { Reactプロップ名: 'イベント名' } のマップ
  displayName?: string;
}): ReactWebComponent<I, E>
```

- 戻り値は `ForwardRefExoticComponent`。**`ref` でカスタム要素インスタンス `I` がそのまま取れる**
- `events` に `'change' as EventName<FooEvent>` と書くと、対応するプロップの型が `(e: FooEvent) => void` になる（`EventName<T extends Event>` はブランド付き string 型。`as` キャストは erasable なので `erasableSyntaxOnly: true` に抵触しない）
- 要素のプロパティ（`disabled`、`activeTabIndex` 等）は `Partial<Omit<I, keyof HTMLElement>>` として全て自動でプロップ化される。**プロパティの型付けはラッパー側で書く必要が一切ない**
- `import React from 'react'` のデフォルト import は現行 tsconfig（`verbatimModuleSyntax: true`）で `tsc -b` が通ることを実ビルドで確認済み

### 1.2 `@material/web` 2.5.0 の29モジュール

29点すべての `.d.ts` を読み、以下を確認した:

- 各モジュールは `export declare class Md〜` を1つ export し、モジュール評価時に `customElements.define('md-…', Md〜)` を**副作用として実行**する（`declare global` で `HTMLElementTagNameMap` も拡張）
- `@material/web` の `package.json` に **`sideEffects` フィールドは無い**（＝バンドラは全モジュールを副作用ありとみなす。§2 のバレル問題の原因）
- タグ名・クラス名・発火イベントは §3 の表の通り（`@fires` JSDoc と実装 `.js` の `dispatchEvent` 箇所を突合済み）
- Issue 本文の「tonal-button」の実ファイル名は **`filled-tonal-button`**（クラス `MdFilledTonalButton`、タグ `md-filled-tonal-button`）
- ライブラリが export する**イベント型は `CloseMenuEvent` のみ**（`@material/web/menu/menu.js` から `type CloseMenuEvent` を re-export。実体は `CustomEvent<{initiator, reason, itemPath}>`）。navigation-bar 等の CustomEvent detail 型は export されていないため、必要なものは実装 `.js` の `dispatchEvent` 引数から転記してインラインで書く（§4）

### 1.3 `md-icon` の描画方式（`icon/internal/icon-styles` 実物で確認）

- `md-icon` は `font-family: var(--md-icon-font, Material Symbols Outlined)` / `font-size: var(--md-icon-size, 24px)` で **slot のテキストをリガチャとして描画**する。つまり `<Icon>home</Icon>` と書けばよく、フォントさえ読み込めば追加設定は不要
- SVG を slot に入れる方式もサポートされる（`::slotted(svg){fill:currentColor}`）が、本プロジェクトはリガチャ方式で統一する

---

## 2. バレルエクスポート vs バンドルサイズ（実測と結論）

### 2.1 実測値（vite build の出力 JS。CSS 5.75 kB は全ケース共通のため省略）

検証方法: ラッパー6点（FilledButton / Tabs / PrimaryTab / OutlinedSelect / SelectOption / OutlinedTextField）とバレル `index.ts` を一時作成し、`App.tsx` から **FilledButton 1点だけ**を使って本番ビルド。

| ケース | JS サイズ | gzip |
|---|---|---|
| A. ベースライン（ラッパー無し、現状の main） | 238.36 kB | 74.50 kB |
| B. バレル経由で1点 import（対策なし） | **430.11 kB** | **115.69 kB** |
| C. 個別ファイルから1点 import | 286.92 kB | 88.49 kB |
| D. バレル経由で1点 import ＋ `package.json` に `"sideEffects": ["*.css"]` | **286.92 kB**（C と同一ハッシュ） | **88.49 kB** |

- B は懸念どおり: `customElements.define()` の副作用のため、Rollup はバレルに載った**未使用ラッパーも全て**バンドルに引き込む（ラッパー6点・実使用1点で +143.19 kB / gzip +27.20 kB。29点なら差はさらに拡大する）
- D は C と**バイト単位で同一**の出力になった。アプリ自身の `package.json` に `sideEffects` を宣言すると、Vite/Rollup が `src/` 配下のモジュールを「export が使われない限り丸ごと除去してよい」と扱い、未使用ラッパーファイルごと（＝その中の `@material/web` import ごと）グラフから消える。使用中のラッパーが import する `@material/web` モジュール側の `customElements.define` は残る（dist に `md-filled-button` の定義が存在し、`md-tabs` が存在しないことを grep で確認済み）

### 2.2 結論: **バレル維持 ＋ ルート `package.json` に `"sideEffects": ["*.css"]`**

| 選択肢 | 評価 |
|---|---|
| バレル廃止・個別 import 規約 | 動くが、利用側の import 文が煩雑（1画面で5〜8点使う）。規約違反（うっかりバレル追加）を防ぐ仕組みもない |
| カテゴリ別バレル分割 | カテゴリ内の同居問題（Tabs を使うと PrimaryTab も来るのは実用上むしろ好都合だが、Menu/Select 系で無駄が残る）。中途半端 |
| **`sideEffects` 宣言 ＋ 単一バレル（採用）** | Issue 要求の「index.ts 一括エクスポート」と「バンドルサイズ管理」を両立。実測で個別 import と同一出力 |

`package.json` への追加（`false` でなく allowlist にするのは、`import './index.css'` 等の CSS 副作用 import を将来にわたり保護するため。今回の実測では `false` でも CSS は残ったが、仕様上安全な形を取る）:

```jsonc
// package.json（ルート直下に追加）
"sideEffects": ["*.css"]
```

**この宣言に伴う恒久コーディング規約（設計書・CLAUDE.md 級の拘束力を持たせる）**:

1. `src/` 配下で「**副作用のためだけの bare import**」（`import './foo'` 形式。CSS を除く）を書いてはならない。本番ビルドで黙って除去される。カスタム要素の登録は必ず「ラッパーの export を使う」ことで成立させる
2. アプリコードは **必ずバレル `src/components/md`（index.ts）から import** する。個別ファイル直 import も動作はするが、規約はバレル一本に統一する（D=C の実測により性能差はゼロ）
3. dev サーバーはツリーシェイクしないため、dev では `#/__components` 以外の画面でも29点全てが register される。これは仕様（本番には影響しない）
4. **`sideEffects` が除去できるのは「モジュール丸ごと未使用」の場合のみ**であり、**使用中のファイル内で未使用の named export（同居する兄弟コンポーネント）** は除去されない。Rollup は `createComponent(...)` 呼び出しを純粋と証明できないため、同一ファイル内の未使用 export の呼び出し自体（＝そのラッパーが内部で持つスタイルトークン文字列等）が gzip 数百バイト単位で残存する（`customElements.define` 自体は当該 `@material/web` モジュールが他から参照されなければ除去されるため、実行時の副作用は残らない）。実測: `Button.ts`（FilledButton/FilledTonalButton/TextButton 同居）から `FilledButton` 1点だけ使う場合、`FilledButton` 単独ファイルから import した場合（gzip 88.49 kB）より数百バイト大きい（gzip 89.26 kB）。§5 のファイル分割単位（ディレクトリ単位で複数コンポーネントを同居させる）を採る限りこの差は残り、後続 Issue でバンドルサイズが想定と数百バイト単位でズレても異常ではない

---

## 3. ラップ対象29点の完全一覧

すべて node_modules 実物の `.d.ts`（クラス名・タグ名）と実装 `.js`（イベント dispatch 箇所）で裏取り済み。import パスは `@material/web/` からの相対で表記（**必ず `.js` 拡張子付き**で import する。パッケージの exports がそうなっているため）。

| # | React 名 | import パス（@material/web/…） | タグ名 | elementClass | events マッピング |
|---|---|---|---|---|---|
| 1 | `FilledButton` | `button/filled-button.js` | `md-filled-button` | `MdFilledButton` | — |
| 2 | `FilledTonalButton` | `button/filled-tonal-button.js` | `md-filled-tonal-button` | `MdFilledTonalButton` | — |
| 3 | `TextButton` | `button/text-button.js` | `md-text-button` | `MdTextButton` | — |
| 4 | `IconButton` | `iconbutton/icon-button.js` | `md-icon-button` | `MdIconButton` | `onChange: 'change'`, `onInput: 'input'`（toggle 時のみ発火） |
| 5 | `Tabs` | `tabs/tabs.js` | `md-tabs` | `MdTabs` | `onChange: 'change'`（型は §4 パターンA） |
| 6 | `PrimaryTab` | `tabs/primary-tab.js` | `md-primary-tab` | `MdPrimaryTab` | — |
| 7 | `NavigationBar` | `labs/navigationbar/navigation-bar.js` | `md-navigation-bar` | `MdNavigationBar` | `onNavigationBarActivated: 'navigation-bar-activated'`（CustomEvent, §4 パターンB） |
| 8 | `NavigationTab` | `labs/navigationtab/navigation-tab.js` | `md-navigation-tab` | `MdNavigationTab` | `onNavigationTabInteraction: 'navigation-tab-interaction'`。`navigation-tab-rendered` は bar 内部整合用のため**非マップ**（必要なら ref + addEventListener） |
| 9 | `ChipSet` | `chips/chip-set.js` | `md-chip-set` | `MdChipSet` | — |
| 10 | `FilterChip` | `chips/filter-chip.js` | `md-filter-chip` | `MdFilterChip` | `onRemove: 'remove'`。選択トグルの検知は標準 `onClick` ＋ `e.currentTarget.selected` 読み取り（chip は選択変更イベントを発火しない。`.d.ts` で確認） |
| 11 | `OutlinedSegmentedButton` | `labs/segmentedbutton/outlined-segmented-button.js` | `md-outlined-segmented-button` | `MdOutlinedSegmentedButton` | `onSegmentedButtonInteraction: 'segmented-button-interaction'` |
| 12 | `OutlinedSegmentedButtonSet` | `labs/segmentedbuttonset/outlined-segmented-button-set.js` | `md-outlined-segmented-button-set` | `MdOutlinedSegmentedButtonSet` | `onSegmentedButtonSetSelection: 'segmented-button-set-selection'`（CustomEvent, §4 パターンB） |
| 13 | `ElevatedCard` | `labs/card/elevated-card.js` | `md-elevated-card` | `MdElevatedCard` | — |
| 14 | `FilledCard` | `labs/card/filled-card.js` | `md-filled-card` | `MdFilledCard` | — |
| 15 | `OutlinedCard` | `labs/card/outlined-card.js` | `md-outlined-card` | `MdOutlinedCard` | — |
| 16 | `Badge` | `labs/badge/badge.js` | `md-badge` | `MdBadge` | — |
| 17 | `Divider` | `divider/divider.js` | `md-divider` | `MdDivider` | — |
| 18 | `Elevation` | `elevation/elevation.js` | `md-elevation` | `MdElevation` | — |
| 19 | `Ripple` | `ripple/ripple.js` | `md-ripple` | `MdRipple` | — |
| 20 | `LinearProgress` | `progress/linear-progress.js` | `md-linear-progress` | `MdLinearProgress` | — |
| 21 | `CircularProgress` | `progress/circular-progress.js` | `md-circular-progress` | `MdCircularProgress` | — |
| 22 | `OutlinedTextField` | `textfield/outlined-text-field.js` | `md-outlined-text-field` | `MdOutlinedTextField` | `onChange: 'change'`, `onInput: 'input'`（§4 パターンA） |
| 23 | `Menu` | `menu/menu.js` | `md-menu` | `MdMenu` | `onOpening/onOpened/onClosing/onClosed`（素の Event）、`onCloseMenu: 'close-menu'`（§4 パターンC・`CloseMenuEvent`） |
| 24 | `MenuItem` | `menu/menu-item.js` | `md-menu-item` | `MdMenuItem` | —（`close-menu` は bubbles するため Menu 側で受ける） |
| 25 | `OutlinedSelect` | `select/outlined-select.js` | `md-outlined-select` | `MdOutlinedSelect` | `onChange: 'change'`, `onInput: 'input'`（§4 パターンA）、`onOpening/onOpened/onClosing/onClosed` |
| 26 | `SelectOption` | `select/select-option.js` | `md-select-option` | `MdSelectOption` | —（`close-menu`/`request-selection` 等は select 内部用） |
| 27 | `Icon` | `icon/icon.js` | `md-icon` | `MdIcon` | — |
| 28 | `List` | `list/list.js` | `md-list` | `MdList` | — |
| 29 | `ListItem` | `list/list-item.js` | `md-list-item` | `MdListItem` | —（`request-activation` は list 内部用） |

イベントプロップの命名規則: **`on` ＋ イベント名の camelCase 変換**（`navigation-bar-activated` → `onNavigationBarActivated`）。機械的に導出できることを名前の短さより優先する。

Issue の「select」は `md-outlined-select` 1点とする（テキストフィールドを outlined で統一しているため。`md-filled-select` は存在するが本プロジェクトでは使わない＝ラップしない）。

---

## 4. イベント型付けの方針

**方針: 「ハンドラ内でキャストが要るかどうか」だけを基準に3パターンを使い分ける。detail 型の網羅的な作り込みはしない。**

`@material/web` はイベント型をほぼ export していない（§1.2。唯一の例外が `CloseMenuEvent`）。存在しない型を精緻に再現しようとすると、ライブラリ更新のたびに手書き型が実装とズレる保守コストだけが残る。一方、素の `Event` のままだと利用側が毎回 `e.target as MdTabs` とキャストする羽目になる。そこで:

### パターンA: 発火元プロパティを読むイベント → `EventName<Event & { currentTarget: I }>`

`change` 系は「イベント自体に情報がなく、要素のプロパティ（`activeTabIndex` / `value` / `selected`）を読む」設計。リスナーは `createComponent` がホスト要素に直付けするため、dispatch 中の `currentTarget` はホスト要素で**型として健全**（`target` は composed の内側要素になりうるので使わない）。

```ts
// src/components/md/Tabs.ts（実装例。この形を全ファイルで踏襲）
import React from 'react';
import { createComponent, type EventName } from '@lit/react';
import { MdTabs } from '@material/web/tabs/tabs.js';
import { MdPrimaryTab } from '@material/web/tabs/primary-tab.js';

export const Tabs = createComponent({
  tagName: 'md-tabs',
  elementClass: MdTabs,
  react: React,
  events: {
    onChange: 'change' as EventName<Event & { currentTarget: MdTabs }>,
  },
});

export const PrimaryTab = createComponent({
  tagName: 'md-primary-tab',
  elementClass: MdPrimaryTab,
  react: React,
});
```

利用側は `onChange={(e) => setIndex(e.currentTarget.activeTabIndex)}` とキャスト無しで書ける。適用対象: Tabs / IconButton / OutlinedTextField / OutlinedSelect の `change`・`input`（`input` は `InputEvent & { currentTarget: … }`）。

### パターンB: CustomEvent で detail を運ぶイベント → detail 型をインライン転記

実装 `.js` の `dispatchEvent(new CustomEvent(...))` から detail の形を転記する（`.d.ts` の `@fires` JSDoc と突合済み。§3 の表の2件のみ）:

```ts
// NavigationBar.ts 内
onNavigationBarActivated: 'navigation-bar-activated' as EventName<
  CustomEvent<{ tab: MdNavigationTab; activeIndex: number }>
>,
// SegmentedButton.ts 内
onSegmentedButtonSetSelection: 'segmented-button-set-selection' as EventName<
  CustomEvent<{ button: MdOutlinedSegmentedButton; selected: boolean; index: number }>
>,
```

（detail の実行時の中身は内部クラス `NavigationTab` / `SegmentedButton` のインスタンスだが、本プロジェクトの DOM 上には `Md〜` 要素しか存在しないため `Md〜` で型付けして実害がない）

### パターンC: ライブラリが型を export しているもの → それを使う

```ts
// Menu.ts 内
import { MdMenu, type CloseMenuEvent } from '@material/web/menu/menu.js';
…
onCloseMenu: 'close-menu' as EventName<CloseMenuEvent>,
```

### パターンD（その他）: ペイロードも発火元プロパティも読まないイベント → 素の string マッピング

`opening` / `opened` / `closing` / `closed` / `remove` / `segmented-button-interaction` / `navigation-tab-interaction` は文字列だけ書く（ハンドラは `(e: Event) => void` になる）。**過剰な型付けをしない**のが方針。

補足:
- `type EventName` / `type CloseMenuEvent` は必ず **type-only import**（`verbatimModuleSyntax: true` のため。値 import すると実行時に存在せず落ちる…ことはないが tsc がエラーにする）
- `Md〜` クラスは `elementClass` に渡す**値 import**。同じ識別子を型位置（`EventName<Event & {currentTarget: MdTabs}>`）で使うのは問題ない
- §3 の表に無いイベント（`update-focus` / `request-activation` / `request-selection` / `navigation-tab-rendered` 等の内部連携イベント）は意図的に非マップ。必要になったら `ref` ＋ `addEventListener` で逃げられる（`ref` は要素インスタンスを返す。§1.1）

---

## 5. ファイル構成と import 規約

```
src/components/md/
  Button.ts          … FilledButton / FilledTonalButton / TextButton
  IconButton.ts      … IconButton
  Icon.ts            … Icon
  Tabs.ts            … Tabs / PrimaryTab
  NavigationBar.ts   … NavigationBar / NavigationTab
  Chips.ts           … ChipSet / FilterChip
  SegmentedButton.ts … OutlinedSegmentedButton / OutlinedSegmentedButtonSet
  Card.ts            … ElevatedCard / FilledCard / OutlinedCard
  Badge.ts           … Badge
  Divider.ts         … Divider
  Elevation.ts       … Elevation
  Ripple.ts          … Ripple
  Progress.ts        … LinearProgress / CircularProgress
  TextField.ts       … OutlinedTextField
  Menu.ts            … Menu / MenuItem
  Select.ts          … OutlinedSelect / SelectOption
  List.ts            … List / ListItem
  index.ts           … 上記全ファイルの named re-export（29点）
```

- 分割単位は「@material/web のディレクトリ単位」（＝一緒に使うものが同居する）。1コンポーネント1ファイルにしないのは、Tabs と PrimaryTab のように単独では意味を成さない組を分ける利益がないため
- 拡張子は **`.ts`**（JSX を含まないため）。oxlint の `react/only-export-components` は JSX コンポーネントファイル向けの警告であり、`.ts` の `createComponent` 戻り値 export には作用しない（現行 `.oxlintrc.json` で警告が出ないことは受け入れ条件1で担保）
- `index.ts` は re-export のみ:

  ```ts
  export { FilledButton, FilledTonalButton, TextButton } from './Button';
  export { IconButton } from './IconButton';
  // …以下17ファイル分
  ```

- **import 規約（他 Issue の実装者向け）**: アプリコードは常に

  ```ts
  import { Tabs, PrimaryTab, Icon } from '../components/md';
  ```

  のようにバレルから import する（相対パスの深さは呼び出し元に依存。パスエイリアスは未導入なので導入しない）。個別ファイル直 import は禁止しないが推奨しない（§2.2 の実測により差はゼロ。規約の一本化が目的）
- `package.json` に `"sideEffects": ["*.css"]` を追加する（§2.2。**本 Issue のスコープ**）

---

## 6. Material Symbols（`md-icon` 用フォント）

### 6.1 読み込み（`index.html`。既存の Noto Sans JP link 群の直後に追加）

```html
<link
  href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=block"
  rel="stylesheet"
/>
```

- **軸は `opsz=24 / wght=400 / FILL=0 / GRAD=0` の単一インスタンスに固定**する。可変レンジ指定（`@20..48,100..700,0..1,-50..200`）にすると可変フォント全体の配信になり無駄に重い。固定インスタンスの woff2 は **313 KB**（今回 CDN 応答の content-length=320,688 bytes を実測）。`md-icon` の既定サイズは 24px（§1.3）なので opsz=24 と一致する
- **`display=block` にする**（Noto Sans JP の `swap` と意図的に変える）。アイコンフォントを swap にするとフォント到着までリガチャ名の生テキスト（"home" 等）がそのまま見えてしまう。block はフォント到着まで最大3秒不可視にする挙動で、アイコン用途の Google 推奨
- **重さの評価**: 313 KB はフォント1本として Noto Sans JP の1サブセット（数十KB × unicode-range 分割）より重いが、(a) `<link rel="stylesheet">` のフォント取得はレンダリングをブロックしない、(b) キャッシュ後はゼロコスト、(c) 適用画面が MVP 段階ではボトムナビ等の限定的な数アイコン、であることから MVP はこれで確定とする。将来 Google Fonts の `icon_names=` パラメータ（使用アイコン名のカンマ区切りを URL に列挙するとそのグリフだけにサブセットされ数KBになる）で削減できるが、**アイコンの採用が各 Issue で流動的な間は保守コスト（使用アイコンと URL の同期）が上回るため今はやらない**。全画面実装が固まる仕上げ段階の Issue で再検討する旨を §9 に引き継ぐ
- FILL 軸を固定したため、選択状態でアイコンを塗りつぶしに切り替える表現（FILL=1）は**使えない**。ボトムナビの active 表現は色（トークン）で行う（Issue 5 への制約として引き継ぎ）

### 6.2 使い方

```tsx
<Icon>trending_up</Icon>                    // リガチャ名を children で渡す
<IconButton><Icon>search</Icon></IconButton> // アイコン系スロットに入れる
```

- アイコン名は Material Symbols のスネークケース名。サイズ変更は CSS 変数 `--md-icon-size`、色は `color`（currentColor 継承）で行う

---

## 7. dev ルート `#/__components`

### 7.1 main.tsx の複数 dev ルート化（最小の一般化）

Issue 1 の単一分岐を「プレフィックス→ローダー」のテーブルに置き換えるだけに留める（Issue 5 のルーティング方式を先取りしない）:

```tsx
// main.tsx の bootstrap() 内。既存の #/__theme 分岐をこの形に置換
if (import.meta.env.DEV) {
  const devRoutes: Record<string, () => Promise<ReactElement>> = {
    '#/__theme': async () => {
      const { ThemeGallery } = await import('./dev/ThemeGallery');
      return <ThemeGallery />;
    },
    '#/__components': async () => {
      const { ComponentGallery } = await import('./dev/ComponentGallery');
      return <ComponentGallery />;
    },
  };
  const match = Object.entries(devRoutes).find(([prefix]) => location.hash.startsWith(prefix));
  if (match) {
    root.render(
      <StrictMode>
        <ThemeProvider>{await match[1]()}</ThemeProvider>
      </StrictMode>,
    );
    return;
  }
}
```

- `import.meta.env.DEV` のリテラル分岐内に**動的 import を直接書く**形を維持すること。Vite が本番ビルドで `false` に静的置換 → ブランチごと除去 → `ComponentGallery` チャンク自体が emit されない（Issue 1 §7 で確立済みの本番除外機構。ローダーテーブルを分岐の外に括り出すと除去が壊れるので不可）
- アクセスは `http://localhost:5173/#/__components`

### 7.2 ComponentGallery の内容（`src/dev/ComponentGallery.tsx`）

ThemeProvider 配下で描画される（7.1 の構造上自動的に被る）ため、全コンポーネントに MD3 トークンが効いた状態で表示される。以下のセクションで構成:

1. **登録チェック表**: 29タグ名の配列（ギャラリー内にローカル定数として保持。dev 専用ファイルなので重複定義を許容）を `customElements.get(tag)` で走査し、タグ名と 定義済み/未定義 を一覧表示。全行「定義済み」であることが受け入れ条件2の機械確認になる
2. **Tabs デモ（完了条件3の検証区画)**: `<Tabs onChange={…}>` に PrimaryTab を3枚（例: 順位分布/総合成績/立直統計）。`useState` で受けた `e.currentTarget.activeTabIndex` を **`選択中: N`** とタブの下にテキスト表示する。クリックで N が変わることが「change イベントを React ハンドラで受け取れた」ことの目視証拠
3. **ボタン**: FilledButton / FilledTonalButton / TextButton / IconButton（toggle 指定で onChange の発火回数を並記）
4. **アイコン**: `<Icon>home</Icon>` `<Icon>search</Icon>` `<Icon>trending_up</Icon>` 等5個程度 ＋ 「この行が文字列に見えたらフォント未読込」の注記（受け入れ条件7の目視点）
5. **ナビ**: NavigationBar ＋ NavigationTab 3枚（label と Icon スロット）。`onNavigationBarActivated` で activeIndex を表示。うち1枚は `showBadge` / `badgeValue="3"` プロパティでバッジを表示する（`md-navigation-tab` のスロットは `active-icon` / `inactive-icon` の2つのみでデフォルトスロットが無いため——`navigationtab/internal/navigation-tab.js` の `<slot>` で確認済み——、Badge を子要素として置いても light DOM に取り残されて描画されない。`showBadge`/`badgeValue` は内部で `<md-badge>` を自前描画する正規 API であり、これを使う）。Badge 単体の描画確認は別途 `position: relative` な枠内に単独配置して行う（`md-badge` は shadow 内で `position: absolute` を使うため relative な親が必須。10. 素材系の Elevation デモと同じ作法）
6. **選択系**: ChipSet＋FilterChip 3枚（onClick で selected 読み取り表示、onRemove 動作確認用に removable 1枚）、OutlinedSegmentedButtonSet＋OutlinedSegmentedButton 3枚（onSegmentedButtonSetSelection で index 表示）
7. **カード**: ElevatedCard / FilledCard / OutlinedCard を横並び（中に List＋ListItem を入れ、要件 §4.3 の「ラベル＋値＋サブテキスト」形式のサンプル: 例 ツモ率 36.54% / supporting-text「和了回数比」）
8. **進行**: LinearProgress（determinate `value=0.6` と `indeterminate`）、CircularProgress（同2種）
9. **入力**: OutlinedTextField（label・onInput で値エコー）、OutlinedSelect＋SelectOption 3個（onChange で value 表示）、Menu＋MenuItem（`md-menu` は `anchor` プロパティに要素 id を渡す方式で anchor ボタンとの位置合わせを行うが、**anchor のクリックだけでは開かない**。開閉は `open` プロパティを React state で制御し、anchor ボタンの `onClick` で `open` を切り替え、`Menu` の `onClosed` で state を追従させる。onCloseMenu で選択結果表示。加えて `md-menu` の既定 `positioning="absolute"` は anchor と共通の `position: relative` な祖先を要求するため、anchor と Menu を包む div に `position: relative` を付ける）
10. **素材系**: Divider、`position:relative` の枠に Elevation（`--md-elevation-level: 2`）、Ripple（`for` 無しで親要素に反応）を敷いたデモ

これで29点全てがいずれかのセクションで実 DOM に描画される。

---

## 8. 受け入れ条件（検収チェックリスト)

前提: `npm ci` 済み。dev 確認は `npm run dev` の URL に対して行う。

1. **ビルド・lint**: `npm run build`（`tsc -b` 込み）と `npm run lint` がともに exit code 0。oxlint の警告（`react/only-export-components` 含む）が新規に増えていない
2. **29点描画と登録**: `#/__components` を実ブラウザで開き、(a) §7.2 の全セクションが描画されエラーが無い（DevTools Console にエラー0）、(b) 冒頭の登録チェック表が29行すべて「定義済み」。ダメ押しに Console で `customElements.get('md-tabs')` 等任意の数タグを叩き、クラスが返ることを確認
3. **tabs の change**: Tabs デモのタブを順にクリックし、「選択中: N」の N がクリックしたタブの index に追従する。矢印キーでのタブ移動でも追従する
4. **生タグ直書きゼロ**: `git grep -n '<md-' -- src` が**0件**であること。ラッパー定義ファイルは `tagName: 'md-…'` という文字列であり `<md-` を含まないため、機械的に除外される（docs/ は Issue 引用を含みうるため pathspec で `src` に限定するのが除外方法）
5. **本番バンドルから dev ルート除外**: `npm run build` 後、`grep -ril 'ComponentGallery\|__components' dist/` が何もヒットしない。`npm run preview` で `#/__components` を開くと通常アプリが表示される（Issue 1 受け入れ条件10と同方式）
6. **バンドルサイズ（バレル論点の結論どおりであること）**: 以下2段で確認
   - (a) 通常ビルド: 本番コードはラッパー未使用のため、`npm run build` の JS が **gzip 80 kB 以下**（ベースライン実測 74.50 kB ＋余裕。29点分が紛れ込むと 115 kB 超になるので明確に判別可能）
   - (b) ツリーシェイク実証: `src/App.tsx` に一時的に `import { FilledButton } from './components/md';` を足して `<FilledButton>test</FilledButton>` を描画し `npm run build`。JS が **gzip 95 kB 以下**（実測 88.49 kB。バレルが漏れると 115.69 kB 以上になる）かつ `grep -c 'md-tabs' dist/assets/*.js` が 0、`grep -c 'md-filled-button' dist/assets/*.js` が 1 以上。確認後 App.tsx を**必ず元に戻し**、`git status` で差分が無いこと
   - (c) `package.json` に `"sideEffects": ["*.css"]` が存在すること
7. **Material Symbols**: `#/__components` のアイコン行が「home」等の生テキストでなくアイコングリフで描画される。DevTools Network で `fonts.gstatic.com` から `materialsymbolsoutlined` を含む woff2（約313KB）の取得があり、`index.html` の link が `display=block`・軸 `@24,400,0,0` 固定であること
8. **テーマ追従**: `#/__components` を開いたまま OS のダーク設定（またはローカルストレージ `mjsv:color-mode`）を切り替えると、ボタン・カード等の色がライト/ダークで追従する（ThemeProvider 配下で描画されている証拠）
9. **型・規約**: ラッパー全ファイルで (a) `EventName` / `CloseMenuEvent` が type-only import、(b) `events` の型付けが §4 のパターン通り、(c) `@material/web` の import が `.js` 拡張子付き、であることをコードレビューで確認

---

## 9. 後続 Issue への引き継ぎ事項

- **Issue 5（アプリシェル・ボトムナビ)**: ボトムナビは `NavigationBar`＋`NavigationTab`（`onNavigationBarActivated` の `detail.activeIndex` でルート切替）、タブ内ナビは `Tabs`＋`PrimaryTab`（`onChange` → `e.currentTarget.activeTabIndex`）を §3・§4 の型のまま使える。**FILL 軸固定のためアイコンの塗り切替は不可**（§6.1）。active 表現は NavigationBar 標準のインジケータと色に任せること。main.tsx の devRoutes 分岐はルーター導入後もそのまま残してよい（Issue 1 §10 と同方針）
- **Issue 14（スタッツタブ)**: `List`／`ListItem` は headline／`slot="supporting-text"`（分母注記）／`slot="end"`（値）で要件 §4.3 の形式を組む。ギャラリー §7.2-7 にサンプルあり
- **全 Issue 共通**: 新しい md コンポーネントが必要になったら (1) §5 の該当カテゴリファイルに追記（無ければ新ファイル）、(2) index.ts に re-export 追加、(3) ComponentGallery に描画サンプル追加、(4) 受け入れ条件2の登録チェック表の配列にタグ名追加、の4点セットで行う。`all.js` と bare 副作用 import は引き続き禁止（§2.2 の規約）
- **仕上げ段階**: Material Symbols の `icon_names=` サブセット化（§6.1。使用アイコン確定後に 313 KB → 数 KB へ削減可能）
