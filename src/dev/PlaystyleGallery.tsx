import type { ReactElement } from 'react';
import { useTheme, type ColorModeSetting } from '../theme/ThemeProvider';
import { PlaystyleCard } from '../summary/PlaystyleCard';
import type { FilteredStatsState } from '../filters/useFilteredStats';
import type { DistributionState, MetricLookup } from '../filters/useGlobalHistogram';
import type { MetricDistribution } from '../domain';
import type { GameMode, GlobalHistogram, NumPlayers, PlayerExtendedStats, PlayerStats } from '../api';
import '../shell/shell.css';

/**
 * dev 専用の `/__playstyle` 確認ページ。
 * 本番ビルドでは main.tsx の `import.meta.env.DEV` 分岐により到達不能・emit されない。
 * 受け入れ条件 B1〜B8・B12・B13 の実行基盤。API は一切叩かない（固定状態のみ）。
 * 実在プレイヤーの ID・ニックネームは使わない。
 * 詳細: docs/design/issue-10-playstyle.md §4.9
 */

const MODE_OPTIONS: ColorModeSetting[] = ['light', 'dark', 'system'];

function dist(mean: number, sd = 1, count = 200_000): MetricDistribution {
  return { mean, sd, count };
}

/** 全メトリクスが mean=0/sd=1 の baseline（z がそのまま stats 値になる。里宝率・一发率のみ比率指標として実測相当の平均を持つ） */
const BASELINE: Record<string, MetricDistribution> = {
  打点效率: dist(0),
  铳点损失: dist(0),
  和牌率: dist(0),
  立直率: dist(0),
  追立率: dist(0),
  放铳率: dist(0),
  默听率: dist(0),
  副露率: dist(0),
  和了巡数: dist(0),
  里宝率: dist(0.15),
  一发率: dist(0.1),
};

function makeLookup(overrides: Partial<Record<string, MetricDistribution | null>> = {}): MetricLookup {
  return (metric: string) => {
    if (metric in overrides) return overrides[metric] ?? null;
    return BASELINE[metric] ?? null;
  };
}

function makeExtended(overrides: Partial<PlayerExtendedStats> = {}): PlayerExtendedStats {
  return {
    roundCount: 100,
    打点效率: 0,
    铳点损失: 0,
    和牌率: 0,
    立直率: 0,
    里宝率: 0.15,
    一发率: 0.1,
    追立率: 0,
    放铳率: 0,
    默听率: 0,
    副露率: 0,
    和了巡数: 0,
    ...overrides,
  } as PlayerExtendedStats;
}

function makeStats(): PlayerStats {
  return {
    id: 1,
    nickname: 'テストプレイヤー',
    gameCount: 100,
    level: { id: 10301, score: 695, delta: -11 },
    max_level: { id: 10301, score: 1184, delta: 0 },
    rank_rates: [0.25, 0.25, 0.25, 0.25],
    rank_avg_score: [30000, 25000, 20000, 15000],
    avg_rank: 2.5,
    negative_rate: 0.05,
    played_modes: [16],
  };
}

function ready(extended: PlayerExtendedStats | null): FilteredStatsState {
  return { kind: 'ready', stats: makeStats(), extended };
}

function distReady(lookup: MetricLookup): DistributionState {
  return { kind: 'ready', histogram: {} as GlobalHistogram, lookupFor: () => lookup };
}

const LOADING_STATS: FilteredStatsState = { kind: 'loading' };
const ERROR_STATS: FilteredStatsState = { kind: 'error', message: 'ネットワークに接続できませんでした。' };
const ERROR_DISTRIBUTION: DistributionState = { kind: 'error', message: '母集団データを取得できませんでした。' };
const LOADING_DISTRIBUTION: DistributionState = { kind: 'loading' };

const MODES_16: readonly GameMode[] = [16];

// 状態5: 全軸あり。攻守 band3・門前速度 band2（校正後の値。§1.5(d)）。
const STATE5_EXTENDED = makeExtended({
  打点效率: 0.7, // dv 57 → 攻
  铳点损失: -0.4, // dv 46 → 守 54
  和牌率: 0.8, // dv 58 → 速
  立直率: 0.9, // dv 59 → 制。offense の z立直としても使う
  里宝率: 0.16,
  一发率: 0.11,
  追立率: 0.5,
  放铳率: 0.5,
  默听率: -0.3,
  副露率: 0,
  和了巡数: 0.3,
});
const STATE5_DISTRIBUTION = distReady(makeLookup());

