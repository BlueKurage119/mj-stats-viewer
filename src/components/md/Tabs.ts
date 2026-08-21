import React from 'react';
import { createComponent, type EventName } from '@lit/react';
import { MdTabs } from '@material/web/tabs/tabs.js';
import { MdPrimaryTab } from '@material/web/tabs/primary-tab.js';

export const Tabs = createComponent({
  tagName: 'md-tabs',
  elementClass: MdTabs,
  react: React,
  events: {
    onChange: 'change' as EventName<Event & { currentTarget: MdTabs }>,
  },
});

export const PrimaryTab = createComponent({
  tagName: 'md-primary-tab',
  elementClass: MdPrimaryTab,
  react: React,
});
