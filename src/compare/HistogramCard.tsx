import type { ReactElement } from 'react';
import type { HistogramData } from '../api';
import { percentile } from '../domain/distribution';
import type { CompareMetric } from './compareMetrics';
import { Histogram } from './Histogram';
import {
  cropHistogram,
  formatMeanNote,
  formatMetricValue,
  toTopPercent,
} from './histogramView';

export interface HistogramCardProps {
  readonly metric: CompareMetric;
  readonly value: number | null; // 自分の値。null = 自分の統計が無い
  readonly histogram: HistogramData | null; // band 0 の histogramFull
  readonly tableMean: number | null; // 卓平均（band 0 の mean）
  readonly levelMean: number | null; // 段位平均（段位帯 band の mean）
  readonly loading?: boolean;
}

/**
 * 汎用ヒストグラムカード（14枚がこれ1つを再利用）。
 * フックを持たない純表示部品。
 *
 * 設計書: docs/design/issue-13-comparison-tab.md §4.4
 */
export function HistogramCard(props: HistogramCardProps): ReactElement {
  const { metric, value, histogram, tableMean, levelMean, loading = false } = props;

  let state: 'loading' | 'ready' | 'nodist' = 'ready';
  if (loading) {
    state = 'loading';
  } else if (!histogram) {
    state = 'nodist';
  }

  // クロップとパーセンタイル計算
  const marks = [value, tableMean, levelMean];
  const window = histogram ? cropHistogram(histogram, marks) : null;

  // 上位% の計算（必ず全域の histogramFull で percentile() を呼ぶ: A1-2, A3-2）
  let topPercent = null;
  if (histogram && value !== null && Number.isFinite(value)) {
    const p = percentile(value, histogram);
    topPercent = toTopPercent(p, metric.direction);
  }

  // レンジ外判定
  const isClamped =
    histogram &&
    value !== null &&
    Number.isFinite(value) &&
    (value < histogram.min || value > histogram.max);

  // aria-label の生成
  const ariaParts = [`${metric.label}の分布`];
  if (value !== null) {
    ariaParts.push(`自分 ${formatMetricValue(value, metric.unit)}`);
  }
  if (tableMean !== null) {
    ariaParts.push(`卓平均 ${formatMetricValue(tableMean, metric.unit)}`);
  }
  if (levelMean !== null) {
    ariaParts.push(`段位平均 ${formatMetricValue(levelMean, metric.unit)}`);
  }
  if (topPercent !== null) {
    ariaParts.push(topPercent.text);
  }
  const ariaLabel = ariaParts.join('、');

  // 卓平均・段位平均の併記テキスト生成
  const meanNoteText = formatMeanNote(tableMean, levelMean, metric.unit);

  return (
    <div
      className="histogram-card"
      data-testid="histogram-card"
      data-metric={metric.key}
      data-state={state}
    >
      <div className="histogram-card__header">
        <div className="histogram-card__title-group">
          <h3 className="histogram-card__title md-typescale-title-small">{metric.label}</h3>
          {metric.denominatorNote ? (
            <span className="histogram-card__subnote md-typescale-label-small">
              {metric.denominatorNote}
            </span>
          ) : null}
        </div>
        {!loading && topPercent ? (
          <span
            className="top-percent-chip md-typescale-label-medium"
            data-testid="top-percent"
            data-tone={topPercent.tone}
          >
            {topPercent.text}
          </span>
        ) : null}
      </div>

      <div className="histogram-card__value-row">
        {loading ? (
          <>
            <div className="histogram-card__skeleton" style={{ width: '80px', height: '28px' }} />
            <div className="histogram-card__skeleton" style={{ width: '100px', height: '14px' }} />
          </>
        ) : (
          <>
            <span className="histogram-card__value md-typescale-headline-medium">
              {formatMetricValue(value, metric.unit)}
            </span>
            {meanNoteText ? (
              <span className="histogram-card__mean-note md-typescale-label-small">
                {meanNoteText}
              </span>
            ) : null}
          </>
        )}
      </div>

      <div className="histogram-card__graph-area">
        {loading ? (
          <div className="histogram-card__skeleton" />
        ) : !histogram || !window ? (
          <div className="histogram-card__nodist md-typescale-body-small">
            卓全体の分布データがありません
          </div>
        ) : (
          <Histogram
            histogram={histogram}
            window={window}
            selfValue={value}
            tableMean={tableMean}
            levelMean={levelMean}
            ariaLabel={ariaLabel}
          />
        )}
      </div>

      {isClamped ? (
        <span className="histogram-card__warning-note md-typescale-label-small">
          卓全体の分布レンジ外
        </span>
      ) : null}
    </div>
  );
}
