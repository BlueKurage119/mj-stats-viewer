import { ApiError, MaintenanceError } from '../api';

export function describeStatsError(err: unknown): string {
  if (err instanceof MaintenanceError) {
    return 'サーバーがメンテナンス中です。しばらくしてからお試しください。';
  }
  if (err instanceof ApiError) {
    if (err.status === 0) {
      return 'ネットワークに接続できませんでした。';
    }
    return `データの取得に失敗しました（HTTP ${err.status}）`;
  }
  return 'データの取得に失敗しました。';
}
