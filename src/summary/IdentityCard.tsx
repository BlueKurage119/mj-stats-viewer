import type { ReactElement } from 'react';
import type { CurrentIdentityState } from '../filters/useCurrentIdentity';
import { MODE_LABELS } from '../filters/filterState';
import { buildIdentityView, type ConditionLine, type IdentityView } from './identityView';
import './summary.css';

/**
 * カード1（アイデンティティ）の表示専用コンポーネント。
 * フックを使わない純粋な表示コンポーネント（dev ギャラリーから任意の状態を流し込める）。
 * 詳細: docs/design/issue-8-identity-card.md §4.3
 */
export interface IdentityCardProps {
  readonly state: CurrentIdentityState;
  readonly fallbackName: string; // 例 'プレイヤー: 123456'（identity 未解決時の名前）
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

function ReadyIdentity({ view }: { view: IdentityView }): ReactElement {
  const hasMax = view.maxPointText !== null && view.progress !== null;
  const point = Number(view.pointText);
  const maxPoint = view.maxPointText !== null ? Number(view.maxPointText) : 0;

  return (
    <section className="identity" data-testid="identity-card">
      <p className="identity__name md-typescale-title-medium" data-testid="identity-name">
        {view.nickname}
      </p>

      <div className="identity__level" data-testid="identity-level">
        <span className="identity__badge md-typescale-headline-small" role="img" aria-label={view.levelText}>
          {view.badge.kind === 'stars' ? (
            <>
              {view.badge.major}
              <span className="identity__stars" aria-hidden="true">
                {'★'.repeat(view.badge.stars)}
              </span>
            </>
          ) : (
            view.badge.text
          )}
        </span>
        <span className="identity__point md-typescale-display-medium numeric">{view.pointText}</span>
        {view.maxPointText !== null && (
          <span className="identity__max md-typescale-title-medium numeric">/{view.maxPointText}</span>
        )}
      </div>

      {hasMax && (
        <div
          className="identity__progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={maxPoint}
          aria-valuenow={point}
          aria-valuetext={`${view.pointText}/${view.maxPointText}`}
        >
          <span className="identity__progress-fill" style={{ width: `${(view.progress ?? 0) * 100}%` }} />
        </div>
      )}

      <p className="identity__remaining md-typescale-body-medium" data-testid="identity-remaining">
        {view.nextLevelText !== null && view.remainingText !== null ? (
          <>
            {view.nextLevelText} まであと <span className="numeric">{view.remainingText}</span> pt
          </>
        ) : (
          '昇段上限なし'
        )}
      </p>

      <ConditionsBlock view={view} />

      <p className="identity__meta md-typescale-label-small" data-testid="identity-meta">
        全モード・全期間 通算 <span className="numeric">{view.gameCount.toLocaleString('ja-JP')}</span> 戦（フィルタ非適用）
      </p>
    </section>
  );
}

export function IdentityCard(props: IdentityCardProps): ReactElement {
  const { state, fallbackName } = props;

  if (state.kind === 'ready') {
    return <ReadyIdentity view={buildIdentityView(state.identity)} />;
  }

  if (state.kind === 'loading') {
    return (
      <section className="identity" data-testid="identity-card">
        <p className="identity__name md-typescale-title-medium" data-testid="identity-name">
          {fallbackName}
        </p>
        <div className="identity__level identity__level--loading" data-testid="identity-level">
          <span className="identity__skeleton identity__skeleton--level" />
        </div>
        <div className="identity__progress--loading" aria-hidden="true" />
        <p className="identity__remaining md-typescale-body-medium" data-testid="identity-remaining">
          <span className="identity__skeleton identity__skeleton--remaining" />
        </p>
      </section>
    );
  }

  const message = state.kind === 'notFound' ? 'プレイヤーが見つかりませんでした' : state.message;
  const messageModifierClass = state.kind === 'notFound' ? 'identity__level--not-found' : 'identity__level--error';

  return (
    <section className="identity" data-testid="identity-card">
      <p className="identity__name md-typescale-title-medium" data-testid="identity-name">
        {fallbackName}
      </p>
      <p className={`identity__level md-typescale-body-medium ${messageModifierClass}`} data-testid="identity-level">
        {message}
      </p>
    </section>
  );
}
