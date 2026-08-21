import React from 'react';
import { createComponent } from '@lit/react';
import { MdRipple } from '@material/web/ripple/ripple.js';

export const Ripple = createComponent({
  tagName: 'md-ripple',
  elementClass: MdRipple,
  react: React,
});
