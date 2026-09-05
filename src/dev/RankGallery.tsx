import type { ReactElement } from 'react';
import { useTheme, type ColorModeSetting } from '../theme/ThemeProvider';
import { RankCard } from '../summary/RankCard';
import type { FilteredStatsState } from '../filters/useFilteredStats';
import type { NumPlayers, PlayerExtendedStats, PlayerStats } from '../api';
import '../shell/shell.css';

/**
 * dev 専用の `/__rank` 確認ページ。
 * 本番ビルドでは main.tsx の `import.meta.env.DEV` 分岐により到達不能・emit されない。
 * 受け入れ条件 B1〜B4・B7・B8・B11・B12 の実行基盤。API は一切叩かない（固定状態のみ）。
 * 詳細: docs/design/issue-9-rank-donut.md §4.8
 */

const MODE_OPTIONS: ColorModeSetting[] = ['light', 'dark', 'system'];

// 実在プレイヤーの ID・ニックネームは使わない。
function makeStats(overrides: Partial<PlayerStats> = {}): PlayerStats {
  return {
    id: 1,
    nickname: 'テストプレイヤー',
    gameCount: 54,
    level: { id: 10301, score: 695, delta: -11 },
    max_level: { id: 10301, score: 1184, delta: 0 },
    rank_rates: [0.2037, 0.1481, 0.3888, 0.2592],
    rank_avg_score: [37718, 27250, 21357, 11079],
    avg_rank: 2.7037,
    negative_rate: 0.0555,
    played_modes: [8],
    ...overrides,
  };
}

function makeExtended(roundCount: number): PlayerExtendedStats {
  return { roundCount } as PlayerExtendedStats;
}

interface GalleryEntry {
  readonly label: string;
  readonly state: FilteredStatsState;
  readonly numPlayers: NumPlayers;
}

const LOADING_4P: FilteredStatsState = { kind: 'loading' };
const LOADING_3P: FilteredStatsState = { kind: 'loading' };
const ERROR_STATE: FilteredStatsState = {
  kind: 'error',
  message: 'ネットワークに接続できませんでした。',
};
const READY_4P: FilteredStatsState = {
  kind: 'ready',
  stats: makeStats(),
  extended: makeExtended(194),
};
const READY_3P: FilteredStatsState = {
  kind: 'ready',
  stats: makeStats({
    id: 2,
    nickname: 'テストプレイヤー3',
    gameCount: 120,
    level: { id: 20302, score: 58, delta: 174 },
    max_level: { id: 20302, score: 1000, delta: 0 },
    rank_rates: [0.3002, 0.34, 0.3598],
    rank_avg_score: [62500, 35700, 6800],
    avg_rank: 2.0596,
    negative_rate: 0.09,
    played_modes: [22],
  }),
  extended: makeExtended(500),
};
const READY_NO_EXTENDED: FilteredStatsState = { kind: 'ready', stats: makeStats(), extended: null };
const READY_ZERO_SLICES: FilteredStatsState = {
  kind: 'ready',
  stats: makeStats({
    gameCount: 5,
    rank_rates: [0.6, 0.4, 0, 0],
    rank_avg_score: [40000, 30000, 10000, 5000],
  }),
  extended: makeExtended(20),
};
const READY_TINY_RATES: FilteredStatsState = {
  kind: 'ready',
  stats: makeStats({
    rank_rates: [0.997, 0.001, 0.001, 0.001],
    rank_avg_score: [30000, 25000, 20000, 15000],
  }),
  extended: makeExtended(200),
};
const READY_LARGE_COUNTS: FilteredStatsState = {
  kind: 'ready',
  stats: makeStats({ gameCount: 12345 }),
  extended: makeExtended(56789),
};
const READY_UNEXPECTED_SHAPE: FilteredStatsState = {
  kind: 'ready',
  stats: makeStats({ rank_rates: [0.5, 0.5], rank_avg_score: [30000, 20000] }),
  extended: makeExtended(100),
};

