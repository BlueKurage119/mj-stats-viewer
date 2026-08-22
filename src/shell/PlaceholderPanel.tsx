import type { ReactElement } from 'react';
import type { PlayerTab } from './paths';

export interface PlaceholderPanelProps {
  tab: PlayerTab;
}

export function PlaceholderPanel(props: PlaceholderPanelProps): ReactElement {
  return (
    <div className="placeholder-panel">
      <h2 className="md-typescale-title-large">タブ: {props.tab}</h2>
      <p className="md-typescale-body-medium">このタブのコンテンツは後続の Issue で実装されます。</p>
    </div>
  );
}
