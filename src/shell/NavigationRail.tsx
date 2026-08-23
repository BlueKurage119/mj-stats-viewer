import type { ReactElement } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { NumPlayers } from '../api';
import { Icon, Ripple } from '../components/md';
import { playerPath, VISIBLE_TABS, type PlayerTab } from './paths';

export interface PlayerNavProps {
  numPlayers: NumPlayers;
  playerId: string;
  activeTab: PlayerTab;
}

export function NavigationRail(props: PlayerNavProps): ReactElement {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="nav-rail" data-testid="nav-rail">
      {VISIBLE_TABS.map((tab) => {
        const isSelected = props.activeTab === tab.id;
        const targetPath = playerPath({
          numPlayers: props.numPlayers,
          playerId: props.playerId,
          tab: tab.id,
        });

        const handleClick = () => {
          if (location.pathname !== targetPath) {
            // タブ切替は numPlayers / playerId を変えないため、グローバル
            // フィルタ（?mode&period）はそのまま持ち越す
            navigate({ pathname: targetPath, search: location.search });
          }
        };

        return (
          <button
            key={tab.id}
            type="button"
            className="nav-rail__item"
            aria-current={isSelected ? 'page' : undefined}
            onClick={handleClick}
          >
            <Ripple />
            <div className="nav-rail__pill">
              <Icon>{tab.icon}</Icon>
            </div>
            <span className="nav-rail__label md-typescale-label-medium">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
