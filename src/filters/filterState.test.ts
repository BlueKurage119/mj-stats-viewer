import { describe, it, expect } from 'vitest';
import { allModes, type GameMode } from '../api';
import {
  canonicalizeModes,
  parseModes,
  serializeModes,
  parsePeriod,
  defaultModes,
  toggleMode,
  selectRepresentativeMode,
  MODE_LABELS,
} from './filterState';

describe('filterState', () => {
  it('B1: canonicalizeModes removes duplicates, removes foreign modes, and preserves canonical order', () => {
    expect(canonicalizeModes([9, 16, 9, 21], 4)).toEqual([16, 9]);
  });

  it('B2: canonicalizeModes is idempotent', () => {
    const inputs: readonly number[][] = [
      [9, 16, 9, 21],
      [8, 11, 15, 9, 12, 16],
      [26, 21, 24],
      [],
    ];
    for (const x of inputs) {
      const once = canonicalizeModes(x, 4);
      const twice = canonicalizeModes(once, 4);
      expect(twice).toEqual(once);
    }
  });

  it('B3: parseModes correctly parses valid/invalid raw query strings', () => {
    expect(parseModes('16.12', 4)).toEqual([16, 12]);
    expect(parseModes('26.24', 4)).toBeNull();
    expect(parseModes('', 4)).toBeNull();
    expect(parseModes(null, 4)).toBeNull();
    expect(parseModes('16.abc.12', 4)).toEqual([16, 12]);
  });

  it('B4: serializeModes round-trips parsed modes', () => {
    const parsed = parseModes('9.16', 4);
    expect(parsed).not.toBeNull();
    expect(serializeModes(parsed!)).toBe('16.9');
  });

  it('B5: parsePeriod validates period presets', () => {
    expect(parsePeriod('90d')).toBe('90d');
    expect(parsePeriod('all')).toBe('all');
    expect(parsePeriod('1w')).toBeNull();
    expect(parsePeriod(null)).toBeNull();
  });

  it('B6: defaultModes resolves for 4p Jyago 2', () => {
    expect(defaultModes(4, 10402, [])).toEqual([12]);
  });

  it('B7: defaultModes resolves for 4p Jyaktet 1, Jyasei 2, Konten 1', () => {
    expect(defaultModes(4, 10301, [])).toEqual([9]);
    expect(defaultModes(4, 10502, [])).toEqual([16]);
    expect(defaultModes(4, 10701, [])).toEqual([16]);
  });

  it('B8: defaultModes resolves for 3p Jyasei 2', () => {
    expect(defaultModes(3, 20502, [])).toEqual([26]);
  });

  it('B9: defaultModes falls back to playedModes for Shoshin', () => {
    expect(defaultModes(4, 10102, [8, 9])).toEqual([9]);
  });

  it('B10: defaultModes falls back to all modes when allowed and playedModes are empty or levelId is null', () => {
    expect(defaultModes(4, 10102, [])).toEqual([16, 12, 9, 15, 11, 8]);
    expect(defaultModes(4, null, [])).toEqual([16, 12, 9, 15, 11, 8]);
  });

  it('B11: toggleMode toggles or preserves invariant of non-empty modes', () => {
    expect(toggleMode([16, 12], 16, 4)).toEqual([12]);
    expect(toggleMode([12], 12, 4)).toEqual([12]);
    expect(toggleMode([12], 16, 4)).toEqual([16, 12]);
  });

  it('B12: selectRepresentativeMode resolves mode with max games or table order fallback and throws if empty', () => {
    expect(selectRepresentativeMode(4, [9, 16], { 9: 100, 16: 5 })).toBe(9);
    expect(selectRepresentativeMode(4, [9, 16], { 9: 5, 16: 5 })).toBe(16);
    expect(selectRepresentativeMode(4, [9, 16])).toBe(16);
    expect(() => selectRepresentativeMode(4, [])).toThrow();
  });

  it('B13: MODE_LABELS covers all 12 GameMode IDs', () => {
    const all = allModes(4).concat(allModes(3));
    expect(all.length).toBe(12);
    expect(all.every((m: GameMode) => Boolean(MODE_LABELS[m]))).toBe(true);
  });
});
