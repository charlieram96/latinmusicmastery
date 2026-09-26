// @vitest-environment jsdom
//
// Flex Time: the peaks loop draws through the warp. The canvas x-axis is
// TIMELINE time; the peaks are MEDIA time. With no warp (or an identity one)
// the draw is exactly what it was before.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FlexMap } from '@/lib/playsense-studio/flex';
import type { WaveformPeaks } from '@/lib/playsense-studio/waveform';
import { WaveformCanvas } from '../waveform-canvas';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const WIDTH = 100;
const PPS = 10;

// 10 s of media in 0.1 s buckets, quiet except one loud bucket at 5.0–5.1 s.
const peaks: WaveformPeaks = {
  version: 1,
  durationSeconds: 10,
  bucketCount: 100,
  sampleRate: 1000,
  data: Array.from({ length: 100 }, (_, i) => (i === 50 ? [-127, 127] : [-10, 10])).flat(),
};

let moves: Array<[number, number]> = [];
let restore: Array<() => void> = [];

function stubContext(): CanvasRenderingContext2D {
  const target: Record<string, unknown> = {
    // The playhead overlay starts above the wave area (y < 20): ignore it.
    moveTo: (x: number, y: number) => { if (y >= 20) moves.push([x, y]); },
    measureText: () => ({ width: 0 }),
  };
  return new Proxy(target, {
    get: (t, k: string) => (k in t ? t[k] : () => {}),
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  moves = [];
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

function draw(warp?: FlexMap): Array<[number, number]> {
  moves = [];
  act(() => {
    root.render(
      <WaveformCanvas
        peaks={peaks}
        durationSeconds={10}
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
        warp={warp}
      />
    );
  });
  // The last full paint (the sizing effect and the redraw effect both paint).
  return moves.slice(-WIDTH);
}

/** The x of the tallest column (smallest yTop). */
function loudestX(ms: Array<[number, number]>): number {
  return ms.reduce((best, m) => (m[1] < best[1] ? m : best))[0];
}

describe('WaveformCanvas peaks through the warp', () => {
  it('draws exactly as before with no warp or an identity warp', () => {
    const plain = draw();
    expect(loudestX(plain)).toBeCloseTo(50.5);
    expect(draw(new FlexMap([]))).toEqual(plain);
  });

  it('draws a media peak at its timeline position', () => {
    // Media 5 s plays at timeline 6 s (the stretch between 2 s and 8 s).
    const warp = new FlexMap([
      { src: 2, dst: 2, anchor: true },
      { src: 5, dst: 6, anchor: false },
      { src: 8, dst: 8, anchor: true },
    ]);
    const x = loudestX(draw(warp));
    expect(x).toBeGreaterThanOrEqual(59.5);
    expect(x).toBeLessThanOrEqual(61.5);
  });
});
