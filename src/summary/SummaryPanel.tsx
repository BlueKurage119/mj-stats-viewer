import type { ReactElement } from 'react';
import { usePlayerScope } from '../filters/playerScope';
import { NO_GAMES_IN_PERIOD_MESSAGE } from '../filters/filterState';
import { ElevatedCard } from '../components/md';
import './summary.css';

/**
 * サマリータブ本体。順位グラフのプレースホルダ（#17 承諾後機能）を持つ。
 * カード1（アイデンティティ）はヒーロー側（IdentityCard）にあり、ここには含まない。
 * 詳細: docs/design/issue-8-identity-card.md §4.4
 */
export function SummaryPanel(): ReactElement {
  const scope = usePlayerScope();

  if (scope.stats.kind === 'empty') {
    return (
      <div className="summary-panel">
        <p className="md-typescale-body-medium">{NO_GAMES_IN_PERIOD_MESSAGE}</p>
      </div>
    );
  }

  return (
    <div className="summary-panel">
      <ElevatedCard className="summary-panel__rank-graph">
        <div className="summary-panel__rank-graph-inner" data-testid="rank-graph-placeholder">
          <h2 className="md-typescale-title-medium">順位グラフ</h2>
          <p className="md-typescale-body-medium">対局履歴データの利用許諾後に実装します（#17）</p>
        </div>
      </ElevatedCard>
    </div>
  );
}
