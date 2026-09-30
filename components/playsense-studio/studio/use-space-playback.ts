'use client';
import { useEffect, useRef } from 'react';

/** Space controls the active Studio transport even after clicking an edit tool. */
export function useSpacePlayback(active: boolean, toggle: () => void) {
  const action = useRef(toggle);
  action.current = toggle;
  useEffect(() => {
    if (!active) return;
    let consumed = false;
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.isComposing) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('input:not([type="range"]),textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="menu"],[role="menuitem"]')) return;
      // Preview/import dialogs own their own keyboard; never start the score behind them.
      if (document.querySelector('[role="dialog"][aria-modal="true"],dialog[open],[role="alertdialog"]')) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      consumed = true;
      if (!e.repeat) action.current();
    };
    const up = (e: KeyboardEvent) => {
      if (!consumed || (e.code !== 'Space' && e.key !== ' ')) return;
      consumed = false;
      // A focused palette/Delete button must not also fire a native Space click.
      e.preventDefault();e.stopImmediatePropagation();
    };
    const blur=()=>{consumed=false;};
    const releaseEditorFocus=(event:PointerEvent)=>{
      const target=event.target instanceof Element ? event.target : null;
      if(!target || target.closest('input,textarea,select,button,a,[contenteditable],[role="menu"],[role="dialog"]'))return;
      const focused=document.activeElement;
      if(focused instanceof HTMLElement && focused.matches('input,textarea,select,[contenteditable]'))focused.blur();
    };
    window.addEventListener('keydown',down,true);
    window.addEventListener('keyup',up,true);
    window.addEventListener('blur',blur);
    window.addEventListener('pointerdown',releaseEditorFocus,true);
    return()=>{window.removeEventListener('keydown',down,true);window.removeEventListener('keyup',up,true);window.removeEventListener('blur',blur);window.removeEventListener('pointerdown',releaseEditorFocus,true);};
  },[active]);
}
