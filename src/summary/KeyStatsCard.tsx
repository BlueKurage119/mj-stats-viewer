import type { ReactElement } from 'react';
import type { GameMode, NumPlayers } from '../api';
import { selectRepresentativeMode } from '../filters/filterState';
import type { DistributionState } from '../filters/useGlobalHistogram';
import type { FilteredStatsState } from '../filters/useFilteredStats';
import { getBandZeroMean } from '../domain';
import { ElevatedCard } from '../components/md';
import { buildKeyStatsView, KEY_STAT_METRICS, type KeyStatTile } from './keyStatsView';
import './summary.css';

/**
 * カード4（主要スタッツ）。6タイル・卓平均差分。RankCard / PlaystyleCard と同じくフックを
 * 持たない表示専用コンポーネント（dev ギャラリーから任意状態を流し込める）。
 * 分布 error は致命扱いにせず、チップだけ「—（比較不可）」に縮退させる（§1.3・§4.3）。
 * 詳細: docs/design/issue-11-key-stats.md §4
 */
export interface KeyStatsCardProps {
  readonly state: FilteredStatsState;
  readonly distribution: DistributionState;
  readonly modes: readonly GameMode[] | null;
  readonly numPlayers: NumPlayers;
}

/**
 * ラベルは KEY_STAT_METRICS 由来の固定表なので loading でも既に分かっている。
 * skeleton にするのは値・差分の2行だけ（§4.3「6タイル分の skeleton（値・差分の両方）」）。
 */
function TileItem({ label, tile }: { label: string; tile: KeyStatTile | null }): ReactElement {
  if (tile === null) {
    return (
      <div className="key-stats-card__tile">
        <dt className="md-typescale-label-medium">{label}</dt>
        <dd className="key-stats-card__value key-stats-card__skeleton" aria-hidden="true" />
        <span className="key-stats-card__delta key-stats-card__skeleton" aria-hidden="true" />
      </div>
    );
  }

  const delta = tile.delta;
  const tone = delta?.tone ?? 'neutral';
  const sign = delta?.sign ?? null;

  return (
    <div className="key-stats-card__tile" data-metric={tile.key}>
      <dt className="md-typescale-label-medium">{tile.label}</dt>
      <dd className="key-stats-card__value md-typescale-headline-small numeric" aria-hidden="true">
        {tile.valueText}
      </dd>
      <span className="key-stats-card__delta numeric" data-tone={tone} data-sign={sign ?? undefined} aria-hidden="true">
        {delta !== null ? (
          <>
            <span className="key-stats-card__delta-glyph">{delta.glyph}</span>
            {delta.text}
          </>
        ) : (
          '—'
        )}
      </span>
      <span className="visually-hidden">{tile.ariaLabel}</span>
    </div>
  );
}

export function KeyStatsCard(props: KeyStatsCardProps): ReactElement {
  const { state, distribution, modes, numPlayers } = props;

  const isLoading = state.kind === 'loading' || distribution.kind === 'loading' || modes === null;

  let message: string | null = null;
  let tiles: readonly KeyStatTile[] | null = null;
  let note = '';

  if (!isLoading) {
    if (state.kind === 'error') {
      message = state.message;
    } else if (state.kind === 'ready') {
      if (state.extended === null) {
        message = '主要スタッツを取得できません';
      } else {
        const mode = selectRepresentativeMode(numPlayers, modes);
        const meanOf =
          distribution.kind === 'ready'
            ? (metric: string) => getBandZeroMean(distribution.histogram, mode, metric)
            : () => null;
        const view = buildKeyStatsView({ extended: state.extended, meanOf, mode });
        tiles = view.tiles;
        note = view.comparable ? view.note : '卓全体平均を取得できませんでした';
      }
    } else {
      // state.kind === 'empty' はここに到達しない（SummaryPanel が上流で扱う）。
      // 型の網羅性のためだけの防御的分岐で、loading と同じ描画にする。
      message = null;
    }
  }

  const cardState: 'loading' | 'ready' | 'error' = isLoading ? 'loading' : message !== null ? 'error' : 'ready';

  return (
    <ElevatedCard className="key-stats-card" data-testid="key-stats-card" data-state={cardState}>
      <div className="key-stats-card__inner">
        <h2 className="key-stats-card__title md-typescale-title-medium">主要スタッツ</h2>

        <div className={`key-stats-card__body${message !== null ? ' key-stats-card__body--message' : ''}`}>
          <dl className="key-stats-card__tiles" data-testid="key-stats-tiles">
            {KEY_STAT_METRICS.map((metric, i) => (
              <TileItem key={metric.key} label={metric.label} tile={tiles?.[i] ?? null} />
            ))}
          </dl>

          {message !== null && <p className="key-stats-card__message">{message}</p>}
        </div>

        <p className="key-stats-card__note md-typescale-label-medium">{note}</p>
      </div>
    </ElevatedCard>
  );
}
