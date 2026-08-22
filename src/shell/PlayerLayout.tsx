import { useState, type ReactElement } from 'react';
import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import { LayeredSheet } from './LayeredSheet';
import { PlayerNav } from './PlayerNav';
import { TabTransition } from './TabTransition';
import {
  isNumPlayersParam,
  isVisibleTab,
  toNumPlayers,
  visibleTabIndex,
  type PlayerTab,
} from './paths';
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

  if (!isNumPlayersParam(np) || !id) {
    return <Navigate to="/" replace />;
  }

  const numPlayers = toNumPlayers(np);

  const heroContent = (
    <div className="player-hero">
      <div className="md-typescale-headline-small">プレイヤー: {id}</div>
      <div className="md-typescale-body-medium">
        {numPlayers === 4 ? '四人打ち' : '三人打ち'}
      </div>
    </div>
  );

  return (
    <div className="shell-container">
      <AppHeader
        numPlayers={numPlayers}
        playerId={id}
        activeTab={activeTab}
      />
      <PlayerNav
        numPlayers={numPlayers}
        playerId={id}
        activeTab={activeTab}
      />
      <LayeredSheet hero={heroContent}>
        <TabTransition transitionKey={activeTab} direction={direction}>
          <Outlet />
        </TabTransition>
      </LayeredSheet>
    </div>
  );
}
