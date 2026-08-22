import type { PlayerSearchResult } from '../api';
import { ApiError, MaintenanceError } from '../api';

export type SearchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'results'; items: readonly PlayerSearchResult[] }
  | { kind: 'error'; message: string };

/** 前後の空白を落とす。全て空白なら '' */
export function normalizeQuery(raw: string): string {
  return raw.trim();
}

/** 例外を利用者向け日本語メッセージへ。サーバ由来の生文言は出さない */
export function describeError(err: unknown): string {
  if (err instanceof MaintenanceError) {
    return 'サーバーがメンテナンス中です。しばらくしてからお試しください。';
  }
  if (err instanceof ApiError) {
    if (err.status === 0) {
      return 'ネットワークに接続できませんでした。';
    }
    return `検索に失敗しました（HTTP ${err.status}）`;
  }
  return '検索に失敗しました。';
}
