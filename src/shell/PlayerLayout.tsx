import { useEffect, useState, type ReactElement } from 'react';
import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import { LayeredSheet } from './LayeredSheet';
import { PlayerNav } from './PlayerNav';
import { TabTransition } from './TabTransition';
import {
  isNumPlayersParam,
  isVisibleTab,
  parsePlayerId,
  toNumPlayers,
  visibleTabIndex,
  type PlayerTab,
} from './paths';
import { useCurrentIdentity } from '../filters/useCurrentIdentity';
import { useGlobalFilter } from '../filters/useGlobalFilter';
import { useFilteredStats } from '../filters/useFilteredStats';
import { FilterBar } from '../filters/FilterBar';
import { IdentityHero } from '../summary/IdentityHero';
import { useTheme } from '../theme/ThemeProvider';
import { rankFromLevelId } from '../theme/seeds';
import type { PlayerScope } from '../filters/playerScope';
import type { NumPlayers } from '../api';
import './shell.css';

export function PlayerLayout(): ReactElement {
  const { np, id } = useParams<{ np: string; id: string; tab?: string }>();
  const location = useLocation();

  const pathSegments = location.pathname.split('/').filter(Boolean);
  const lastSegment = pathSegments[pathSegments.length - 1];
  const activeTab: PlayerTab = isVisibleTab(lastSegment) ? lastSegment : 'summary';

  const [prevTab, setPrevTab] = useState<PlayerTab>(activeTab);
  const [direction, setDirection] = useState<-1 | 0 | 1>(0);

  if (activeTab !== prevTab) {
    const prevIndex = visibleTabIndex(prevTab);
    const nextIndex = visibleTabIndex(activeTab);
    setPrevTab(activeTab);
    if (nextIndex > prevIndex) {
      setDirection(1);
    } else if (nextIndex < prevIndex) {
      setDirection(-1);
    } else {
      setDirection(0);
    }
  }

  const playerId = parsePlayerId(id);
  if (!isNumPlayersParam(np) || playerId === null) {
    return <Navigate to="/" replace />;
  }

  const numPlayers = toNumPlayers(np);

  return (
    <PlayerLayoutInner
      numPlayers={numPlayers}
      playerId={playerId}
      rawId={id!}
      activeTab={activeTab}
      direction={direction}
    />
  );
}

function PlayerLayoutInner({
  numPlayers,
  playerId,
  rawId,
  activeTab,
  direction,
}: {
  numPlayers: NumPlayers;
  playerId: number;
  rawId: string;
  activeTab: PlayerTab;
  direction: -1 | 0 | 1;
}): ReactElement {
  const identity = useCurrentIdentity(numPlayers, playerId);
  const { filter, setModes, setPeriod } = useGlobalFilter(numPlayers, identity);
  const stats = useFilteredStats(numPlayers, playerId, filter);

  // Issue 8: 段位が確定したらテーマシードを切り替える（setRank）。
  // deps に identity.kind と levelId を入れる。loading 中は前の rank を維持する。
  const { setRank } = useTheme();
  const levelId = identity.kind === 'ready' ? identity.identity.level.id : undefined;
  useEffect(() => {
    if (identity.kind === 'ready' && levelId !== undefined) {
      setRank(rankFromLevelId(levelId));
    } else if (identity.kind === 'notFound' || identity.kind === 'error') {
      setRank(null);
    }
  }, [identity.kind, levelId, setRank]);

  const scope: PlayerScope = {
    numPlayers,
    playerId,
    identity,
    filter,
    stats,
    setModes,
    setPeriod,
  };

  const heroContent = (
    <IdentityHero
      identity={identity}
      filterBar={
        <FilterBar
          numPlayers={numPlayers}
          filter={filter}
          onModesChange={setModes}
          onPeriodChange={setPeriod}
        />
      }
    />
  );

  return (
    <div className="shell-container">
      <AppHeader
        numPlayers={numPlayers}
        playerId={rawId}
        activeTab={activeTab}
      />
      <PlayerNav
        numPlayers={numPlayers}
        playerId={rawId}
        activeTab={activeTab}
      />
      <LayeredSheet hero={heroContent}>
        <TabTransition transitionKey={activeTab} direction={direction}>
          <Outlet context={scope} />
        </TabTransition>
      </LayeredSheet>
    </div>
  );
}
