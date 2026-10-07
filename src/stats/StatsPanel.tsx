import { StatsFeedback } from '../feedback/StatsFeedback';
import { useEffect, useState, type ReactElement } from 'react';
import { usePlayerScope } from '../filters/playerScope';
import { preferredMode } from '../domain';
import { effectiveLevelPoint } from '../summary/identityView';
import { buildGrowthView } from './growthView';
import { buildStatsView } from './statsView';
import { StatsSection } from './StatsSection';
import type { PlayerStats } from '../api';
import './stats.css';

export function StatsPanel(): ReactElement {
  const scope = usePlayerScope();
  const { numPlayers, stats, identity, filter } = scope;
  const [openTipId, setOpenTipId] = useState<string | null>(null);

  useEffect(() => {
    if (openTipId === null) return;
    const handleOutsidePointer = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('.stats-row__info-btn') || target?.closest('.stats-row__tip')) {
        return;
      }
      setOpenTipId(null);
    };
    document.addEventListener('pointerdown', handleOutsidePointer);
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointer);
    };
  }, [openTipId]);

  if (stats.kind === 'loading') {
    // Build the same tables/lists as ready. Placeholder values never reach the UI.
    const level = {id: numPlayers === 4 ? 10301 : 20301, score: 0, delta: 0};
    const placeholder: PlayerStats = {id: scope.playerId, nickname: '', gameCount: 0, level, max_level: level,
      rank_rates: Array(numPlayers).fill(0), rank_avg_score: Array(numPlayers).fill(0), avg_rank: 0, negative_rate: 0, played_modes: []};
    const growthPlaceholder = buildGrowthView({level: {id: 0, score: 0, delta: 0}, rankRates: [], rankAvgScores: [], numPlayers, selectedModeCount: 0, selectedModes: [], maxLevel: null});
    const sections = buildStatsView({stats: placeholder, extended: null, growth: growthPlaceholder, baseMode: null, numPlayers});
    return <div className="stats-panel">
      <StatsFeedback state={stats} retryingIssues={scope.statsRetryingIssues} onRetry={scope.retryStats} />
      <p className="stats-panel__count md-typescale-body-small"><span className="feedback-skeleton" aria-hidden="true" />戦 / <span className="feedback-skeleton" aria-hidden="true" />局</p>
      {sections.map(section => <StatsSection key={section.id} section={section} loadingRows={new Set(section.rows.map(row => row.key))} />)}
    </div>;
  }

  if (stats.kind === 'empty' || stats.kind === 'error') return <div className="stats-panel"><StatsFeedback state={stats} retryingIssues={scope.statsRetryingIssues} onRetry={scope.retryStats} /></div>;

  // stats.kind === 'ready'
  let eff = null;
  let growth = null;
  if (identity.kind === 'ready') {
    try {
      eff = effectiveLevelPoint(identity.identity.level);
      growth = buildGrowthView({
        level: identity.identity.level,
        rankRates: stats.stats.rank_rates,
        rankAvgScores: stats.stats.rank_avg_score,
        numPlayers,
        selectedModeCount: filter?.modes?.length ?? 0,
        selectedModes: filter?.modes ?? [],
        maxLevel: stats.stats.max_level,
      });
    } catch {
      growth = null;
    }
  }

  const baseMode = eff ? preferredMode(eff.levelId) : null;
  if (!growth) {
    growth = buildGrowthView({level: {id: 0, score: 0, delta: 0}, rankRates: [], rankAvgScores: [], numPlayers, selectedModeCount: 0, selectedModes: [], maxLevel: stats.stats.max_level});
  }
  const sections = buildStatsView({
    stats: stats.stats,
    extended: stats.extended,
    growth,
    baseMode,
    numPlayers,
  });

  const gameCountText = stats.stats.gameCount.toLocaleString('ja-JP');
  const roundCountVal = stats.extended?.roundCount;
  const roundCountText =
    typeof roundCountVal === 'number' && Number.isFinite(roundCountVal)
      ? roundCountVal.toLocaleString('ja-JP')
      : '—';

  return (
    <div className="stats-panel">
      <StatsFeedback state={stats} retryingIssues={scope.statsRetryingIssues} onRetry={scope.retryStats} />
      <p className="stats-panel__count md-typescale-body-small">
        {gameCountText}戦 / {stats.extendedState.kind === 'loading' ? <span className="feedback-skeleton" aria-hidden="true" /> : roundCountText}局
      </p>

      {sections.map((section) => (
        <StatsSection
          key={section.id}
          section={section}
          loadingRows={new Set(section.rows.filter(row => section.id === 'growth' ? identity.kind === 'loading' : (row.key === 'roundBalance' && identity.kind === 'loading') || stats.extendedState.kind === 'loading' && (section.id === 'overall1' ? row.key === 'roundCount' : section.id !== 'rank')).map(row => row.key))}
          openTipId={openTipId}
          onToggleTip={setOpenTipId}
        />
      ))}
    </div>
  );
}
