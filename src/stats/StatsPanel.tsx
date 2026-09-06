import type { ReactElement } from 'react';
import { usePlayerScope } from '../filters/playerScope';
import { NO_GAMES_IN_PERIOD_MESSAGE } from '../filters/filterState';
import { preferredMode } from '../domain';
import { effectiveLevelPoint } from '../summary/identityView';
import { buildGrowthView } from './growthView';
import { buildStatsView } from './statsView';
import { StatsSection } from './StatsSection';
import { STAT_SECTIONS } from './statsMetrics';
import { List, ListItem } from '../components/md';
import './stats.css';

export function StatsPanel(): ReactElement {
  const scope = usePlayerScope();
  const { numPlayers, stats, identity, filter } = scope;

  if (stats.kind === 'loading') {
    const defaultSectionRowCounts: Record<string, number> = {
      rank: numPlayers === 4 ? 4 : 3,
      overall1: 7,
      overall2: 8,
      efficiency: 6,
      growth: 5,
      riichi: 16,
      call: 3,
      distribution: 9,
      luck: 12,
    };

    return (
      <div className="stats-panel">
        {STAT_SECTIONS.map((s) => {
          const count = defaultSectionRowCounts[s.id] ?? 0;
          return (
            <section key={s.id} className="stats-section" data-section={s.id}>
              <h2 className="stats-section__title md-typescale-title-small">{s.title}</h2>
              <List className="stats-section__list">
                {Array.from({ length: count }).map((_, i) => (
                  <div className="stats-row" key={i} data-has-note="false">
                    <ListItem>
                      <span slot="headline" className="stats-row__skeleton-label" />
                      <span slot="trailing-supporting-text" className="stats-row__skeleton-value" />
                    </ListItem>
                  </div>
                ))}
              </List>
            </section>
          );
        })}
      </div>
    );
  }

  if (stats.kind === 'empty') {
    return (
      <div className="stats-panel">
        <p className="md-typescale-body-medium">{NO_GAMES_IN_PERIOD_MESSAGE}</p>
      </div>
    );
  }

  if (stats.kind === 'error') {
    return (
      <div className="stats-panel">
        <p className="md-typescale-body-medium">{stats.message}</p>
      </div>
    );
  }

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
      <p className="stats-panel__count md-typescale-body-small">
        {gameCountText}戦 / {roundCountText}局
      </p>

      {sections.map((section) => (
        <StatsSection key={section.id} section={section} />
      ))}
    </div>
  );
}
