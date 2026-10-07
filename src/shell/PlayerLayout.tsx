import { useState, type ReactElement } from 'react';
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
import { useGlobalHistogram } from '../filters/useGlobalHistogram';
import { FilterBar } from '../filters/FilterBar';
import { IdentityCard } from '../summary/IdentityCard';
import { effectiveLevelPoint } from '../summary/identityView';
import { useRankTheme } from '../theme/useRankTheme';
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
  const identityResource = useCurrentIdentity(numPlayers, playerId);
  const identity = identityResource.state;
  const { filter, setModes, setPeriod } = useGlobalFilter(numPlayers, identity);
  const statsResource = useFilteredStats(numPlayers, playerId, filter);
  const stats = statsResource.state;
  const distributionResource = useGlobalHistogram(numPlayers);
  const distribution = distributionResource.state;

  // 段位シード切替に渡す levelId は正規化後の値（issue-8 §1.4・§3.4）。
  // 表示中の段位タグ（IdentityCard）とテーマ色が食い違わないようにする。
  const normalizedLevelId = identity.kind === 'ready' ? effectiveLevelPoint(identity.identity.level).levelId : null;
  useRankTheme(normalizedLevelId);

  const scope: PlayerScope = {
    numPlayers,
    playerId,
    identity,
    filter,
    stats,
    distribution,
    setModes,
    setPeriod,
    retryIdentity: identityResource.retry,
    retryStats: statsResource.retry,
    retryDistribution: distributionResource.retry,
    identityRetryingIssue: identityResource.retryingIssue,
    statsRetryingIssues: statsResource.retryingIssues,
    distributionRetryingIssue: distributionResource.retryingIssue,
  };

  const heroContent = (
    <div className="player-hero">
      <span role="status" aria-live="polite" className="feedback-status">現在の段位: {identity.kind === 'loading' ? identityResource.retryingIssue ? '再試行中' : '読み込み中' : identity.kind === 'error' ? identity.issue.message : identity.kind === 'notFound' ? 'プレイヤーが見つかりませんでした' : '読み込み完了'}</span>
      <IdentityCard state={identity} onRetry={identityResource.retry} retryingIssue={identityResource.retryingIssue} fallbackName={`プレイヤー: ${rawId}`} />
      <FilterBar
        numPlayers={numPlayers}
        filter={filter}
        onModesChange={setModes}
        onPeriodChange={setPeriod}
      />
    </div>
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
