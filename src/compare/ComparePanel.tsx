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
import { useRepresentativeMode } from './useRepresentativeMode';
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
    if (filter !== prevFilterRef.current) {
      prevFilterRef.current = filter;
      setOverrideMode(null);
    }
  }, [filter]);

  // 代表モードの選定
  const playedModes = scope.stats.kind === 'ready' ? scope.stats.stats.played_modes : null;
  const rep = useRepresentativeMode({
    numPlayers,
    playerId,
    filter,
    playedModes,
    override: overrideMode,
  });

  // 代表モード1つだけの filter を合成して useFilteredStats をもう一度呼ぶ（§6.4）
  // ★ useMemo 必須: 毎レンダで新しい object literal を渡すと無限ループになる
  const repMode = rep.kind === 'ready' ? rep.mode : null;
  const filterPeriod = filter?.period;
  const singleModeFilter = useMemo<GlobalFilter | null>(
    () => (repMode !== null && filterPeriod ? { modes: [repMode], period: filterPeriod } : null),
    [repMode, filterPeriod],
  );
  const modeStats = useFilteredStats(numPlayers, playerId, singleModeFilter);

  // 段位分布データの取得
  const levelStats = useLevelStatistics(numPlayers);

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

  // 全体エラー
  if (scope.stats.kind === 'error') {
    return (
      <div className="compare-panel">
        <p className="md-typescale-body-medium">{scope.stats.message}</p>
      </div>
    );
  }

  // 候補0または対局なし (empty)
  if (rep.kind === 'empty' || modeStats.kind === 'empty') {
    return (
      <div className="compare-panel">
        <p className="md-typescale-body-medium">{NO_GAMES_IN_PERIOD_MESSAGE}</p>
      </div>
    );
  }

  const isLoading =
    filter === null ||
    distribution.kind === 'loading' ||
    rep.kind === 'loading' ||
    modeStats.kind === 'loading';

  // カテゴリ順にグループ化
  const categories: CompareCategory[] = ['rate', 'point', 'speed', 'luck'];

  return (
    <div className="compare-panel">
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

      {/* 2. 段位分布カード */}
      <LevelDistributionCard
        view={levelDistView}
        loading={levelStats.kind === 'loading'}
      />

      {/* 3. 各カテゴリのヒストグラムカード群 */}
      {categories.map((cat) => {
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
                    loading={isLoading}
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
