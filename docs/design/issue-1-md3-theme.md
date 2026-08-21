# Issue 1 設計書: MD3テーマ基盤（カラートークン生成とタイポグラフィ）

作成日: 2026-08-21
対象 Issue: [#1 MD3テーマ基盤: カラートークン生成とタイポグラフィ](../../../mj-stats-viewer)
前提資料: `docs/requirements.md` §3 / `docs/amae-koromo-api-spec.md` §4.3
検証環境: `@material/material-color-utilities` **0.3.0**（node_modules 実物の `.d.ts` / `.js` を確認済み）、`@material/web` 2.5

---

## 0. 確定済み前提（変更不可）

- シード色はプレイヤーの**現在段位**（雀傑/雀豪/雀聖/魂天の4段位のみ）で動的に変化。未選択・不明時は雀卓グリーン `#1D6B4F`
- 日本語フォントは Google Fonts CDN の Noto Sans JP
- 確認用ページは dev 専用ルート `/__theme`（本番バンドル除外）
- `@material/material-color-utilities` は `0.3.0` 固定（キャレットなし）。0.4.x 使用禁止
- typescale は `@material/web/typography/md-typescale-styles.css` を CSS 直 import（JS エクスポートは v2.5 で廃止済み）
- Issue 3（API層）未着手のため、本 Issue では「段位 → シード → 再適用」のインターフェースのみ完成させ、入力は `/__theme` での手動切替とする

---

## 1. ライブラリ 0.3.0 の実態調査結果（設計の根拠）

`node_modules/@material/material-color-utilities/utils/theme_utils.js` と `.d.ts` を読んだ結果、**標準の `applyTheme()` はそのまま使えない**。理由は2つ:

1. **`applyTheme()` は customColors を一切書き出さない**。`setSchemeProperties()` で `scheme.toJSON()` の29キーだけを `--md-sys-color-*` に変換する実装であり、`theme.customColors` は無視される。セクション4色は自前で書き出す必要がある。
2. **旧 `Scheme`（0.3.0 の唯一のスキーム型）には `surfaceContainer*` 系トークンが存在しない**。`Scheme` が持つのは以下の29キーのみ（`scheme.d.ts` の `toJSON()` 戻り値で確認）:

   ```
   primary, onPrimary, primaryContainer, onPrimaryContainer,
   secondary, onSecondary, secondaryContainer, onSecondaryContainer,
   tertiary, onTertiary, tertiaryContainer, onTertiaryContainer,
   error, onError, errorContainer, onErrorContainer,
   background, onBackground, surface, onSurface,
   surfaceVariant, onSurfaceVariant, outline, outlineVariant,
   shadow, scrim, inverseSurface, inverseOnSurface, inversePrimary
   ```

   一方 `@material/web` v2 のコンポーネント（card, navigationbar 等）は
   `--md-sys-color-surface-container` / `-low` / `-lowest` / `-high` / `-highest` /
   `--md-sys-color-surface-dim` / `--md-sys-color-surface-bright` / `--md-sys-color-surface-tint`
   を参照する。**これらは `theme.palettes.neutral`（`TonalPalette`）から M3 仕様のトーンで自前合成する**。

3. `customColor()` の実装（確認済み）: `blend: true` のときのみ `Blend.harmonize(color, seed)` で色相をシード側へ回転させ、その後 `CorePalette.of(value).a1` から light `{color: tone40, onColor: tone100, colorContainer: tone90, onColorContainer: tone10}` / dark `{color: tone80, onColor: tone20, colorContainer: tone30, onColorContainer: tone90}` を返す。**`blend: false` なら出力はシードに一切依存しない**（＝定数化可能）。

結論: **トークンの CSS 変数書き出しは全て自前実装**とし、`themeFromSourceColor` / `customColor` / `hexFromArgb` / `argbFromHex` / `TonalPalette.tone()` のみを利用する。

---

## 2. カラー設計

### 2.1 段位シード4色 + 既定シード

HCT 検証は実際に 0.3.0 を Node から叩いて確認した（H=色相, C=彩度, T=トーン。生成された light/dark の primary も併記）。

| 段位 | seed HEX | HCT | light primary | dark primary | 選定根拠 |
|---|---|---|---|---|---|
| 雀傑 | `#E6B422` | H88 C54 T76 | `#775A00` | `#F3BF2F` | 黄蘗色系のゴールド。下記「黄色の落とし穴」参照 |
| 雀豪 | `#F57C00` | H53 C67 T65 | `#964900` | `#FFB786` | Material Orange 700。H53 は雀傑(H88)と雀聖(H24)のほぼ中間で識別性最大 |
| 雀聖 | `#D32F2F` | H24 C83 T47 | `#BA1A20` | `#FFB3AC` | Material Red 700。高彩度で tone40 でも鮮やかな赤が出る |
| 魂天 | `#1E88E5` | H256 C59 T56 | `#0060A8` | `#A2C9FF` | Material Blue 600。魂天の天青イメージ。暖色3段位と完全に分離 |
| 既定 | `#1D6B4F` | H167 C36 T40 | `#006C4D` | `#6BDBAD` | 雀卓グリーン（確定済み）。段位4色のどれとも色相が離れており「未選択」と誤認しない |

**黄色の落とし穴と雀傑色の決定理由**: MD3 の light primary は「シード色相のトーナルパレットの tone 40」であり、黄色系は tone 40 まで落とすと必然的にオリーブ〜マスタードに沈む。実測では純黄 `#FFD600`（H96）→ primary `#705D00`（くすんだオリーブ）。これは色相をどう選んでも tone 40 の黄色は暗色化する物理的制約なので、「沈まない黄色」を追うのではなく、**沈んでも金色として成立する色相**を選ぶ。`#E6B422`（伝統色・黄金系, H88）は light primary が `#775A00`（アンティークゴールド）、dark primary が `#F3BF2F`（鮮やかな金）となり、「雀傑=金の間の色」として両モードで破綻しない。アンバー寄り（H73, `#F9A825`）も試したが light primary が `#835400` と雀豪オレンジ（`#964900`）に接近しすぎるため、H88 を採用した。

### 2.2 セクション用カスタムカラー4系統

| 系統 | name | source HEX | HCT | light color / container | dark color / container |
|---|---|---|---|---|---|
| 和了 | `win` | `#FF7455` | H31 C64 T65 | `#AA361D` / `#FFDAD2` | `#FFB4A3` / `#881E07` |
| 放銃 | `dealin` | `#2D9BF0` | H251 C57 T62 | `#00629F` / `#D0E4FF` | `#9BCBFF` / `#004A7A` |
| 立直 | `riichi` | `#9C5BD1` | H313 C63 T51 | `#7F3EB3` / `#F2DAFF` | `#E0B6FF` / `#652299` |
| 運 | `luck` | `#F0A800` | H79 C58 T74 | `#7E5700` / `#FFDEAD` | `#FFBA3A` / `#604100` |

（light/dark の値は `customColor(seed, {blend:false})` の実出力。blend=false のためどのシードでも同一）

**blend フラグは `false` で確定**。根拠（blend=true を実測した結果）:

- blend=true は `Blend.harmonize` で各セクション色の色相をシード側へ最大約15°回転させる。実測では
  - 雀聖(赤)シード時: 和了コーラルが H31→H27 となり **primary(H24) とほぼ同色相に融合**
  - 魂天(青)シード時: 立直パープルが H313→H298 と青側へ流れ、放銃ブルー(H254)との距離が縮む
  - 雀豪/雀聖シード時: 運アンバーが H79→H64~66 とオレンジ化し、和了コーラルとの距離が縮む
- つまり blend=true では「シードが4段位で変わっても4系統が識別可能」という要件を満たせない。blend=false なら4系統の相互距離（H31/H79/H251/H313）は常に固定で、最小色相差48°を維持する。
- 副次効果: blend=false の出力はシード非依存の**純粋な定数**になる。ただし実装は将来 blend 方針を変えられるよう `customColor()` をランタイムで呼ぶ形を維持する（コスト無視できる規模）。

**受容する制約（仕様として明記）**: セクション色は「4系統相互」の識別性を保証するが、「現在の primary との識別性」は保証しない。具体的には 雀聖テーマ時の 和了(`#AA361D`) vs primary(`#BA1A20`)、魂天テーマ時の 放銃(`#00629F`) vs primary(`#0060A8`) は近接する。セクション色はカード内・レーダー軸・ドーナツなど「セクション文脈のラベル付きUI」でのみ使い、primary と並置して意味を区別させる使い方をしないことで回避する。これは後続 Issue のスタイリング時の制約事項とする。

**運=アンバーの注意**: light の `luck` color は `#7E5700`（黄系 tone40 の宿命でブラウン寄り）。ライトモードのチャートで「アンバー感」が必要な場面では `--md-custom-color-luck-container`（`#FFDEAD`）との併用や、チャート側で dark 用 tone80 を面色に使う等の工夫を後続 Issue で行う。本 Issue はトークン提供まで。

### 2.3 コントラスト（数値根拠）

M3 のロールペアはトーン差で コントラストが保証される設計。0.3.0 の `Contrast.ratioOfTones` での実測:

- tone40(color) vs tone100(onColor) = **6.46** ≥ 4.5 ✓（light の color/onColor ペア）
- tone80(color) vs tone20(onColor) = **7.72** ≥ 4.5 ✓（dark の color/onColor ペア）
- tone40 vs tone98(light surface) = 6.15 ✓ / tone80 vs tone6(dark surface) = 10.89 ✓

セクション4色・全シードの primary 系も同じトーン規則で生成されるため、**ペア使用（color の上に onColor、container の上に onColorContainer）を守る限り** WCAG AA を数学的に満たす。検収時の目視確認手順は §8。

---

## 3. トークン命名規則

**標準 `applyTheme()` は使わず、自前で `:root`（`document.documentElement`）へ書き出す**（理由は §1）。ただし変数名は `applyTheme()` が生成する名前と完全互換にする（camelCase → kebab-case 変換、例: `onPrimaryContainer` → `--md-sys-color-on-primary-container`）。

### 3.1 スキームトークン（29個 + 合成8個 = 37個）

1. `scheme.toJSON()` の29キーをすべて `--md-sys-color-{kebab}` で書き出す
2. `theme.palettes.neutral.tone(n)` から以下8トークンを M3 現行仕様のトーンで**追加合成**する（`@material/web` v2 コンポーネントの参照先。旧 Scheme に無いため必須）:

| トークン | light トーン | dark トーン |
|---|---|---|
| `--md-sys-color-surface-dim` | N87 | N6 |
| `--md-sys-color-surface-bright` | N98 | N24 |
| `--md-sys-color-surface-container-lowest` | N100 | N4 |
| `--md-sys-color-surface-container-low` | N96 | N10 |
| `--md-sys-color-surface-container` | N94 | N12 |
| `--md-sys-color-surface-container-high` | N92 | N17 |
| `--md-sys-color-surface-container-highest` | N90 | N22 |
| `--md-sys-color-surface-tint` | primary と同値 | primary と同値 |

3. あわせて `--md-sys-color-surface` を N98(light)/N6(dark) で、`--md-sys-color-background` も同値で**上書き**する（旧 Scheme は surface=N99 で現行仕様とズレるため。上書きしないと surface と surface-bright の関係が逆転する）。書き出し順は「29キー → 上書き・合成8+2個」とし、上書きが後勝ちになるようにする。

### 3.2 カスタムカラートークン（4系統 × 4ロール = 16個）

`applyTheme()` に前例がないため独自定義する。`--md-sys-color-*` 名前空間は Google が将来拡張しうるので侵さず、**`--md-custom-color-*`** を使う:

```
--md-custom-color-win               --md-custom-color-dealin        （color）
--md-custom-color-on-win            ...                             （onColor）
--md-custom-color-win-container     ...                             （colorContainer）
--md-custom-color-on-win-container  ...                             （onColorContainer）
```

系統キーは `win` / `dealin` / `riichi` / `luck` の4つ（`seeds.ts` の定義から機械的に導出し、名称のハードコード分散を避ける）。

### 3.3 タイポグラフィトークン

```
--md-ref-typeface-brand: 'Noto Sans JP', system-ui, sans-serif;
--md-ref-typeface-plain: 'Noto Sans JP', system-ui, sans-serif;
```

これは動的でないため JS からではなく `src/index.css` の `:root` に静的に書く。`md-typescale-styles.css` の全クラスは `--md-ref-typeface-brand/plain` へフォールバックする実装（CSS 実物で確認済み）なので、この2変数だけで全 typescale クラスに波及する。

---

## 4. モジュール構成と関数シグネチャ

```
src/
  theme/
    seeds.ts          … 定数のみ（シード・セクション色・段位→シード解決）
    applyTheme.ts     … トークン生成と :root への書き出し（DOM副作用はここだけ）
    ThemeProvider.tsx … React 状態（段位・カラーモード）と再適用・購読
  dev/
    ThemeGallery.tsx  … /__theme の中身（dev 専用）
  index.css           … typescale import・typeface 変数・ベーススタイル
  main.tsx            … フォント確認不要（index.html 側）。dev ルート分岐とプロバイダ装着
index.html            … Google Fonts link・FOUC 対策インラインスクリプト
```

### 4.1 `src/theme/seeds.ts`（定数の単一情報源）

```ts
/** 段位キー。majorRank 3/4/5/6+ に対応（牌譜屋は金の間以上のみ採譜） */
export type RankKey = 'ketsu' | 'gou' | 'sei' | 'konten';

/** 段位別シード色。差し替えはこのオブジェクトの編集のみで完結する */
export const RANK_SEEDS: Record<RankKey, string> = {
  ketsu:  '#E6B422', // 雀傑: 金
  gou:    '#F57C00', // 雀豪: 橙
  sei:    '#D32F2F', // 雀聖: 赤
  konten: '#1E88E5', // 魂天: 青
};

/** プレイヤー未選択・段位不明時の既定シード（雀卓グリーン） */
export const DEFAULT_SEED = '#1D6B4F';

export type SectionKey = 'win' | 'dealin' | 'riichi' | 'luck';

/** セクション色。blend:false（4系統の相互識別性維持のため。§2.2） */
export const SECTION_COLORS: Record<SectionKey, string> = {
  win:    '#FF7455', // 和了: コーラル
  dealin: '#2D9BF0', // 放銃: ブルー
  riichi: '#9C5BD1', // 立直: パープル
  luck:   '#F0A800', // 運: アンバー
};

/** levelId（例: 10503 = 四麻・聖3）→ RankKey。範囲外・undefined は null */
export function rankFromLevelId(levelId: number | undefined): RankKey | null;
// 実装: majorRank = Math.floor((levelId % 10000) / 100);
//       3→ketsu, 4→gou, 5→sei, 6以上→konten（旧魂天6と現魂天7の両対応）, それ以外→null

/** RankKey|null → シードHEX。null は DEFAULT_SEED */
export function seedForRank(rank: RankKey | null): string;
```

`rankFromLevelId` を本ファイルに置くのは、Issue 3 完了後に「`player_stats.level.id` → `rankFromLevelId` → `ThemeProvider.setRank`」と流し込むだけで動的化が完成する結線点を明示するため。API 仕様書 §4.3 の levelId 体系（`numPlayerId*10000 + majorRank*100 + minorRank`、majorRank 6以上=魂天）に準拠。

### 4.2 `src/theme/applyTheme.ts`

```ts
import type { SectionKey } from './seeds';

/**
 * シードから light/dark 両スキーム＋セクション4色を生成し、
 * :root（document.documentElement）に CSS 変数として反映する。
 * - themeFromSourceColor(argbFromHex(seed), customColors) を使用
 * - scheme.toJSON() 29キー → --md-sys-color-*
 * - neutral palette から surface-container 系8トークン合成＋surface/background 上書き（§3.1）
 * - customColors → --md-custom-color-*（§3.2）
 * - documentElement.style.colorScheme = dark ? 'dark' : 'light' も設定
 *   （ネイティブUI・スクロールバーの追従と FOUC 対策スクリプトとの整合）
 */
export function applyMd3Theme(seed: string, dark: boolean): void;
```

実装メモ:
- `themeFromSourceColor` の結果はシード HEX をキーに `Map` でメモ化する（取りうるシードは5種のみ。切替のたびの再計算を避ける）
- 書き出し先は `document.documentElement`（`applyTheme` 標準の `document.body` ではない。`:root` 変数として全要素・ポータルに波及させるため）
- 依存 API は 0.3.0 に実在を確認済みのもののみ: `themeFromSourceColor`, `customColor`(間接), `argbFromHex`, `hexFromArgb`, `Theme.palettes.neutral.tone(n)`, `Scheme.toJSON()`

### 4.3 `src/theme/ThemeProvider.tsx`

```ts
export type ColorModeSetting = 'light' | 'dark' | 'system';

export interface ThemeContextValue {
  rank: RankKey | null;                    // null = 既定シード
  setRank(rank: RankKey | null): void;     // Issue 3 完了後は API 結果から呼ぶ
  modeSetting: ColorModeSetting;           // ユーザー設定（既定 'system'）
  setModeSetting(mode: ColorModeSetting): void;
  resolvedDark: boolean;                   // 実効値（system 解決後）
}

export function ThemeProvider(props: { children: ReactNode }): ReactElement;
export function useTheme(): ThemeContextValue;  // Provider 外で throw
```

動作仕様:
- 実効ダーク判定: `modeSetting === 'system'` なら `matchMedia('(prefers-color-scheme: dark)')` の現在値、それ以外は設定値。**手動設定が常に OS 設定を上書きする**
- `matchMedia` の `change` イベントを購読し、`modeSetting === 'system'` のときのみ再適用（購読自体は常時、判定で無視）
- `rank` / `resolvedDark` の変化時に `useLayoutEffect` で `applyMd3Theme(seedForRank(rank), resolvedDark)` を呼ぶ（初回マウント時も走る）
- 永続化: `modeSetting` のみ `localStorage` キー **`mjsv:color-mode`** に保存（値 `light`/`dark`/`system`、不正値・読取失敗は `system` にフォールバック）。**`rank` は永続化しない**（段位はプレイヤーデータ由来の導出値であり、保存すると別プレイヤー閲覧時に前回の段位色が残留するため）
- SSR 非対応前提のため `window` 直接参照で良いが、`localStorage` アクセスは try/catch で包む（プライベートモード等）

### 4.4 FOUC（フラッシュ）対策 — `index.html`

トークン生成はランタイム JS なので、バンドル評価前の一瞬は無スタイルになる。OS ダーク環境で白フラッシュさせないため、`index.html` の `<head>` に**インラインスクリプト＋最小限のインラインスタイル**を置く:

```html
<script>
  // ThemeProvider と同じ解決規則の先行ミニ実装（キー名を必ず一致させる）
  try {
    var m = localStorage.getItem('mjsv:color-mode');
    var dark = m === 'dark' || (m !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) { /* system既定のまま */ }
</script>
<style>
  /* トークン適用前の地色。既定シード#1D6B4Fのneutralトーン(N98/N6)実値 */
  html { background-color: #f8faf6; }
  html[style*="color-scheme: dark"], html[style*="color-scheme:dark"] { background-color: #111412; }
</style>
```

`color-scheme` を先に立てることでブラウザのデフォルト UI も追従する。地色はテーマ適用時に `--md-sys-color-background` で上書きされるため、既定シード基準の固定値で十分。

### 4.5 呼び出し順序（起動シーケンス）

```
index.html: フォント<link> → FOUCスクリプト（colorScheme確定・地色）
→ main.tsx: index.css import（typescale CSS・typeface変数）
→ dev分岐（§7）
→ <ThemeProvider><App/></ThemeProvider> マウント
→ ThemeProvider useLayoutEffect → applyMd3Theme(DEFAULT_SEED, resolvedDark)
→ （将来）Issue 3 でプレイヤー確定 → setRank(rankFromLevelId(level.id)) → 再適用
```

### 4.6 Vite 雛形の残骸整理

本 Issue のスコープとして以下を実施する:
- `src/App.css` 削除、`src/assets/react.svg` / `vite.svg` / `hero.png` 削除
- `src/App.tsx` はカウンター等を除去し、typescale クラスとトークンを使った最小プレースホルダ（アプリ名見出し程度）に置換。アプリシェル本体は Issue 5 のスコープなので**ここでは作り込まない**
- `src/index.css` は既存内容（雛形の独自変数群）を全廃棄し、§5.2 の内容に置換

---

## 5. タイポグラフィ

### 5.1 フォント読み込み（`index.html`）

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">
```

**ウェイトは 400 / 500 / 700 の3本で確定**。根拠:
- `md-typescale-styles.css` の実装（確認済み）が参照するウェイト変数は `--md-ref-typeface-weight-regular(400)` / `-medium(500)` / `-bold(700)` の3種のみ。これ以外を読んでも typescale クラスからは使われない
- CDN コスト: Google Fonts は unicode-range 分割配信のため、初期表示は実際に使うグリフのサブセットのみ取得される（日本語全量 ~1.7MB/ウェイトを一括では読まない）。3ウェイトはこの方式なら実用上問題ないが、**これ以上の追加（Light 300 や Black 900）は禁止**とする
- `display=swap` でフォント到着前もテキストを表示（FOIT 回避）。スワップ時のリフローは Noto Sans JP と system-ui の字幅差が小さく許容

### 5.2 `src/index.css`（置換後の構成）

```css
@import '@material/web/typography/md-typescale-styles.css';

:root {
  --md-ref-typeface-brand: 'Noto Sans JP', system-ui, sans-serif;
  --md-ref-typeface-plain: 'Noto Sans JP', system-ui, sans-serif;
}

html, body { margin: 0; }
body {
  font-family: var(--md-ref-typeface-plain);
  background: var(--md-sys-color-background);
  color: var(--md-sys-color-on-surface);
  -webkit-font-smoothing: antialiased;
}
/* 統計数値用: 桁が揃う数字（Noto Sans JP はデフォルト比例数字のため） */
.numeric { font-variant-numeric: tabular-nums; font-feature-settings: 'tnum'; }
```

（`@import` がバンドルされることは Vite の CSS 処理で保証される。JS 側 `import '@material/web/typography/md-typescale-styles.css'` を main.tsx に書く形でも可 — 実装しやすい方で良いが、どちらか一方のみにすること）

### 5.3 typescale 使い分け方針（要件§3「数値は Display/Headline 級」の具体化）

`md-typescale-styles.css` が提供するクラスは display/headline/title/body/label × large/medium/small（＋`-prominent` 変種）。本 Issue はガイドラインの文書化と `/__theme` での見本表示まで。各画面への適用は後続 Issue。

| 用途 | クラス | 備考 |
|---|---|---|
| カード1 の段位pt等の主役数値 | `md-typescale-display-medium` + `.numeric` | 57px級は日本語UIで過大、45px を上限に |
| 主要スタッツタイルの数値 | `md-typescale-headline-medium` + `.numeric` | |
| カード見出し | `md-typescale-title-medium` | |
| 本文・注記（分母注記等） | `md-typescale-body-medium` / `body-small` | |
| チップ・差分（▲/▼） | `md-typescale-label-medium` | |
| 数値の強調 | `-prominent` 変種（weight 500相当） | display級を bold にしない（M3E は size で強調） |

---

## 6. ダークモード方式（まとめ）

| 論点 | 決定 |
|---|---|
| 既定 | `system`（prefers-color-scheme 追従） |
| 手動切替 | `light`/`dark`/`system` の3値。手動値が OS 設定より優先 |
| 永続化 | `modeSetting` のみ localStorage `mjsv:color-mode`。rank は非永続（§4.3） |
| OS設定変更の追従 | `matchMedia('(prefers-color-scheme: dark)')` の change 購読。system 時のみ反映 |
| フラッシュ対策 | index.html インラインスクリプト（§4.4）。SSR なし前提 |
| 切替 UI | 本 Issue では `/__theme` 内のみに設置。アプリ本体のトグル配置は Issue 5 |

---

## 7. `/__theme` の dev 限定化

**ルーターに依存しない**方式にする（ルーティング方式は Issue 5 で HashRouter 想定・未確定のため、先取りしない）。`main.tsx` で:

```tsx
async function bootstrap() {
  if (import.meta.env.DEV && location.hash.startsWith('#/__theme')) {
    const { ThemeGallery } = await import('./dev/ThemeGallery');
    root.render(<StrictMode><ThemeProvider><ThemeGallery /></ThemeProvider></StrictMode>);
    return;
  }
  root.render(<StrictMode><ThemeProvider><App /></ThemeProvider></StrictMode>);
}
```

- アクセス方法は `http://localhost:5173/#/__theme`（dev サーバー時のみ）。Issue 5 で HashRouter が確定したら `#/__theme` 判定はそのまま両立し、ルート登録に移行してもよい（移行は必須でない）
- **本番除外の根拠**: Vite は本番ビルドで `import.meta.env.DEV` をリテラル `false` に静的置換し、Rollup が `if (false)` ブランチごと除去する。ブランチ内の動的 `import()` も到達不能となり、`ThemeGallery` のチャンク自体が emit されない（Vite 公式の dead-code elimination の標準パターン）。検収では `dist/` に対する grep で確認する（§8）
- `src/dev/` ディレクトリは「本番から参照してはならないコード」の置き場として今後も使う

### ThemeGallery の内容

1. **コントロール列**: 段位セレクタ（既定/雀傑/雀豪/雀聖/魂天 の5択 → `setRank`）、カラーモード（light/dark/system → `setModeSetting`）
2. **スキームスウォッチ**: `--md-sys-color-*` 全37トークンを「変数名・解決済みHEX・その色の塗り＋対になる on 色の文字」で一覧表示。HEX は `getComputedStyle(document.documentElement).getPropertyValue()` で実測値を出す
3. **セクションスウォッチ**: `--md-custom-color-*` 16トークンを win/dealin/riichi/luck の行で表示し、4系統が並んで見分けられることを確認できるようにする
4. **コントラスト表示**: 各「color/onColor」「container/onContainer」ペアと「color/surface」について WCAG 相対輝度からコントラスト比を計算して数値表示し、4.5 未満(本文) / 3.0 未満(大型文字・図形) を警告色で明示（計算は dev 専用コードなので素朴な実装でよい）
5. **typescale 見本**: 全 `md-typescale-*` クラスの日本語＋数値サンプル（例: 「雀傑★★ 232/1400」）。`.numeric` の桁揃え見本も併置

---

## 8. 受け入れ条件（検収チェックリスト）

前提: `npm ci` 済み。dev 確認は `npm run dev` の URL に対して行う。

1. **ビルド・lint**: `npm run build` と `npm run lint` がともに exit code 0 でエラーなく完了する。
2. **8通り切替**: `#/__theme` を開き、段位セレクタ4値 × カラーモード light/dark の8通りを切り替える。各組み合わせで (a) ページ地色・スウォッチが即時変化する、(b) `--md-sys-color-*` 全37トークン（§3.1 の29+8）が変数名付きスウォッチとして表示される、(c) win/dealin/riichi/luck の4セクション色スウォッチが表示され、どの段位でも4系統が相互に見分けられる（§2.2 の light/dark 期待HEX と一致する）ことを確認。
3. **段位と primary の対応**: 雀傑→金系 / 雀豪→橙系 / 雀聖→赤系 / 魂天→青系 / 既定→緑系 の primary になっている。目安値: light primary がそれぞれ `#775A00` / `#964900` / `#BA1A20` / `#0060A8` / `#006C4D`。
4. **タイポグラフィ**: `/__theme` の typescale 見本で各クラスのサイズ差が出ており、DevTools の Computed → Rendered Fonts で「Noto Sans JP」が実使用されている（Network タブで fonts.gstatic.com からの woff2 取得があることでも可）。
5. **ダークモード優先関係**: モード=system の状態で OS のダーク設定を切り替えるとテーマが追従する。次にモードを light（または dark）へ手動設定すると OS 設定と逆でも手動値が勝つ。リロード後も手動値が維持されている（localStorage `mjsv:color-mode`）。
6. **フラッシュ**: OS ダーク＋モード dark の状態でリロードし、白い画面が一瞬でも挟まらない（DevTools の Network throttling: Slow 4G で確認するとよい）。
7. **シード差し替えの局所性**: `src/theme/seeds.ts` の `DEFAULT_SEED` を任意の色（例 `#7B1FA2`）に変えて dev サーバーで既定テーマの色が変わること、`git grep -n '1D6B4F' -- src index.html` のヒットが `seeds.ts` と index.html の FOUC 地色コメント周辺（§4.4 の固定値。ここは意図的な複製で、コメントで seeds.ts 参照を明記すること）以外に無いことを確認し、元に戻す。
8. **バージョン固定**: `package.json` の `@material/material-color-utilities` が `"0.3.0"`（`^` なし）であり、`package-lock.json` でも 0.3.0 で解決されている。
9. **雛形残骸ゼロ**: `src/App.css` と `src/assets/`（react.svg/vite.svg/hero.png）が存在しない。`src/App.tsx` にカウンター・ロゴ・"Get started" が残っていない。
10. **本番バンドル除外**: `npm run build` 後、`grep -ril "ThemeGallery\|__theme" dist/` が assets 内の JS にヒットしない（index.html のハッシュ判定文字列もビルド後 JS から消えていること。※ `import.meta.env.DEV` 静的置換による）。`npm run preview` で `#/__theme` を開いても通常アプリが表示される。
11. **コントラスト**: §9 の手順で light/dark 双方の警告ゼロを確認。

## 9. ライト/ダーク双方でのコントラスト確認方法（検収手順）

1. **一次確認（機械的・網羅）**: `/__theme` のコントラスト表示（§7-4）で、light/dark × 5シードの全10通りについて、(a) 全 color/onColor・container/onContainer ペアが 4.5 以上、(b) primary・セクション4色の color が surface に対して 3.0 以上、であること。ギャラリーが警告表示ゼロなら合格。
2. **二次確認（抜き取り・実ブラウザ）**: Chrome DevTools → 要素検査 → カラーピッカーのコントラスト比表示で、light/dark 各1シード（雀傑 light と 魂天 dark を推奨。黄系 light と青系 dark が最も沈みやすい組合せのため）について「onPrimary on primary」「onSurface on surface」「on-win-container on win-container」の3点を実測し、DevTools の AA 判定が出ることを確認。
3. トーン規則上の理論値（tone40/100=6.46, tone80/20=7.72, §2.3）から、ペア使用を守る限り不合格は出ない設計。もし 1. で警告が出た場合はペアの組み方（実装のトークン対応ミス）を疑うこと。

---

## 10. 後続 Issue への引き継ぎ事項

- **Issue 3**: プレイヤー確定時に `setRank(rankFromLevelId(player_stats.level.id))` を呼ぶ（カード1同様、段位は常に全モード・全期間のクエリから取ること）。プレイヤー未選択に戻ったら `setRank(null)`
- **Issue 5**: ルーティング確定後も `/__theme` の dev 分岐は main.tsx のまま残してよい。ダークモード切替 UI のアプリ内配置はそちらで
- **チャート系 Issue**: セクション色は §2.2 の「primary との近接を許容」制約に留意。Recharts へは `getComputedStyle` 経由でなく、テーマコンテキストから HEX を直接渡せるよう `applyTheme.ts` に生成結果を返すヘルパーを足す拡張余地あり（本 Issue では不要）
