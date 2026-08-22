import type { ReactElement } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { NumPlayers } from '../api';
import { OutlinedSegmentedButton, OutlinedSegmentedButtonSet } from '../components/md';
import { playerPath, type PlayerTab } from './paths';

export interface AppHeaderProps {
  numPlayers: NumPlayers;
  playerId: string;
  activeTab: PlayerTab;
}

export function AppHeader(props: AppHeaderProps): ReactElement {
  const navigate = useNavigate();

  const handleSelection = (
    e: CustomEvent<{ selected: boolean; index: number }>,
  ) => {
    const index = e.detail.index;
    const nextNumPlayers: NumPlayers = index === 0 ? 4 : 3;
    if (nextNumPlayers !== props.numPlayers) {
      navigate(
        playerPath({
          numPlayers: nextNumPlayers,
          playerId: props.playerId,
          tab: props.activeTab,
        }),
      );
    }
  };

  return (
    <header className="app-header" data-testid="app-header">
      <Link to="/" className="app-header__title md-typescale-title-medium">
        mj-stats-viewer
      </Link>
      <OutlinedSegmentedButtonSet
        data-testid="np-toggle"
        onSegmentedButtonSetSelection={handleSelection}
      >
        <OutlinedSegmentedButton
          label="四人打ち"
          selected={props.numPlayers === 4}
        />
        <OutlinedSegmentedButton
          label="三人打ち"
          selected={props.numPlayers === 3}
        />
      </OutlinedSegmentedButtonSet>
    </header>
  );
}
