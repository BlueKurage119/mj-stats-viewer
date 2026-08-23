import type { NumPlayers } from '../api';

export type PlayerTab = 'summary' | 'compare' | 'stats' | 'history';

export interface TabDescriptor {
  readonly id: PlayerTab;
  readonly label: string; // 'サマリー' | '比較' | 'スタッツ' | '履歴'
  readonly icon: string; // Material Symbols のリガチャ名
  readonly enabled: boolean; // history のみ false（承諾後に true）
}

/** 表示順を兼ねた全タブ定義。history は enabled:false */
export const PLAYER_TABS: readonly TabDescriptor[] = [
  { id: 'summary', label: 'サマリー', icon: 'dashboard', enabled: true },
  { id: 'compare', label: '比較', icon: 'bar_chart', enabled: true },
  { id: 'stats', label: 'スタッツ', icon: 'list', enabled: true },
  { id: 'history', label: '履歴', icon: 'history', enabled: false },
];

/** enabled のみ。ルート生成・ナビ描画・activeIndex 算出はすべてこれを唯一の情報源にする */
export const VISIBLE_TABS: readonly TabDescriptor[] = PLAYER_TABS.filter((tab) => tab.enabled);

export const HOME_PATH = '/';

export function isNumPlayersParam(value: string | undefined): value is '3' | '4' {
  return value === '3' || value === '4';
}

export function toNumPlayers(value: '3' | '4'): NumPlayers {
  return value === '3' ? 3 : 4;
}

export function isVisibleTab(value: string | undefined): value is PlayerTab {
  return VISIBLE_TABS.some((tab) => tab.id === value);
}

/** 例: playerPath({ numPlayers: 4, playerId: '123456', tab: 'compare' }) → '/4/player/123456/compare' */
export function playerPath(args: {
  numPlayers: NumPlayers;
  playerId: string;
  tab: PlayerTab;
}): string {
  return `/${args.numPlayers}/player/${encodeURIComponent(args.playerId)}/${args.tab}`;
}

/**
 * VISIBLE_TABS 上のインデックス。該当なしは 0 を返す。
 * md-navigation-bar は activeIndex が範囲外だと throw するため、-1 を返してはならない（§1.2）。
 */
export function visibleTabIndex(tab: PlayerTab | undefined): number {
  const index = VISIBLE_TABS.findIndex((t) => t.id === tab);
  return index >= 0 ? index : 0;
}

/** ルートの :id を数値 playerId へ。10進の非負整数でなければ null */
export function parsePlayerId(raw: string | undefined): number | null {
  if (raw === undefined || !/^\d+$/.test(raw)) {
    return null;
  }
  const parsed = parseInt(raw, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}