// 状態6: 両軸とも band0（守備×門前）
const STATE6_EXTENDED = makeExtended({
  打点效率: 0.7,
  铳点损失: -0.4,
  和牌率: 0.8,
  立直率: -1,
  里宝率: 0.16,
  一发率: 0.11,
  追立率: -1,
  放铳率: -1,
  默听率: 1,
  副露率: -1,
  和了巡数: 1,
});

// 状態7: 両軸とも band4（攻撃×速度）
const STATE7_EXTENDED = makeExtended({
  打点效率: 0.7,
  铳点损失: -0.4,
  和牌率: 0.8,
  立直率: 1,
  里宝率: 0.16,
  一发率: 0.11,
  追立率: 1,
  放铳率: 1,
  默听率: -1,
  副露率: 1,
  和了巡数: -1,
});

// 状態8a: 攻守band0・門前速度band4（対角）
const STATE8A_EXTENDED = makeExtended({
  打点效率: 0.7,
  铳点损失: -0.4,
  和牌率: 0.8,
  立直率: -1,
  里宝率: 0.16,
  一发率: 0.11,
  追立率: -1,
  放铳率: -1,
  默听率: 1,
  副露率: 2,
  和了巡数: -2,
});

// 状態8b: 攻守band4・門前速度band0（対角）
const STATE8B_EXTENDED = makeExtended({
  打点效率: 0.7,
  铳点损失: -0.4,
  和牌率: 0.8,
  立直率: 1,
  里宝率: 0.16,
  一发率: 0.11,
  追立率: 1,
  放铳率: 1,
  默听率: -1,
  副露率: -2,
  和了巡数: 2,
});

// 状態9: 一部軸null（運のみ欠損。里宝率の分布が引けない）
const STATE9_LOOKUP = makeLookup({ 里宝率: null });

// 状態11: 全軸null（分布に metric が無い。三麻想定。§1.6）
const STATE11_LOOKUP = makeLookup({
  打点效率: null,
  铳点损失: null,
  和牌率: null,
  立直率: null,
  里宝率: null,
  一发率: null,
  追立率: null,
  放铳率: null,
  默听率: null,
  副露率: null,
  和了巡数: null,
});

// 状態12: クランプ発生（攻が95相当）
const STATE12_EXTENDED = makeExtended({
  打点效率: 4.5, // dv 95 → クランプ
  铳点损失: -0.4,
  和牌率: 0.8,
  立直率: 0,
  里宝率: 0.16,
  一发率: 0.11,
  追立率: 0,
  放铳率: 0,
  默听率: 0,
  副露率: 0,
  和了巡数: 0,
});

// 状態13: 傾向2軸のうち片方だけnull（攻守band2・門前速度は判定不能）
const STATE13_EXTENDED = makeExtended({
  打点效率: 0.7,
  铳点损失: -0.4,
  和牌率: 0.8,
  立直率: 0,
  里宝率: 0.16,
  一发率: 0.11,
  追立率: 0,
  放铳率: 0,
  默听率: 0,
  副露率: 0,
  和了巡数: 0,
});
const STATE13_LOOKUP = makeLookup({ 副露率: null, 默听率: null, 和了巡数: null });

interface GalleryEntry {
  readonly label: string;
  readonly state: FilteredStatsState;
  readonly distribution: DistributionState;
  readonly modes: readonly GameMode[] | null;
}

