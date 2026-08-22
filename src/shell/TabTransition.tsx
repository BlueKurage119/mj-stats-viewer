import type { ReactElement, ReactNode } from 'react';

export interface TabTransitionProps {
  /** 変化したら再生し直すキー。タブID を渡す */
  transitionKey: string;
  /** 1 = 次のタブへ（右→左）, -1 = 前のタブへ, 0 = 方向なし（フェードのみ） */
  direction: -1 | 0 | 1;
  children: ReactNode;
}

export function TabTransition(props: TabTransitionProps): ReactElement {
  return (
    <div
      key={props.transitionKey}
      className="tab-transition"
      data-direction={props.direction}
      data-testid="tab-panel"
      data-tab={props.transitionKey}
    >
      {props.children}
    </div>
  );
}
