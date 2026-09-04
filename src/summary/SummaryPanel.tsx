import type { ReactElement } from 'react';
import { usePlayerScope } from '../filters/playerScope';
import { NO_GAMES_IN_PERIOD_MESSAGE } from '../filters/filterState';
import { ElevatedCard } from '../components/md';
import { LevelDetailCard } from './LevelDetailCard';
import './summary.css';

/**
 * サマリータブ本体。段位の詳細（LevelDetailCard）と順位グラフのプレースホルダ（#17 承諾後機能）を持つ。
 * カード1のヒーロー部分（IdentityCard）はヒーロー側にあり、ここには含まない。
 *
 * 【2026-09-05 是正】LevelDetailCard は scope.stats の状態に関係なく常に描画する。
 * 段位・昇降条件はフィルタ非依存なので、期間内に対局が無い（empty）ときも消してはならない。
 * NO_GAMES_IN_PERIOD_MESSAGE は LevelDetailCard の下に出し、順位グラフ枠は出さない。
 * 詳細: docs/design/issue-8-identity-card.md §4.4
 */
export function SummaryPanel(): ReactElement {
  const scope = usePlayerScope();

  return (
    <div className="summary-panel">
      <LevelDetailCard state={scope.identity} />

      {scope.stats.kind === 'empty' ? (
        <p className="md-typescale-body-medium">{NO_GAMES_IN_PERIOD_MESSAGE}</p>
      ) : (
        <ElevatedCard className="summary-panel__rank-graph">
          <div className="summary-panel__rank-graph-inner" data-testid="rank-graph-placeholder">
            <h2 className="md-typescale-title-medium">順位グラフ</h2>
            <p className="md-typescale-body-medium">対局履歴データの利用許諾後に実装します（#17）</p>
          </div>
        </ElevatedCard>
      )}
    </div>
  );
}
