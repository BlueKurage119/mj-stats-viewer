import React from 'react';
import { createComponent, type EventName } from '@lit/react';
import { MdIconButton } from '@material/web/iconbutton/icon-button.js';

export const IconButton = createComponent({
  tagName: 'md-icon-button',
  elementClass: MdIconButton,
  react: React,
  events: {
    onChange: 'change' as EventName<Event & { currentTarget: MdIconButton }>,
    onInput: 'input' as EventName<InputEvent & { currentTarget: MdIconButton }>,
  },
});
