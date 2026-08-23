# Issue 8 設計書: サマリーカード1 — アイデンティティ（段位・pt・昇降条件）

作成日: 2026-08-24
対象 Issue: #8 サマリーカード1: アイデンティティ（段位・pt・昇降条件）
依存: #4（ドメイン計算）/ #5（アプリシェル）/ #6（グローバルフィルタ）— いずれもマージ済み
前提資料: `docs/requirements.md` §4.1・§5.3・§6.4・§6.6 / `docs/design/issue-4-domain-logic.md`（昇降条件の計算仕様）/ `docs/design/issue-5-app-shell.md` §3.10（引き継ぎ）/ `docs/design/issue-6-global-filter.md` §8（引き継ぎ）

---

## 0. 結論サマリ（先に読む）

1. **Issue #8 の担当範囲は「`PlayerLayout` の hero 領域を正式な `IdentityCard` に差し替えること」と「サマリータブに `SummaryPanel`（カード1のみ）を追加すること」の2点**。hero 領域には段位・pt・昇降条件を置き、サマリータブ layer 部には「カード1以外は後続 Issue」のプレースホルダを置く
2. **`identity` は `usePlayerScope().identity`（`useCurrentIdentity` 由来）を使う。`stats.stats.level` は絶対に使わない**（要件 §5.3。理由: `player_stats.level` はクエリ範囲内のスナップショットなので、フィルタを変えると古い段位が出る）
3. **昇降条件は `preferredMode(lv.id)` で求まる「入れる最上の卓・半荘」を基準に計算する**。要件はモードの指定を求めていないが、プレイヤーが実際に対局するモードで計算するのが最も実用的。複数モードが入れる段位（雀豪以上）では「最上」1種だけを表示する（より有利な条件の見やすさ優先）
4. **昇降条件は成立するものだけ表示する**（`kind: 'never'` は非表示）。全て `'never'` のとき（初心〜雀士・魂天20 など）は条件エリア自体を非表示にする
5. **順位グラフ枠は `aria-label` 付きの `role="img"` プレースホルダ**とし、承諾後に差し替えやすい単一の div コンテナとして置く
6. **`useTheme().setRank()` をここで初めて呼ぶ**（issue-5/6 の引き継ぎ）。`identity.kind === 'ready'` になったタイミングで `rankFromLevelId(identity.identity.level.id)` を渡す

---

## 1. 既存コードの確認（ここに手を加える箇所の実物確認）

### 1.1 `PlayerLayout.tsx` の現在の hero（差し替え対象）

`src/shell/PlayerLayout.tsx` 内の `PlayerLayoutInner`：

```tsx
let nicknameDisplay = `プレイヤー: ${rawId}`;
let levelDisplay = '読み込み中...';

if (identity.kind === 'ready') {
  nicknameDisplay = identity.identity.nickname;
  levelDisplay = formatLevelWithDelta(identity.identity.level);
} else if (identity.kind === 'notFound') {
  levelDisplay = 'プレイヤーが見つかりませんでした';
} else if (identity.kind === 'error') {
  levelDisplay = identity.message;
}

const heroContent = (
  <div className="player-hero">
    <div className="md-typescale-headline-small">{nicknameDisplay}</div>
    <div className="md-typescale-body-medium" data-testid="identity-level">
      {levelDisplay}
    </div>
    <FilterBar ... />
  </div>
);
```

これを `<IdentityHero identity={identity} />` コンポーネントで置き換える。`FilterBar` は `IdentityHero` の子として維持する（既存レイアウト構造を保つ。§3.2）。

`data-testid="identity-level"` は issue-6 の受け入れ条件 C5 が参照している（「フィルタを変えても本カードは変化しない」の検証対象）。**この `data-testid` は必ず残す**。段位タグ＋pt の文字列（`formatLevelWithDelta(lv)` 相当）が入る要素に付け続ける。

