import React from 'react';
import { createComponent } from '@lit/react';
import { MdBadge } from '@material/web/labs/badge/badge.js';

export const Badge = createComponent({
  tagName: 'md-badge',
  elementClass: MdBadge,
  react: React,
});
