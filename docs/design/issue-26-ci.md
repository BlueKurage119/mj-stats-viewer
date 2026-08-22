# Issue 26 設計書: CI（PR時に lint / 型チェック / build / テストを自動実行する）

作成日: 2026-08-22
執筆: 設計担当（mjsv-designer）
前提資料: [Issue #26](https://github.com/BlueKurage119/mj-stats-viewer/issues/26) / 親 [Issue #16](https://github.com/BlueKurage119/mj-stats-viewer/issues/16) / [CLAUDE.md](../../CLAUDE.md)

---

## 0. 前提とスコープ

### 0.1 やること

- `.github/workflows/ci.yml` を新規作成（`.github/` はリポジトリに**まだ存在しない**）
- `.nvmrc` を新規作成
- `package.json` に `engines` を追加し、`package-lock.json` を再生成

### 0.2 やらないこと（触れたら差し戻し）

- **デプロイ・`vite.config.ts` の `base`・ホスティング先の決定** — すべて #16 に残っている論点。本Issueでは1行も触れない
- `src/` 配下の変更（負の検証で一時的に壊す場合を除く。必ず戻す）
- `.oxlintrc.json` の severity 変更（§4.3 で理由を述べる。別Issue化を提案）
- main ブランチ保護ルール（リポジトリ設定。オーナー判断）
- 実APIアクセス（本Issueでは不要。テストはすべてフィクスチャで完結している）

### 0.3 本設計書の実測環境

すべての数値・出力は 2026-08-22 に本リポジトリの main（`cdd21f6`）で実測したもの。実測機は macOS / Node v23.11.0 / npm 11.4.2。**GitHub Actions ランナー上での実測は行っていない**（PR を出すまで実行できないため）。ランナー固有の数値は「実挙動未確認」と明記する。

---

## 1. Node バージョンの選定

### 1.1 実測: 依存パッケージの `engines`

`node_modules` 配下の実物の `package.json` を読んで確認した（記憶やドキュメントではない）。

| パッケージ | 実インストール版 | `engines.node` |
|---|---|---|
| `vitest` | 4.1.11 | `^20.0.0 \|\| ^22.0.0 \|\| >=24.0.0` |
| `vite` | 8.2.2 | `^20.19.0 \|\| >=22.12.0` |
| `oxlint` | 1.79.0 | `^20.19.0 \|\| >=22.12.0` |
| `@vitejs/plugin-react` | 6.1.0 | `^20.19.0 \|\| >=22.12.0` |
| `react-router-dom` | 7.18.2 | `>=20.0.0` |
| `recharts` | 3.10.1 | `>=18` |
| `typescript` | 6.0.3 | `>=14.17` |
| `react` | 19.2.8 | `>=0.10.0` |
| `react-dom` / `dayjs` / `@material/web` / `@lit/react` / `@types/node` | — | 宣言なし |

**論理積**は `[20.19, 21) ∪ [22.12, 23) ∪ [24, ∞)`。すなわち **Node 21 と Node 23 は除外される**。除外の主因は `vitest` の `^20 || ^22 || >=24`（奇数系メジャーを明示的に外している）。

実測した警告（scratch にコピーした `package.json` + `package-lock.json` で `npm ci` を実行）:

```
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: 'vitest@4.1.11',
npm warn EBADENGINE   required: { node: '^20.0.0 || ^22.0.0 || >=24.0.0' },
npm warn EBADENGINE   current: { node: 'v23.11.0', npm: '11.4.2' }
npm warn EBADENGINE }
```

### 1.2 決定: CI は Node 24（`.nvmrc` を単一の情報源にする）

**`.nvmrc`（新規、内容は `24` の1行）** を置き、ワークフローは `node-version-file: .nvmrc` で読む。`actions/setup-node` の `action.yml` を実物で確認した結果、`node-version-file` は `.nvmrc` / `.node-version` / `package.json` / `.tool-versions` / `mise.toml` をサポートしている。

**なぜ 24 か**:

1. 2026-08 時点の **Active LTS** であり、上表の全依存が要求を満たす唯一の「現行 LTS」
2. `@types/node` が `^24.13.3` で入っている。**型定義と実行系のメジャーを揃える**のが自然（`tsconfig.node.json` は `"types": ["node"]`）
3. `actions/setup-node@v7` 自体が `using: 'node24'` で動く。ランナー側に 24 が最も確実に載っている
4. 22 でも動くが、2026-10 に 24 が Maintenance に落ちるまで 24 が最長で「Active」でいられる

**マトリクス（20 / 22 / 24 の並走）は採らない。** 成果物はブラウザ向け静的 SPA であり、**本番に Node ランタイムは存在しない**。Node はビルド・テストを回すためだけの道具なので、複数版で通ることを保証する価値がない。CI 時間を 3 倍にする対価に見合わない。

### 1.3 ローカル（Node 23）と CI（Node 24）のずれをどう扱うか

**結論: ずれを放置せず、`.nvmrc` と `engines` で「23 は非対応」を明示し、オーナーにローカルの 24 への移行を推奨する。ただし移行を CI の前提条件にはしない。**

理由:

- Node 23 は **odd メジャー（非 LTS、2025-06 に EOL 済み）**であり、`vitest` が意図的に外している。単なる警告ではなく「作者が動作保証していない」宣言
- とはいえ現状ローカルの 70 件は全部 green で通っている（実測: `Duration 559ms`）。**今すぐ壊れているわけではない**ので、移行を本Issueのブロッカーにはしない
- ずれ自体は「CI が正」と決めれば運用可能。ただしローカルだけで green を確認して PR を出す運用は危険なので、CI を必須チェックにする（ブランチ保護は #16 スコープ外＝オーナー判断）

### 1.4 `package.json` の `engines`: 追加する

```json
"engines": {
  "node": "^20.19.0 || ^22.12.0 || >=24.0.0"
}
```

§1.1 の論理積そのまま。`>=24` だけに絞らないのは、22 LTS の環境を不当に弾かないため。

**実測した副作用（製造担当が踏みやすい罠）**:

- `engines` を追加すると `package-lock.json` のルート `packages[""]` にも `engines` ブロックが**書き込まれる**。`npm install --package-lock-only` を実行すると、差分は以下の3行**だけ**（他は一切動かない）。実測済み:

  ```diff
         "vitest": "^4.1.11"
  +      },
  +      "engines": {
  +        "node": "^20.19.0 || ^22.12.0 || >=24.0.0"
         }
  ```

- **`package.json` にだけ書いて lock を再生成し忘れても `npm ci` は exit 0 で通る**（実測済み）。`engines` は `npm ci` の同期チェックの対象外。したがって**この漏れは CI では捕まらない**。製造担当が `npm install --package-lock-only` を実行して lock も一緒にコミットすること、検収担当が lock のルート `engines` を目視で確認することで担保する

### 1.5 `.npmrc` に `engine-strict=true` は**置かない**

置くと EBADENGINE が warn から error に昇格し、**オーナーのローカル（Node 23）で `npm ci` が即座に落ちる**。現在ローカルは動いているのに、CI 整備をきっかけに開発機が止まるのは割に合わない。CI 側は `.nvmrc` で 24 を強制するので、strict にしなくても CI の実行版はぶれない。

---

## 2. `npm ci` をフラグなしで通すことの保証

これが本Issueの中核。Issue #3 の回帰（`--legacy-peer-deps` が lock を壊し `npm ci` が通らなくなった）を **CI で無料で捕まえる**。

### 2.1 実測: 回帰は再現し、素の `npm ci` で確実に落ちる

scratch に `package.json` + `package-lock.json` だけをコピーして再現した。

**手順と結果**:

1. `npm install --legacy-peer-deps` → **exit 0**（何事もなく成功する。ここが罠）
2. `package-lock.json` の差分は 2 insertions / 7 deletions。実測した中身:
   - `node_modules/react-is`（`"peer": true` のエントリ）が**丸ごと消える**
   - `node_modules/@types/react` と `node_modules/csstype` に `"dev": true` が付く（本番依存から外れたと誤記録される）
3. その lock で素の `npm ci` を実行 → **exit 1**

   ```
   npm error code EUSAGE
   npm error `npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync. Please update your lock file with `npm install` before continuing.
   npm error
   npm error Missing: react-is@19.2.8 from lock file
   ```

**したがって、ワークフローに `npm ci` を素で1行書くだけで #3 の回帰は捕まる。** 追加のチェックステップは不要。

### 2.2 `package.json` と lock の一般的な不整合も同じ経路で落ちる

別途、`package.json` にだけ `left-pad` を足して lock を放置したケースも実測した。同じく **exit 1 / `code EUSAGE` / `Missing: left-pad@1.3.0 from lock file`**。

### 2.3 採らなかった案

| 案 | 却下理由 |
|---|---|
| `npm install --package-lock-only && git diff --exit-code package-lock.json` を足す | レジストリのメタデータ更新でランダムに落ちうる（`^` レンジ内の新版が出た瞬間に赤くなる）。CI の信頼性を下げる対価が、§1.4 の `engines` 漏れ1件を拾うだけでは見合わない |
| `node_modules` を丸ごとキャッシュする | `npm ci` は本来 `node_modules` を消して作り直す。キャッシュから復元すると「lock から素で入る」保証が消え、**本Issueの目的そのものを無効化する**。絶対に採らない |
| `npm ci --prefer-offline` 等のフラグ追加 | 「フラグなしで通ること」が完了条件なので、素のままにする |

---

## 3. ジョブ構成とキャッシュ

### 3.1 実測: 各ステップの所要時間（ローカル、npm キャッシュ温）

| ステップ | 実測 |
|---|---|
| `npm ci`（`node_modules` 無しから、153 packages） | **6.1 s** |
| `npm run lint`（oxlint） | **0.43 s** |
| `npm run build`（`tsc -b && vite build`、60 modules / 238 kB） | **4.2 s** |
| `npm test`（vitest run、5 files / 70 tests） | **1.4 s** |
| 合計 | **約 12 s** |

### 3.2 決定: 1ジョブ直列

**根拠は上の実測値**。lint / build / test を 3 ジョブに割ると:

- `npm ci`（6 s）を **3 回**払う。検査本体の合計（0.43 + 4.2 + 1.4 = 6.0 s）より **セットアップの方が高い**
- ランナーの起動・checkout・setup-node のオーバーヘッドも 3 倍になる（GitHub 実行環境での実測は未実施＝**実挙動未確認**だが、方向は明白）
- 並列化で縮むのは最長ステップ（build 4.2 s）までで、上限効果が数秒しかない

**この規模では分割は純損**。将来テストが数分規模に育ったら再検討する（§6 に引き継ぐ）。

### 3.3 決定: 1ジョブだが「最初の失敗で止めない」

素直に書くと lint で落ちた時点でジョブが終わり、型エラーやテスト失敗が見えない。**1 回の push で 4 種類すべての結果を返す**ため、lint 以降の各ステップに `if: ${{ !cancelled() && steps.install.outcome == 'success' }}` を付ける。

- `continue-on-error` は**使わない**。あれは失敗を成功に塗り替えてしまう。`if: !cancelled()` は「前が失敗しても実行する」だけで、**ジョブ全体の結論は赤のまま**
- `npm ci` が失敗した場合だけは後続をスキップする（`node_modules` が無い状態で lint を走らせても無意味なノイズが出る）。`steps.install.outcome == 'success'` がその条件

### 3.4 決定: キャッシュは `actions/setup-node` の `cache: npm` で足りる

- `cache: npm` がキャッシュするのは **`~/.npm`（npm のダウンロードキャッシュ）**であって `node_modules` ではない。`npm ci` は毎回 lock から `node_modules` を作り直すので、§2.3 の保証は保たれたまま、ネットワーク取得ぶんだけが短縮される。**本Issueの目的と両立する唯一のキャッシュ層**
- キャッシュキーは `package-lock.json` のハッシュから自動生成される。lock が変わればキャッシュも切り替わる。手動の `actions/cache` を足す必要はない
- 対象は 153 packages と小さく、`actions/cache@v6` を別途組む複雑さに見合わない
- `action.yml` を実物で確認した結果、`package-manager-cache`（デフォルト true）による自動キャッシュは `package.json` の `packageManager` / `devEngines.packageManager` フィールドが npm を指す場合に効く。**本リポジトリには両方とも無い**ので、`cache: npm` を明示する必要がある

---

## 4. 成果物の仕様

### 4.1 `.nvmrc`（新規）

```
24
```

末尾改行あり、それだけ。

### 4.2 `.github/workflows/ci.yml`（新規）

アクションのバージョンは 2026-08-22 に `gh api repos/<owner>/<repo>/releases/latest` で取得した実際の最新リリースタグ:
`actions/checkout` = **v7.0.1**、`actions/setup-node` = **v7.0.0**。メジャーの浮動タグ（`@v7`）で固定する。

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

jobs:
  verify:
    name: lint / typecheck / build / test
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v7

      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: npm

      # フラグなしで通ることが Issue #26 の完了条件。
      # --legacy-peer-deps 等を足すと #3 の回帰を検出できなくなる。
      - name: Install
        id: install
        run: npm ci

      - name: Lint
        if: ${{ !cancelled() && steps.install.outcome == 'success' }}
        run: npm run lint

      - name: Typecheck + build
        if: ${{ !cancelled() && steps.install.outcome == 'success' }}
        run: npm run build

      - name: Test
        if: ${{ !cancelled() && steps.install.outcome == 'success' }}
        run: npm test
```

設計上の意図（製造担当は勝手に変えないこと）:

| 記述 | 理由 |
|---|---|
| `permissions: contents: read` | 既定の書き込み権限を落とす。CI は読むだけ |
| `concurrency` + `cancel-in-progress`（PR のみ） | 連続 push で古い実行を打ち切る。main への push はキャンセルしない（履歴上の全コミットの結果を残す） |
| `timeout-minutes: 10` | 実測 12 秒に対して十分すぎる余裕。ハングを 6 時間放置しないための保険 |
| `npm test` であって `npm run test` でない | 同義。`package.json` の `test` スクリプトは npm の組み込みエイリアスで動く |
| ステップ名に「Typecheck + build」 | `npm run build` は `tsc -b && vite build`。型チェックがここに含まれることを検収担当・PR 閲覧者に明示する |

**`workflow_dispatch` は付けない。** PR と main への push で十分で、手動実行の用途が現時点で無い。

### 4.3 触らないもの — `.oxlintrc.json`（重要な既知の穴）

**実測して判明した事実: 現状の `npm run lint` は、`.oxlintrc.json` で `"error"` と明示された `react/rules-of-hooks` 以外では落ちない。**

検証（一時ファイルを作って `npx oxlint` に掛け、直後に削除した）:

| 仕込んだ違反 | 出力 | exit code |
|---|---|---|
| 条件分岐内の `useState` | `error react-hooks(rules-of-hooks)` | **1** |
| `debugger` 文 | `warning eslint(no-debugger)` | 0 |
| オブジェクトリテラルの重複キー | `warning eslint(no-dupe-keys)` | 0 |

また、main の現状で `npm run lint` は **warning 5件を出しながら exit 0** で通る（`src/theme/ThemeProvider.tsx` ×1、`src/dev/ThemeGallery.tsx` ×4）。

つまり **CI の lint ゲートは現状かなり薄い**。ただし本Issueで直すべきではない:

- `--deny-warnings` / `--max-warnings=0` を足すと**初回 PR がいきなり赤になる**（既存 warning 5件のため）。CI 導入とコード修正が同一 PR に混ざる
- `--max-warnings=5` のような現状追認の閾値は脆く、無関係な PR を巻き込む
- severity の見直しはリンタのポリシー決定であり、CI 配線とは別の判断

**→ 「oxlint の severity ポリシーを決めて warning ゼロにする」を別Issueとして起票することを統括担当に提案する。** 本Issueでは `npm run lint` を素のまま呼び、この穴を本設計書に記録するに留める。

---

## 5. 受け入れ条件（検収チェックリスト）

**前提**: 検収担当が CI を実走させるには PR が必要。以下は**その順序を織り込んだ手順**になっている。上から順に実行すること。

### フェーズ A: PR を出す前（ローカル）

1. **差分がスコープ内であること**
   `git diff --stat main` の結果が `.github/workflows/ci.yml`（新規）/ `.nvmrc`（新規）/ `package.json` / `package-lock.json` の **4ファイルのみ**であること。`src/` / `vite.config.ts` / `.oxlintrc.json` に変更が無いこと。`vite.config.ts` に `base` が追加されていないこと（#16 スコープ）。

2. **`.nvmrc` の内容**
   `cat .nvmrc` が `24`（末尾改行のみ）。

3. **`engines` が package.json と lock の両方に入っていること**
   - `node -e "console.log(require('./package.json').engines)"` が `{ node: '^20.19.0 || ^22.12.0 || >=24.0.0' }`
   - `node -e "console.log(JSON.parse(require('fs').readFileSync('package-lock.json')).packages[''].engines)"` が**同じ値**を返すこと。§1.4 のとおり **`npm ci` はこの漏れを検出しないので、ここは目視で確認するしかない**

4. **ローカルで素の `npm ci` が通ること**
   `rm -rf node_modules && npm ci`（フラグなし）が exit 0。`npm run lint` / `npm run build` / `npm test` が exit 0、テストは **70件 passed**。
   （Node 23 のローカルでは `vitest` と自プロジェクトの EBADENGINE warn が出るが、これは §1.3 で織り込み済み。**warn であって error ではないこと**を確認する）

5. **ワークフローの構文**
   `.github/workflows/ci.yml` が §4.2 の記述と一致していること。特に:
   - `npm ci` に**フラグが一切付いていない**
   - `cache: npm` がある
   - `node-version-file: .nvmrc` である（`node-version:` にバージョンをベタ書きしていない）
   - lint / build / test の3ステップに `if: ${{ !cancelled() && steps.install.outcome == 'success' }}` がある

### フェーズ B: 本番 PR を出して green を確認する

6. **PR を作成し、CI が起動すること**
   ブランチを push して PR を作る。PR の Checks に `CI / lint / typecheck / build / test` が現れること。
   `gh pr checks <PR番号>` で確認できる。

7. **全ステップ green**
   `gh run view <run-id> --log` で、`Install` / `Lint` / `Typecheck + build` / `Test` の4ステップがすべて成功していること。ログ中に:
   - `Test` ステップに `Tests  70 passed (70)`
   - `Typecheck + build` ステップに `✓ built in`
   - `Install` ステップに **`npm error` が1行も無い**こと。かつ `vitest` の EBADENGINE warn が**出ていない**こと（Node 24 で走っている証拠。**ここが Node 選定の実効確認**）

8. **セットアップされた Node が 24 系であること**
   `Set up job` / `setup-node` のログに `v24.` が現れること。

9. **キャッシュが機能していること**
   同じ PR に空コミットを1つ足して2回目の run を起こし、`setup-node` の post ステップまたは `Cache restored` 系のログでキャッシュヒットが出ること。かつ**2回目の `Install` の所要時間が1回目より短いこと**（`gh run view` の表示時間で比較）。ヒットしない場合は `cache-dependency-path` の要否を疑う。

### フェーズ C: 「落ちるべきときに落ちる」ことの確認（4種）

**やり方**: フェーズ B の PR は汚さない。CI ブランチから**使い捨てブランチ `ci-negative-check` を切り、そこから別 PR を立てる**。以下 4 種を**1件ずつ別コミット**で push し、それぞれ run が赤になることと**赤くなったステップと出力**を確認する。確認後、この PR は**マージせずクローズし、ブランチを削除する**。

> §3.3 の `if: !cancelled()` により、1種だけ壊した run では**その1ステップだけが赤で、残りは green** になる。これも併せて確認すること（ステップの独立性が効いている証拠）。

10. **型エラーで落ちる**
    `src/api/range.ts` の末尾に `export const __ciProbe: number = 'x';` を追加して push。
    → **`Typecheck + build` ステップが赤**。ログに:
    ```
    src/api/range.ts(95,14): error TS2322: Type 'string' is not assignable to type 'number'.
    ```
    （行番号は追加位置による。`error TS2322` が出ることが要点。ローカルで実測済みの出力）
    `Lint` と `Test` は green のままであること。

11. **テスト失敗で落ちる**
    `src/api/range.test.ts` の期待値をどれか1つだけ意図的に狂わせて push（例: 期待日数を +1 する）。
    → **`Test` ステップが赤**。ログに `Tests  1 failed | 69 passed (70)` 相当。
    `Lint` と `Typecheck + build` は green のままであること。

12. **lint エラーで落ちる**
    §4.3 のとおり **warning では落ちない**ので、`error` 設定の `react/rules-of-hooks` を踏むこと。`src/` に以下のファイル（例: `src/__ciProbe.tsx`）を追加して push:
    ```tsx
    import { useState } from 'react';
    export function CiProbe({ flag }: { flag: boolean }) {
      if (flag) {
        const [n] = useState(0);
        return <span>{n}</span>;
      }
      return null;
    }
    ```
    → **`Lint` ステップが赤**。ログに:
    ```
    error react-hooks(rules-of-hooks): React Hook "useState" is called conditionally.
    ```
    （ローカルで実測済み。`npx oxlint` の exit code が 1 であることも確認済み）
    **`debugger` 文や重複キーを使わないこと** — それらは warning で exit 0 になり、この検証が偽陰性になる。

13. **`package-lock.json` の不整合で落ちる（#3 の回帰そのもの）**
    ローカルで `npm install --legacy-peer-deps` を実行し、**書き換わった `package-lock.json` だけを**コミットして push。
    （実測: この install 自体は exit 0 で成功し、lock から `node_modules/react-is`（peer）が消え、`@types/react` と `csstype` に `"dev": true` が付く）
    → **`Install` ステップが赤**。ログに:
    ```
    npm error code EUSAGE
    npm error `npm ci` can only install packages when your package.json and package-lock.json ... are in sync.
    npm error Missing: react-is@19.2.8 from lock file
    ```
    かつ **`Lint` / `Typecheck + build` / `Test` の3ステップが `skipped`** になっていること（`steps.install.outcome` ガードが効いている証拠）。

14. **後始末**
    `ci-negative-check` の PR をクローズし、ブランチを削除する。ローカルの作業ツリーで `git status --porcelain` が空、`package-lock.json` が main と同一（`git diff main -- package-lock.json` が engines の3行だけ）であること。

### フェーズ D: 最終確認

15. **本番 PR が green のまま**
    フェーズ B の PR を再確認し、Checks が green であること。マージは統括担当が行う。

16. **Node 選定理由が記録されていること**
    本設計書 §1 に、依存の `engines` 実測表・Node 23 が除外される理由・`.nvmrc` を単一情報源にした理由が書かれていること（Issue #26 の完了条件「Node バージョンの選定理由が記録されている」に対応）。

---

## 6. 後続 Issue への引き継ぎ

- **#16（デプロイ）**: 本ワークフローは `dist/` を artifact にアップロードしていない。デプロイ側で必要になったら、`Typecheck + build` の後に `actions/upload-artifact@v7`（2026-08-22 時点の最新リリース）を足す形になる。**別ワークフロー（`deploy.yml`）に分けるか、本 `ci.yml` に `deploy` ジョブを `needs: verify` で足すか**は #16 で決めること。`vite.config.ts` の `base` は依然として未設定であり、`npm run build` は `/` 前提で通っている
- **ブランチ保護**: CI が必須チェックになるかはリポジトリ設定次第（オーナー判断）。設定しない限り、赤でもマージできてしまう
- **oxlint の severity（§4.3）**: `react/rules-of-hooks` 以外は warning 止まりで CI を落とせない。main に既存 warning が 5 件ある。**別Issue化を提案**
- **ジョブ分割の再検討ライン（§3.2）**: 現状は合計 12 秒で1ジョブが最速。`npm test` が 1 分を超えたあたりで `needs:` による並列化を検討する
- **Node の更新**: 2026-10 に Node 26 が Current になり 24 が Maintenance に落ちる。`.nvmrc` の 1行を変えるだけで CI 側は追随できる設計にしてある
- **ローカル Node 23**: オーナー環境の 24 への移行は本Issueの完了条件に含めていない。移行するまで、ローカルの `npm test` は vitest の非サポート engine 上で走り続ける

---

## 7. 実挙動未確認の箇所

正直に列挙する。

1. **GitHub Actions ランナー上での実行時間**。§3.1 はすべてローカル実測値で、ランナー（`ubuntu-latest`）での所要時間・ジョブ起動オーバーヘッドは未計測。ジョブ分割の判断はローカル実測からの推論
2. **`cache: npm` のヒット率と短縮効果**。キャッシュ機構の仕様は `actions/setup-node` の `action.yml` を実物で確認したが、実際のヒット挙動は未確認。受け入れ条件 9 で検収担当が実測すること
3. **`actions/checkout@v7` / `actions/setup-node@v7` の実動作**。最新リリースタグは `gh api` で実取得したが、本ワークフローでの実行は未確認
4. **`if: ${{ !cancelled() && steps.install.outcome == 'success' }}` の実挙動**。GitHub Actions の式評価は未実行。受け入れ条件 10〜13 が同時にこの検証を兼ねている。**もしこの式が期待どおり動かなかった場合**は、`if: ${{ !cancelled() }}` に落として `Install` 失敗時に後続がノイズを出すのを許容する（ジョブ全体が赤になる点は変わらないため、CI の実効性は損なわれない）
5. **ランナーの Node 24 で 70 件が green かどうか**。ローカル（Node 23）では green。Node 24 での実行は未確認で、受け入れ条件 7 が初回の実測になる
