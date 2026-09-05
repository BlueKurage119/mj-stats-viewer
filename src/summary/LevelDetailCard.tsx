import type { ReactElement } from 'react';
import type { CurrentIdentityState } from '../filters/useCurrentIdentity';
import { MODE_LABELS } from '../filters/filterState';
import { ElevatedCard } from '../components/md';
import { buildIdentityView, type ConditionLine, type IdentityView } from './identityView';
import './summary.css';

/**
 * 層側カード（段位の詳細）。昇降条件（成立時のみ）と通算試合数を表示する。
 * IdentityCard と同じくフックを使わない純粋な表示コンポーネント（dev ギャラリーから任意の状態を流し込める）。
 *
 * 【2026-09-05 新規】旧 IdentityCard（ヒーロー）にあった可変ブロックの移設先。
 * ヒーローと違い高さの制約が無いため、`state.kind !== 'ready'` のときは null を返して消えてよい。
 * 詳細: docs/design/issue-8-identity-card.md §4.4.1
 */
export interface LevelDetailCardProps {
  readonly state: CurrentIdentityState;
}

function condText(line: ConditionLine, suffix: string): string {
  return line.threshold === null ? line.rankLabel : `${line.rankLabel} ${line.threshold.toLocaleString('ja-JP')}${suffix}`;
}

function CondGroup({
  testId,
  heading,
  lines,
  suffix,
}: {
  testId: string;
  heading: string;
  lines: readonly ConditionLine[];
  suffix: string;
}): ReactElement | null {
  if (lines.length === 0) return null;
  return (
    <div className="identity__cond-group" data-testid={testId}>
      <p className="identity__cond-heading md-typescale-label-large">{heading}</p>
      <ul className="identity__cond-list">
        {lines.map((line) => (
          <li key={line.key} className="identity__cond-line md-typescale-label-medium numeric">
            {condText(line, suffix)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConditionsBlock({ view }: { view: IdentityView }): ReactElement | null {
  // 条件が1つも無い / conditionMode===null のときはこのブロックごと出さない
  if (view.conditionMode === null) return null;
  if (view.promotions.length === 0 && view.demotions.length === 0) return null;

  return (
    <div className="identity__conditions" data-testid="identity-conditions">
      <CondGroup testId="identity-promotion" heading="あと1戦で昇段" lines={view.promotions} suffix="点以上" />
      <CondGroup testId="identity-demotion" heading="あと1戦で降段" lines={view.demotions} suffix="点以下" />
      <p className="identity__cond-note md-typescale-label-small">{MODE_LABELS[view.conditionMode]}・半荘での条件</p>
    </div>
  );
}

export function LevelDetailCard(props: LevelDetailCardProps): ReactElement | null {
  const { state } = props;
  if (state.kind !== 'ready') return null;

  const view = buildIdentityView(state.identity);

  return (
    <ElevatedCard className="level-detail" data-testid="level-detail-card">
      <div className="level-detail__inner">
        <h2 className="level-detail__title md-typescale-title-medium">段位の詳細</h2>

        <ConditionsBlock view={view} />

        <p className="identity__meta md-typescale-label-small" data-testid="identity-meta">
          全モード・全期間 通算 <span className="numeric">{view.gameCount.toLocaleString('ja-JP')}</span>{' '}
          戦（モード・期間フィルタの影響を受けません）
        </p>
      </div>
    </ElevatedCard>
  );
}
