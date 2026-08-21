import { describe, it, expect } from 'vitest';
import { joinModes, allModes, ALL_MODES_4, ALL_MODES_3 } from './gameMode';

describe('gameMode', () => {
  // T8
  it('joinModes throws on empty array (mode_is_required 防止)', () => {
    expect(() => joinModes([])).toThrow();
  });

  it('joinModes joins with "."', () => {
    expect(joinModes([16, 12])).toBe('16.12');
  });

  it('allModes returns the 4-player list for numPlayers=4', () => {
    expect(allModes(4)).toEqual(ALL_MODES_4);
  });

  it('allModes returns the 3-player list for numPlayers=3', () => {
    expect(allModes(3)).toEqual(ALL_MODES_3);
  });
});
