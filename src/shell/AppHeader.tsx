import type { ReactElement } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { NumPlayers } from '../api';
import { OutlinedSegmentedButton, OutlinedSegmentedButtonSet } from '../components/md';
import { PERIOD_QUERY_KEY } from '../filters/filterState';
import { playerPath, type PlayerTab } from './paths';

export interface AppHeaderProps {
  numPlayers: NumPlayers;
  playerId: string;
  activeTab: PlayerTab;
}

export function AppHeader(props: AppHeaderProps): ReactElement {
  const navigate = useNavigate();
  const location = useLocation();

  const handleSelection = (
    e: CustomEvent<{ selected: boolean; index: number }>,
  ) => {
    const index = e.detail.index;
    const nextNumPlayers: NumPlayers = index === 0 ? 4 : 3;
    if (nextNumPlayers !== props.numPlayers) {
      const targetPath = playerPath({
        numPlayers: nextNumPlayers,
        playerId: props.playerId,
        tab: props.activeTab,
      });
      // 人数を切り替えると mode（雀荘IDの集合）は別の値域になるため引き継がず、
      // useGlobalFilter に既定値を再解決させる。period は人数に依存しないため持ち越す
      const currentParams = new URLSearchParams(location.search);
      const period = currentParams.get(PERIOD_QUERY_KEY);
      const nextParams = new URLSearchParams();
      if (period !== null) {
        nextParams.set(PERIOD_QUERY_KEY, period);
      }
      const search = nextParams.toString();
      navigate({ pathname: targetPath, search: search === '' ? '' : `?${search}` });
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
