import React from 'react';
import { createComponent, type EventName } from '@lit/react';
import { MdNavigationBar } from '@material/web/labs/navigationbar/navigation-bar.js';
import { MdNavigationTab } from '@material/web/labs/navigationtab/navigation-tab.js';

export const NavigationBar = createComponent({
  tagName: 'md-navigation-bar',
  elementClass: MdNavigationBar,
  react: React,
  events: {
    onNavigationBarActivated: 'navigation-bar-activated' as EventName<
      CustomEvent<{ tab: MdNavigationTab; activeIndex: number }>
    >,
  },
});

export const NavigationTab = createComponent({
  tagName: 'md-navigation-tab',
  elementClass: MdNavigationTab,
  react: React,
  events: {
    onNavigationTabInteraction: 'navigation-tab-interaction',
  },
});
