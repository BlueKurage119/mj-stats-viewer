import React from 'react';
import { createComponent } from '@lit/react';
import { MdFilledButton } from '@material/web/button/filled-button.js';
import { MdFilledTonalButton } from '@material/web/button/filled-tonal-button.js';
import { MdTextButton } from '@material/web/button/text-button.js';

export const FilledButton = createComponent({
  tagName: 'md-filled-button',
  elementClass: MdFilledButton,
  react: React,
});

export const FilledTonalButton = createComponent({
  tagName: 'md-filled-tonal-button',
  elementClass: MdFilledTonalButton,
  react: React,
});

export const TextButton = createComponent({
  tagName: 'md-text-button',
  elementClass: MdTextButton,
  react: React,
});
