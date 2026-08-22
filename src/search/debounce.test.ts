import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDebouncer } from './debounce';

describe('createDebouncer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('B1: schedule("a") -> advance 299ms -> onFire not called', () => {
    const onFire = vi.fn();
    const debouncer = createDebouncer(300, onFire);

    debouncer.schedule('a');
    vi.advanceTimersByTime(299);

    expect(onFire).not.toHaveBeenCalled();
  });

  it('B2: B1 continuation -> advance 1ms -> onFire called once with "a"', () => {
    const onFire = vi.fn();
    const debouncer = createDebouncer(300, onFire);

    debouncer.schedule('a');
    vi.advanceTimersByTime(299);
    expect(onFire).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onFire).toHaveBeenCalledTimes(1);
    expect(onFire).toHaveBeenCalledWith('a');
  });

  it('B3: schedule multiple values with 0ms interval -> only last value fired after 300ms', () => {
    const onFire = vi.fn();
    const debouncer = createDebouncer(300, onFire);

    debouncer.schedule('a');
    debouncer.schedule('ab');
    debouncer.schedule('abc');

    vi.advanceTimersByTime(300);
    expect(onFire).toHaveBeenCalledTimes(1);
    expect(onFire).toHaveBeenCalledWith('abc');
  });

  it('B4: schedule resets timer when called before delay expires', () => {
    const onFire = vi.fn();
    const debouncer = createDebouncer(300, onFire);

    debouncer.schedule('a');
    vi.advanceTimersByTime(200);
    expect(onFire).not.toHaveBeenCalled();

    debouncer.schedule('ab');
    vi.advanceTimersByTime(200);
    expect(onFire).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(onFire).toHaveBeenCalledTimes(1);
    expect(onFire).toHaveBeenCalledWith('ab');
  });

  it('B5: separate schedule calls fire sequentially', () => {
    const onFire = vi.fn();
    const debouncer = createDebouncer(300, onFire);

    debouncer.schedule('a');
    vi.advanceTimersByTime(300);
    expect(onFire).toHaveBeenCalledTimes(1);
    expect(onFire).toHaveBeenLastCalledWith('a');

    debouncer.schedule('b');
    vi.advanceTimersByTime(300);
    expect(onFire).toHaveBeenCalledTimes(2);
    expect(onFire).toHaveBeenLastCalledWith('b');
  });

  it('B6: cancel stops scheduled fire', () => {
    const onFire = vi.fn();
    const debouncer = createDebouncer(300, onFire);

    debouncer.schedule('a');
    vi.advanceTimersByTime(100);
    debouncer.cancel();
    vi.advanceTimersByTime(1000);

    expect(onFire).not.toHaveBeenCalled();
  });

  it('B7: debouncer reusable after cancel', () => {
    const onFire = vi.fn();
    const debouncer = createDebouncer(300, onFire);

    debouncer.schedule('a');
    vi.advanceTimersByTime(100);
    debouncer.cancel();
    vi.advanceTimersByTime(1000);
    expect(onFire).not.toHaveBeenCalled();

    debouncer.schedule('c');
    vi.advanceTimersByTime(300);
    expect(onFire).toHaveBeenCalledTimes(1);
    expect(onFire).toHaveBeenCalledWith('c');
  });

  it('B8: instances do not share state', () => {
    const onFire1 = vi.fn();
    const onFire2 = vi.fn();
    const debouncer1 = createDebouncer(300, onFire1);
    const debouncer2 = createDebouncer(300, onFire2);

    debouncer1.schedule('x');
    debouncer2.schedule('y');

    debouncer1.cancel();
    vi.advanceTimersByTime(300);

    expect(onFire1).not.toHaveBeenCalled();
    expect(onFire2).toHaveBeenCalledTimes(1);
    expect(onFire2).toHaveBeenCalledWith('y');
  });
});
