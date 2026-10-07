import type { FilteredStatsState, StatsRetryTarget } from '../filters/useFilteredStats';
import type { RequestIssue } from './requestIssue';
import { ResourceFeedback } from './RequestFeedback';
export function StatsFeedback({state, retryingIssues, onRetry, source = '期間内の成績'}: {
  state: FilteredStatsState; retryingIssues: Readonly<Partial<Record<'stats' | 'extended', RequestIssue>>>;
  onRetry: (target?: StatsRetryTarget) => void; source?: string;
}) {
  const extended = state.kind === 'ready' ? state.extendedState : null;
  return <>
    <ResourceFeedback source={source} issue={state.kind === 'error' ? state.issue : null}
      retryingIssue={retryingIssues.stats} onRetry={() => onRetry('failed')}
      loading={state.kind === 'loading'} emptyMessage={state.kind === 'empty' ? 'この期間の対局はありません。モードや期間を変更してください。' : null} />
    {(state.kind === 'ready' || retryingIssues.extended) && <ResourceFeedback source="詳細スタッツ" issue={extended?.kind === 'error' ? extended.issue : null}
      retryingIssue={retryingIssues.extended} onRetry={() => onRetry('extended')}
      loading={state.kind === 'loading' || extended?.kind === 'loading'} emptyMessage={extended?.kind === 'empty' ? 'この期間の詳細スタッツはありません。モードや期間を変更してください。' : null} />}
  </>;
}
