import React from 'react';
import { createComponent, type EventName } from '@lit/react';
import { MdOutlinedTextField } from '@material/web/textfield/outlined-text-field.js';

export const OutlinedTextField = createComponent({
  tagName: 'md-outlined-text-field',
  elementClass: MdOutlinedTextField,
  react: React,
  events: {
    onChange: 'change' as EventName<Event & { currentTarget: MdOutlinedTextField }>,
    onInput: 'input' as EventName<InputEvent & { currentTarget: MdOutlinedTextField }>,
  },
});