### 1.2 `AppRouter.tsx` の現在のサマリールート（差し替え対象）

```tsx
{VISIBLE_TABS.map((tab) => (
  <Route key={tab.id} path={tab.id} element={<PlaceholderPanel tab={tab.id} />} />
))}
```

`summary` タブだけを `<SummaryPanel />` に差し替え、他のタブは引き続き `<PlaceholderPanel>` のままにする。

### 1.3 `src/domain/transitions.ts` の公開型（使用する関数）

```ts
export type RankCondition =
  | { rank: number; kind: 'always' }
  | { rank: number; kind: 'never' }
  | { rank: number; kind: 'atLeast'; score: number }
  | { rank: number; kind: 'atMost'; score: number };

export function promotionConditions(lv: LevelWithDelta, mode: GameMode): RankCondition[];
export function demotionConditions(lv: LevelWithDelta, mode: GameMode): RankCondition[];
```

### 1.4 `src/domain/growth.ts` の公開型（使用する関数）

```ts
export function preferredMode(levelId: number): GameMode | null;
// 入れる最上の卓・半荘。初心・雀士は null を返す
```

初心・雀士（`preferredMode` が `null`）は昇降条件・昇段残pt・段位ポイント表示も「まだ段位戦に入れません」相当の表示になる。段位戦に入れない段位では `getMaxPoint` が 20/80 で 0 ではないが、`LEVEL_ALLOWED_MODES` が `[]` なので計算に意味がない。→ `preferredMode(lv.id) === null` の場合は条件エリア・残pt を非表示にする。

### 1.5 `src/domain/level.ts` の公開型（使用する関数）

```ts
export function formatLevelWithDelta(lv: LevelWithDelta): string;   // '雀傑2 232/1400'
export function getLevelTagFromId(levelId: number): string;           // '雀傑2'
export function currentPoint(lv: LevelWithDelta): number;            // score + delta
export function getMaxPoint(level: Level): number;                    // 0 = 上限なし
export function getVersionAdjustedLevel(level: Level): Level;
export function getVersionAdjustedScore(level: Level, score: number): number;
export function parseLevelId(levelId: number): Level;
```

残pt = `getMaxPoint(getVersionAdjustedLevel(parseLevelId(lv.id))) - getVersionAdjustedScore(parseLevelId(lv.id), currentPoint(lv))`。  
上限 0（魂天20）のときは残pt 非表示。

### 1.6 `src/theme/seeds.ts` / `ThemeProvider.tsx`（`setRank` 呼び出し）

```ts
export function rankFromLevelId(levelId: number | undefined): RankKey | null;
// 3=ketsu / 4=gou / 5=sei / majorRank>=6=konten / それ以外=null

export function useTheme(): ThemeContextValue;
// .setRank(rank: RankKey | null): void
```

`useEffect` で `identity.kind === 'ready'` のとき `setRank(rankFromLevelId(identity.identity.level.id))` を呼ぶ。`identity` が `loading` / `notFound` / `error` のときは `setRank(null)`（既定シードに戻す）。  
deps は `[identity.kind, identity.kind === 'ready' ? identity.identity.level.id : null, setRank]`。

### 1.7 既存 CSS の確認

`src/shell/shell.css`：

```css
.layered-sheet__hero {
  background-color: var(--md-sys-color-surface-container-high);
  color: var(--md-sys-color-on-surface);
  min-height: 180px;
  padding: 24px 16px 48px;
}
```

ヒーロー背景は `--md-sys-color-surface-container-high`（issue-5 §3.6 確定）。**本 Issue では `shell.css` を変更しない**。`summary.css` を新設してカード固有のスタイルだけを置く。

---

## 2. 設計

### 2.1 コンポーネント構成

