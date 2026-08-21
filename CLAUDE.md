# mj-stats-viewer

雀魂の段位戦スタッツを可視化する非公式SPA。データ源は[雀魂牌譜屋 (amae-koromo)](https://amae-koromo.sapk.ch/) の公開API。技術スタックと画面構成は [README.md](README.md) と [docs/requirements.md](docs/requirements.md) を参照。

```bash
npm run dev      # 開発サーバー (http://localhost:5173)
npm run build    # tsc -b + vite build。型エラーを残さないこと
npm run lint     # oxlint
```

---

## 破ると静かに壊れる制約

**エラーも警告も出ずに壊れる**ものだけをここに集約している。変更する前に必ず読むこと。

### 1. `src/` に副作用のためだけの bare import を書かない

`package.json` に `"sideEffects": ["*.css"]` を宣言している。CSS 以外の `import './foo'` 形式（副作用目的の import）は**本番ビルドで黙って除去される**。dev サーバーでは動くため気づけない。

カスタム要素の登録は「ラッパーの export を使う」ことで成立させること。この宣言はバンドルを 430 kB → 287 kB に削減しており、外せない。根拠と実測値: [docs/design/issue-2-md-react-wrappers.md](docs/design/issue-2-md-react-wrappers.md) §2

### 2. `@material/material-color-utilities` は `0.3.0` 固定（キャレットなし）

**0.4.x は使用禁止**。拡張子なし import を含むパッケージング不具合があり、Node / バンドラの解決に失敗する（2026-08 検証済み）。`npm update` 等で勝手に上がらないよう注意すること。

### 3. `<md-*>` の生タグを直書きしない

JSX の型エラーになる。`@material/web` のコンポーネントは必ず `src/components/md` のバレルから import する。

```ts
import { FilledButton, Tabs, PrimaryTab } from '../components/md';
```

ラップされていないコンポーネントが必要になったら、`src/components/md/` にラッパーを追加してからバレルに載せる。**全量 import の `all.js` は使用禁止**（バンドルサイズ管理のため）。

### 4. dev 専用ルートは DCE が効く形を崩さない

`src/main.tsx` の dev ルート（`#/__theme` / `#/__components`）は、`import.meta.env.DEV` のリテラル分岐の**内側に動的 `import()` を直書き**することで本番バンドルから除外されている。この形を崩すと dev 用コードが本番に混入する。

dev 専用コードは `src/dev/` に置くこと。

### 5. 色をハードコードしない

配色は `src/theme/` がランタイムに生成し `:root` の CSS 変数として供給する。`--md-sys-color-*`（37トークン）と `--md-custom-color-*`（セクション4系統）を使うこと。

- シード色・セクション色の変更は **`src/theme/seeds.ts` の定数のみ**で完結する
- 例外は `index.html` の FOUC 対策の地色 `#f8faf6` / `#111412`。`DEFAULT_SEED` 由来の値の**意図的な複製**で、自動追従しない（コメントあり）
- `index.html` と `src/theme/ThemeProvider.tsx` の localStorage キー `mjsv:color-mode` は必ず一致させること

根拠: [docs/design/issue-1-md3-theme.md](docs/design/issue-1-md3-theme.md)

### 6. typescale は CSS を直 import する

`@material/web/typography/md-typescale-styles.css` を使う。`typescaleStyles` の JS エクスポートは v2.5 で廃止済み。

---

## 開発フロー

Issue 単位で、フェーズごとにモデルを切り替えたサブエージェント3体を直列で回す（設計=Fable / 製造=Sonnet / 検収=Opus）。

- **設計**: `docs/design/issue-N-<slug>.md` を作成し、**受け入れ条件のチェックリストまで書く**。コードは書かない。憶測でAPIを書かず `node_modules` の実物 `.d.ts` を読むこと
- **製造**: 設計書だけを唯一の仕様として実装。逸脱が必要なら勝手に別方式を採らず差し戻す
- **検収**: 受け入れ条件を1項目ずつ**実行して**検証し、PR を作成する。「コードを読んで多分大丈夫」は不合格

設計書は使い捨てではなく後続Issueの参照資産としてコミットする。

### UI検証の逆発注

エージェントが原理的に確認できないUI検証は、[docs/ui-verification/](docs/ui-verification/) の手順書を書いてオーナーへ委託する。運用ルールは同ディレクトリの `README.md`。

**既知の検証環境の制約**: Claude Code のブラウザペインは `document.visibilityState === "hidden"` のため、Web Animations API が進行せずアニメーション完了イベント（`opened` / `closed` 等）が発火しない。`prefers-color-scheme` のエミュレーションも `matchMedia` の `change` を発火しない。これらを**コードの欠陥と誤診しないこと**。

---

## 保留中の設計判断

以下はオーナーが明示的に保留しており、**確定事項として扱わない**こと。

- **シード色（段位4色）**: 画面が組み上がった段階で全体のバランスを見て再調整する
- **セクション色4系統（和了/放銃/立直/運）**: セクション構成の検討時に再考する。**色分けそのものを行わない可能性がある**ため、これらの色を前提とした設計に深く依存しないこと

---

## API利用の方針

- `games` / `player_records` は CAP（PoW型CAPTCHA）保護下にあり、**迂回は行わない**
- APIコールを増やす回避策（二分探索等）を採用しない。1画面表示あたり数リクエスト以内が目安
- robots.txt の意向を尊重し、クロール的な一括取得は行わない

詳細: [docs/amae-koromo-api-spec.md](docs/amae-koromo-api-spec.md) / [docs/requirements.md](docs/requirements.md) §7
