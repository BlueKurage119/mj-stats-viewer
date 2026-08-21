import React from 'react';
import { createComponent, type EventName } from '@lit/react';
import { MdOutlinedSelect } from '@material/web/select/outlined-select.js';
import { MdSelectOption } from '@material/web/select/select-option.js';

export const OutlinedSelect = createComponent({
  tagName: 'md-outlined-select',
  elementClass: MdOutlinedSelect,
  react: React,
  events: {
    onChange: 'change' as EventName<Event & { currentTarget: MdOutlinedSelect }>,
    onInput: 'input' as EventName<Event & { currentTarget: MdOutlinedSelect }>,
    onOpening: 'opening',
    onOpened: 'opened',
    onClosing: 'closing',
    onClosed: 'closed',
  },
});

export const SelectOption = createComponent({
  tagName: 'md-select-option',
  elementClass: MdSelectOption,
  react: React,
});