```
PlayerLayout（既存）
 └─ LayeredSheet hero=<IdentityHero identity={identity} filterBar={<FilterBar ...>} />
     └─ TabTransition → Outlet
         [summary] SummaryPanel（新規）
             └─ IdentityCard（新規・layer 上部に置く）
             └─ PlaceholderCards x4（カード2〜5のプレースホルダ）
         [compare] PlaceholderPanel（既存）
         [stats]   PlaceholderPanel（既存）
```

**IdentityHero**（新規）: `PlayerLayout` 内 hero 領域の中身。段位・pt・昇降条件・順位グラフ枠を表示する。`FilterBar` をその直下に配置する（hero は sticky なので FilterBar も画面上部に固定される）。

**SummaryPanel**（新規）: サマリータブのルートコンポーネント。`usePlayerScope()` で scope を取り、カード1（`IdentityCard`）と後続カードのプレースホルダを layer 内に置く。

**IdentityCard**（新規）: layer 内カード1のシェル。hero とは異なり layer（`--md-sys-color-surface` 背景）上に乗る。カード1の情報を再掲するか、layer 側は「カード2以降へのエントリポイント」に留めるか → **カード1はヒーロー hero 領域に置く**（要件 §4.1 "層状シートのヒーロー領域"）。layer 側の `IdentityCard` は省略し `SummaryPanel` はカード2〜5のプレースホルダだけを置く。

> **上記の設計判断（重要）**: 要件 §4.1 の「層状シートのヒーロー領域として」という記述に従い、カード1のUI はすべて hero 領域に収める。layer 側のサマリータブは将来のカード2〜5の置き場所として空の骨格だけを置く。

### 2.2 `IdentityHero` の表示要素

| 要素 | 表示内容 | 型 |
|---|---|---|
| ニックネーム | `identity.identity.nickname` | `md-typescale-headline-small`（既存 `.player-hero` に合わせる） |
| 段位タグ＋pt | `formatLevelWithDelta(identity.identity.level)` → `'雀傑2 232/1400'` | `md-typescale-body-medium`、`data-testid="identity-level"` は**維持** |
| 段位タグ（大） | `getLevelTagFromId(identity.identity.level.id)` | `md-typescale-display-small`（大きな数値。要件 §3 "Display/Headline級"） |
| 残pt | `上限pt − currentPoint(lv)`（上限 0・`preferredMode` null のとき非表示） | `md-typescale-headline-large` |
| 昇降条件バッジ | `promotionConditions` / `demotionConditions` の `kind !== 'never'` のもの（§2.3） | `md-typescale-label-medium` |
| 順位グラフ枠 | `role="img" aria-label="順位グラフ（承諾後実装）"` のプレースホルダ div | — |
| FilterBar | 既存の `<FilterBar>` | （変更なし） |

**ローディング状態**: `identity.kind === 'loading'` のとき skeleton（透明な rect アニメーション）を 3 段表示する。`aria-busy="true"` で補助技術に通知する。`min-height: 180px`（`.layered-sheet__hero` の既定値）は維持する。

**エラー・notFound 状態**: エラー文言を `--md-sys-color-error` で表示。`FilterBar` は引き続き描画する（期間を変えれば直るケースがあるため）。

### 2.3 昇降条件の文言生成規則

```
モード = preferredMode(lv.id)
  null → 条件エリア全体を非表示

プロモーション条件:
  kind === 'always'   → '<N位>'
  kind === 'atLeast'  → '<N位> <score>点以上'
  kind === 'never'    → 表示しない

デモーション条件:
  kind === 'always'   → '<N位>'
  kind === 'atMost'   → '<N位> <score>点以下'
  kind === 'never'    → 表示しない

表示セクション:
  promotion に1件以上 → '昇格' ラベル ＋ 条件リスト
  demotion に1件以上  → '降格' ラベル ＋ 条件リスト
  両方 0 件           → 条件エリア全体を非表示（魂天20 / 入室不可段位）
```

順位ラベル: 四麻=`['1位','2位','3位','4位']` / 三麻=`['1位','2位','3位']`。`numPlayersForMode(mode)` で選択する。  
スコアは `toLocaleString('ja-JP')` でカンマ区切り表示（`84,100` など）。

