import type { ReactElement, ReactNode } from 'react';
import { DONUT_CIRCUMFERENCE, DONUT_RADIUS, DONUT_STROKE } from './rankView';

/**
 * 汎用ドーナツ部品。フックを使わない純粋な表示コンポーネント。
 * #12（和了/放銃ドーナツ3枚）で再利用するため RankCard から分離してある。
 * 詳細: docs/design/issue-9-rank-donut.md §4.4
 */
export interface DonutSegment {
  readonly key: string;
  readonly colorVar: string; // 'var(--md-custom-color-rank-1)' 形式の完成した CSS 値
  readonly arcLength: number | null; // null なら描かない
  readonly arcOffset: number;
}

export interface DonutProps {
  readonly segments: readonly DonutSegment[];
  readonly ariaLabel: string;
  readonly children?: ReactNode; // 中央の穴に置く内容
  readonly placeholder?: boolean; // true なら全周を surface-container-highest で1本描く（loading 用）
}

export function Donut(props: DonutProps): ReactElement {
  const { segments, ariaLabel, children, placeholder = false } = props;

  return (
    <div className="donut">
      <svg
        className="donut__svg"
        viewBox="0 0 160 160"
        role="img"
        aria-label={ariaLabel}
        data-testid="rank-donut"
      >
        <circle
          className="donut__track"
          cx={80}
          cy={80}
          r={DONUT_RADIUS}
          fill="none"
          strokeWidth={DONUT_STROKE}
        />
        {placeholder
          ? null
          : segments
              .filter((seg) => seg.arcLength !== null)
              .map((seg) => (
                <circle
                  key={seg.key}
                  className="donut__seg"
                  data-seg={seg.key}
                  cx={80}
                  cy={80}
                  r={DONUT_RADIUS}
                  fill="none"
                  strokeWidth={DONUT_STROKE}
                  stroke={seg.colorVar}
                  strokeDasharray={`${seg.arcLength} ${DONUT_CIRCUMFERENCE - seg.arcLength!}`}
                  strokeDashoffset={seg.arcOffset}
                  transform="rotate(-90 80 80)"
                />
              ))}
      </svg>
      <div className="donut__center">{children}</div>
    </div>
  );
}
