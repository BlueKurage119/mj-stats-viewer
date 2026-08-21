import React from 'react';
import { createComponent } from '@lit/react';
import { MdIcon } from '@material/web/icon/icon.js';

export const Icon = createComponent({
  tagName: 'md-icon',
  elementClass: MdIcon,
  react: React,
});