### 2.4 `setRank` の呼び出しタイミング

`PlayerLayoutInner` 内で `useEffect` を1つ追加する。

```ts
const { setRank } = useTheme();

useEffect(() => {
  if (identity.kind === 'ready') {
    setRank(rankFromLevelId(identity.identity.level.id));
  } else if (identity.kind === 'notFound' || identity.kind === 'error') {
    setRank(null);
  }
  // 'loading' では何もしない（前の rank を維持する）
}, [identity.kind, identity.kind === 'ready' ? identity.identity.level.id : undefined, setRank]);
```

deps の書き方が少し複雑なので型エラーに注意する（§5 参照）。

### 2.5 `SummaryPanel` のレイアウト

layer 側（`--md-sys-color-surface` 上）にカード列を置く。Issue #8 のスコープはカード1（情報はheroに集約済み）なので、layer 内は「カード1は上部 hero を参照してください」的なプレースホルダではなく、**将来のカード2〜5のためのスロット**を空 div で示すだけにする。

```tsx
// SummaryPanel.tsx（Issue 8 の時点）
export function SummaryPanel(): ReactElement {
  return (
    <div className="summary-panel" data-testid="summary-panel">
      {/* カード2〜5は後続 Issue で実装 */}
      <PlaceholderCard label="成績（Issue 9以降）" />
      <PlaceholderCard label="打ち筋（Issue 10以降）" />
      <PlaceholderCard label="主要スタッツ（Issue 11以降）" />
      <PlaceholderCard label="和銃分布（Issue 12以降）" />
    </div>
  );
}
```

`PlaceholderCard` はこのファイル内のローカルコンポーネント（公開しない）。`summary-panel` の `data-testid` を受け入れ条件で使う。

---

## 3. モジュール構成と公開シグネチャ

### 3.1 追加ファイル

| ファイル | 種別 | 内容 |
|---|---|---|
| `src/summary/IdentityHero.tsx` | 新規 | hero 領域コンポーネント |
| `src/summary/SummaryPanel.tsx` | 新規 | サマリータブのルートコンポーネント |
| `src/summary/summary.css` | 新規 | カード固有スタイル |

### 3.2 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `src/shell/PlayerLayout.tsx` | `heroContent` を `<IdentityHero>` に差し替え。`setRank` の `useEffect` を追加 |
| `src/shell/AppRouter.tsx` | `summary` ルートの `element` を `<SummaryPanel />` に差し替え |
| `docs/ui-verification/` | `2026-08-24-issue-8-identity.md` を新規作成（§5.3 参照） |

**変更しない**: `src/shell/shell.css`（hero のスタイルは既存のまま）/ `src/filters/**`（フィルタロジックは変更しない）/ `src/domain/**`（ドメイン関数は変更しない）/ `src/api/**`

### 3.3 `src/summary/IdentityHero.tsx` の公開シグネチャ

```ts
import type { ReactElement, ReactNode } from 'react';
import type { CurrentIdentityState } from '../filters/useCurrentIdentity';

export interface IdentityHeroProps {
  identity: CurrentIdentityState;
  /** FilterBar を受け取って hero 下部に描画する */
  filterBar: ReactNode;
}

/** hero 領域の中身（PlayerLayout から LayeredSheet の hero prop に渡す） */
export function IdentityHero(props: IdentityHeroProps): ReactElement;
```

### 3.4 `src/summary/SummaryPanel.tsx` の公開シグネチャ

```ts
import type { ReactElement } from 'react';

/** サマリータブのルートコンポーネント。usePlayerScope() で scope を取る */
export function SummaryPanel(): ReactElement;
```

`usePlayerScope()` を内部で呼ぶ。`scope.identity` は hero 側でも参照されているが、レンダリングはそれぞれ独立で問題ない（React context / Outlet context 経由で同じインスタンスが参照される）。

