import type { ReactElement } from 'react';
import type { CurrentIdentityState } from '../filters/useCurrentIdentity';
import { buildIdentityView, type IdentityView } from './identityView';
import './summary.css';

/**
 * カード1（アイデンティティ）ヒーローの表示専用コンポーネント。
 * フックを使わない純粋な表示コンポーネント（dev ギャラリーから任意の状態を流し込める）。
 *
 * 【2026-09-05 是正】ヒーローは状態非依存の固定4行（名前行 / 段位・pt 行 / 進捗バー / 残pt 行）に限定する。
 * 昇降条件ブロックと通算試合数は層側の LevelDetailCard へ移した。
 * 詳細: docs/design/issue-8-identity-card.md §3.1・§4.3
 */
export interface IdentityCardProps {
  readonly state: CurrentIdentityState;
  readonly fallbackName: string; // 例 'プレイヤー: 123456'（identity 未解決時の名前）
}

/** ① 名前行。「フィルタ非適用」注記を右端に置き、行を増やさない（§3.8） */
function Head({ name }: { name: string }): ReactElement {
  return (
    <div className="identity__head">
      <p className="identity__name md-typescale-title-medium" data-testid="identity-name">
        {name}
      </p>
      <span className="identity__scope md-typescale-label-small" data-testid="identity-scope">
        フィルタ非適用
      </span>
    </div>
  );
}

function ReadyIdentity({ view }: { view: IdentityView }): ReactElement {
  const hasMax = view.maxPointText !== null && view.progress !== null;
  const point = Number(view.pointText);
  const maxPoint = view.maxPointText !== null ? Number(view.maxPointText) : 0;

  return (
    <section className="identity" data-testid="identity-card">
      <Head name={view.nickname} />

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

      {/* ③ 進捗バー。上限なし（魂天20）のときも枠は出し、中身（fill）だけ描かない */}
      {hasMax ? (
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
      ) : (
        <div className="identity__progress" aria-hidden="true" />
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
        <Head name={fallbackName} />
        <div className="identity__level identity__level--loading" data-testid="identity-level">
          <span className="identity__skeleton identity__skeleton--level" />
        </div>
        <div className="identity__progress" aria-hidden="true" />
        <p className="identity__remaining md-typescale-body-medium" data-testid="identity-remaining">
          <span className="identity__skeleton identity__skeleton--remaining" />
        </p>
      </section>
    );
  }

  const message = state.kind === 'notFound' ? 'プレイヤーが見つかりませんでした' : state.message;
  const messageModifierClass = state.kind === 'notFound' ? 'identity__message--not-found' : 'identity__message--error';

  return (
    <section className="identity" data-testid="identity-card">
      <Head name={fallbackName} />
      <p className={`identity__message md-typescale-body-medium ${messageModifierClass}`} data-testid="identity-level">
        {message}
      </p>
    </section>
  );
}
