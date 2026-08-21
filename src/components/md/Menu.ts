import React from 'react';
import { createComponent, type EventName } from '@lit/react';
import { MdMenu, type CloseMenuEvent } from '@material/web/menu/menu.js';
import { MdMenuItem } from '@material/web/menu/menu-item.js';

export const Menu = createComponent({
  tagName: 'md-menu',
  elementClass: MdMenu,
  react: React,
  events: {
    onOpening: 'opening',
    onOpened: 'opened',
    onClosing: 'closing',
    onClosed: 'closed',
    onCloseMenu: 'close-menu' as EventName<CloseMenuEvent>,
  },
});

export const MenuItem = createComponent({
  tagName: 'md-menu-item',
  elementClass: MdMenuItem,
  react: React,
});