---

## 4. CSS 設計（`src/summary/summary.css`）

色はすべて `--md-sys-color-*` を参照する（CLAUDE.md 制約5）。HEX を書かない。

```css
/* IdentityHero —— hero 内の表示 */
.identity-hero {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.identity-hero__nickname {
  /* md-typescale-headline-small は shell.css 側の .player-hero で使われていたクラスと揃える */
}

.identity-hero__level-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
}

.identity-hero__level-tag {
  /* md-typescale-display-small を付与する。追加 CSS は不要 */
}

.identity-hero__pt {
  /* md-typescale-headline-large を付与する */
  color: var(--md-sys-color-on-surface);
}

.identity-hero__remaining {
  color: var(--md-sys-color-on-surface-variant);
}

.identity-hero__remaining-value {
  font-weight: bold;
  color: var(--md-sys-color-on-surface);
  margin: 0 2px;
}

/* 昇降条件 */
.identity-conditions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.identity-conditions__label {
  /* md-typescale-label-small */
  color: var(--md-sys-color-on-surface-variant);
  min-width: 2em;
}

.identity-conditions--promotion .identity-conditions__label {
  color: var(--md-sys-color-primary);
}

.identity-conditions--demotion .identity-conditions__label {
  color: var(--md-sys-color-error);
}

.identity-conditions__list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.identity-conditions__item {
  background-color: var(--md-sys-color-surface-container);
  color: var(--md-sys-color-on-surface);
  border-radius: 8px;
  padding: 2px 8px;
}

.identity-conditions--promotion .identity-conditions__item {
  background-color: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
}

.identity-conditions--demotion .identity-conditions__item {
  background-color: var(--md-sys-color-error-container);
  color: var(--md-sys-color-on-error-container);
}

/* 順位グラフプレースホルダ */
.identity-hero__rank-graph {
  min-height: 64px;
  border-radius: 12px;
  border: 1px dashed var(--md-sys-color-outline-variant);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--md-sys-color-on-surface-variant);
}

/* ローディング Skeleton */
.identity-hero--loading .identity-hero__skeleton {
  background-color: var(--md-sys-color-surface-container-highest);
  border-radius: 8px;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.identity-hero__skeleton--title  { height: 28px; width: 60%; margin-bottom: 4px; }
.identity-hero__skeleton--level  { height: 40px; width: 80%; }
.identity-hero__skeleton--pt     { height: 20px; width: 40%; }

/* SummaryPanel */
.summary-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.summary-placeholder-card {
  padding: 20px 16px;
  border-radius: 12px;
  background-color: var(--md-sys-color-surface-container-low);
  color: var(--md-sys-color-on-surface-variant);
}

/* visually-hidden（スクリーンリーダー専用） */
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (prefers-reduced-motion: reduce) {
  .identity-hero__skeleton {
    animation: none !important;
  }
}
```

---

## 5. 実装上の注意点

### 5.1 `useEffect` の deps（`setRank`）

`setRank` は `ThemeProvider` の `useCallback((...) => ..., [])` から来るため参照安定（deps に入れても問題ない）。ただし TypeScript は lint で `exhaustive-deps` を強制しない（oxlint は react-hooks/exhaustive-deps を持つが本プロジェクト設定を確認すること）。`setRank` を deps に含めれば安全。

正確な書き方（`identity.kind === 'ready'` の条件分岐で levelId を安全に取り出す）:

```ts
const levelId = identity.kind === 'ready' ? identity.identity.level.id : undefined;

useEffect(() => {
  if (identity.kind === 'ready' && levelId !== undefined) {
    setRank(rankFromLevelId(levelId));
  } else if (identity.kind === 'notFound' || identity.kind === 'error') {
    setRank(null);
  }
}, [identity.kind, levelId, setRank]);
```

### 5.2 `md-typescale-*` クラスの適用

