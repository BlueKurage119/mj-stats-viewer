# Issue #15 設計書: ローディング・空・エラー状態

対象: [#15](https://github.com/BlueKurage119/mj-stats-viewer/issues/15)

作成日: 2026-10-07

設計対象の基準コミット: `fe485da`（#14 / PR #48 マージ済み）

参照: `docs/requirements.md` §3・§5.2・§5.3・§7、既存 #3・#6・#8〜#14 設計書。

本書は既存設計の**取得状態とその表示に関する部分を更新する**。計算式・指標・モード選定規則は既存仕様を維持する。設計段階ではアプリケーションコードを変更しない。

## 1. 目的と範囲

取得が完了した領域から表示し、失敗は失敗として伝え、利用者が同じ条件で再試行できるようにする。失敗やデータ不足を永久スケルトン・0%・空グラフに変換しない。

対象は検索、現在段位、期間内基本成績、期間内詳細スタッツ、比較用代表モード選定、母集団分布、段位分布。共有の表示部品と dev 専用の状態再現環境を追加する。

対象外は #16 デプロイ、#17 履歴・順位グラフ、指標定義の訂正、色のシード変更、API の新規利用、汎用データ取得ライブラリの導入、自動ポーリング。段位ptの確定値を示す既存プログレスバーはローディング用スピナーとは区別し、維持する。

## 2. 実物調査と設計判断

以下は基準コミットのコードを読んで確認した事項。ブラウザの実測結果ではない。

| 現状 | 根拠 | 対応 |
|---|---|---|
| 基本成績・詳細スタッツを `Promise.all` で待つ。片方の失敗が全体エラーになる | `filters/useFilteredStats.ts` | 個別に状態を更新し、基本成績だけでも表示する |
| `PlayerScope` は取得状態のみで、再試行関数を持たない | `filters/playerScope.ts` | 取得単位の再試行を供給する |
| 主要画面にスケルトンがある。本番画面に Circular/LinearProgress の利用なし | `summary`・`compare`・`stats`・`search`、利用箇所検索 | 既存形状を再利用し、スピナー追加は不要 |
| 主要スタッツ・打ち筋は別取得の loading を OR で集約し、その後にエラーを見る | `KeyStatsCard.tsx`・`PlaystyleCard.tsx` | 領域の依存関係に従って評価し、既知の障害を隠さない |
| 段位分布は `loading || !view` を loading とする | `LevelDistributionCard.tsx` | error・empty を明示的に渡す |
| 比較は `rep.error`・`modeStats.error`・母集団 error の専用導線がない。基本成績の empty も直接処理しない | `ComparePanel.tsx` | 親の terminal 状態を先に評価し、依存フックの待機を表示上の loading にしない |
| 検索にはスケルトン・0件・再試行がある | `SearchPage.tsx`・`useSearch.ts` | 動作を維持し、障害分類・表示部品を揃える |
| エラーは日本語文言へ変換されるが、変換後はメンテナンスの種別を失う | `filterErrors.ts`・`searchState.ts` | 文言とは別に種別を保持する |
| 404 は基本成績・詳細スタッツのみ null に変換される | `api/client.ts`・`endpoints.ts` | 対局なし・詳細データなしに変換。他 endpoint の 404 は障害 |
| APIキャッシュは失敗 Promise を削除し、成功結果・進行中 Promise を共有する | `api/client.ts` | 全キャッシュ削除・retry 用 tag 追加は不要 |
| 現在段位と期間内基本成績は条件一致時に同じ URL を共有する | `getCurrentLevel`・`getPlayerStats` | 再試行で他の利用者の共有リクエストを abort しない |
| range と tag は1時間単位。再試行時刻が境界を跨ぐと URL が変わり得る | `api/range.ts`・`endpoints.ts` | 同一取得世代内の range は固定。時間境界で tag が更新される既存仕様は維持 |
| ヒーローは固定4行。error 領域に `min-height: 94px` がある | `IdentityCard.tsx`・`summary.css`、#8 設計 | ボタンを含む文言を収める。ヒーローへ可変長の通知を積み増さない |
| MD TextButton ラッパー、focus/blur/softDisabled がある | `components/md/Button.ts`、`node_modules/@material/web/button/internal/button.d.ts` | 既存ラッパーを使う。フォーカス挙動は検証時に実測 |

事前確認の baseline は 51ファイル・601テスト成功、型チェック・ビルド成功、lint はエラー0・既存警告5件。ビルド JS gzip は 152.75 kB（サイズ警告あり）。#14 の過去のバンドル上限を本 Issue の baseline として流用しない。

## 3. 状態モデルと公開インターフェース

### 3.1 共通の障害分類

`src/feedback/requestIssue.ts` を追加する。HTTP status は内部の検証・診断用で、画面の主文言には含めない。既存 describe 系関数は既存テスト・文言互換のため残し、新規 UI は以下を利用する。

```ts
export type RequestIssue = {
  readonly kind: 'network' | 'http' | 'maintenance' | 'unknown';
  readonly message: string;
  readonly status?: number;
};
export function toRequestIssue(error: unknown): RequestIssue;
export type ResourceState<T> =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly data: T }
  | { readonly kind: 'empty' }
  | { readonly kind: 'error'; readonly issue: RequestIssue };
export interface RetryResource<S> {
  readonly state: S;
  readonly retry: () => void;
  readonly retryingIssue: RequestIssue | null;
}
```

MaintenanceError は maintenance、ApiError status=0 は network、その他 ApiError は http、その他例外は unknown。abort による不要な取得の終了は表示しない。メッセージの一致・部分一致で種別を判定しない。サーバー由来の生文言・URL・プレイヤーIDは表示しない。

既存の error union には `issue: RequestIssue` を追加し、`message: string` は互換用に保持する（`issue.message` と一致）。dev ギャラリー・テストの error fixture も更新する。

### 3.2 基本成績と詳細スタッツの分離

既存 `FilteredStatsState` の外側は維持する。基本成績が ready になった時点で ready を返し、その内側に詳細スタッツの独立状態を置く。

```ts
export type ExtendedStatsState = ResourceState<PlayerExtendedStats>;
export type FilteredStatsState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'empty' }
  | { readonly kind: 'error'; readonly message: string;
      readonly issue: RequestIssue }
  | { readonly kind: 'ready'; readonly stats: PlayerStats;
      readonly extended: PlayerExtendedStats | null;
      readonly extendedState: ExtendedStatsState };
export type StatsRetryTarget = 'stats' | 'extended' | 'failed';
export interface FilteredStatsResource {
  readonly state: FilteredStatsState;
  readonly retry: (target?: StatsRetryTarget) => void;
  readonly retryingIssues:
    Readonly<Partial<Record<'stats' | 'extended', RequestIssue>>>;
}
export function useFilteredStats(
  numPlayers: NumPlayers, playerId: number,
  filter: GlobalFilter | null, delayMs?: number,
): FilteredStatsResource;
```

`extended` は extendedState.ready の data と同一参照。それ以外は null。これは既存ビューモデル向けの投影であり、**null を loading/empty/error の判定に使わない**。基本成績の取得終了を詳細スタッツ待ちで遅らせない。詳細だけ先に成功しても、基本成績が loading の間は外側 loading。

基本成績 null または正常な gameCount=0 は empty。詳細 null は extendedState.empty。正常レスポンスで局数ゼロ・和了回数ゼロなどが成立する場合は、ready データ内の母数不足として扱う。勝手な最小対局数閾値は追加しない。既存計算で値を定義できないもののみ `—` / データ不足にする。

### 3.3 他のフックと配線

```ts
useCurrentIdentity(np: NumPlayers, id: number): RetryResource<CurrentIdentityState>;
useGlobalHistogram(np: NumPlayers): RetryResource<DistributionState>;
useLevelStatistics(np: NumPlayers): RetryResource<LevelStatisticsState>;
// 引数は現行の args 型を維持する。
useRepresentativeMode(args: RepresentativeModeArgs): RetryResource<RepresentativeModeState>;
```

`RepresentativeModeArgs` は現在の引数オブジェクトを名前付き interface にするだけ。候補1つなら追加取得0本、複数なら既存の候補数分の基本成績を利用する規則を維持する。候補の取得が完了して全て null / gameCount=0 なら empty とし、存在しない代表モードの成績取得へ進まない。

PlayerLayout は各 resource の `.state` を現行 scope の欄に渡し、PlayerScope に次を追加する。

```ts
readonly retryIdentity: () => void;
readonly retryStats: (target?: StatsRetryTarget) => void;
readonly retryDistribution: () => void;
readonly identityRetryingIssue: RequestIssue | null;
readonly statsRetryingIssues:
  Readonly<Partial<Record<'stats' | 'extended', RequestIssue>>>;
readonly distributionRetryingIssue: RequestIssue | null;
```

ComparePanel 内の代表選定・単一モード成績・段位分布の再試行は、そのローカル resource が所有する。検索は現行 UseSearch の返り値の既存フィールドを維持し、`retryingIssue: RequestIssue | null` と SearchState.error の issue を加える。

retryingIssue(s) は手動再試行を受け付けたときだけ直前の障害を保持する表示用メタデータ。取得中はこれで同じ通知・ボタンを描画し、ボタン文言を「再試行中…」にして無効化する。成功/empty/新しいerror/条件変更でクリアする。初回loadingでは null / 空オブジェクト。通知側は現在のerrorを優先し、errorがないときだけretryingIssueを利用する。古い障害を新条件に残さない。

## 4. 再試行・競合の規則

1. 初回は既存と同じ取得本数。基本成績と詳細スタッツは並列開始し、個別に完了を反映する。汎用キャッシュや新 endpoint は追加しない。
2. 成績 `retry()` の既定 target は failed。現在 error の部分だけを loading に戻して再実行する。明示 target も error の部分だけを対象とし、ready・empty・loading への要求は no-op。他のフックも error 時だけ再試行を受け付ける。
3. 成功済みデータは同じ取得条件の中で保持する。詳細だけの再試行では順位・成長などを消さない。基本成績の再試行でも内部で成功済みの詳細を捨てない。
4. クリック直後に同期的に再試行受付をロックし、effect の開始までの連打も1回にする。取得中は再試行ボタンを無効にする。自動再試行、全画面リロード、キャッシュ全消去は行わない。
5. フィルタ変更は既存250ms debounce、初回と再試行は即時。再試行は**画面で選択中の最新条件**を使う。debounce 未確定の別条件へ古い error ボタンから再試行しない。
6. 条件の識別は人数・playerId・canonical modes・period。identity は人数・playerId、分布は人数。条件変更時に世代を更新し、旧データ・旧エラーは新条件の表示へ流用しない。debounce 待機中も新条件の loading を表示し、旧応答の反映を拒否する。
7. 同一取得世代の resolved range を基本成績・詳細・その再試行で共有する。代表候補の再試行も選定世代の range を再利用する。画面条件を変えた場合のみ新世代の range を解決する。
8. resolveRange 失敗は依存する基本・詳細両方の障害。failed 再試行は range 解決からやり直す。基本404と詳細障害が同時の場合は「対局なし」を優先し、不要な詳細エラー通知を出さない。
9. API client の失敗キャッシュ削除、成功キャッシュ、in-flight dedupe を維持する。同一条件の再試行は現在進行中の別の成功取得を abort しない。画面条件変更・unmount 時は消費側の世代guardで結果反映を中止し、StrictMode と共有 URL の中断キャッシュ回帰を確認する。
   **製造時の補足**: 現在段位・基本成績・詳細・代表選定は同一URLを共有するため、consumerのAbortSignalを共有API Promiseへ渡さない。旧要求は終了までキャッシュが所有し、旧世代への反映をguardで拒否する。API clientの既存abort規約は変更しない。検索も同じresource機構を使い、古い応答を反映しない。待機中の通信自体は継続する（既存のタイムアウト・ミラーフォールバック上限内）。これは共有待機者を道連れにしないための変更で、要求の新規追加・自動再試行はしない。
10. 再試行中も別条件へ切り替えられる。旧世代で成功・失敗が後着しても新世代を上書きしない。hook 返り値・callback は安定化し、filter のオブジェクト再生成による再取得ループを発生させない。

## 5. 表示と依存関係

### 5.1 表示文言

| 状態 | 表示 | 操作 |
|---|---|---|
| 期間内の基本成績なし | この期間の対局はありません | モードや期間を変更してください（再試行なし） |
| 現在段位 notFound | プレイヤーが見つかりませんでした | 検索へ戻る |
| 検索0件 | 該当するプレイヤーが見つかりませんでした | 入力・人数切替を維持 |
| 詳細スタッツなし | この期間の詳細スタッツはありません | モードや期間を変更してください |
| 母数不足 | この指標を表示するためのデータが足りません | 再試行なし。個別値は `—` |
| 対象分布が空 | 卓全体の分布データがありません / 段位分布データがありません | 再試行なし |
| network | データを取得できませんでした。接続を確認して、もう一度お試しください。 | 再試行 |
| http / unknown | データを取得できませんでした。 | 再試行 |
| maintenance | サーバーがメンテナンス中です。しばらくしてからお試しください。 | 手動の再試行 |

検索の障害主語は「検索結果」、通知見出しは取得元に応じて「現在の段位」「詳細スタッツ」「卓全体の分布」など。空は障害色にしない。正常な0件・母数不足と通信エラーを区別する。

### 5.2 カードごとの規則

| 領域 | 必要データと状態の扱い |
|---|---|
| 現在段位ヒーロー | identity のみ。error は文言と再試行、notFound は検索へのリンク。固定4行相当の高さを維持 |
| 段位詳細 | identity loading はタイトル・通算戦数位置のスケルトン枠を表示。error/notFound はヒーローが通知を所有し、このカードは非表示。ready の条件表示は従来どおり |
| 順位カード | 基本成績 ready で表示。詳細 loading/error に左右されない。詳細依存の局数はセル単位で loading / `—` に分ける |
| 打ち筋 | 詳細と母集団の両方が必要。基本成績 empty を最優先、その後必須取得の error、詳細 empty、必須取得の loading、ready の順で評価 |
| 主要スタッツ | 詳細 ready なら自分の値を表示。母集団 loading は平均差分だけスケルトン、error は差分 `—` と取得元の通知。カード全体を待たせない |
| 和銃分布 | 詳細 loading/empty/error を区別。内訳の母数0は各ドーナツ単位でデータ不足。他の正常なドーナツは維持 |
| スタッツ9セクション | 基本成績 ready で順位など表示可能な行を描画。詳細 loading は詳細依存の値セルだけスケルトン。詳細 error/empty は該当値 `—` と1つの通知。成長は基本成績・identity に依存し、identity loading はそのセクションだけ待つ |
| 比較・段位分布 | levelStats の loading/ready/error を明示。ready でも total<=0 または bars が空なら empty。自分の段位未取得でも母集団の棒は表示可能 |
| 比較・14指標 | 代表モードが ready なら母集団のグラフと自分の値を独立表示。自分の詳細 loading/error/empty でも母集団が ready ならグラフを残す。母集団 error でも自分の値が ready なら残す。自分の値がないとき上位%・自己マーカーを出さない |

順位カードの `buildRankView`、スタッツの `buildStatsView`、成長・和銃分布の計算式は変更しない。**表示層で取得依存を判定する**。無効値や分母0に数値0を補完しない。詳細の一部キーだけ欠ける場合は該当値 `—` とし、全カードを空扱いしない。

ComparePanel の早期 return を改め、段位分布を常に独立描画する。比較指標領域では、scope.stats の empty/error → rep の empty/error → rep ready 後の modeStats 状態を評価する。親が empty/error のため rep/modeStats が「起動待ち」の場合、それを loading として表示しない。scope.stats.ready 後は rep が詳細を待たず基本成績の played_modes を使える。

scope.stats.error 時は期間内基本成績の再試行、rep.error 時は代表選定の再試行、modeStats.error 時は単一モード基本成績の再試行。母集団・段位分布はそれぞれ自身の再試行。override と現在のフィルタは再試行でリセットしない。

### 5.3 共通表示部品

`src/feedback/RequestFeedback.tsx` と `feedback.css` を追加する。

```ts
export interface RequestFeedbackProps {
  readonly source: string;
  readonly kind: 'empty' | 'insufficient' | 'error' | 'maintenance';
  readonly message: string;
  readonly onRetry?: () => void;
  readonly retrying?: boolean;
  readonly compact?: boolean;
}
export function RequestFeedback(props: RequestFeedbackProps): ReactElement;
```

Outlined 相当の通知枠、既存 typescale、MD TextButton を用いる。empty は surface-container / on-surface-variant、error は error-container / on-error-container、maintenance は surface-container / on-surface。色は既存トークンのみ。アイコンは既存 Icon で search_off / info / error_outline / construction、装飾扱いで aria-hidden。具体的な余白は既存カード内の余白を継承する。

同じ取得元が複数カードに影響する場合、**1パネルにつき1取得元1通知・1再試行ボタン**。カード内は短い不足メッセージを出しても再試行と live 通知を重複させない。identity の通知は常時見えるヒーローが所有し、段位詳細に複製しない。

HistogramCard は単一 loading を互換用に残し、`valueLoading?: boolean` と `distributionLoading?: boolean` を追加する。両方未指定なら現行 loading に従う。片方のみ待機時は他方を表示する。段位分布には `issue?: RequestIssue`・`onRetry?: () => void` を追加し、issue → loading → empty → ready を明示判定する。既存ギャラリーの通常 props で動作を保つ。

### 5.4 アクセシビリティ・モーション・レイアウト

- 各領域に `aria-busy` を付け、スケルトン自体は aria-hidden。数値が未取得の枠をグラフの実データとして読み上げない。
- error/empty の領域は loading のpulseを停止し、`data-state` を terminal にする。高さ確保用の装飾枠を残す場合も、取得が続いているように見せない。
- loading の開始・empty・error・復帰は取得元単位の常設 `role=status` / aria-live=polite で通知する。通知文は aria-busy な内容領域の外に置く。14指標それぞれに live region を作らない。
- ボタンは Tab/Enter/Space で操作可能にする。再試行でフォーカスを失わせない。読み込み中はボタンを同じ位置に無効状態で保持し、成功で消すときはその取得元の見出しへフォーカスを戻す。利用者が途中で別要素へ移動した場合はフォーカスを奪わない。
- pulse は既存の検索スケルトン程度の控えめな表現に揃え、prefers-reduced-motion=reduce で停止する。必須の待ち時間・成功時の過剰なアニメーションは追加しない。
- 既存のカード枠・タイトル・行数を loading/ready で揃える。固定高さへの切り詰めで error 文言やボタンを隠さない。ヒーローの既存126pxは #8 の設計値であり、本変更後は各幅で実測する。収まらなければ設計を修正し、黙ってヒーローを伸ばさない。
- 段位詳細は条件が可変であり、全状態の高さ完全一致は要求しない。スタッツの表形式・2列レイアウト・ツールチップの排他制御は維持する。

## 6. モジュール変更範囲

| 対象 | 責務 |
|---|---|
| `feedback/requestIssue.ts`・`RequestFeedback.tsx`・CSS | 障害分類・型・共通通知 |
| `filters/useFilteredStats.ts` | 基本/詳細の独立完了、世代管理、部分再試行 |
| identity / histogram / levelStats フック | error 種別、再試行、後着応答抑制 |
| `filters/playerScope.ts`・`shell/PlayerLayout.tsx` | resource.state と callbacks の配線 |
| `compare/useRepresentativeMode.ts` | 再試行と全候補対局なしの判定 |
| サマリー各カード・SummaryPanel・CSS | 依存状態の評価、値/差分の分離、通知集約 |
| ComparePanel・HistogramCard・LevelDistributionCard | 独立描画、失敗導線、分布と値の独立待機 |
| StatsPanel・StatsSection・CSS | 行/セクション単位の loading、通知、既存レイアウト保持 |
| searchState・useSearch・SearchPage | issue を保持し、既存検索を共通通知へ接続 |
| dev ギャラリー、`main.tsx` | 更新された props/fixture、状態再現ルート |
| 意味のある状態/取得テスト | 競合、再試行、部分失敗、表示分岐の検証 |

API client と endpoint の本番挙動は変更予定なし。調査で必要性が出た場合は共有キャッシュ・中断規約への影響を設計に追記してから変更する。domain の式・fixtures の数値は変更しない。

## 7. APIアクセスなしの再現環境

`#/__states` に StateGallery を追加する。`main.tsx` の `import.meta.env.DEV` リテラル分岐内の動的 import を維持する。

見本を並べるだけではなく、実フックと実画面を MemoryRouter で動かす。PlayerLayout の既存ルートをサマリー/比較/スタッツとともに組み込み、検索も実 SearchPage を使う。Router/フックの配置をコピーして別の疑似画面を作らない。StateGallery が mount する前に dev 専用 fixtureFetch をインストールし、認証不要の対象 endpoint を既存の匿名fixtureで返す。未知 URL は拒否し、実ネットワークへフォールスルーさせない。URL の query は固定文字列ではなく pathname・mode・range を解釈する。unmount 後に fetch を復元する。dev 専用初期化も StrictMode の二重 mount に耐える。

シナリオ変更はページ reload で行い、モジュール内の成功キャッシュによる見かけ上の復帰を防ぐ。通常 endpoint は成功、対象 endpoint は指定回数だけ失敗→成功とする。時間はテストで制御できる deferred response を優先し、実ネットワークのタイムアウトを待たない。

必須シナリオ: 全成功、取得順序を入れ替えた遅延、基本404、詳細404、検索0件、局数/内訳母数0、基本だけ障害、詳細だけ障害、母集団だけ障害、段位分布だけ障害、代表選定だけ障害、単一モード基本/詳細だけ障害、全ミラー fetch reject、maintenance、遅い旧条件と速い新条件。response.json・HTTP status・AbortSignal を本番 client と同じ経路で通す。

fixtureFetch は要求履歴（endpoint・mode・range・回数・abort）を表示する。基本/詳細404は404 Response、検索0件は200と配列[]、maintenanceは200と `{maintenance: 'fixture'}`、全ミラー失敗はfetch reject。母集団の正常な空データと取得障害は別シナリオ。匿名fixtureの内部整合しない箇所は精度検証に使わず、当該指標の母数を明示して構成する。

新規テスト依存を入れる前に既存環境で検証する。純粋状態判定は Vitest、表示は既存の renderToStaticMarkup、effect・クリック・競合は上記実フックのブラウザ再現環境で検証する。SSRテストだけで再試行や競合を検証済みと扱わない。

## 8. 受け入れ条件

チェックは設計時点では未実施。製造・検収は実行条件と結果を残す。B群は dev server の `#/__states` で行い、要求履歴と実 DOM の状態を併せて確認する。

### A. 分類・値・構造（Vitest）

- [ ] A1: MaintenanceError / ApiError(0) / ApiError(500) / Error('secret') を入力し、それぞれ maintenance/network/http/unknown、HTTP内部値500、生文言非露出を assert する。
- [ ] A2: 基本ready・詳細loading/error/empty の各fixtureで、順位の回数・割合は同じ値を表示し、詳細依存の局数が loading のみスケルトン、terminal は `—` になる。
- [ ] A3: 詳細ready・母集団loading/error の主要スタッツを描画し、6つの自分の値が ready 時と一致し、平均差分のみ待機/未取得になる。
- [ ] A4: 打ち筋で詳細error+母集団loading と詳細loading+母集団error をそれぞれ描画し、error 表示になり、必須データの error を loading が隠さない。
- [ ] A5: HistogramCard の値ready/分布loading、値loading/分布ready、値欠落/分布ready を描画し、残せる領域がある。自分の値がない場合は上位%と自己マーカーを出さない。
- [ ] A6: 段位分布の issue / loading / total=0 / 正常view を描画し、順に error/loading/empty/ready。error と empty にスケルトンがない。
- [ ] A7: 局数0・内訳合計0・一部キー欠落fixtureで、NaN/Infinity が表示されず、欠落を0%に変換せず、正常な隣接指標を残す。既存の正常な0%は0%を表示する。

### B. フックと実画面の状態遷移（ブラウザ）

- [ ] B1: 基本を先に解決し詳細を保留する。順位が表示され、詳細依存領域が待機する。逆順も実施し、最後は両データが同じ世代で ready になる。
- [ ] B2: 基本404+詳細障害を設定し3タブを開く。「この期間の対局はありません」が出る。サマリーの段位詳細と比較の段位分布は独立表示し、詳細障害ボタン・永久スケルトンはない。
- [ ] B3: 基本正常・詳細404で、順位が残り、詳細なしの案内が1つ表示され、詳細の再試行ボタンはない。検索0件でも同じく障害扱いにならない。
- [ ] B4: 詳細だけ失敗→成功に設定。詳細の再試行を連続2回押し、1回だけ受け付ける。同じ時間帯・同じrange/modeの基本成績は追加取得されず、詳細が復帰し通知が消える。
- [ ] B5: 基本だけ失敗・詳細成功に設定。基本の再試行で成功済み詳細を再取得せずに復帰する。基本と詳細が両方失敗なら failed 再試行が双方を対象にする。
- [ ] B6: 母集団だけ失敗→成功に設定。主要スタッツの自分の値と和銃分布・順位は残り、母集団の1つのボタンで差分/打ち筋/比較分布が復帰する。プレイヤー成績の追加取得なし。
- [ ] B7: 段位分布だけ障害に設定し、段位分布のerrorが表示される。再試行で復帰し、14指標側に追加取得がない。正常な空分布では empty となりボタンなし。
- [ ] B8: 代表選定errorと単一モード基本errorを別々に再現。比較指標領域が起動待ちスケルトンに留まらず、正しい取得元の再試行で復帰する。選択override・periodは維持される。
- [ ] B9: 全候補の基本成績がnull/0戦のシナリオで比較指標領域は対局なし。単一モード成績の不要な取得は発生しない。
- [ ] B10: 各取得元のmaintenanceを再現し、メンテ文言と手動再試行が表示される。未知404/HTTP500は障害、全ミラーrejectはnetwork。待機時間の経過だけで新しい要求が発生しない。
- [ ] B11: 旧periodの遅い成功/失敗を保留し、新periodの成功を解決後、旧応答を解決する。画面の新値・状態・URLが変わらない。人数・playerId変更も実施する。
- [ ] B12: フィルタのdebounce中に古いerrorの再試行を試みる。古い条件を再要求せず、最新条件の取得だけが確定する。再試行中の別条件変更もB11と同じ結果になる。
- [ ] B13: 現在段位errorの再試行と全期間・全モード基本成績の同一URL共有を再現。片方の再試行が他方を中断しない。StrictMode二重mount後も新しい待機者がabort済みPromiseを掴まない（既存#38テストも成功）。
- [ ] B14: identity/母集団/段位分布をそれぞれ単独遅延し、依存しないカードが表示される。検索の連打・入力変更・人数変更でも古い検索結果が後着表示されない。

### C. UIとアクセシビリティ（ブラウザ実測）

- [ ] C1: 幅375/840/1280pxで全状態を表示。readyとloadingのヒーローの getBoundingClientRect().height が同じ。error/maintenance/notFound の文言・ボタンが枠内に収まり、横スクロールやクリップなし。計測時の clientWidth と scrollbar 条件を記録する。
- [ ] C2: ライト/ダーク双方で通知・値・スケルトンが読める。色のハードコードなし。新規通知の文字/背景は実際のcomputed colorでコントラスト比4.5以上を確認する。
- [ ] C3: Tab/Enter/Spaceで再試行が1回動作し、取得中はボタンが同じ位置に無効状態で残る。完了時のフォーカスが取得元見出しへ戻り、別要素へ移動済みなら移動先を維持する。
- [ ] C4: DOMとアクセシビリティツリーで aria-busy と取得元単位の status を確認。スケルトンが実際の数値として読まれず、同じ障害のlive通知や再試行ボタンが14個並ばない。
- [ ] C5: prefers-reduced-motion=reduce でスケルトンpulseが停止する。ready/loading切替で通知を重ねたり一定時間表示を遅らせたりしない。
- [ ] C6: スタッツの2列構成・分布3表・注記ツールチップ排他制御が維持される。新規通知がstickyフィルタや操作ボタンを覆わない。

### D. 回帰と検証の規律

- [ ] D1: npm test / npm run lint / npm run build が成功。既存lint警告5件とサイズ警告はbaselineとして記録し、新規警告を増やさない。
- [ ] D2: dev状態再現ルートでネットワークログを確認し、実amae-koromoへの要求0件。production buildにStateGallery/fixtureFetchの実体が含まれない（文字列grepだけでなくbundle内のfixture固有文字列・出力ファイルを確認）。
- [ ] D3: 既存のAPI・domainテストが成功し、変更前後の正常fixture値が一致する。新規本番依存なし。gzip差分をbaseline 152.75kBと比較して記録し、大きな増分があれば内訳を説明する。
- [ ] D4: 新規の意味あるテストはredを先に確認する。意味を変えない改変が成功する対照実験の後、「errorよりloadingを優先」「失敗retryで全resourceを更新」「旧世代の応答guardを外す」のうち実装に対応する改変で、該当テスト/ブラウザ手順が失敗することを確認して戻す。

## 9. 実装順序・未確認事項・引き継ぎ

実装順序は共通分類 → 成績の独立状態・retry → scope配線 → 各カードと比較の依存処理 → 共通通知 → dev再現環境 → 受け入れ条件検証。返り値変更とfixture更新は同じ変更内で完結させ、型エラーのある途中状態を完成として扱わない。

**実挙動未確認**: 本設計時点では、MDボタンの無効化中/完了後の実フォーカス、通知を入れたヒーローの高さと狭幅での収まり、テーマ全組合せの新規通知のコントラスト、読み上げ実機での通知回数、shared URLの複数待機者とpartial retryの実挙動、全状態のモーションは未検証。C/B群で確認する。ブラウザDOMで確認できる項目を人間へ逆発注しない。実機タッチ・主観的モーション・読み上げなど環境上確認できない項目だけ、既存 `docs/ui-verification/README.md` に従い手順書と未確認範囲を残す。

本設計では外部amae-koromo APIを呼んでいない。404・maintenanceの形は既存API実装/仕様に依拠する。数値・コントラスト・バンドル増分の新規実測は製造後に行い、未測定値を測定済みとして扱わない。

#16はbaselineの既存lint/サイズ警告とdevルート除外の検証を引き継ぐ。#17は独立した取得状態・通知・retryの規約を再利用し、CAP保護を迂回しない。既存の四麻「ラス率」と「逆連対率」の差、暫定ラベル、fixture内部整合性などは#15で定義を変更しない。
