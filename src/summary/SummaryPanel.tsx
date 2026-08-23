/**
 * Issue 8: SummaryPanel — サマリータブのルートコンポーネント。
 *
 * カード1（アイデンティティ）は hero 領域に置くため、
 * layer 内のこのパネルはカード2〜5の後続 Issue 用プレースホルダを置く。
 *
 * 設計: docs/design/issue-8-identity-card.md §2.5
 */

import type { ReactElement } from 'react';
import { usePlayerScope } from '../filters/playerScope';
import { NO_GAMES_IN_PERIOD_MESSAGE } from '../filters/filterState';
import './summary.css';

/** カード2〜5のプレースホルダ（SummaryPanel 内専用） */
function PlaceholderCard({ label }: { label: string }): ReactElement {
  return (
    <div className="summary-placeholder-card md-typescale-body-medium" aria-label={label}>
      {label}
    </div>
  );
}

/**
 * サマリータブのルートコンポーネント。
 * usePlayerScope() で scope を取り、フィルタ状態に応じた表示を行う。
 * カード1（アイデンティティ）情報は hero 領域にあるため、ここには置かない。
 */
export function SummaryPanel(): ReactElement {
  const scope = usePlayerScope();

  // 期間データなし
  if (scope.stats?.kind === 'empty') {
    return (
      <div className="summary-panel" data-testid="summary-panel">
        <p className="md-typescale-body-medium">{NO_GAMES_IN_PERIOD_MESSAGE}</p>
      </div>
    );
  }

  return (
    <div className="summary-panel" data-testid="summary-panel">
      {/* カード2〜5: 後続 Issue で実装 */}
      <PlaceholderCard label="成績（Issue 9以降）" />
      <PlaceholderCard label="打ち筋（Issue 10以降）" />
      <PlaceholderCard label="主要スタッツ（Issue 11以降）" />
      <PlaceholderCard label="和銃分布（Issue 12以降）" />
    </div>
  );
}
