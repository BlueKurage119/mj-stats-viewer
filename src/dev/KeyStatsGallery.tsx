import type { ReactElement } from 'react';
import { useTheme, type ColorModeSetting } from '../theme/ThemeProvider';
import type { RankKey } from '../theme/seeds';
import { KeyStatsCard } from '../summary/KeyStatsCard';
import type { FilteredStatsState } from '../filters/useFilteredStats';
import type { DistributionState } from '../filters/useGlobalHistogram';
import type { GameMode, GlobalHistogram, NumPlayers, PlayerExtendedStats, PlayerStats } from '../api';
import '../shell/shell.css';

/**
 * dev 専用の `/__keystats` 確認ページ。
 * 本番ビルドでは main.tsx の `import.meta.env.DEV` 分岐により到達不能・emit されない。
 * 受け入れ条件11〜18の実行基盤。API は一切叩かない（固定状態のみ）。
 * 実在プレイヤーの ID・ニックネームは使わない。
 * 詳細: docs/design/issue-11-key-stats.md §6
 */

const MODE_OPTIONS: ColorModeSetting[] = ['light', 'dark', 'system'];

const RANK_OPTIONS: { value: RankKey | null; label: string }[] = [
  { value: null, label: '既定（緑）' },
  { value: 'ketsu', label: '雀傑（金）' },
  { value: 'gou', label: '雀豪（橙）' },
  { value: 'sei', label: '雀聖（赤）— good/badが同色化しないか要確認' },
  { value: 'konten', label: '魂天（青）' },
];

function makeExtended(overrides: Partial<PlayerExtendedStats> = {}): PlayerExtendedStats {
  return {
    roundCount: 100,
    最大连庄: 0,
    最大累计番数: 0,
    役满: 0,
    累计役满: 0,
    W立直: 0,
    流满: 0,
    和牌率: 0.4536,
    自摸率: 0,
    默听率: 0,
    放铳率: 0.1237,
    副露率: 0.3711,
    立直率: 0.2113,
    平均打点: 5312,
    和了巡数: 0,
    平均铳点: 4821,
    流局率: 0,
    流听率: 0,
    一发率: 0,
    里宝率: 0,
    被炸率: 0,
    平均被炸点数: 0,
    放铳时立直率: 0,
    放铳时副露率: 0,
    立直后放铳率: 0,
    立直后非瞬间放铳率: 0,
    副露后放铳率: 0,
    立直后和牌率: 0,
    副露后和牌率: 0,
    立直后流局率: 0,
    副露后流局率: 0,
    放铳至立直: 0,
    放铳至副露: 0,
    放铳至默听: 0,
    立直和了: 0,
    副露和了: 0,
    默听和了: 0,
    立直巡目: 0,
    立直收支: 0,
    立直收入: 0,
    立直支出: 0,
    先制率: 0,
    追立率: 0,
    被追率: 0,
    振听立直率: 0,
    立直好型: 0,
    立直好型2: 0,
    立直多面: 0,
    打点效率: 0,
    铳点损失: 0,
    净打点效率: 0,
    平均起手向听: 0,
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

const MODES_16: readonly GameMode[] = [16];

/** 卓平均: 一部が良い方向・一部が悪い方向になるよう選んだ MEAN セット（good/bad両方を目視できるようにする） */
const MEAN: Record<string, number> = {
  和牌率: 0.4412, // 自分 0.4536 → 高い(good)
  放铳率: 0.132, // 自分 0.1237 → 低い(good)
  立直率: 0.19, // 自分 0.2113 → 高い(neutral)
  副露率: 0.4, // 自分 0.3711 → 低い(neutral)
  平均打点: 5000, // 自分 5312 → 高い(good)
  平均铳点: 4400, // 自分 4821 → 高い(bad)
};

function distReadyWithMean(): DistributionState {
  const histogram = {
    '16': {
      '0': Object.fromEntries(Object.entries(MEAN).map(([k, mean]) => [k, { mean }])),
    },
  } as unknown as GlobalHistogram;
  return { kind: 'ready', histogram, lookupFor: () => () => null };
}

const READY_STATE: FilteredStatsState = { kind: 'ready', stats: makeStats(), extended: makeExtended() };
const LOADING_STATE: FilteredStatsState = { kind: 'loading' };
const ERROR_STATE: FilteredStatsState = { kind: 'error', message: 'ネットワークに接続できませんでした。' };
const NULL_EXTENDED_STATE: FilteredStatsState = { kind: 'ready', stats: makeStats(), extended: null };

const READY_DISTRIBUTION: DistributionState = distReadyWithMean();
const LOADING_DISTRIBUTION: DistributionState = { kind: 'loading' };
const ERROR_DISTRIBUTION: DistributionState = { kind: 'error', message: '母集団データを取得できませんでした。' };

const ENTRIES: {
  label: string;
  state: FilteredStatsState;
  distribution: DistributionState;
  modes: readonly GameMode[] | null;
}[] = [
  { label: '1. loading', state: LOADING_STATE, distribution: LOADING_DISTRIBUTION, modes: null },
  { label: '2. ready（分布あり・良い/悪い/中立が混在）', state: READY_STATE, distribution: READY_DISTRIBUTION, modes: MODES_16 },
  { label: '3. error（stats）', state: ERROR_STATE, distribution: READY_DISTRIBUTION, modes: MODES_16 },
  {
    label: '4. ready・extended null',
    state: NULL_EXTENDED_STATE,
    distribution: READY_DISTRIBUTION,
    modes: MODES_16,
  },
  {
    label: '5. 比較不可（分布 error。値は出るが差分は—）',
    state: READY_STATE,
    distribution: ERROR_DISTRIBUTION,
    modes: MODES_16,
  },
];

export function KeyStatsGallery(): ReactElement {
  const { modeSetting, setModeSetting, rank, setRank } = useTheme();

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 32 }}>
      <h1 className="md-typescale-headline-medium">/__keystats — カード4（主要スタッツ）確認ページ（dev限定）</h1>

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

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 className="md-typescale-title-medium">段位シード（受け入れ条件16: 雀聖で good/bad が別色に見えるか）</h2>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {RANK_OPTIONS.map((opt) => (
            <label key={opt.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="radio" name="rank" checked={rank === opt.value} onChange={() => setRank(opt.value)} />
              <span className="md-typescale-body-medium">{opt.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 className="md-typescale-title-medium">
          カード幅（受け入れ条件11: 600px以上で3列×2行・未満で2列×3行に切り替わること）
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ width: 700, border: '1px dashed var(--md-sys-color-outline-variant)', padding: 8 }}>
            <p className="md-typescale-body-small">幅700px（3列×2行になるはず）</p>
            <KeyStatsCard state={READY_STATE} distribution={READY_DISTRIBUTION} modes={MODES_16} numPlayers={4 as NumPlayers} />
          </div>
          <div style={{ width: 380, border: '1px dashed var(--md-sys-color-outline-variant)', padding: 8 }}>
            <p className="md-typescale-body-small">幅380px（2列×3行になるはず）</p>
            <KeyStatsCard state={READY_STATE} distribution={READY_DISTRIBUTION} modes={MODES_16} numPlayers={4 as NumPlayers} />
          </div>
        </div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 className="md-typescale-title-medium">
          状態一覧（受け入れ条件12: loading/ready/errorでカード高さが一致すること）
        </h2>
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
                gap: 8,
              }}
            >
              <span className="md-typescale-label-medium">{entry.label}</span>
              <KeyStatsCard
                state={entry.state}
                distribution={entry.distribution}
                modes={entry.modes}
                numPlayers={4 as NumPlayers}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
