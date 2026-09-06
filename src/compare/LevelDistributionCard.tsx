import type { ReactElement } from 'react';
import type { LevelDistributionBar, LevelDistributionView } from './levelDistributionView';
import { parseLevelId, getLevelMajorTag } from '../domain/level';

export interface LevelDistributionCardProps {
  readonly view: LevelDistributionView | null;
  readonly loading?: boolean;
}

function computeLabelVisibility(bars: readonly LevelDistributionBar[]): boolean[] {
  let lastMajorTag = '';
  return bars.map((bar) => {
    if (bar.isSelf) return true;
    const level = parseLevelId(bar.bucketId);
    const majorTag = getLevelMajorTag(level);
    if (majorTag !== lastMajorTag) {
      lastMajorTag = majorTag;
      return true;
    }
    return false;
  });
}

/**
 * 段位分布カード。
 * 全段位帯の縦棒グラフ＋自分ハイライト＋上位%を表示。
 *
 * 設計書: docs/design/issue-13-comparison-tab.md §5
 */
export function LevelDistributionCard(props: LevelDistributionCardProps): ReactElement {
  const { view, loading = false } = props;

  if (loading || !view) {
    return (
      <div className="level-dist-card" data-testid="level-distribution-card" data-state="loading">
        <div className="level-dist-card__header">
          <h3 className="level-dist-card__title md-typescale-title-medium">段位分布</h3>
        </div>
        <div className="level-dist-card__bars">
          <div className="histogram-card__skeleton" />
        </div>
      </div>
    );
  }

  // バーの最大度数（高さスケール用）
  const maxCount = Math.max(...view.bars.map((b) => b.count), 1);
  const shouldShowLabel = computeLabelVisibility(view.bars);

  return (
    <div className="level-dist-card" data-testid="level-distribution-card" data-state="ready">
      <div className="level-dist-card__header">
        <div className="histogram-card__title-group">
          <h3 className="level-dist-card__title md-typescale-title-medium">段位分布</h3>
          <span className="histogram-card__subnote md-typescale-label-small">
            母集団 {view.total.toLocaleString('ja-JP')}人
          </span>
        </div>
        {view.topPercent ? (
          <span
            className="top-percent-chip md-typescale-label-medium"
            data-testid="top-percent"
            data-tone={view.topPercent.tone}
          >
            {view.topPercent.text}
          </span>
        ) : null}
      </div>

      <div className="level-dist-card__chart-container">
        <div className="level-dist-card__bars" role="img" aria-label="段位分布グラフ">
          {view.bars.map((bar) => {
            const heightPct = Math.max(4, Math.round((bar.count / maxCount) * 100));
            return (
              <div
                key={bar.bucketId}
                className="level-dist-card__bar-col"
                title={`${bar.label}: ${bar.count.toLocaleString('ja-JP')}人 (${(bar.ratio * 100).toFixed(1)}%)`}
              >
                <div
                  className="level-dist-bar"
                  data-self={bar.isSelf ? 'true' : 'false'}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="level-dist-card__labels" aria-hidden="true">
          {view.bars.map((bar, idx) => (
            <div key={bar.bucketId} className="level-dist-card__label-col">
              <span
                className="level-dist-card__label-text md-typescale-label-small"
                data-self={bar.isSelf ? 'true' : 'false'}
              >
                {shouldShowLabel[idx] ? bar.label : ''}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="level-dist-card__footer md-typescale-label-small">{view.note}</div>
    </div>
  );
}
