import { useEffect, useRef, type ReactElement } from 'react';
import { Icon, TextButton } from '../components/md';
import type { RequestIssue } from './requestIssue';
import './feedback.css';
export interface RequestFeedbackProps {
  readonly source: string;
  readonly kind: 'empty' | 'insufficient' | 'error' | 'maintenance';
  readonly message: string;
  readonly onRetry?: () => void;
  readonly retrying?: boolean;
  readonly compact?: boolean;
}
export function RequestFeedback({source, kind, message, onRetry, retrying = false, compact = false}: RequestFeedbackProps): ReactElement {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    const owner = element?.closest('.level-dist-card, .summary-panel, .stats-panel, .compare-panel, .player-hero, .search-page');
    let focused = false;
    const track = (event: FocusEvent) => { focused = element?.contains(event.target as Node) ?? false; };
    document.addEventListener('focusin', track);
    return () => {
      document.removeEventListener('focusin', track);
      if (!focused || !element) return;
      const preferred = source === '詳細スタッツ' ? '.key-stats-card__title, [data-section="overall2"] h2, .compare-category-header'
        : source === '卓全体の分布' ? '.playstyle-card__title, .compare-category-header'
        : source === '現在の段位' ? '.identity__name' : '.rank-card__title, .compare-category-header';
      const heading = owner?.querySelector<HTMLElement>(preferred) ?? owner?.querySelector<HTMLElement>('h2, h3, h1, .identity__name');
      if (heading && !element.contains(heading)) { heading.setAttribute('tabindex', '-1'); heading.focus(); }
    };
  }, [source]);
  return <div ref={root} className={`request-feedback${compact ? ' request-feedback--compact' : ''}`} data-state={kind}>
    {!compact && <div className="request-feedback__heading md-typescale-title-small"><Icon aria-hidden="true">{kind === 'error' ? 'error_outline' : kind === 'maintenance' ? 'construction' : kind === 'empty' ? 'search_off' : 'info'}</Icon>{source}</div>}
    <p className="md-typescale-body-medium">{message}</p>
    {onRetry && <TextButton softDisabled={retrying} aria-label={`${source}を再試行`} onClick={() => { if (!retrying) onRetry(); }}>{retrying ? '再試行中…' : '再試行'}</TextButton>}
  </div>;
}
/** One live region per acquisition, outside the busy content. Always mounted. */
export function ResourceFeedback({source, issue, retryingIssue, onRetry, emptyMessage, loading = false, compact = false, statusMessage, announce = true}: {
  source: string; issue?: RequestIssue | null; retryingIssue?: RequestIssue | null;
  onRetry?: () => void; emptyMessage?: string | null; loading?: boolean; compact?: boolean; statusMessage?: string; announce?: boolean;
}): ReactElement {
  const shown = issue ?? retryingIssue;
  const status = statusMessage ?? (shown ? `${source}: ${retryingIssue && !issue ? '再試行中' : shown.message}` : emptyMessage ?? `${source}: ${loading ? '読み込み中' : '読み込み完了'}`);
  return <div className="resource-feedback" data-source={source}>
    {announce && <span role="status" aria-live="polite" className="feedback-status">{status}</span>}
    {shown ? <RequestFeedback source={source} kind={shown.kind === 'maintenance' ? 'maintenance' : 'error'} message={shown.message} onRetry={onRetry} retrying={!issue && !!retryingIssue} compact={compact} />
      : emptyMessage ? <RequestFeedback source={source} kind="empty" message={emptyMessage} compact={compact} /> : null}
  </div>;
}
