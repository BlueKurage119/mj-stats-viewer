import { describe, expect, it } from 'vitest';
import { crossModeLabel, formatLastPlayedDate, formatLevel } from './format';

describe('format', () => {
  it('B9: formatLastPlayedDate formats year/month/day with local timezone', () => {
    const timestamp = new Date(2021, 3, 15, 22, 54).getTime();
    expect(formatLastPlayedDate(timestamp)).toBe('2021/04/15');
  });

  it('B10: formatLastPlayedDate zero-pads month and day', () => {
    const timestamp = new Date(2024, 0, 5, 0, 0).getTime();
    expect(formatLastPlayedDate(timestamp)).toBe('2024/01/05');
  });

  it('B11: formatLevel uses formatLevelWithDelta with delta adjustment', () => {
    expect(formatLevel({ id: 10301, score: 695, delta: -11 })).toBe('雀傑1 684/1200');
  });

  it('B12: crossModeLabel returns null when level mode matches target numPlayers', () => {
    expect(crossModeLabel(10301, 4)).toBeNull();
    expect(crossModeLabel(20301, 3)).toBeNull();
  });

  it('B13: crossModeLabel returns "三麻" when sanma level in 4-player mode', () => {
    expect(crossModeLabel(20301, 4)).toBe('三麻');
  });

  it('B14: crossModeLabel returns "四麻" when yonma level in 3-player mode', () => {
    expect(crossModeLabel(10301, 3)).toBe('四麻');
  });
});
