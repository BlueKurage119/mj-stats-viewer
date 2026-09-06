import type { ReactElement } from 'react';
import type { GameMode, PeriodPreset } from '../api';
import { ChipSet, FilterChip } from '../components/md';
import { MODE_LABELS } from '../filters/filterState';

export interface CompareContextBarProps {
  readonly candidates: readonly GameMode[];
  readonly currentMode: GameMode | null;
  readonly populationSize: number | null;
  readonly period: PeriodPreset;
  readonly onSelectMode: (mode: GameMode) => void;
}

const PERIOD_NOTE_LABELS: Record<PeriodPreset, string> = {
  all: '全期間',
  '1y': '直近1年',
  '90d': '直近90日',
  '30d': '直近30日',
  '7d': '直近7日',
};

/**
 * sticky コンテキストバー（モードチップ・母集団n・凡例・注記）。
 *
 * 設計書: docs/design/issue-13-comparison-tab.md §6.1
 */
export function CompareContextBar(props: CompareContextBarProps): ReactElement {
  const { candidates, currentMode, populationSize, period, onSelectMode } = props;

  const isAllPeriod = period === 'all';
  const periodLabel = PERIOD_NOTE_LABELS[period] ?? '選択期間';

  return (
    <div className="compare-context-bar" data-testid="compare-context-bar">
      <div className="compare-context-bar__main">
        <div className="compare-context-bar__left">
          {candidates.length > 0 ? (
            <ChipSet data-testid="compare-mode-chips">
              {candidates.map((mode) => (
                <FilterChip
                  key={mode}
                  label={MODE_LABELS[mode]}
                  selected={currentMode === mode}
                  data-mode={mode}
                  onClick={(e) => {
                    e.currentTarget.selected = true;
                    onSelectMode(mode);
                  }}
                />
              ))}
            </ChipSet>
          ) : null}

          {populationSize !== null ? (
            <span className="compare-context-bar__pop md-typescale-label-medium">
              母集団 n = {populationSize.toLocaleString('ja-JP')}人
            </span>
          ) : null}
        </div>

        {/* 凡例 */}
        <div className="compare-context-bar__legends md-typescale-label-small" aria-label="凡例">
          <span className="compare-legend-item">
            <svg className="compare-legend-item__icon" viewBox="0 0 14 14" aria-hidden="true">
              <line
                x1="7"
                y1="0"
                x2="7"
                y2="14"
                className="histogram-marker-self"
                vectorEffect="non-scaling-stroke"
              />
              <polygon points="4,0 10,0 7,4" className="histogram-marker-pointer" />
            </svg>
            自分
          </span>
          <span className="compare-legend-item">
            <svg className="compare-legend-item__icon" viewBox="0 0 14 14" aria-hidden="true">
              <line
                x1="7"
                y1="0"
                x2="7"
                y2="14"
                className="histogram-marker-table"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            卓平均
          </span>
          <span className="compare-legend-item">
            <svg className="compare-legend-item__icon" viewBox="0 0 14 14" aria-hidden="true">
              <line
                x1="7"
                y1="0"
                x2="7"
                y2="14"
                className="histogram-marker-level"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            段位平均
          </span>
        </div>
      </div>

      {/* 注記 */}
      <div className="compare-context-bar__note md-typescale-label-medium">
        {isAllPeriod
          ? '卓全体（全期間）との比較'
          : `${periodLabel}の自分 vs 卓全体（全期間）。母集団の分布は期間で絞り込めません`}
      </div>
    </div>
  );
}