`@material/web/typography/md-typescale-styles.css` を `src/main.tsx` が import している（CLAUDE.md 制約6）。クラス名をそのまま className に書けば使える。追加 import 不要。

確認が必要なクラス名（実在確認済み）:
- `md-typescale-display-small` / `md-typescale-headline-large` / `md-typescale-headline-medium` / `md-typescale-headline-small`
- `md-typescale-body-large` / `md-typescale-body-medium` / `md-typescale-label-medium` / `md-typescale-label-small`

### 5.3 `import './summary.css'` は CLAUDE.md 制約1のスコープ内

`package.json` の `"sideEffects": ["*.css"]` に該当するため、このファイル内での `import './summary.css'` は本番ビルドで除去されない唯一の bare import として許可される。`IdentityHero.tsx` または `SummaryPanel.tsx` のどちらか1箇所でのみ import すること（重複して import してもバンドラが dedup するが、明確性のため1箇所）。

### 5.4 `preferredMode` が `null` のケース

初心・雀士は `LEVEL_ALLOWED_MODES` が `[]` で `preferredMode` が `null` を返す。この場合:
- 昇降条件エリア → 非表示
- 残pt → 非表示（`preferredMode` null = まだ段位戦に入れないので表示しても無意味）
- 段位タグ・pt は通常通り表示（`getLevelTagFromId` / `formatLevelWithDelta` は初心・雀士でも動作する）

### 5.5 `currentPoint` の値域

`currentPoint(lv) = lv.score + lv.delta`。実装は `src/domain/level.ts` に存在する。`getVersionAdjustedScore` は majorRank 6（旧魂天）のスコールを現行スケールに変換する。必ず `getVersionAdjustedScore(parseLevelId(lv.id), currentPoint(lv))` の順で呼ぶこと（`formatLevelWithDelta` の実装と同じパターン）。

残pt の表示は `調整後の上限pt − 調整後の現在pt`。負にはならないはずだが、`Math.max(0, remaining)` でクランプしておくこと（万一の不整合で UI が壊れないため）。

---

## 6. 受け入れ条件（検収担当はこれを1項目ずつ実行する）

### A. 静的検証

| # | 実行 | 合格 |
|---|---|---|
| A1 | `npm run build` | 型エラー 0 で exit 0 |
| A2 | `npm run lint` | エラー0・警告0 |
| A3 | `npm test` | 全テスト通過（既存テストに変化なし） |
| A4 | `grep -rn "<md-" src/summary/ --include=*.tsx` | **0件**（生タグ禁止。CLAUDE.md 制約3） |
| A5 | `grep -rniE "#[0-9a-f]{3,8}\b" src/summary/summary.css` | **0件**（色ハードコード禁止。制約5） |
| A6 | `grep -rn "stats\.stats\.level\|stats\.level" src/summary/` | **0件**（`identity` 以外から段位を取らない。要件 §5.3） |
| A7 | `git diff --name-only main` | `src/summary/`・`src/shell/PlayerLayout.tsx`・`src/shell/AppRouter.tsx`・`docs/ui-verification/` のみ含む。`src/domain/`・`src/api/`・`src/filters/`・`src/components/` が含まれない |
| A8 | `grep -rn "setRank" src/shell/PlayerLayout.tsx` | **1件以上**（`setRank` 呼び出しが追加されている） |

### B. 機能検証（`npm run dev` → ブラウザペイン）

事前準備: 実在プレイヤーID を用意する（**設計書・PR 本文・コミットメッセージにプレイヤー ID・ニックネームを書かない**）。

