import type { ReactElement } from 'react';
import { useTheme, type ColorModeSetting } from '../theme/ThemeProvider';
import { IdentityCard } from '../summary/IdentityCard';
import { LevelDetailCard } from '../summary/LevelDetailCard';
import { FilterBar } from '../filters/FilterBar';
import type { CurrentIdentityState } from '../filters/useCurrentIdentity';
import type { CurrentLevelInfo, LevelWithDelta } from '../api';
import '../shell/shell.css';

/**
 * dev 専用の `/__identity` 確認ページ。
 * 本番ビルドでは main.tsx の `import.meta.env.DEV` 分岐により到達不能・emit されない。
 * 受け入れ条件 B4・B5・B6・B11 の実行基盤。API は一切叩かない（固定状態のみ）。
 *
 * 【2026-09-05 是正】2点変更した:
 * 1. 各状態で IdentityCard と LevelDetailCard の両方を描画する（条件表示の検証は LevelDetailCard 側に移った）
 * 2. ヒーロー実寸プローブ（data-testid="gallery-hero"）を追加し、B5 を実 API なしで測れるようにする
 *
 * 詳細: docs/design/issue-8-identity-card.md §4.6
 */

const MODE_OPTIONS: ColorModeSetting[] = ['light', 'dark', 'system'];

// 実在プレイヤーの ID・ニックネームは使わない。
const LONG_NICKNAME = 'テストプレイヤー'.repeat(4); // 32文字

function makeInfo(nickname: string, level: LevelWithDelta, gameCount: number): CurrentLevelInfo {
  return {
    level,
    maxLevel: level,
    nickname,
    gameCount,
    playedModes: [],
  };
}

interface GalleryEntry {
  readonly label: string;
  readonly state: CurrentIdentityState;
}

const LOADING_STATE: CurrentIdentityState = { kind: 'loading' };
const READY_WITH_CONDITIONS_STATE: CurrentIdentityState = {
  kind: 'ready',
  identity: makeInfo('テストプレイヤー03', { id: 10503, score: 8950, delta: 0 }, 3456),
};

const ENTRIES: readonly GalleryEntry[] = [
  { label: '1. loading', state: LOADING_STATE },
  { label: '2. notFound', state: { kind: 'notFound' } },
  { label: '3. error', state: { kind: 'error', message: 'ネットワークに接続できませんでした。' } },
  {
    label: '4. 雀傑2 四麻（条件なし・常態）',
    state: { kind: 'ready', identity: makeInfo('テストプレイヤー01', { id: 10302, score: 232, delta: 0 }, 1234) },
  },
  {
    label: '5. 雀傑3 昇段目前（2位以内に畳まれる）',
    state: { kind: 'ready', identity: makeInfo('テストプレイヤー02', { id: 10303, score: 1950, delta: 40 }, 2345) },
  },
  {
    label: '6. 雀聖3 昇段目前（1位 / 2位9,100点以上）',
    state: READY_WITH_CONDITIONS_STATE,
  },
  {
    label: '7. 雀豪1 降段目前（3位9,000点以下 / 4位）',
    state: { kind: 'ready', identity: makeInfo('テストプレイヤー04', { id: 10401, score: 60, delta: -40 }, 4567) },
  },
  {
    label: '8. 魂天1（小数表示・1位）',
    state: { kind: 'ready', identity: makeInfo('テストプレイヤー05', { id: 10701, score: 1960, delta: 0 }, 5678) },
  },
  {
    label: '9. 魂天20（上限なし）',
    state: { kind: 'ready', identity: makeInfo('テストプレイヤー06', { id: 10720, score: 5000, delta: 0 }, 6789) },
  },
  {
    label: '10. 雀士3（preferredMode が null → 条件ブロックなし）',
    state: { kind: 'ready', identity: makeInfo('テストプレイヤー07', { id: 10203, score: 900, delta: 0 }, 789) },
  },
  {
    label: '11. 三麻 雀豪1 降段目前（3人分の順位）',
    state: { kind: 'ready', identity: makeInfo('テストプレイヤー08', { id: 20401, score: 40, delta: 0 }, 8901) },
  },
  {
    label: '12. 長いニックネーム（32文字）で省略が効くこと',
    state: { kind: 'ready', identity: makeInfo(LONG_NICKNAME, { id: 10302, score: 232, delta: 0 }, 9999) },
  },
];

// B5 の実寸プローブが使う2状態（loading / 条件あり）。実ページと同じ入れ子で組む。
const HERO_PROBES: readonly { readonly dataState: string; readonly state: CurrentIdentityState }[] = [
  { dataState: 'loading', state: LOADING_STATE },
  { dataState: 'ready-with-conditions', state: READY_WITH_CONDITIONS_STATE },
];

function noopModes(): void {
  // ヒーロー実寸プローブは寸法計測のみが目的で、操作には応答しない。
}

function noopPeriod(): void {
  // 同上。
}

export function IdentityGallery(): ReactElement {
  const { modeSetting, setModeSetting } = useTheme();

  return (
    <>
      {/* ヒーロー実寸プローブ（§4.6）。B5 を実 API なしで測るため、横パディングを持つ
          祖先の外側（このページ本体の padding div の外）に置く。 */}
      {HERO_PROBES.map(({ dataState, state }) => (
        <div key={dataState} className="identity-gallery__hero-probe" data-testid="gallery-hero" data-state={dataState}>
          <div className="layered-sheet__hero">
            <div className="player-hero">
              <IdentityCard state={state} fallbackName="プレイヤー: 000000" />
              <FilterBar numPlayers={4} filter={null} onModesChange={noopModes} onPeriodChange={noopPeriod} />
            </div>
          </div>
        </div>
      ))}

      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 32 }}>
        <h1 className="md-typescale-headline-medium">/__identity — カード1（アイデンティティ）確認ページ（dev限定）</h1>

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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 720 }}>
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
              <IdentityCard state={entry.state} fallbackName="プレイヤー: 000000" />
              <LevelDetailCard state={entry.state} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
