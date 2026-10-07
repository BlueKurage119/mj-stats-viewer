import { ApiError, MaintenanceError } from '../api';

export type RequestIssue = {
  readonly kind: 'network' | 'http' | 'maintenance' | 'unknown';
  readonly message: string;
  readonly status?: number;
};
export type ResourceState<T> =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly data: T }
  | { readonly kind: 'empty' }
  | { readonly kind: 'error'; readonly issue: RequestIssue; readonly message: string };
export interface RetryResource<S> {
  readonly state: S;
  readonly retry: () => void;
  readonly retryingIssue: RequestIssue | null;
}
export function toRequestIssue(error: unknown): RequestIssue {
  if (error instanceof MaintenanceError) {
    return { kind: 'maintenance', message: 'サーバーがメンテナンス中です。しばらくしてからお試しください。' };
  }
  if (error instanceof ApiError) {
    return error.status === 0
      ? { kind: 'network', message: 'データを取得できませんでした。接続を確認して、もう一度お試しください。' }
      : { kind: 'http', status: error.status, message: 'データを取得できませんでした。' };
  }
  return { kind: 'unknown', message: 'データを取得できませんでした。' };
}
