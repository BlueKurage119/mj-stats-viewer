import { ResourceFeedback } from '../feedback/RequestFeedback';
import { StatsFeedback } from '../feedback/StatsFeedback';
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import type { GameMode } from '../api';
import { getBandZeroHistogram, getBandZeroMean } from '../domain/distribution';
import { useFilteredStats } from '../filters/useFilteredStats';
import { useLevelStatistics } from '../filters/useLevelStatistics';
import { usePlayerScope } from '../filters/playerScope';
import { NO_GAMES_IN_PERIOD_MESSAGE, type GlobalFilter } from '../filters/filterState';
import {
  COMPARE_CATEGORY_LABELS,
  COMPARE_METRICS,
  type CompareCategory,
} from './compareMetrics';
import { CompareContextBar } from './CompareContextBar';
import { HistogramCard } from './HistogramCard';
import { getLevelBandMean, populationSize } from './histogramView';
import { LevelDistributionCard } from './LevelDistributionCard';
import { buildLevelDistributionView } from './levelDistributionView';
import { shouldResetOverride, useRepresentativeMode } from './useRepresentativeMode';
import './compare.css';

/**
 * 比較タブ本体。
 * フック配線と状態の集約のみを行う。
 *
 * 設計書: docs/design/issue-13-comparison-tab.md §6・§7
 */
