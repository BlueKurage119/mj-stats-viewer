import React from 'react';
import { createComponent } from '@lit/react';
import { MdChipSet } from '@material/web/chips/chip-set.js';
import { MdFilterChip } from '@material/web/chips/filter-chip.js';

export const ChipSet = createComponent({
  tagName: 'md-chip-set',
  elementClass: MdChipSet,
  react: React,
});

export const FilterChip = createComponent({
  tagName: 'md-filter-chip',
  elementClass: MdFilterChip,
  react: React,
  events: {
    onRemove: 'remove',
  },
});
