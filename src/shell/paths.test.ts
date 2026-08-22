import { describe, it, expect } from 'vitest';
import { matchPath } from 'react-router-dom';
import {
  playerPath,
  visibleTabIndex,
  VISIBLE_TABS,
  PLAYER_TABS,
  isNumPlayersParam,
} from './paths';

describe('paths', () => {
  it('B1: playerPath generates correct path for 4 players summary', () => {
    expect(playerPath({ numPlayers: 4, playerId: '123456', tab: 'summary' })).toBe(
      '/4/player/123456/summary',
    );
  });

  it('B2: playerPath generates correct path for 3 players compare', () => {
    expect(playerPath({ numPlayers: 3, playerId: '123456', tab: 'compare' })).toBe(
      '/3/player/123456/compare',
    );
  });

  it('B3: playerPath URL-encodes playerId', () => {
    expect(playerPath({ numPlayers: 4, playerId: 'a/b c', tab: 'stats' })).toBe(
      '/4/player/a%2Fb%20c/stats',
    );
  });

  it('B4: visibleTabIndex returns correct index for visible tabs', () => {
    expect(visibleTabIndex('summary')).toBe(0);
    expect(visibleTabIndex('compare')).toBe(1);
    expect(visibleTabIndex('stats')).toBe(2);
  });

  it('B5: visibleTabIndex returns 0 for history and undefined', () => {
    expect(visibleTabIndex('history')).toBe(0);
    expect(visibleTabIndex(undefined)).toBe(0);
  });

  it('B6: tab lists have expected lengths', () => {
    expect(VISIBLE_TABS.length).toBe(3);
    expect(PLAYER_TABS.length).toBe(4);
  });

  it('B7: VISIBLE_TABS does not include history', () => {
    expect(VISIBLE_TABS.some((t) => t.id === 'history')).toBe(false);
  });

  it('B8: isNumPlayersParam validates correctly', () => {
    expect(isNumPlayersParam('4')).toBe(true);
    expect(isNumPlayersParam('3')).toBe(true);
    expect(isNumPlayersParam('2')).toBe(false);
    expect(isNumPlayersParam('44')).toBe(false);
    expect(isNumPlayersParam(undefined)).toBe(false);
  });

  it('B9: react-router matchPath matches /:np/player/:id/:tab', () => {
    const match = matchPath('/:np/player/:id/:tab', '/4/player/123/stats');
    expect(match).not.toBeNull();
    expect(match?.params).toEqual({
      np: '4',
      id: '123',
      tab: 'stats',
    });
  });
});