export function ComparePanel(): ReactElement {
  const scope = usePlayerScope();
  const { numPlayers, playerId, filter, identity, distribution } = scope;

  // ユーザーがコンテキストバーで選んだモード（override）
  const [overrideMode, setOverrideMode] = useState<GameMode | null>(null);

  // filter が変化したら override をリセット（A4-4）
  const prevFilterRef = useRef<GlobalFilter | null>(filter);
  useEffect(() => {
    if (shouldResetOverride(prevFilterRef.current, filter)) {
      prevFilterRef.current = filter;
      setOverrideMode(null);
    }
  }, [filter]);

  // 代表モードの選定
  const playedModes = scope.stats.kind === 'ready' ? scope.stats.stats.played_modes : null;
  const repResource = useRepresentativeMode({
    numPlayers,
    playerId,
    filter,
    playedModes,
    override: overrideMode,
  });

  const rep = repResource.state;

  // 代表モード1つだけの filter を合成して useFilteredStats をもう一度呼ぶ（§6.4）
  // ★ useMemo 必須: 毎レンダで新しい object literal を渡すと無限ループになる
  const repMode = rep.kind === 'ready' ? rep.mode : null;
  const filterPeriod = filter?.period;
  const singleModeFilter = useMemo<GlobalFilter | null>(
    () => (repMode !== null && filterPeriod ? { modes: [repMode], period: filterPeriod } : null),
    [repMode, filterPeriod],
  );
  const modeResource = useFilteredStats(numPlayers, playerId, singleModeFilter);
  const modeStats = modeResource.state;

  // 段位分布データの取得
  const levelResource = useLevelStatistics(numPlayers);
  const levelStats = levelResource.state;

  // 段位分布ビューモデルの構築
  const selfLevelId = identity.kind === 'ready' ? identity.identity.level.id : null;
  const levelDistView = useMemo(() => {
    if (levelStats.kind !== 'ready') return null;
    return buildLevelDistributionView({
      stats: levelStats.stats,
      numPlayers,
      selfLevelId,
    });
  }, [levelStats, numPlayers, selfLevelId]);

  // 母集団 n
  const popN = useMemo(() => {
    if (distribution.kind !== 'ready' || repMode === null) return null;
    return populationSize(distribution.histogram, repMode);
  }, [distribution, repMode]);

  const parentBlocked = scope.stats.kind === 'empty' || scope.stats.kind === 'error';
  const repBlocked = rep.kind === 'empty' || rep.kind === 'error';
  const showMetrics = !parentBlocked && !repBlocked && modeStats.kind !== 'empty';
  const valueLoading = !parentBlocked && !repBlocked && (rep.kind === 'loading' || modeStats.kind === 'loading' || (modeStats.kind === 'ready' && modeStats.extendedState.kind === 'loading'));
  const distributionLoading = distribution.kind === 'loading' || (!parentBlocked && !repBlocked && rep.kind === 'loading');

  // カテゴリ順にグループ化
  const categories: CompareCategory[] = ['rate', 'point', 'speed', 'luck'];

  return (
    <div className="compare-panel">
      <ResourceFeedback source="期間内の成績" issue={scope.stats.kind === 'error' ? scope.stats.issue : null} retryingIssue={scope.statsRetryingIssues.stats} onRetry={() => scope.retryStats('failed')} loading={scope.stats.kind === 'loading'} emptyMessage={scope.stats.kind === 'empty' ? NO_GAMES_IN_PERIOD_MESSAGE : null} />
      {!parentBlocked && <ResourceFeedback source="比較するモード" issue={rep.kind === 'error' ? rep.issue : null} retryingIssue={repResource.retryingIssue} onRetry={repResource.retry} loading={rep.kind === 'loading'} emptyMessage={rep.kind === 'empty' ? NO_GAMES_IN_PERIOD_MESSAGE : null} />}
      {!parentBlocked && rep.kind === 'ready' && <StatsFeedback state={modeStats} retryingIssues={modeResource.retryingIssues} onRetry={modeResource.retry} source="比較する成績" />}
      {!parentBlocked && !repBlocked && <ResourceFeedback source="卓全体の分布" issue={distribution.kind === 'error' ? distribution.issue : null} retryingIssue={scope.distributionRetryingIssue} onRetry={scope.retryDistribution} loading={distribution.kind === 'loading'} />}
      {/* 1. sticky コンテキストバー */}
      <CompareContextBar
        candidates={rep.kind === 'ready' ? rep.candidates : []}
        currentMode={repMode}
        populationSize={popN}
        period={filter?.period ?? 'all'}
        onSelectMode={(mode) => {
          setOverrideMode(mode);
        }}
      />

      {/* 2. 段位分布カード。通知は busy なカードの外に置く。 */}
      <span role="status" aria-live="polite" className="feedback-status">段位分布: {levelStats.kind === 'error' ? levelStats.issue.message : levelStats.kind === 'loading' ? levelResource.retryingIssue ? '再試行中' : '読み込み中' : !levelDistView || levelDistView.total <= 0 ? '段位分布データがありません' : '読み込み完了'}</span>
      <LevelDistributionCard
        view={levelDistView}
        loading={levelStats.kind === 'loading'}
        issue={levelStats.kind === 'error' ? levelStats.issue : undefined}
        retryingIssue={levelResource.retryingIssue}
        onRetry={levelResource.retry}
      />

      {/* 3. 各カテゴリのヒストグラムカード群 */}
      {showMetrics && categories.map((cat) => {
        const metricsInCat = COMPARE_METRICS.filter((m) => m.category === cat);
        return (
          <section key={cat} className="compare-category-section">
            <h2 className="compare-category-header md-typescale-title-small">
              {COMPARE_CATEGORY_LABELS[cat]}
            </h2>
            <div className="compare-grid">
              {metricsInCat.map((metric) => {
                const rawVal =
                  modeStats.kind === 'ready' && modeStats.extended
                    ? modeStats.extended[metric.statsKey]
                    : null;
                const value =
                  typeof rawVal === 'number' && Number.isFinite(rawVal) ? rawVal : null;

                const histData =
                  distribution.kind === 'ready' && repMode !== null
                    ? getBandZeroHistogram(distribution.histogram, repMode, metric.histogramKey)
                    : null;

                const tableMean =
                  distribution.kind === 'ready' && repMode !== null
                    ? getBandZeroMean(distribution.histogram, repMode, metric.histogramKey)
                    : null;

                const levelMean =
                  distribution.kind === 'ready' && repMode !== null
                    ? getLevelBandMean(
                        distribution.histogram,
                        repMode,
                        selfLevelId,
                        metric.histogramKey,
                      )
                    : null;

                return (
                  <HistogramCard
                    key={metric.key}
                    metric={metric}
                    value={value}
                    histogram={histData}
                    tableMean={tableMean}
                    levelMean={levelMean}
                    valueLoading={valueLoading}
                    distributionLoading={distributionLoading}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
