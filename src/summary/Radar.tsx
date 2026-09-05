import type { ReactElement } from 'react';
import {
  RADAR_CENTER,
  RADAR_RADIUS,
  RADAR_LABEL_RADIUS,
  RADAR_RINGS,
  radarPointAt,
  radiusForValue,
  type RadarPoint,
} from './playstyleView';

/**
 * 汎用レーダー部品。フックを使わない純粋な表示コンポーネント（Donut.tsx と同じ流儀）。
 * 幾何定数は playstyleView から import する（TSX に直書きしない）。
 * 詳細: docs/design/issue-10-playstyle.md §4.5・§3.7
 */
export interface RadarProps {
  readonly points: readonly RadarPoint[];
  readonly polygonPoints: string | null;
  readonly ariaLabel: string;
  readonly placeholder?: boolean; // true なら枠（リング・スポーク・軸ラベル）だけ描く（loading）
}

export function Radar(props: RadarProps): ReactElement {
  const { points, polygonPoints, ariaLabel, placeholder = false } = props;

  return (
    <svg
      className="radar"
      viewBox="0 0 200 200"
      role="img"
      aria-label={ariaLabel}
      data-testid="playstyle-radar"
    >
      {RADAR_RINGS.map((ringValue) => (
        <circle
          key={ringValue}
          className="radar__ring"
          data-mid={ringValue === 50}
          cx={RADAR_CENTER}
          cy={RADAR_CENTER}
          r={radiusForValue(ringValue)}
        />
      ))}

      {points.map((p, i) => {
        const tip = radarPointAt(i, RADAR_RADIUS);
        return (
          <line
            key={`spoke-${p.axis}`}
            className="radar__spoke"
            data-axis={p.axis}
            x1={RADAR_CENTER}
            y1={RADAR_CENTER}
            x2={tip.x}
            y2={tip.y}
          />
        );
      })}

      {!placeholder && polygonPoints !== null && (
        <polygon className="radar__area" points={polygonPoints} />
      )}

      {!placeholder &&
        points.map((p) =>
          p.value === null ? null : (
            <circle
              key={`dot-${p.axis}`}
              className="radar__dot"
              data-axis={p.axis}
              data-clamped={p.clamped}
              cx={p.x}
              cy={p.y}
              r={3}
            />
          ),
        )}

      {points.map((p, i) => {
        const labelPt = radarPointAt(i, RADAR_LABEL_RADIUS);
        return (
          <text
            key={`label-${p.axis}`}
            className="radar__label"
            data-axis={p.axis}
            x={labelPt.x}
            y={labelPt.y}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {p.axis}
          </text>
        );
      })}

      {!placeholder &&
        points.map((p, i) => {
          if (p.value === null || p.valueText === null) return null;
          const labelPt = radarPointAt(i, RADAR_LABEL_RADIUS);
          return (
            <text
              key={`value-${p.axis}`}
              className="radar__value numeric"
              data-axis={p.axis}
              x={labelPt.x}
              y={labelPt.y + 12}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {p.valueText}
            </text>
          );
        })}
    </svg>
  );
}
