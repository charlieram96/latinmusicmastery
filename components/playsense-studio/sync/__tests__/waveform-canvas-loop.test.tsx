// @vitest-environment jsdom
//
// The running A/B loop draws as a gold bracket: a 12% band between A and B
// (timeline seconds) with 2px edges.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WaveformCanvas } from '../waveform-canvas';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const WIDTH = 200;
const PPS = 10;

let rects: Array<{ x: number; w: number; alpha: number }> = [];
let restore: Array<() => void> = [];

function stubContext(): CanvasRenderingContext2D {
  let alpha = 1;
  const target: Record<string, unknown> = {
    fillRect: (x: number, _y: number, w: number) => { rects.push({ x, w, alpha }); },
    measureText: () => ({ width: 0 }),
  };
  return new Proxy(target, {
    get: (t, k: string) => (k === 'globalAlpha' ? alpha : k in t ? t[k] : () => {}),
    set: (_t, k: string, v) => { if (k === 'globalAlpha') alpha = v; return true; },
  }) as unknown as CanvasRenderingContext2D;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const ctx = stubContext();
  const origGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = (() => ctx) as unknown as typeof origGetContext;
  const origWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => WIDTH });
  restore = [
    () => { HTMLCanvasElement.prototype.getContext = origGetContext; },
    () => {
      if (origWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', origWidth);
      else delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
    },
  ];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  restore.forEach((r) => r());
});

const noop = () => {};

function draw(loop: { a: number; b: number } | null, selection: { a: number; b: number } | null = null) {
  rects = [];
  act(() => {
    root.render(
      <WaveformCanvas
        peaks={null}
        durationSeconds={20}
        handles={[]}
        noteTicks={[]}
        showNotes={false}
        tailVideoTimeSeconds={1000}
        pixelsPerSecond={PPS}
        scrollLeftPx={0}
        dragAll={false}
        selected={null}
        getCurrentSeconds={() => 0}
        onSeek={noop}
        onSelect={noop}
        onMarkerDrag={noop}
        onTailDrag={noop}
        onDragEnd={noop}
        onScrollByPx={noop}
        onViewportWidth={noop}
        loop={loop}
        selection={selection}
      />
    );
  });
  return rects;
}

describe('WaveformCanvas loop bracket', () => {
  it('draws a 12% band from A to B with 2px edges', () => {
    const r = draw({ a: 4, b: 9 });
    expect(r).toContainEqual({ x: 40, w: 50, alpha: 0.12 });
    expect(r).toContainEqual({ x: 40, w: 2, alpha: 1 });
    expect(r).toContainEqual({ x: 88, w: 2, alpha: 1 });
  });

  it('draws no bracket without a loop', () => {
    const r = draw(null);
    expect(r.some((x) => x.alpha === 0.12)).toBe(false);
    expect(r.some((x) => x.w === 2)).toBe(false);
  });

  it('tints the selected bars at 7% with no edges', () => {
    const r = draw(null, { a: 4, b: 9 });
    expect(r).toContainEqual({ x: 40, w: 50, alpha: 0.07 });
  });
});
