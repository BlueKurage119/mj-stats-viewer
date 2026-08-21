import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveRange, DATA_MIN_DATE, defaultRangeResolver, setRangeResolver } from './range';
import { RangeNotSupportedError } from './errors';

afterEach(() => {
  vi.useRealTimers();
  setRangeResolver(defaultRangeResolver);
});

describe('resolveRange — preset (T11)', () => {
  it('"all" は DATA_MIN_DATE から現在の1時間切り上げまで', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-21T12:34:56Z'));

    const { start, end } = await resolveRange({ kind: 'preset', preset: 'all' }, 4, 123456789);

    expect(start.getTime()).toBe(DATA_MIN_DATE.getTime());
    expect(end.getTime()).toBe(Date.parse('2026-08-21T13:00:00Z'));
  });

  it('"7d" は end - 7日 が start になる', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-21T12:34:56Z'));

    const { start, end } = await resolveRange({ kind: 'preset', preset: '7d' }, 4, 123456789);

    expect(end.getTime() - start.getTime()).toBe(7 * 24 * 3_600_000);
  });

  it('end は1時間の間 URL 安定になる（同一時間内で複数回呼んでも end が変わらない）', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-21T12:00:01Z'));
    const r1 = await resolveRange({ kind: 'preset', preset: '30d' }, 4, 123456789);

    vi.setSystemTime(new Date('2026-08-21T12:59:59Z'));
    const r2 = await resolveRange({ kind: 'preset', preset: '30d' }, 4, 123456789);

    expect(r1.end.getTime()).toBe(r2.end.getTime());
  });
});

describe('resolveRange — lastNGames (T11)', () => {
  it('既定 resolver は RangeNotSupportedError を throw する', async () => {
    await expect(resolveRange({ kind: 'lastNGames', n: 100 }, 4, 123456789)).rejects.toBeInstanceOf(
      RangeNotSupportedError,
    );
  });
});

describe('setRangeResolver', () => {
  it('差し替えた resolver が resolveRange から呼ばれる', async () => {
    const custom = { resolve: vi.fn().mockResolvedValue({ start: new Date(0), end: new Date(1) }) };
    setRangeResolver(custom);

    const result = await resolveRange({ kind: 'lastNGames', n: 200 }, 4, 123456789);

    expect(custom.resolve).toHaveBeenCalledWith({ kind: 'lastNGames', n: 200 }, 4, 123456789);
    expect(result).toEqual({ start: new Date(0), end: new Date(1) });
  });
});
