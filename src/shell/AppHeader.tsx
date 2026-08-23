import type { ReactElement } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
      // クエリ全体をそのまま持ち越す。mode は新しい numPlayers の値域では
      // 全ID が無効になり canonicalizeModes/parseModes の結果が空 →「mode 欠落」
      // と同じ扱いになるため、useGlobalFilter が新しい既定値を自然に解決・書き戻す
      // （period は人数非依存なのでそのまま有効な値として残る）
      navigate({ pathname: targetPath, search: location.search });
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