const ENTRIES: readonly GalleryEntry[] = [
  { label: '1. loading（四麻）', state: LOADING_4P, numPlayers: 4 },
  { label: '2. loading（三麻）', state: LOADING_3P, numPlayers: 3 },
  { label: '3. error', state: ERROR_STATE, numPlayers: 4 },
  { label: '4. ready 四麻（実レスポンス値）', state: READY_4P, numPlayers: 4 },
  { label: '5. ready 三麻', state: READY_3P, numPlayers: 3 },
  { label: '6. ready・extended === null（局数が出ないこと）', state: READY_NO_EXTENDED, numPlayers: 4 },
  { label: '7. ready・0% を含む（弧2本・凡例4行）', state: READY_ZERO_SLICES, numPlayers: 4 },
  { label: '8. ready・極端に小さい率（弧が消えないこと）', state: READY_TINY_RATES, numPlayers: 4 },
  { label: '9. ready・大きな試合数（中央からあふれないこと）', state: READY_LARGE_COUNTS, numPlayers: 4 },
  { label: '10. 想定外形状（rank_rates.length === 2）', state: READY_UNEXPECTED_SHAPE, numPlayers: 4 },
];

// B3 高さ不変プローブ。四麻: loading/ready/error の3枚、三麻: loading/readyの2枚。
const HEIGHT_PROBES_4P: readonly { readonly dataState: string; readonly state: FilteredStatsState }[] = [
  { dataState: 'loading', state: LOADING_4P },
  { dataState: 'ready', state: READY_4P },
  { dataState: 'error', state: ERROR_STATE },
];
const HEIGHT_PROBES_3P: readonly { readonly dataState: string; readonly state: FilteredStatsState }[] = [
  { dataState: 'loading', state: LOADING_3P },
  { dataState: 'ready', state: READY_3P },
];

export function RankGallery(): ReactElement {
  const { modeSetting, setModeSetting } = useTheme();

  return (
    <>
      {/*
        高さ計測プローブ（§4.8）。横パディングを持つ祖先の外側に置く（issue-8 §4.6 の教訓）。
        幅は実ページと同じカード内容幅（311px）で測る（issue-9 検収 P2-1 是正）。
        実ページ: 375px 幅 − ページ左右パディング32px（shell.css）− カード左右パディング32px
        （.rank-card__inner）= 311px。プローブに与える幅は「カード自身の幅」なので
        375 − 32（ページパディングのみ）= 343px（issue-8 §4.6 で使った値と同じ考え方）。
        以前のプローブはこの幅制約が無く、実ページより広い幅で測っていたため
        `.rank-card__chart` の2カラム分岐（当時の実装）を検知できなかった（B3 が見逃した原因）。
      */}
      <div data-testid="rank-height-probe">
        {HEIGHT_PROBES_4P.map(({ dataState, state }) => (
          <div
            key={`4p-${dataState}`}
            data-testid="rank-height-probe-item"
            data-players="4"
            data-state={dataState}
            style={{ width: 343 }}
          >
            <RankCard state={state} numPlayers={4} />
          </div>
        ))}
        {HEIGHT_PROBES_3P.map(({ dataState, state }) => (
          <div
            key={`3p-${dataState}`}
            data-testid="rank-height-probe-item"
            data-players="3"
            data-state={dataState}
            style={{ width: 343 }}
          >
            <RankCard state={state} numPlayers={3} />
          </div>
        ))}
      </div>

      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 32 }}>
        <h1 className="md-typescale-headline-medium">/__rank — カード2（成績）確認ページ（dev限定）</h1>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 className="md-typescale-title-medium">カラーモード</h2>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {MODE_OPTIONS.map((opt) => (
              <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input type="radio" name="mode" checked={modeSetting === opt} onChange={() => setModeSetting(opt)} />
                <span className="md-typescale-body-medium">{opt}</span>
              </label>
            ))}
          </div>
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 375 }}>
          {ENTRIES.map((entry) => (
            <div
              key={entry.label}
              style={{
                border: '1px solid var(--md-sys-color-outline-variant)',
                borderRadius: 12,
                padding: 16,
                backgroundColor: 'var(--md-sys-color-surface-container-high)',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <p className="md-typescale-label-large">{entry.label}</p>
              <RankCard state={entry.state} numPlayers={entry.numPlayers} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
