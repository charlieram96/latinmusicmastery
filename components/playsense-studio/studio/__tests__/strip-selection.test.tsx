// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditableMeasureStrip, type MeasureStripItem } from '../editable-measure-strip';

beforeAll(() => {
  // VexFlow measures text through a canvas; jsdom has none.
  const ctx = { measureText: (s: string) => ({ width: String(s).length * 7, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2, fontBoundingBoxAscent: 8, fontBoundingBoxDescent: 2 }), font: '' };
  HTMLCanvasElement.prototype.getContext = (() => ctx) as never;
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 800 });
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
});

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 0) as unknown as number);
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const items: MeasureStripItem[] = Array.from({ length: 4 }, (_, i) => ({
  measureIndex: i,
  measureNumber: i + 1,
  finalBarline: false,
  startVideoTimeSeconds: i,
  endVideoTimeSeconds: i + 1,
  events: [],
  voice2Events: [],
  timeSignature: [4, 4],
  isFirst: i === 0,
  clef: 'treble',
  keyFifths: 0,
  previousKeyFifths: 0,
  keyChanged: false,
  clefChanged: false,
}));

function mount() {
  const cb = {
    onSelectMeasure: vi.fn(),
    onSelectMeasureRange: vi.fn(),
    onOpenMeasure: vi.fn(),
    onInsertMeasureAt: vi.fn(),
    onSelectEvent: vi.fn(),
    onRequestZoomTo: vi.fn(),
    onSetPitch: vi.fn(),
    onScrollByPx: vi.fn(),
    onWheelZoom: vi.fn(),
  };
  act(() => {
    root.render(
      <EditableMeasureStrip
        measures={items} pixelsPerSecond={100} scrollLeftPx={0} selected={null}
        accidental={0} keyFifths={0} isPercussion={false} percStrokes={null}
        {...cb}
      />,
    );
  });
  return cb;
}

function pointer(target: Element, type: string, clientX: number, clientY = 10) {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  act(() => { target.dispatchEvent(e); });
}

const bar = (i: number) => host.querySelector(`[data-measure-index="${i}"]`)!;

describe('EditableMeasureStrip bar selection', () => {
  it('a drag across bars selects the range the pointer passes over', () => {
    const cb = mount();
    pointer(bar(0), 'pointerdown', 50);
    pointer(bar(0), 'pointermove', 250);
    act(() => { vi.advanceTimersByTime(20); });
    pointer(bar(0), 'pointerup', 250);
    expect(cb.onSelectMeasure).toHaveBeenCalledWith(0, false);
    expect(cb.onSelectMeasureRange).toHaveBeenCalledWith(0, 2);
    expect(cb.onSelectMeasure.mock.invocationCallOrder[0]).toBeLessThan(cb.onSelectMeasureRange.mock.invocationCallOrder[0]);
  });

  it('a double-click opens the bar', () => {
    const cb = mount();
    act(() => { bar(1).dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 150, clientY: 10 })); });
    expect(cb.onOpenMeasure).toHaveBeenCalledWith(1);
  });

  it('a click on empty staff only selects the bar and never touches notes', () => {
    const cb = mount();
    pointer(bar(0), 'pointerdown', 50, 120);
    pointer(bar(0), 'pointerup', 50, 120);
    act(() => { vi.advanceTimersByTime(20); });
    expect(cb.onSelectMeasure).toHaveBeenCalledTimes(1);
    expect(cb.onSelectMeasure).toHaveBeenCalledWith(0, false);
    expect(cb.onSelectEvent).not.toHaveBeenCalled();
    expect(cb.onSetPitch).not.toHaveBeenCalled();
    for (const [name, fn] of Object.entries(cb)) {
      if (name !== 'onSelectMeasure') expect(fn, name).not.toHaveBeenCalled();
    }
  });
});
