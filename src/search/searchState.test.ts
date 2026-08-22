import { describe, expect, it } from 'vitest';
import { ApiError, MaintenanceError } from '../api';
import { describeError, normalizeQuery } from './searchState';

describe('searchState', () => {
  it('B15: normalizeQuery returns empty string for whitespace or empty', () => {
    expect(normalizeQuery('  ')).toBe('');
    expect(normalizeQuery('')).toBe('');
  });

  it('B16: normalizeQuery trims leading and trailing whitespace', () => {
    expect(normalizeQuery('  たなか  ')).toBe('たなか');
  });

  it('B17: describeError returns maintenance message and does not leak server message', () => {
    const err = new MaintenanceError('维护中');
    const msg = describeError(err);
    expect(msg).toBe('サーバーがメンテナンス中です。しばらくしてからお試しください。');
    expect(msg).not.toContain('维护中');
  });

  it('B18: describeError returns network message for ApiError status 0', () => {
    const err = new ApiError('x', 0, 'p');
    expect(describeError(err)).toBe('ネットワークに接続できませんでした。');
  });

  it('B19: describeError includes HTTP status for other ApiError', () => {
    const err = new ApiError('x', 500, 'p');
    expect(describeError(err)).toContain('500');
  });

  it('B20: describeError returns generic message and does not leak raw error message', () => {
    const err = new Error('boom');
    const msg = describeError(err);
    expect(msg).toBe('検索に失敗しました。');
    expect(msg).not.toContain('boom');
  });
});
