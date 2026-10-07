# Issue #15 — 製造時の状態表示・再試行検証

設計: [状態表示と再試行](../design/issue-15-loading-empty-error.md)。基準コミットは `fe485da`、作業ブランチは `codex/issue-15-loading-empty-error`。

## 実行環境と再現方法

2026-10-07、Node 24.20.0、Vitest 4.1.11、ローカル Vite + Playwright Chromium headless で実行。新しい本番依存・テスト依存は追加していない。Playwright は作業環境に既存のものを利用する。検証ルートは dev 専用で、通常の API URL へアクセスする必要はない。

```sh
npm test
npm run lint
npm run build
npm run dev -- --host 127.0.0.1
# 別のターミナル。ポートが変更された場合は実際の値を指定する
MJSV_FIXTURE_URL=http://127.0.0.1:5173 node scripts/verify-issue-15.mjs
```

実際には既存サーバーとの競合を避けて5175番で実行した。`#/__states` はシナリオ、画面、テーマ、応答保留/解決、要求履歴を表示する。実フック・実画面・API clientを通す。fixtureの分布はdomainの正常な匿名fixtureを各モードに割り当てており、指標の統計的精度を評価するデータではない。

ブラウザではローカルorigin以外の要求をすべて遮断。実amae-koromoへの要求は0件。既存のGoogle Fontsへの要求も遮断したため、証跡はフォールバックフォントで描画されている。別途、Vitestのsetupで未mockのfetchを拒否し、呼び出しがあればafterEachで失敗させた構成でも全447件が成功した。

## 自動検証結果

| 項目 | 結果 |
|---|---|
| 基準コミットのテスト | アーカイブから再実行: 35ファイル、430件成功 |
| 変更後のテスト | 39ファイル、447件成功（17件追加） |
| 型チェック・本番ビルド | `npm run build` 成功 |
| lint | エラー0、既存警告5件。ThemeGallery 4件、ThemeProvider 1件 |
| production出力 | HTML 1ファイル、JS/CSS各1ファイル。StateGallery、fixtureFetch、fixture固有メンテ文言・プレイヤー名・見出しを含まない |
| JS gzip | 152.75 → 158.59 kB（+5.84 kB） |
| CSS gzip | 5.81 → 6.12 kB（+0.31 kB、独立検証のCSS修正後） |
| ビルドのサイズ警告 | 基準と同じ500 kB超過警告が残る |
| ブラウザ例外 | 各検証phaseで0件 |

初回の基準件数「51ファイル・601件」は集計誤り。上表が基準コミットから取り直した実測値。API client・endpoint・domainの計算式および数値fixtureは変更していない。

## 状態・取得・画面

| 設計の項目 | 確認内容・結果 |
|---|---|
| A1–A6 | 障害4分類と生文言非露出、詳細待機時の順位維持、自分の6指標と母集団の独立、既知error優先、分布と値の独立、段位分布のterminalをVitestで確認 |
| A7 | 既存domainテストの欠落/0値の回帰成功。局数0・内訳0・母集団emptyの実画面にNaN/Infinityなし |
| B1–B3 | 基本/詳細/母集団/段位の遅延を保留し、独立したカードを表示。詳細エラー・詳細404で基本値を維持 |
| B4–B5 | 基本エラーから再試行して復帰、基本404では対局なし。比較の段位分布は残る。基本emptyと詳細errorの組合せでは不要な詳細再試行なし |
| B6 | 母集団エラーの再試行でプレイヤー基本/詳細の要求数が増えない |
| B7 | 段位分布errorと正常emptyを区別。errorのみ再試行導線。14個の比較グラフは表示を維持 |
| B8–B9 | 代表選定・単一モード基本/詳細エラーから対応するボタンで復帰。候補の対局数0では指標カードを表示しない |
| B10 | 4ミラーrejectとmaintenanceを実client経由で再現、手動再試行で復帰。任意の例外文言は表示しない |
| B11–B12 | 四麻から三麻への変更で旧応答を無視。7日から30日へ変更後、旧条件の成功/エラー応答が後着しても54戦・readyを維持。debounce中の旧retryは取得しない（Vitest） |
| B13 | 共有Promiseのconsumerをabortしない実装。全期間・全モードへ変更し、段位と基本成績の同一URLが1要求に合流して両方readyになることをブラウザ確認。既存APIの共有・中断回帰テスト成功。StrictModeでfixture transportを維持 |
| B14 | 現在段位の遅延中も期間内成績を表示。検索0件、検索error/maintenanceからの再試行と結果1件を確認 |
| C1 | 主な20シナリオを375/840/1280pxで測定。document.scrollWidthはclientWidth以下。ヒーロー126px。成功/段位loading/error/maintenance/notFoundの各状態でヒーロー内部クリップなし |
| C2 | default/傑/豪/聖/魂天 × light/darkで通知文字と背景のcomputed colorを計算。最低5.509:1（light 13.260:1） |
| C3 | Enter/Spaceで再試行。待機中softDisabled、ボタンを維持。完了後に取得元見出しへフォーカス、別要素へ移動済みならそのフォーカスを維持 |
| C4 | statusがbusy要素の外側にあり、詳細取得の通知が1個であることをDOMとアクセシビリティツリーで確認。数値スケルトンはaria-hidden |
| C5 | reduced-motion: reduceでfeedback-skeletonのanimationNameがnone |
| C6 | スタッツ9セクション、順位1表、分布3表、段位待機時の成長5行スケルトンを確認。注記は1個だけ開き、外側クリックで閉じる |
| D1–D3 | 上記全体チェック、API/domain既存テスト成功、dev fixtureの本番除外と増分測定 |