| # | 実行 | 合格 |
|---|---|---|
| B1（プレイヤー名表示） | `#/4/player/<id>/summary` を開く | `document.querySelector('[data-testid="identity-hero"]')` が存在する。identity 解決後にニックネームが表示される |
| B2（段位・pt）| identity が ready になった後 | `document.querySelector('[data-testid="identity-level"]').textContent` が `'雀傑2 232/1400'` のような形式（`getLevelTag + ' ' + 'pt/上限'` 形式）になっている |
| B3（大きな段位タグ）| 同上 | `data-testid="identity-level-tag"` の要素が存在し、段位タグ文字列（例 `'雀傑2'`）を含む |
| B4（残pt）| 雀傑2（上限1400）の場合 | `data-testid="identity-remaining"` が存在し、`'昇段まで'` テキストと数値が含まれる。魂天20（上限0）のプレイヤーでは非表示（要素が DOM に存在しない） |
| B5（昇降条件の有無） | 昇降条件が成立するプレイヤーで | `data-testid="identity-conditions"` が存在し、`昇格` または `降格` ラベルが表示される |
| B6（昇降条件の非表示） | 初心・雀士のプレイヤーで、または昇降条件が全て `never` の場合 | `data-testid="identity-conditions"` が DOM に存在しないか、空表示にならない（条件バッジが 0 のとき条件エリア自体を非表示） |
| B7（フィルタ変更で不変） | identity 解決後に `[data-testid="identity-level"]` のテキストを記録し、期間チップを「90日」に変える | テキストが変化しない（issue-6 C5 の再検証） |
| B8（モード変更で不変） | B7 に続き、モードチップを 1 つ追加/除去する | 同様にテキストが変化しない |
| B9（テーマカラー変化） | identity 解決後に `document.documentElement.style.getPropertyValue('--md-sys-color-primary')` を記録し、別の段位のプレイヤーに切り替える | 値が変化する（`setRank` が効いている）。なお同じ `RankKey` なら変化しなくてよい |
| B10（ローディング表示） | ネットワーク速度を遅延させて `/summary` を開く | `data-testid="identity-hero"` に `aria-busy="true"` が付いている、または skeleton 要素が存在する |
| B11（順位グラフ枠）| identity 解決後 | `data-testid="identity-rank-graph"` が存在し、`role="img"` と `aria-label="順位グラフ（承諾後実装）"` を持つ |
| B12（サマリーパネル存在）| summary タブを開く | `data-testid="summary-panel"` が DOM に存在する |
| B13（他タブへの非影響）| サマリーから compare / stats タブに移動する | `data-testid="identity-hero"` が消えない（hero は LayeredSheet に属し、タブ切替では消えない）。タブコンテンツのみ切り替わる |
| B14（light/dark 両対応）| `localStorage.setItem('mjsv:color-mode', 'dark')` → リロード | 昇格バッジが `--md-sys-color-primary-container`、降格バッジが `--md-sys-color-error-container` 由来の色になっており、ライトとダークで **`backgroundColor` の値が異なる** |
| B15（コンソールエラー）| B1〜B14 を通して | `read_console_messages` でエラー 0 件 |

### C. オーナーへの UI 検証逆発注

`docs/ui-verification/2026-08-24-issue-8-identity.md` を作成し、以下を委託する（PR を作成してよいが、PR 本文に未回収である旨を記載すること）。

- **C1**: 段位タグ（大）・pt・残pt の数値の視認性・フォントサイズの妥当性
- **C2**: 昇格・降格バッジの色（primary-container / error-container）が視覚的に分かりやすいか
- **C3**: スクロール時に hero が sticky してフィルタバーと段位情報が追随する体感
- **C4**: ローディング中の skeleton アニメーションが不自然でないか（`prefers-reduced-motion` 時は静止する）
- **C5**: 順位グラフのプレースホルダ枠が「未実装エリア」として視覚的に明確か

---

## 7. 後続 Issue への引き継ぎ

