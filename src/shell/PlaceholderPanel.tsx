import type { ReactElement } from 'react';
import { usePlayerScope } from '../filters/playerScope';
import { NO_GAMES_IN_PERIOD_MESSAGE } from '../filters/filterState';
import type { PlayerTab } from './paths';

export interface PlaceholderPanelProps {
  tab: PlayerTab;
}

export function PlaceholderPanel(props: PlaceholderPanelProps): ReactElement {
  const scope = usePlayerScope();

  if (scope?.stats?.kind === 'empty') {
    return (
      <div className="placeholder-panel">
        <h2 className="md-typescale-title-large">タブ: {props.tab}</h2>
        <p className="md-typescale-body-medium">{NO_GAMES_IN_PERIOD_MESSAGE}</p>
      </div>
    );
  }

  return (
    <div className="placeholder-panel">
      <h2 className="md-typescale-title-large">タブ: {props.tab}</h2>
      <p className="md-typescale-body-medium">このタブのコンテンツは後続の Issue で実装されます。</p>
      {scope?.filter && (
        <p className="md-typescale-body-small">
          選択中モード: {scope.filter.modes.join(', ')} / 期間: {scope.filter.period}
        </p>
      )}
      {scope?.stats?.kind === 'ready' && (
        <p className="md-typescale-body-small">
          対局数: {scope.stats.stats.gameCount}
        </p>
      )}
      {scope?.stats?.kind === 'error' && (
        <p className="md-typescale-body-small" style={{ color: 'var(--md-sys-color-error)' }}>
          {scope.stats.message}
        </p>
      )}
    </div>
  );
}
