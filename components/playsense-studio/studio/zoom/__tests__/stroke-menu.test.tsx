// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isTypingTarget } from '@/lib/playsense-studio/typing-target';
import { zoomIntent } from '@/lib/playsense-studio/zoom-keys';
import { StrokeMenu } from '../stroke-menu';

declare global { var IS_REACT_ACT_ENVIRONMENT: boolean }
let host: HTMLDivElement; let root: Root;
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });
const strokes = [{ midi: 60, label: 'High timbal' }, { midi: 61, label: 'Cáscara · high' }, { midi: 62, label: 'Cymbal' }];

describe('StrokeMenu', () => {
  it('is one chip naming the current stroke', () => {
    act(() => root.render(<StrokeMenu strokes={strokes} current={61} onPick={() => {}} />));
    expect(host.querySelectorAll('button')).toHaveLength(1);
    expect(host.textContent).toContain('Cáscara · high');
  });

  // The list portals to document.body (Task 9's clipping check: the zoom
  // overlay's `overflow: hidden` and the docked toolbar's `backdrop-filter`
  // would otherwise clip or mis-anchor it), so its rows are looked up on
  // `document`, not `host`, even though the chip itself stays put.
  it('opens a list, enters the picked stroke and closes', () => {
    const onPick = vi.fn();
    act(() => root.render(<StrokeMenu strokes={strokes} current={61} onPick={onPick} />));
    act(() => (host.querySelector('button') as HTMLButtonElement).click());
    const opts = document.querySelectorAll('[role="option"]');
    expect(opts).toHaveLength(3);
    act(() => (opts[2] as HTMLButtonElement).click());
    expect(onPick).toHaveBeenCalledWith(62);
    expect(document.querySelector('[role="listbox"]')).toBeNull();
  });

  it('closes on Escape without picking', () => {
    const onPick = vi.fn();
    act(() => root.render(<StrokeMenu strokes={strokes} current={null} onPick={onPick} />));
    act(() => (host.querySelector('button') as HTMLButtonElement).click());
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    expect(onPick).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Stroke');
  });

  it('closes on an outside pointerdown without picking', () => {
    const onPick = vi.fn();
    act(() => root.render(<StrokeMenu strokes={strokes} current={61} onPick={onPick} />));
    act(() => (host.querySelector('button') as HTMLButtonElement).click());
    expect(document.querySelector('[role="listbox"]')).not.toBeNull();
    act(() => { document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })); });
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    expect(onPick).not.toHaveBeenCalled();
  });

  // Fix round 1, finding 2: a real pick is a pointerdown followed by a click
  // (not a bare, synthetic `.click()` as above) — the pointerdown lands on an
  // option first, inside `listRef`, and must NOT be mistaken for the outside-
  // pointerdown case above and close the list before the click can pick it.
  // (jsdom in this project has no PointerEvent constructor — see the outside-
  // pointerdown test above and integrated-editor-measure-bar.test.tsx:315 —
  // so, as there, a MouseEvent typed 'pointerdown' stands in for it.)
  it('fires onPick and closes on a real pointerdown-then-click on an option', () => {
    const onPick = vi.fn();
    act(() => root.render(<StrokeMenu strokes={strokes} current={61} onPick={onPick} />));
    act(() => (host.querySelector('button') as HTMLButtonElement).click());
    const opt = document.querySelectorAll('[role="option"]')[2] as HTMLButtonElement;
    act(() => {
      opt.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
      opt.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(onPick).toHaveBeenCalledWith(62);
    expect(document.querySelector('[role="listbox"]')).toBeNull();
  });

  // Fix round 1, finding 3: clamp the fixed position to the viewport instead
  // of trusting the chip's raw rect, both horizontally (right edge) and
  // vertically (cap max-height instead of overflowing the bottom edge).
  it('clamps the open list inside the viewport', () => {
    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 300 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 400 });
    try {
      act(() => root.render(<StrokeMenu strokes={strokes} current={61} onPick={() => {}} />));
      const chip = host.querySelector('button') as HTMLButtonElement;
      // Stubbed rect: hard against the right edge, and low enough that the
      // full 320px-tall list wouldn't fit below it.
      chip.getBoundingClientRect = () =>
        ({ left: 290, right: 310, top: 300, bottom: 320, width: 20, height: 20, x: 290, y: 300, toJSON() {} }) as DOMRect;
      act(() => { chip.click(); });
      const list = document.querySelector('.st-stroke-list') as HTMLElement;
      expect(list).not.toBeNull();
      // left: min(290, innerWidth(300) - 220 - 8 = 72) = 72, not the raw 290.
      expect(list.style.left).toBe('72px');
      // maxHeight: innerHeight(400) - 8 - (bottom(320) + 6) = 66, not 320.
      expect(list.style.maxHeight).toBe('66px');
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalInnerHeight });
    }
  });

  // Fix round 1, finding 5: land keyboard focus in the list, not on nothing.
  it('focuses the current stroke on open', () => {
    act(() => root.render(<StrokeMenu strokes={strokes} current={61} onPick={() => {}} />));
    act(() => (host.querySelector('button') as HTMLButtonElement).click());
    expect(document.activeElement?.getAttribute('role')).toBe('option');
    expect(document.activeElement?.textContent).toBe('Cáscara · high');
  });

  it('focuses the first stroke on open when none is current', () => {
    act(() => root.render(<StrokeMenu strokes={strokes} current={null} onPick={() => {}} />));
    act(() => (host.querySelector('button') as HTMLButtonElement).click());
    expect(document.activeElement?.getAttribute('role')).toBe('option');
    expect(document.activeElement?.textContent).toBe('High timbal');
  });

  // Fix round 1, finding 4: with focus inside the open list, the zoom's own
  // shortcuts (ArrowUp/Down -> transpose, letters, etc.) must not fire. The
  // zoom's real guard is `isTypingTarget(e.target)` before it even computes a
  // `zoomIntent` (use-zoom-editing.ts); role="dialog" already makes
  // MeasurePopover's contents typing targets (more-popover.tsx:67-72), and
  // typing-target.ts now recognises an open role="listbox" the same way. This
  // wires up that exact guard, with the real isTypingTarget and zoomIntent,
  // to prove ArrowDown never reaches a transpose while an option has focus.
  it("keeps ArrowDown from reaching the zoom's transpose while an option is focused", () => {
    const zoomIntentSeen = vi.fn();
    const zoomHandler = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const intent = zoomIntent(e);
      if (intent) zoomIntentSeen(intent);
    };
    window.addEventListener('keydown', zoomHandler);
    try {
      act(() => root.render(<StrokeMenu strokes={strokes} current={61} onPick={() => {}} />));
      act(() => (host.querySelector('button') as HTMLButtonElement).click());
      const focused = document.activeElement as HTMLElement;
      expect(focused.getAttribute('role')).toBe('option');
      act(() => {
        focused.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
      });
      expect(zoomIntentSeen).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('keydown', zoomHandler);
    }
  });

  // Task 9's second check: Escape must close only the list, not the zoom.
  // use-zoom-editing.ts's own keydown handler is `window.addEventListener(
  // 'keydown', handler)` with no capture flag, i.e. the bubble phase, driven
  // by the real `zoomIntent`. This test wires up that exact shape (bubble,
  // real zoomIntent) instead of a stand-in, and dispatches from `document` —
  // not `window` — so `window` sits as a genuine ancestor of the event's
  // target and capture actually runs before bubble, the way a real keydown
  // (which always targets the focused element, never window itself) would.
  it("stops Escape from also closing the zoom (the zoom's real, bubble-phase handler never runs)", () => {
    const zoomClose = vi.fn();
    const zoomHandler = (e: KeyboardEvent) => { if (zoomIntent(e)?.kind === 'close') zoomClose(); };
    window.addEventListener('keydown', zoomHandler);
    try {
      act(() => root.render(<StrokeMenu strokes={strokes} current={61} onPick={() => {}} />));
      act(() => (host.querySelector('button') as HTMLButtonElement).click());
      expect(document.querySelector('[role="listbox"]')).not.toBeNull();
      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      });
      expect(document.querySelector('[role="listbox"]')).toBeNull();
      expect(zoomClose).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('keydown', zoomHandler);
    }
  });
});