| 宛先 | 内容 |
|---|---|
| #9〜12（カード2〜5） | `SummaryPanel.tsx` の `PlaceholderCard` を本実装に差し替える。`usePlayerScope().stats` からデータを取る。hero 領域（`IdentityHero`）は変更しない |
| 承諾後（順位グラフ） | `data-testid="identity-rank-graph"` の div を本実装に差し替える。`player_records` エンドポイントが必要なため承諾後の別 Issue |
| 段位シード調整 | `src/theme/seeds.ts` の `RANK_SEEDS` を1行変えるだけで全段位の配色が変わる。`setRank` の呼び出しはすでに本 Issue で行うので、シード色の見直しは seeds.ts の編集のみで完結する |
| 全タブ共通 | `setRank` は `PlayerLayoutInner` で呼ぶため、各タブが独自に呼ばないこと。また各タブは `usePlayerScope().identity.identity.level` を段位表示に**使わない**（フィルタ影響下の `stats.stats.level` と同様の誤りになる） |

---

## 8. 実挙動未確認の箇所（推定で書いた部分）

1. **`useTheme()` を `PlayerLayoutInner` の中で使うことの可否**: `ThemeProvider` は `src/main.tsx` から wrapping しているため、`PlayerLayout` より外側にある。`useTheme()` は `ThemeContext` を消費するだけなので、Provider の子孫であれば問題ないはず。製造中に `null context` エラーが出た場合は Provider の配置を確認すること
2. **skeleton の `animation` がブラウザペインの `document.visibilityState === 'hidden'` 制約で停止する**: issue-5 §6 の既知制約と同じ。`prefers-reduced-motion: reduce` の設定でも停止する。どちらも「コードの欠陥」ではない
3. **`md-typescale-display-small` がフォント実装済みかどうか**: `md-typescale-styles.css` に `display-small` クラスが存在することは `node_modules` の実物を確認していない（他クラスは使用例があるが `display` 系は本プロジェクト初）。製造時に確認し、存在しなければ `headline-large` に降格する
4. **段位タグと pt を同一行（`flex-wrap`）に並べたときの折返し**: 長い段位タグ（「魂天3 2.0/20.0」など）では想定以上に幅を取る可能性がある。C1 の UI 検証で確認する

---

## 9. 作業ログ（設計時に読んだ実物）

- `src/shell/PlayerLayout.tsx` — hero 差し替え箇所と `data-testid="identity-level"` の存在を確認
- `src/shell/AppRouter.tsx` — サマリールートの現在の element を確認
- `src/filters/useCurrentIdentity.ts` — `CurrentIdentityState` 型と deps 規則を確認
- `src/filters/playerScope.ts` — `usePlayerScope()` のシグネチャを確認
- `src/domain/transitions.ts` — `RankCondition` 型・`promotionConditions`・`demotionConditions` を確認
- `src/domain/growth.ts` — `preferredMode` のシグネチャ・`null` の条件（初心・雀士）を確認
- `src/domain/level.ts` — `formatLevelWithDelta`・`getLevelTagFromId`・`currentPoint`・`getMaxPoint`・`getVersionAdjustedLevel`・`getVersionAdjustedScore`・`parseLevelId` を確認
- `src/theme/ThemeProvider.tsx` — `useTheme()`・`setRank` のシグネチャを確認
- `src/theme/seeds.ts` — `rankFromLevelId`・`RankKey` を確認
- `src/domain/levelConstants.ts` — `numPlayersForMode` の存在を確認（昇降条件文言生成で使用）
- `src/shell/shell.css` — `.layered-sheet__hero` の既存スタイルを確認（`min-height: 180px`・padding・background token）
- `src/components/md/index.ts` — バレル内容を確認（本 Issue では新規 MD コンポーネントを追加しない）
- `docs/requirements.md` §4.1・§5.3・§6.4 — 要件の一次確認
- `docs/design/issue-4-domain-logic.md` §4.2・§1.3 — 昇降条件の計算仕様（transitions.ts の挙動）
- `docs/design/issue-5-app-shell.md` §8（引き継ぎ）、`docs/design/issue-6-global-filter.md` §8（引き継ぎ）
- **実 API へのアクセス: 0 回**
