// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
