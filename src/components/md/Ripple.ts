import React, { useEffect, useRef } from 'react';
import { createComponent } from '@lit/react';
import { MdRipple } from '@material/web/ripple/ripple.js';

const RippleElement = createComponent({
  tagName: 'md-ripple',
  elementClass: MdRipple,
  react: React,
});

// 実機の長押しをOS/ブラウザがテキスト選択等と解釈すると click/contextmenu/pointercancel の
// いずれも発火せず md-ripple の pressed が固着する（Issue #34）。pointerup 後も一定時間
// これらが来なければ、同じ pointerId で合成 pointercancel を発行し library 自身の
// 後始末経路（endPressAnimation）に処理を戻す。for 属性を使わない前提（現状の全利用箇所と
// 同じ）で、md-ripple 自身のデフォルト解決と同じ parentElement を control とみなす。
const STUCK_PRESS_TIMEOUT_MS = 500;

export function Ripple(): React.ReactElement {
  const ref = useRef<MdRipple>(null);

  useEffect(() => {
    const control = ref.current?.parentElement;
    if (!control) {
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const clearFallback = () => {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') {
        return;
      }
      clearFallback();
      const pointerId = event.pointerId;
      timeoutId = setTimeout(() => {
        timeoutId = undefined;
        control.dispatchEvent(
          new PointerEvent('pointercancel', {
            pointerId,
            isPrimary: true,
            pointerType: 'touch',
            bubbles: true,
            cancelable: true,
          }),
        );
      }, STUCK_PRESS_TIMEOUT_MS);
    };

    control.addEventListener('pointerup', handlePointerUp);
    control.addEventListener('click', clearFallback);
    control.addEventListener('contextmenu', clearFallback);
    control.addEventListener('pointercancel', clearFallback);

    return () => {
      clearFallback();
      control.removeEventListener('pointerup', handlePointerUp);
      control.removeEventListener('click', clearFallback);
      control.removeEventListener('contextmenu', clearFallback);
      control.removeEventListener('pointercancel', clearFallback);
    };
  }, []);

  return React.createElement(RippleElement, { ref });
}