正常時は打ち筋readyとヒストグラム14個のSVG表示も確認。基本と詳細が両方失敗した場合、期間内成績の1回の再試行で失敗した2取得を実行する。詳細だけ失敗した場合は基本成績を再取得しない。共有キャッシュの安全性のため、古いネットワーク自体は中断せず、そのconsumerでの応答適用を止める。

### テストが異常を検出することの確認（D4）

テストを完成扱いにする前に、一時的な実装改変でredを確認した。各変更はfinallyで復元し、復元後に全447件を再実行して成功した。これは既存テストが下記の改変を検出する証拠であり、すべての不具合を検出できる保証ではない。

| 一時改変 | 対象テスト | 結果 |
|---|---|---|
| コメントのみ追加（対照） | useRetryResource | SURVIVED / exit 0 |
| maintenanceをunknownと分類 | requestIssue | KILLED / exit 1 |
| 打ち筋で既知errorより別取得のloadingを優先 | cardStates | KILLED / exit 1 |
| retryで成功/emptyの取得も実行 | useRetryResource・useFilteredStats | KILLED / exit 1 |
| 非active consumerの応答を適用 | useRetryResource | KILLED / exit 1 |

[自動検証の結果JSON](issue-15/results.json) に要求数・計測値・ミューテーション結果を保存。

## 画面証跡

- [詳細だけ障害・375px light](issue-15/error-extended-375.png)
- [詳細だけ障害・375px dark](issue-15/error-extended-dark-375.png)
- [段位分布だけ障害・840px、比較14グラフを維持](issue-15/error-level-840.png)
- [正常スタッツ・840px](issue-15/stats-ready-840.png)

## 未確認範囲と任意の実機確認

製造時の自動チェックは上記範囲。設計B群の全操作組合せを網羅した検収ではない。playerId変更のブラウザ競合、検索の入力/人数変更と後着応答の全組合せ、時間境界のtag変更は専用のブラウザシナリオでは未確認。フックのキー変更・旧応答抑制は自動テストで確認した。

OSのスクリーンリーダーでの実際の通知回数、実機タッチ操作、主観的なフォント/モーションの印象は未確認。必要な場合の手順（目安5分、各項目は合格/不合格/判断保留と理由を記録）:

1. dev画面 `#/__states?scenario=error-extended&tab=summary` を実機で開き、「詳細スタッツ」の障害通知が重複して読まれないか確認する。結果: 未実施。
2. 「詳細スタッツを再試行」を操作し、再試行中と完了を区別して読めるか確認する。結果: 未実施。
3. 同じ画面をスマートフォンで開き、再試行ボタンをタップできるか確認する。結果: 未実施。
4. `slow-extended`でスケルトンの動きとフォントの印象を自由記述する。結果: 未実施。


## サブエージェントによる独立検証

製造担当と別のサブエージェントが基準コミットと差分を読み、全447テスト、build/lint、未mock fetch禁止付き全テスト、本番fixture除外を再実行した。ブラウザ4phaseもローカルorigin限定で再実行し、例外0、3幅のヒーロー126px・横溢れなし、通知コントラスト最低5.509:1を追認した。既存の証跡を作業結果として流用せず、一時アーカイブ内でコメント対照SURVIVED、成功resource再取得の改変4テストKILLED、旧応答guard除去1テストKILLEDを確認した。

追加の一時フックテストでは、検索のquery変更から人数変更まで続けた後の旧成功/失敗応答と、playerId変更後の旧identity応答を無視することも確認した。

独立検証でP2を1件発見: `empty-extended` の打ち筋・主要スタッツ・和銃分布、および `empty-distribution` の打ち筋が、emptyでも既存CSSにより障害色 `rgb(186,26,26)` で描画された。設計§5.1に従い、emptyの文言だけ `--md-sys-color-on-surface-variant` に変更し、error色は維持した。ブラウザ再現スクリプトにも空状態4文言のcomputed color確認を追加した。

今回、オーナーはUI監修を追加で行わない方針を明示した。上記の実機・主観的な未確認範囲は記録として残し、監修の依頼でPR発行を保留しない。文言そのものについて確認を必要とする指摘はなかった。

修正後の限定再検収は合格。light/dark各3シナリオで、emptyは補助文字色（light `rgb(77,70,57)` / dark `rgb(208,197,180)`）、errorは障害色（light `rgb(186,26,26)` / dark `rgb(255,180,171)`）に一致した。build/lintも修正後に再実行して成功。独立検証の要対応・文言確認は残っていない。
