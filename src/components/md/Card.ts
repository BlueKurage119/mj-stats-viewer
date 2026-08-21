import React from 'react';
import { createComponent } from '@lit/react';
import { MdElevatedCard } from '@material/web/labs/card/elevated-card.js';
import { MdFilledCard } from '@material/web/labs/card/filled-card.js';
import { MdOutlinedCard } from '@material/web/labs/card/outlined-card.js';

export const ElevatedCard = createComponent({
  tagName: 'md-elevated-card',
  elementClass: MdElevatedCard,
  react: React,
});

export const FilledCard = createComponent({
  tagName: 'md-filled-card',
  elementClass: MdFilledCard,
  react: React,
});

export const OutlinedCard = createComponent({
  tagName: 'md-outlined-card',
  elementClass: MdOutlinedCard,
  react: React,
});
