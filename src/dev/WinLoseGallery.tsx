import type { ReactElement } from 'react';
import { useTheme, type ColorModeSetting } from '../theme/ThemeProvider';
import type { RankKey } from '../theme/seeds';
import { WinLoseCard } from '../summary/WinLoseCard';
import type { FilteredStatsState } from '../filters/useFilteredStats';
import type { PlayerExtendedStats, PlayerStats } from '../api';
import '../shell/shell.css';

/**
 * dev 専用の `/__winlose` 確認ページ。
 * 本番ビルドでは main.tsx の `import.meta.env.DEV` 分岐により到達不能・emit されない。
 * 受け入れ条件22〜32の実行基盤。API は一切叩かない（固定状態のみ）。
 * 実在プレイヤーの ID・ニックネームは使わない。
 * 詳細: docs/design/issue-12-win-lose-donuts.md §6
 */

const MODE_OPTIONS: ColorModeSetting[] = ['light', 'dark', 'system'];

const RANK_OPTIONS: { value: RankKey | null; label: string }[] = [
  { value: null, label: '既定（緑）' },
  { value: 'ketsu', label: '雀傑（金）' },
  { value: 'gou', label: '雀豪（橙）' },
  { value: 'sei', label: '雀聖（赤）' },
  { value: 'konten', label: '魂天（青）' },
];

function makeExtended(overrides: Partial<PlayerExtendedStats> = {}): PlayerExtendedStats {
  return {
    roundCount: 194,
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
    放铳时立直率: 0.1538,
    放铳时副露率: 0.4615,
    立直后放铳率: 0,
    立直后非瞬间放铳率: 0,
    副露后放铳率: 0,
    立直后和牌率: 0,
    副露后和牌率: 0,
    立直后流局率: 0,
    副露后流局率: 0,
    放铳至立直: 0.1875,
    放铳至副露: 0.5,
    放铳至默听: 0.3125,
    立直和了: 21,
    副露和了: 29,
    默听和了: 8,
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
    gameCount: 54,
    level: { id: 10301, score: 695, delta: -11 },
    max_level: { id: 10301, score: 1184, delta: 0 },
    rank_rates: [0.2037, 0.1481, 0.3888, 0.2592],
    rank_avg_score: [37718, 27250, 21357, 11079],
    avg_rank: 2.7037,
    negative_rate: 0.0555,
    played_modes: [8],
  };
}

const READY_STATE: FilteredStatsState = { kind: 'ready', stats: makeStats(), extended: makeExtended() };
const LOADING_STATE: FilteredStatsState = { kind: 'loading' };
const ERROR_STATE: FilteredStatsState = { kind: 'error', message: 'ネットワークに接続できませんでした。' };
const NULL_EXTENDED_STATE: FilteredStatsState = { kind: 'ready', stats: makeStats(), extended: null };
const NO_WIN_STATE: FilteredStatsState = {
  kind: 'ready',
  stats: makeStats(),
  extended: makeExtended({ 立直和了: 0, 副露和了: 0, 默听和了: 0 }),
};
const NO_DEALIN_STATE: FilteredStatsState = {
  kind: 'ready',
  stats: makeStats(),
  extended: makeExtended({
    放铳率: 0,
    放铳时立直率: 0,
    放铳时副露率: 0,
    放铳至立直: 0,
    放铳至副露: 0,
    放铳至默听: 0,
  }),
};

const ENTRIES: { label: string; state: FilteredStatsState }[] = [
  { label: '1. loading', state: LOADING_STATE },
  { label: '2. ready（3枚とも描画される）', state: READY_STATE },
  { label: '3. error', state: ERROR_STATE },
  { label: '4. ready・extended null', state: NULL_EXTENDED_STATE },
  { label: '5. 和了0（winStateだけ空）', state: NO_WIN_STATE },
  { label: '6. 放銃0（dealInState/dealInTargetが空）', state: NO_DEALIN_STATE },
];

export function WinLoseGallery(): ReactElement {
  const { modeSetting, setModeSetting, rank, setRank } = useTheme();

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 32 }}>
      <h1 className="md-typescale-headline-medium">/__winlose — カード5（和銃分布）確認ページ（dev限定）</h1>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 className="md-typescale-title-medium">カラーモード（受け入れ条件28）</h2>
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
        <h2 className="md-typescale-title-medium">
          段位シード（受け入れ条件29: 5種で hand-* トークンが変化しないこと）
        </h2>
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
          カード幅（受け入れ条件27: 600px以上で3列・未満で縦積みに切り替わること）
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ width: 700, border: '1px dashed var(--md-sys-color-outline-variant)', padding: 8 }}>
            <p className="md-typescale-body-small">幅700px（横3列になるはず）</p>
            <WinLoseCard state={READY_STATE} />
          </div>
          <div style={{ width: 380, border: '1px dashed var(--md-sys-color-outline-variant)', padding: 8 }}>
            <p className="md-typescale-body-small">幅380px（縦積みになるはず）</p>
            <WinLoseCard state={READY_STATE} />
          </div>
        </div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 className="md-typescale-title-medium">
          状態一覧（受け入れ条件26: loading/ready/error/空状態でカード高さが一致すること）
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
              <WinLoseCard state={entry.state} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
