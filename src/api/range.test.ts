import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveRange, DATA_MIN_MS, dataMinDate, defaultRangeResolver, setRangeResolver } from './range';
import { RangeNotSupportedError } from './errors';

afterEach(() => {
  vi.useRealTimers();
  setRangeResolver(defaultRangeResolver);
});

describe('resolveRange — preset (T11)', () => {
  it('"all" は DATA_MIN_MS から現在の1時間切り上げまで', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-21T12:34:56Z'));

    const { start, end } = await resolveRange({ kind: 'preset', preset: 'all' }, 4, 123456789);

    expect(start.getTime()).toBe(DATA_MIN_MS);
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

  it('"all" の start を破壊的に変更しても、以降の resolveRange 呼び出しは汚染されない（指摘3: エイリアシング）', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-21T12:34:56Z'));

    const first = await resolveRange({ kind: 'preset', preset: 'all' }, 4, 123456789);
    const originalTime = first.start.getTime();

    // 消費側が誤って破壊的メソッドを呼んだケースを模す
    first.start.setFullYear(1999);

    const second = await resolveRange({ kind: 'preset', preset: 'all' }, 4, 123456789);
    expect(second.start.getTime()).toBe(originalTime);
    expect(DATA_MIN_MS).toBe(originalTime);
  });
});

describe('DATA_MIN_MS / dataMinDate — 可変 Date を export しない（再レビュー指摘1）', () => {
  it('DATA_MIN_MS は不変なプリミティブ number である', () => {
    expect(typeof DATA_MIN_MS).toBe('number');
  });

  it('dataMinDate() は呼ぶたびに新しい Date インスタンスを返し、一方を破壊的に変更してももう一方は汚染されない', () => {
    const a = dataMinDate();
    const b = dataMinDate();

    expect(a).not.toBe(b); // 同一インスタンスではない
    expect(a.getTime()).toBe(DATA_MIN_MS);
    expect(b.getTime()).toBe(DATA_MIN_MS);

    a.setFullYear(1999);

    expect(b.getTime()).toBe(DATA_MIN_MS); // b は汚染されない
    expect(dataMinDate().getTime()).toBe(DATA_MIN_MS); // 以降の呼び出しも汚染されない
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

describe('resolveRange — PRESET_DAYS (H)', () => {
  it('"30d" は end - 30日 が start になる', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-21T12:34:56Z'));

    const { start, end } = await resolveRange({ kind: 'preset', preset: '30d' }, 4, 123456789);

    expect(end.getTime() - start.getTime()).toBe(30 * 24 * 3_600_000);
  });

  it('"90d" は end - 90日 が start になる', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-21T12:34:56Z'));

    const { start, end } = await resolveRange({ kind: 'preset', preset: '90d' }, 4, 123456789);

    expect(end.getTime() - start.getTime()).toBe(90 * 24 * 3_600_000);
  });

  it('"1y" は end - 365日 が start になる', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-21T12:34:56Z'));

    const { start, end } = await resolveRange({ kind: 'preset', preset: '1y' }, 4, 123456789);

    expect(end.getTime() - start.getTime()).toBe(365 * 24 * 3_600_000);
  });
});
