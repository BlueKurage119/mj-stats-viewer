import type { ReactElement } from 'react';
import type { GameMode, NumPlayers } from '../api';
import { selectRepresentativeMode } from '../filters/filterState';
import type { DistributionState } from '../filters/useGlobalHistogram';
import type { FilteredStatsState } from '../filters/useFilteredStats';
import { ElevatedCard } from '../components/md';
import { Radar } from './Radar';
import {
  RADAR_AXIS_ORDER,
  RADAR_CENTER,
  buildPlaystyleView,
  type RadarPoint,
  type TendencyRow,
} from './playstyleView';
import './summary.css';

/**
 * カード3（打ち筋）。レーダー5軸＋傾向2軸。RankCard と同じくフックを持たない表示専用コンポーネント。
 * 2系統の状態（stats・distribution）を3状態（loading/ready/error）に畳む（§3.4）。
 * タイプ名・バンドの呼称は作らない（オーナー確定。§0.1 R-1/R-2）。
 * 詳細: docs/design/issue-10-playstyle.md §4.6
 */
export interface PlaystyleCardProps {
  readonly state: FilteredStatsState;
  readonly distribution: DistributionState;
  readonly modes: readonly GameMode[] | null; // filter?.modes。null なら loading 扱い
  readonly numPlayers: NumPlayers;
}

const TENDENCY_SEGMENT_INDEXES = [0, 1, 2, 3, 4] as const;

/** loading 中のレーダー枠用のダミー点（Radar は placeholder=true のとき x/y・value を使わない） */
const LOADING_RADAR_POINTS: readonly RadarPoint[] = RADAR_AXIS_ORDER.map((axis) => ({
  axis,
  value: null,
  valueText: null,
  x: RADAR_CENTER,
  y: RADAR_CENTER,
  clamped: false,
}));

/** loading 中の傾向2行。極ラベルは軸ごとに固定なので、データが無くても出せる */
const LOADING_TENDENCY_ROWS: readonly TendencyRow[] = [
  { key: 'offenseDefense', band: null, poleStart: '守', poleEnd: '攻', ariaLabel: '守 ⇔ 攻: 読み込み中' },
  { key: 'concealedSpeed', band: null, poleStart: '門前', poleEnd: '速度', ariaLabel: '門前 ⇔ 速度: 読み込み中' },
];

function TendencyRowView({ row }: { row: TendencyRow }): ReactElement {
  return (
    <div className="tendency__row" role="img" aria-label={row.ariaLabel} data-axis={row.key}>
      <span className="tendency__pole">{row.poleStart}</span>
      <ol className="tendency__bar">
        {TENDENCY_SEGMENT_INDEXES.map((i) => {
          const active = row.band === i;
          return (
            <li key={i} className="tendency__seg" data-active={active}>
              {active && <span className="tendency__marker" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
      <span className="tendency__pole">{row.poleEnd}</span>
    </div>
  );
}

export function PlaystyleCard(props: PlaystyleCardProps): ReactElement {
  const { state, distribution, modes, numPlayers } = props;

  const isLoading = state.kind === 'loading' || distribution.kind === 'loading' || modes === null;

  let message: string | null = null;
  let points: readonly RadarPoint[] = LOADING_RADAR_POINTS;
  let polygonPoints: string | null = null;
  let radarAriaLabel = '打ち筋レーダー 読み込み中';
  let rows: readonly TendencyRow[] = LOADING_TENDENCY_ROWS;
  let modeNote = '';

  if (!isLoading) {
    if (state.kind === 'error') {
      message = state.message;
    } else if (distribution.kind === 'error') {
      message = distribution.message;
    } else if (state.kind === 'ready') {
      if (state.extended === null) {
        message = '打ち筋データを取得できません';
      } else {
        const mode = selectRepresentativeMode(numPlayers, modes);
        const lookup = distribution.lookupFor(mode);
        const view = buildPlaystyleView({ extended: state.extended, lookup, mode });
        if (view.allAxesMissing) {
          message = 'この卓の分布データが揃っていません';
        } else {
          points = view.points;
          polygonPoints = view.polygonPoints;
          radarAriaLabel = view.radarAriaLabel;
          rows = view.rows;
          modeNote = view.modeNote;
        }
      }
    } else {
      // state.kind === 'empty' はここに到達しない（SummaryPanel が上流で扱う。§4.6）。
      // 型の網羅性のためだけの防御的分岐で、loading と同じ描画にする。
      message = null;
    }
  }

  const cardState: 'loading' | 'ready' | 'error' = isLoading ? 'loading' : message !== null ? 'error' : 'ready';

  return (
    <ElevatedCard className="playstyle-card" data-testid="playstyle-card" data-state={cardState}>
      <div className="playstyle-card__inner">
        <h2 className="playstyle-card__title md-typescale-title-medium">打ち筋</h2>

        <div className={`playstyle-card__body${message !== null ? ' playstyle-card__body--message' : ''}`}>
          <div className="playstyle-card__radar">
            <Radar points={points} polygonPoints={polygonPoints} ariaLabel={radarAriaLabel} placeholder={isLoading} />
          </div>

          <div className="playstyle-card__tendency">
            {rows.map((row) => (
              <TendencyRowView key={row.key} row={row} />
            ))}
          </div>

          {message !== null && <p className="playstyle-card__message">{message}</p>}
        </div>

        <p className="playstyle-card__note md-typescale-label-medium">{modeNote}</p>
      </div>
    </ElevatedCard>
  );
}
