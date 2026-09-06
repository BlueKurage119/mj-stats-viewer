import type { CSSProperties, ReactElement } from 'react';
import type { FilteredStatsState } from '../filters/useFilteredStats';
import { ElevatedCard } from '../components/md';
import { Donut, type DonutSegment } from './Donut';
import { buildWinLoseView, DONUT_LABELS, type WinLoseDonut, type WinLoseSlice } from './winLoseView';
import './summary.css';

/**
 * カード5（和銃分布ドーナツ3枚）。RankCard / KeyStatsCard と同じくフックを使わない
 * 純粋な表示コンポーネント（dev ギャラリーから任意の状態を流し込める）。
 * 詳細: docs/design/issue-12-win-lose-donuts.md §4.5
 */
export interface WinLoseCardProps {
  readonly state: FilteredStatsState;
}

function Skeleton({ ariaHidden }: { ariaHidden?: boolean }): ReactElement {
  return <span className="win-lose-card__skeleton" aria-hidden={ariaHidden} />;
}

function segmentsFromSlices(slices: readonly WinLoseSlice[]): readonly DonutSegment[] {
  return slices.map((slice) => ({
    key: slice.key,
    colorVar: `var(--md-custom-color-${slice.key})`,
    arcLength: slice.arcLength,
    arcOffset: slice.arcOffset,
  }));
}

/**
 * 凡例1行。3モードを1つの関数にまとめてある（サイズ節約。issue-12 §6-1 バンドル予算）:
 * - loading: スウォッチ・テキストとも灰色ブロック
 * - dash: このドーナツだけデータが無い。ラベルは残し値だけ「—」（§4.5）
 * - slice: 通常表示
 */
function LegendItem({ slice, label }: { slice: WinLoseSlice | null; label: string | null }): ReactElement {
  if (label === null) {
    return (
      <li className="win-lose-card__legend-item">
        <Skeleton ariaHidden />
        <Skeleton />
      </li>
    );
  }
  return (
    <li className="win-lose-card__legend-item">
      <span
        className={`win-lose-card__swatch${slice === null ? ' win-lose-card__swatch--empty' : ''}`}
        aria-hidden="true"
        style={slice !== null ? ({ '--swatch': `var(--md-custom-color-${slice.key})` } as CSSProperties) : undefined}
      />
      <span className="win-lose-card__legend-text">
        <span className="win-lose-card__legend-label">{slice?.label ?? label}</span>
        <span className="win-lose-card__legend-value numeric">{slice !== null ? `${slice.percentText}%` : '—'}</span>
      </span>
    </li>
  );
}

/** slices が null（このドーナツだけデータ無し）でも凡例3行の行数を変えない（§4.6 高さ規律） */
function DonutItem({ donut, isLoading }: { donut: WinLoseDonut | null; isLoading: boolean }): ReactElement {
  const key = donut?.key ?? 'loading';
  const title = donut?.title ?? '';
  const slices = donut?.slices ?? null;
  const isEmpty = donut !== null && slices === null;
  const labels = donut !== null ? DONUT_LABELS[donut.key] : null;

  return (
    <section className="win-lose-card__item" data-donut={key}>
      <h3 className="win-lose-card__item-title md-typescale-label-large">{title || <Skeleton />}</h3>
      <Donut
        segments={slices !== null ? segmentsFromSlices(slices) : []}
        ariaLabel={donut?.ariaLabel ?? title}
        placeholder={isLoading || isEmpty}
        testId={donut !== null ? `win-lose-donut-${donut.key}` : undefined}
      >
        {/*
          「データがありません」は Donut 中央の穴（既に absolute で場所を確保済み）に置く。
          凡例の後ろに別行として足すと凡例3行の高さ不変則（§4.6）が壊れるため（実測で発見）。
        */}
        {isEmpty && <span className="win-lose-card__empty">データが<br />ありません</span>}
      </Donut>
      <ul className="win-lose-card__legend">
        {[0, 1, 2].map((i) => (
          <LegendItem
            key={slices?.[i]?.key ?? i}
            slice={slices?.[i] ?? null}
            label={isLoading || labels === null ? null : (slices?.[i]?.label ?? labels[i])}
          />
        ))}
      </ul>
    </section>
  );
}

export function WinLoseCard(props: WinLoseCardProps): ReactElement {
  const { state } = props;

  const isLoading = state.kind === 'loading';
  const view =
    state.kind === 'ready' && state.extended !== null ? buildWinLoseView(state.extended) : null;

  const message =
    state.kind === 'error'
      ? state.message
      : state.kind === 'ready' && state.extended === null
        ? '和銃分布を表示できません'
        : null;

  const cardState: 'loading' | 'ready' | 'error' = isLoading ? 'loading' : message !== null ? 'error' : 'ready';

  const donutItems: readonly (WinLoseDonut | null)[] = view !== null ? view.donuts : Array(3).fill(null);

  return (
    <ElevatedCard className="win-lose-card" data-testid="win-lose-card" data-state={cardState}>
      <div className="win-lose-card__inner">
        <h2 className="win-lose-card__title md-typescale-title-medium">和銃分布</h2>

        <div className={`win-lose-card__body${message !== null ? ' win-lose-card__body--message' : ''}`}>
          <div className="win-lose-card__donuts" data-testid="win-lose-donuts">
            {donutItems.map((donut, i) => (
              <DonutItem key={donut?.key ?? i} donut={donut} isLoading={isLoading} />
            ))}
          </div>

          {message !== null && <p className="win-lose-card__message">{message}</p>}
        </div>
      </div>
    </ElevatedCard>
  );
}
