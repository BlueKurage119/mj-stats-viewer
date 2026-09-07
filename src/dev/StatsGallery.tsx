import { useEffect, useState, type ReactElement } from 'react';
import rawExtendedFixture from '../api/testdata/player_extended_stats.json';
import { normalizePlayerExtendedStats } from '../api/normalize';
import playerStatsFixture from '../domain/__fixtures__/player_stats_4p.json';
import type { PlayerExtendedStats, PlayerStats } from '../api';
import { useTheme, type ColorModeSetting } from '../theme/ThemeProvider';
import { buildGrowthView } from '../stats/growthView';
import { buildStatsView } from '../stats/statsView';
import { StatsSection } from '../stats/StatsSection';
import '../stats/stats.css';

const normExtended = normalizePlayerExtendedStats(rawExtendedFixture as any);

const baseStats4p: PlayerStats = {
  ...playerStatsFixture,
  rank_rates: [0.26, 0.25, 0.25, 0.24],
  rank_avg_score: [42000, 27000, 21000, 10000],
  played_modes: [16],
};

const baseStats3p: PlayerStats = {
  ...playerStatsFixture,
  id: 123456791,
  nickname: 'テストプレイヤー3',
  level: { id: 20501, score: 800, delta: 150 },
  max_level: { id: 20501, score: 1200, delta: 0 },
  rank_rates: [0.4, 0.35, 0.25],
  rank_avg_score: [45000, 25000, 10000],
  played_modes: [22],
};

export function StatsGallery(): ReactElement {
  const { modeSetting, setModeSetting } = useTheme();
  const [numPlayers, setNumPlayers] = useState<3 | 4>(4);
  const [hasExtended, setHasExtended] = useState<boolean>(true);
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

  const stats = numPlayers === 4 ? baseStats4p : baseStats3p;
  const extended: PlayerExtendedStats | null = hasExtended ? normExtended : null;

  const growth = buildGrowthView({
    level: stats.level,
    rankRates: stats.rank_rates,
    rankAvgScores: stats.rank_avg_score,
    numPlayers,
    selectedModeCount: 1,
    selectedModes: stats.played_modes ?? [],
    maxLevel: stats.max_level,
  });

  const baseMode = numPlayers === 4 ? 16 : 22;

  const sections = buildStatsView({
    stats,
    extended,
    growth,
    baseMode,
    numPlayers,
  });

  const gameCountText = stats.gameCount.toLocaleString('ja-JP');
  const roundCountVal = extended?.roundCount;
  const roundCountText =
    typeof roundCountVal === 'number' && Number.isFinite(roundCountVal)
      ? roundCountVal.toLocaleString('ja-JP')
      : '—';

  return (
    <div style={{ padding: '24px', maxWidth: '1040px', margin: '0 auto' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1 className="md-typescale-headline-medium">Stats Gallery (#/__stats)</h1>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginTop: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span>Theme:</span>
            {(['light', 'dark', 'system'] as ColorModeSetting[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setModeSetting(mode)}
                style={{
                  fontWeight: modeSetting === mode ? 'bold' : 'normal',
                  padding: '4px 12px',
                }}
              >
                {mode}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span>人数:</span>
            <button
              type="button"
              onClick={() => setNumPlayers(4)}
              style={{ fontWeight: numPlayers === 4 ? 'bold' : 'normal', padding: '4px 12px' }}
            >
              四麻 (4p)
            </button>
            <button
              type="button"
              onClick={() => setNumPlayers(3)}
              style={{ fontWeight: numPlayers === 3 ? 'bold' : 'normal', padding: '4px 12px' }}
            >
              三麻 (3p)
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={hasExtended}
                onChange={(e) => setHasExtended(e.target.checked)}
              />
              ExtendedStatsあり
            </label>
          </div>
        </div>
      </header>

      <main className="stats-panel">
        <p className="stats-panel__count md-typescale-body-small">
          {gameCountText}戦 / {roundCountText}局
        </p>

        {sections.map((section) => (
          <StatsSection
            key={section.id}
            section={section}
            openTipId={openTipId}
            onToggleTip={setOpenTipId}
          />
        ))}
      </main>
    </div>
  );
}
