import type { CSSProperties, ReactElement } from 'react';
import type { NumPlayers } from '../api';
import type { FilteredStatsState } from '../filters/useFilteredStats';
import { ElevatedCard } from '../components/md';
import { Donut, type DonutSegment } from './Donut';
import { buildRankView, skeletonSliceCount, type RankTile, type RankSlice, type RankView } from './rankView';
import './summary.css';

/**
 * カード2（成績）。順位分布ドーナツ＋凡例＋5タイル。
 * LevelDetailCard と同じくフックを使わない純粋な表示コンポーネント（dev ギャラリーから任意の状態を流し込める）。
 * カード1と違いグローバルフィルタの影響を受ける（state はフィルタ適用後の scope.stats）。
 * 詳細: docs/design/issue-9-rank-donut.md §4.5
 *
 * loading / ready で legend・tiles の要素数を揃えるため（§3.4 R1）、
 * 実データの代わりに `null` の配列を流し込んで同じ map から描く。
 */
export interface RankCardProps {
  readonly state: FilteredStatsState;
  readonly numPlayers: NumPlayers;
}

function Skeleton({ ariaHidden }: { ariaHidden?: boolean }): ReactElement {
  return <span className="rank-card__skeleton" aria-hidden={ariaHidden} />;
}

function segmentsFromView(view: RankView): readonly DonutSegment[] {
  return view.slices.map((slice) => ({
    key: slice.key,
    colorVar: `var(--md-custom-color-${slice.colorToken})`,
    arcLength: slice.arcLength,
    arcOffset: slice.arcOffset,
  }));
}

function LegendItem({ slice, rank }: { slice: RankSlice | null; rank: number }): ReactElement {
  if (slice === null) {
    return (
      <li className="rank-card__legend-item">
        <Skeleton ariaHidden />
        <Skeleton />
      </li>
    );
  }
  return (
    <li className="rank-card__legend-item" data-rank={rank}>
      <span
        className="rank-card__swatch"
        aria-hidden="true"
        style={{ '--swatch': `var(--md-custom-color-${slice.colorToken})` } as CSSProperties}
      />
      <span className="rank-card__legend-label">{slice.label}</span>
      <span className="rank-card__legend-value numeric">{slice.percentText}%</span>
    </li>
  );
}

function TileItem({ tile }: { tile: RankTile | null }): ReactElement {
  if (tile === null) {
    return (
      <div className="rank-card__tile">
        <Skeleton />
      </div>
    );
  }
  return (
    <div className="rank-card__tile">
      <dt className="md-typescale-label-medium">{tile.label}</dt>
      <dd className="md-typescale-title-large numeric">{tile.value}</dd>
    </div>
  );
}

export function RankCard(props: RankCardProps): ReactElement {
  const { state, numPlayers } = props;

  const view = state.kind === 'ready' ? buildRankView({ stats: state.stats, extended: state.extended }) : null;
  const message =
    state.kind === 'error' ? state.message : state.kind === 'ready' && view === null ? '順位データを表示できません' : null;

  const legendItems: readonly (RankSlice | null)[] =
    view !== null ? view.slices : Array(skeletonSliceCount(numPlayers)).fill(null);
  const tileItems: readonly (RankTile | null)[] = view !== null ? view.tiles : Array(5).fill(null);

  return (
    <ElevatedCard className="rank-card" data-testid="rank-card" data-state={state.kind}>
      <div className="rank-card__inner">
        <h2 className="rank-card__title md-typescale-title-medium">成績</h2>

        {/*
          error・想定外形状のときも、ドーナツ枠・凡例枠・タイル枠と同じ構造を描いて場所を
          確保した上でメッセージを重ねる（loading と同じプレースホルダ形状を再利用する）。
          こうすることで loading / ready / error の3状態が構造的に同じ高さになる（R1）。
          詳細: docs/design/issue-9-rank-donut.md §3.4（P2-1 是正）
        */}
        <div className={`rank-card__body${message !== null ? ' rank-card__body--message' : ''}`}>
          <div className="rank-card__chart">
            <Donut
              segments={view !== null ? segmentsFromView(view) : []}
              ariaLabel={view !== null ? view.ariaLabel : '順位分布'}
              placeholder={view === null}
            >
              {view !== null ? (
                <div className="rank-card__center">
                  <span className="rank-card__games md-typescale-headline-small numeric" data-testid="rank-games">
                    {view.gameCountText}
                  </span>
                  <span className="rank-card__games-unit md-typescale-label-small">戦</span>
                  {view.roundCountText !== null && (
                    <span className="rank-card__rounds md-typescale-label-small numeric" data-testid="rank-rounds">
                      {view.roundCountText}局
                    </span>
                  )}
                </div>
              ) : (
                <Skeleton />
              )}
            </Donut>

            <ul className="rank-card__legend" data-testid="rank-legend">
              {legendItems.map((slice, i) => (
                <LegendItem key={slice?.key ?? i} slice={slice} rank={i + 1} />
              ))}
            </ul>
          </div>

          <dl className="rank-card__tiles" data-testid="rank-tiles">
            {tileItems.map((tile, i) => (
              <TileItem key={tile?.key ?? i} tile={tile} />
            ))}
          </dl>

          {message !== null && <p className="rank-card__message">{message}</p>}
        </div>
      </div>
    </ElevatedCard>
  );
}
