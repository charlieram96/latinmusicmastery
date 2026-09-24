// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SectionsLane, type LaneSection } from '../sections-lane';

const SECTIONS: LaneSection[] = [
  { sectionId: 'a', label: 'Verse', startSeconds: 10, endSeconds: 20 },
  { sectionId: 'b', label: 'Chorus', startSeconds: 30, endSeconds: 40 },
];

describe('SectionsLane drag', () => {
  let host: HTMLDivElement;
  let root: Root;
  const onDragActive = vi.fn();
  const onSelectSection = vi.fn();

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
    onDragActive.mockReset();
    onSelectSection.mockReset();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
      root.render(
        <SectionsLane
          sections={SECTIONS}
          activeSectionId="a"
          activeRange={{ startSeconds: 10, endSeconds: 20 }}
          ghostRange={null}
          ghostConflict={false}
          pixelsPerSecond={10}
          scrollLeftPx={0}
          onSelectSection={onSelectSection}
          onDragActive={onDragActive}
        />
      );
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.useRealTimers();
  });

  const block = () => host.querySelector('.st-section-block.is-active') as HTMLButtonElement;
  const sibling = () => host.querySelector('.st-section-block:not(.is-active)') as HTMLButtonElement;
  const ptr = (el: Element, type: string, x: number) => {
    const e = new MouseEvent(type, { bubbles: true, clientX: x, clientY: 10 });
    Object.defineProperty(e, 'pointerId', { value: 1 });
    act(() => {
      el.dispatchEvent(e);
    });
  };
  const click = (el: Element) => {
    const e = new MouseEvent('click', { bubbles: true, cancelable: true });
    act(() => {
      el.dispatchEvent(e);
    });
  };

  it('reports move then end deltas and swallows the trailing click', () => {
    const el = block();
    expect(el).toBeTruthy();

    ptr(el, 'pointerdown', 100);
    // Inside the 4px dead zone — not a drag yet.
    ptr(el, 'pointermove', 102);
    expect(onDragActive).not.toHaveBeenCalled();

    // Past the dead zone: (106 - 100) / 10 pps = 0.6s.
    ptr(el, 'pointermove', 106);
    // Further move: (120 - 100) / 10 pps = 2s.
    ptr(el, 'pointermove', 120);
    ptr(el, 'pointerup', 120);

    expect(onDragActive.mock.calls).toEqual([
      [0.6, 'move'],
      [2, 'move'],
      [2, 'end'],
    ]);

    // The browser's own trailing click after the drag must not reselect.
    click(el);
    expect(onSelectSection).not.toHaveBeenCalled();
  });

  it('a plain click with no movement never reports a drag', () => {
    const el = block();
    ptr(el, 'pointerdown', 100);
    ptr(el, 'pointerup', 100);
    expect(onDragActive).not.toHaveBeenCalled();
    click(el);
    // Active block's own click never calls onSelectSection regardless.
    expect(onSelectSection).not.toHaveBeenCalled();
  });

  it('ends the drag on pointercancel, same as pointerup', () => {
    const el = block();
    ptr(el, 'pointerdown', 100);
    // Past the dead zone: (120 - 100) / 10 pps = 2s.
    ptr(el, 'pointermove', 120);
    // Cancelled mid-drag at a later position: (130 - 100) / 10 pps = 3s.
    ptr(el, 'pointercancel', 130);

    expect(onDragActive.mock.calls).toEqual([
      [2, 'move'],
      [3, 'end'],
    ]);
  });

  it('never sticks when the trailing click lands outside the lane', () => {
    const el = block();
    ptr(el, 'pointerdown', 100);
    ptr(el, 'pointermove', 120);
    ptr(el, 'pointerup', 120);
    expect(onDragActive.mock.calls).toEqual([
      [2, 'move'],
      [2, 'end'],
    ]);

    // The real trailing click landed off the lane entirely (e.g. the pointer
    // drifted vertically before release) — this lane never saw it, so its
    // onClickCapture never got a chance to consume the suppression flag.
    // Advancing past the same-turn window lets it self-clear.
    act(() => {
      vi.advanceTimersByTime(0);
    });

    click(sibling());
    expect(onSelectSection).toHaveBeenCalledWith('b');
  });
});
