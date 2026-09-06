import { useEffect, useState, type ReactElement } from 'react';
import type { HistogramData } from '../api';
import {
  buildHistogramPath,
  getMarkerPosition,
  HISTOGRAM_VIEWBOX_HEIGHT,
  HISTOGRAM_VIEWBOX_WIDTH,
  type HistogramWindow,
} from './histogramView';

export interface HistogramProps {
  readonly histogram: HistogramData;
  readonly window: HistogramWindow;
  readonly selfValue: number | null;
  readonly tableMean: number | null;
  readonly levelMean: number | null;
  readonly ariaLabel: string;
  readonly testId?: string;
}

/**
 * ヒストグラムの純表示 SVG 部品。
 * フックを持たない（Donut.tsx と同格）。アニメーション用のフラグのみ保持。
 *
 * 設計書: docs/design/issue-13-comparison-tab.md §3
 */
export function Histogram(props: HistogramProps): ReactElement {
  const {
    histogram,
    window,
    selfValue,
    tableMean,
    levelMean,
    ariaLabel,
    testId = 'histogram',
  } = props;

  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    // 次フレームでアニメーションクラスを付与
    const id = requestAnimationFrame(() => {
      setAnimated(true);
    });
    return () => {
      cancelAnimationFrame(id);
    };
  }, []);

  const pathD = buildHistogramPath(histogram, window);

  const tablePos = getMarkerPosition(tableMean, histogram, window);
  const levelPos = getMarkerPosition(levelMean, histogram, window);
  const selfPos = getMarkerPosition(selfValue, histogram, window);

  return (
    <svg
      className="histogram-svg"
      viewBox={`0 0 ${HISTOGRAM_VIEWBOX_WIDTH} ${HISTOGRAM_VIEWBOX_HEIGHT}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel}
      data-testid={testId}
      data-animated={animated ? 'true' : 'false'}
    >
      {/* 1. 分布背景 path */}
      <g className="histogram-path-group" aria-hidden="true">
        <path d={pathD} className="histogram-fill" />
      </g>

      {/* 2. 卓平均線 */}
      {tablePos !== null ? (
        <line
          x1={tablePos.x}
          y1={0}
          x2={tablePos.x}
          y2={HISTOGRAM_VIEWBOX_HEIGHT}
          className="histogram-marker-table"
          vectorEffect="non-scaling-stroke"
          data-marker="table"
          aria-hidden="true"
        />
      ) : null}

      {/* 3. 段位平均線 */}
      {levelPos !== null ? (
        <line
          x1={levelPos.x}
          y1={0}
          x2={levelPos.x}
          y2={HISTOGRAM_VIEWBOX_HEIGHT}
          className="histogram-marker-level"
          vectorEffect="non-scaling-stroke"
          data-marker="level"
          aria-hidden="true"
        />
      ) : null}

      {/* 4. 自分マーカー線 */}
      {selfPos !== null ? (
        <line
          x1={selfPos.x}
          y1={0}
          x2={selfPos.x}
          y2={HISTOGRAM_VIEWBOX_HEIGHT}
          className="histogram-marker-self"
          vectorEffect="non-scaling-stroke"
          data-marker="self"
          data-clamped={selfPos.clamped ?? undefined}
          aria-hidden="true"
        />
      ) : null}

      {/* 5. 自分三角ポインタ（上端に一辺6） */}
      {selfPos !== null ? (
        <polygon
          points={`${selfPos.x - 3},0 ${selfPos.x + 3},0 ${selfPos.x},6`}
          className="histogram-marker-pointer"
          data-marker="self-pointer"
          data-clamped={selfPos.clamped ?? undefined}
          aria-hidden="true"
        />
      ) : null}
    </svg>
  );
}
