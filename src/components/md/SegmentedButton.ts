import React from 'react';
import { createComponent, type EventName } from '@lit/react';
import { MdOutlinedSegmentedButton } from '@material/web/labs/segmentedbutton/outlined-segmented-button.js';
import { MdOutlinedSegmentedButtonSet } from '@material/web/labs/segmentedbuttonset/outlined-segmented-button-set.js';

export const OutlinedSegmentedButton = createComponent({
  tagName: 'md-outlined-segmented-button',
  elementClass: MdOutlinedSegmentedButton,
  react: React,
  events: {
    onSegmentedButtonInteraction: 'segmented-button-interaction',
  },
});

export const OutlinedSegmentedButtonSet = createComponent({
  tagName: 'md-outlined-segmented-button-set',
  elementClass: MdOutlinedSegmentedButtonSet,
  react: React,
  events: {
    onSegmentedButtonSetSelection: 'segmented-button-set-selection' as EventName<
      CustomEvent<{ button: MdOutlinedSegmentedButton; selected: boolean; index: number }>
    >,
  },
});
