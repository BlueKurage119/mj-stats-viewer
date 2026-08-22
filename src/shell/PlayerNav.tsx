import type { ReactElement } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { NumPlayers } from '../api';
import { NavigationBar, NavigationTab, Icon } from '../components/md';
import { NavigationRail } from './NavigationRail';
import { playerPath, visibleTabIndex, VISIBLE_TABS, type PlayerTab } from './paths';

export interface PlayerNavProps {
  numPlayers: NumPlayers;
  playerId: string;
  activeTab: PlayerTab;
}

export function PlayerNav(props: PlayerNavProps): ReactElement {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <>
      <NavigationRail {...props} />
      <div className="bottom-nav">
        <NavigationBar
          data-testid="bottom-nav"
          activeIndex={visibleTabIndex(props.activeTab)}
        >
          {VISIBLE_TABS.map((tab) => {
            const targetPath = playerPath({
              numPlayers: props.numPlayers,
              playerId: props.playerId,
              tab: tab.id,
            });

            const handleInteraction = () => {
              if (location.pathname !== targetPath) {
                navigate(targetPath);
              }
            };

            return (
              <NavigationTab
                key={tab.id}
                label={tab.label}
                onNavigationTabInteraction={handleInteraction}
              >
                <Icon slot="active-icon">{tab.icon}</Icon>
                <Icon slot="inactive-icon">{tab.icon}</Icon>
              </NavigationTab>
            );
          })}
        </NavigationBar>
      </div>
    </>
  );
}