const ENTRIES: readonly GalleryEntry[] = [
  { label: '1. loading（stats loading）', state: LOADING_STATS, distribution: STATE5_DISTRIBUTION, modes: MODES_16 },
  {
    label: '2. loading（stats ready・distribution loading）— 1 と同じ高さになること',
    state: ready(STATE5_EXTENDED),
    distribution: LOADING_DISTRIBUTION,
    modes: MODES_16,
  },
  { label: '3. error（stats error）', state: ERROR_STATS, distribution: STATE5_DISTRIBUTION, modes: MODES_16 },
  {
    label: '4. error（distribution error）',
    state: ready(STATE5_EXTENDED),
    distribution: ERROR_DISTRIBUTION,
    modes: MODES_16,
  },
  {
    label: '5. ready 全軸あり・攻守 band3 / 門前速度 band2（校正後）',
    state: ready(STATE5_EXTENDED),
    distribution: STATE5_DISTRIBUTION,
    modes: MODES_16,
  },
  {
    label: '6. ready 両軸 band0（守備×門前）',
    state: ready(STATE6_EXTENDED),
    distribution: distReady(makeLookup()),
    modes: MODES_16,
  },
  {
    label: '7. ready 両軸 band4（攻撃×速度）',
    state: ready(STATE7_EXTENDED),
    distribution: distReady(makeLookup()),
    modes: MODES_16,
  },
  {
    label: '8a. ready band0（攻守）× band4（門前速度）— 対角',
    state: ready(STATE8A_EXTENDED),
    distribution: distReady(makeLookup()),
    modes: MODES_16,
  },
  {
    label: '8b. ready band4（攻守）× band0（門前速度）— 対角',
    state: ready(STATE8B_EXTENDED),
    distribution: distReady(makeLookup()),
    modes: MODES_16,
  },
  {
    label: '9. ready 一部軸null（運だけ欠損 → 多角形なし・頂点4個）',
    state: ready(STATE5_EXTENDED),
    distribution: distReady(STATE9_LOOKUP),
    modes: MODES_16,
  },
  {
    label: '10. unavailable（extended === null）',
    state: ready(null),
    distribution: STATE5_DISTRIBUTION,
    modes: MODES_16,
  },
  {
    label: '11. unavailable（全軸null = 分布にmetricが無い。三麻想定）',
    state: ready(STATE5_EXTENDED),
    distribution: distReady(STATE11_LOOKUP),
    modes: MODES_16,
  },
  {
    label: '12. ready クランプ発生（攻が95相当）',
    state: ready(STATE12_EXTENDED),
    distribution: distReady(makeLookup()),
    modes: MODES_16,
  },
  {
    label: '13. ready 傾向2軸のうち片方だけnull（攻守band2・門前速度は判定不能）',
    state: ready(STATE13_EXTENDED),
    distribution: distReady(STATE13_LOOKUP),
    modes: MODES_16,
  },
];

/**
 * 基準幅（600px、`@container playstyle-card (min-width: 600px)`）の両側を測る2種の幅。
 * #8・#9 で「プローブが実ページとズレていて検出できない」事故が計2回起きているため、
 * 実ページの寸法（縦積み最小幅・十分に広い横並び幅）と同じ値を直接指定する。
 */
const PROBE_WIDTH_STACK = 343;
const PROBE_WIDTH_ROW = 700;

interface HeightProbeEntry {
  readonly dataState: 'loading' | 'ready' | 'error';
  readonly state: FilteredStatsState;
  readonly distribution: DistributionState;
  readonly modes: readonly GameMode[] | null;
}

const HEIGHT_PROBES: readonly HeightProbeEntry[] = [
  { dataState: 'loading', state: LOADING_STATS, distribution: STATE5_DISTRIBUTION, modes: MODES_16 },
  { dataState: 'ready', state: ready(STATE5_EXTENDED), distribution: STATE5_DISTRIBUTION, modes: MODES_16 },
  { dataState: 'error', state: ERROR_STATS, distribution: STATE5_DISTRIBUTION, modes: MODES_16 },
];

export function PlaystyleGallery(): ReactElement {
  const { modeSetting, setModeSetting } = useTheme();

  return (
    <>
      {/*
        高さ計測プローブ（§4.9）。横パディングを持つ祖先の外側に置く。
        `.playstyle-card__inner` の `container-type: inline-size` により、ここで与える
        `width` が `.playstyle-card` 自身の実効幅として直接効く。
      */}
      <div data-testid="playstyle-height-probe">
        {HEIGHT_PROBES.map(({ dataState, state, distribution, modes }) => (
          <div
            key={`stack-${dataState}`}
            data-testid="playstyle-height-probe-item"
            data-layout="stack"
            data-state={dataState}
            style={{ width: PROBE_WIDTH_STACK }}
          >
            <PlaystyleCard state={state} distribution={distribution} modes={modes} numPlayers={4 as NumPlayers} />
          </div>
        ))}
        {HEIGHT_PROBES.map(({ dataState, state, distribution, modes }) => (
          <div
            key={`row-${dataState}`}
            data-testid="playstyle-height-probe-item"
            data-layout="row"
            data-state={dataState}
            style={{ width: PROBE_WIDTH_ROW }}
          >
            <PlaystyleCard state={state} distribution={distribution} modes={modes} numPlayers={4 as NumPlayers} />
          </div>
        ))}
      </div>

      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 32 }}>
        <h1 className="md-typescale-headline-medium">/__playstyle — カード3（打ち筋）確認ページ（dev限定）</h1>

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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 900 }}>
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
              <PlaystyleCard
                state={entry.state}
                distribution={entry.distribution}
                modes={entry.modes}
                numPlayers={4 as NumPlayers}
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
