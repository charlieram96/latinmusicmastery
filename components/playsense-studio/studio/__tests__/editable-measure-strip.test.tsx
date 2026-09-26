// @vitest-environment jsdom
import React, { act } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Track } from '@/components/playsense-studio/shared/score-model/types';
import { extractTrackEvents } from '@/lib/playsense-studio/score-to-vexflow';
import { measureFill } from '@/lib/playsense-studio/measure-fill';
import { EditableMeasureStrip, type MeasureStripItem } from '../editable-measure-strip';

beforeAll(() => {
  // VexFlow measures text through a canvas; jsdom has none.
  const ctx = { measureText: (s: string) => ({ width: String(s).length * 7, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2, fontBoundingBoxAscent: 8, fontBoundingBoxDescent: 2 }), font: '' };
  HTMLCanvasElement.prototype.getContext = (() => ctx) as never;
  // The strip only draws measures inside its viewport; jsdom reports no width.
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 1000 });
});

let root: Root;
let host: HTMLDivElement;
// The staff merges redraws into animation frames; the tests run them by hand.
let frames: FrameRequestCallback[] = [];
const flushFrames = () => act(() => {
  const due = frames;
  frames = [];
  due.forEach((cb) => cb(performance.now()));
});
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {});
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

const noop = () => {};

function renderStrip(
  track: Track,
  keyFifths = 0,
  opts: { selectedMeasures?: [number, number] | null; flags?: Record<number, string>; pixelsPerSecond?: number } = {},
) {
  const items: MeasureStripItem[] = extractTrackEvents(track, [4, 4], keyFifths).map((b, i) => ({
    measureIndex: i,
    measureNumber: b.measure.number,
    startVideoTimeSeconds: i * 2,
    endVideoTimeSeconds: i * 2 + 2,
    events: b.events,
    voice2Events: b.voice2Events,
    timeSignature: b.timeSignature,
    isFirst: i === 0,
    clef: b.clef,
    keyFifths: b.keyFifths,
    previousKeyFifths: b.previousKeyFifths,
    keyChanged: b.keyChanged,
    clefChanged: b.clefChanged,
    fill: measureFill(b.measure.voices[0]?.events ?? [], b.measure.voices[1]?.events, b.timeSignature),
    flag: opts.flags?.[i] ?? null,
  }));
  act(() => {
    root.render(
      <EditableMeasureStrip
        measures={items} pixelsPerSecond={opts.pixelsPerSecond ?? 100} scrollLeftPx={0} selected={null}
        selectedMeasures={opts.selectedMeasures ?? null}
        onOpenNote={noop} onSelectMeasureRange={noop} onOpenMeasure={noop} onRequestZoomTo={noop}
      />,
    );
  });
  // The strip measures its viewport after mounting, so the staff redraws once more.
  flushFrames();
  return [...host.querySelectorAll('svg')].filter(svg => svg.querySelector('.vf-stave'));
}

const base = (measures: Track['measures']): Track => ({
  index: 0, instrument: 'staff', displayName: 'T', tuning: null, stringMultiplicity: 1, channel: null, defaultView: 'staff', measures,
});

describe('EditableMeasureStrip', () => {
  it('draws a measure whose only notes are in voice 2', () => {
    const svgs = renderStrip(base([
      { number: 1, voices: [{ number: 1, events: [] }, { number: 2, events: [{ kind: 'note', midi: 60, durationQN: 4 }] }] },
    ]));
    expect(svgs).toHaveLength(1);
    expect(svgs[0].querySelectorAll('.vf-stavenote').length).toBe(1);
  });

  it('draws cancelling naturals on a key change to fewer accidentals', () => {
    const quarters = [{ number: 1, events: [62, 64, 66, 67].map(midi => ({ kind: 'note' as const, midi, durationQN: 1 })) }];
    const svgs = renderStrip(base([
      { number: 1, voices: quarters },
      { number: 2, keyFifths: 0, voices: quarters },
    ]), 2);
    // One continuous SVG: bar 1 opens with D major, bar 2 cancels it.
    expect(svgs).toHaveLength(1);
    const sigs = svgs[0].querySelectorAll('.vf-keysignature');
    expect(sigs).toHaveLength(2);
    const sig = sigs[1];
    expect((sig?.textContent ?? '').split('').length - 1).toBe(2);
  });

  it('draws the mockup header: number, flag dot, beat count; no pass text', () => {
    renderStrip(base([
      { number: 1, voices: [{ number: 1, events: [{ kind: 'note', midi: 60, durationQN: 4 }] }] },
    ]), 0, { flags: { 0: 'no hit near its first note' } });
    const block = host.querySelector('[data-measure-index="0"]')!;
    const hb = block.querySelector('.st-hb')!;
    expect(hb.textContent).toContain('1');
    expect(hb.querySelector('.st-flagdot')?.getAttribute('title')).toBe('Timing: no hit near its first note');
    expect(hb.textContent).not.toMatch(/pass/);
  });

  it('marks a selected bar with is-sel instead of a ring', () => {
    renderStrip(base([
      { number: 1, voices: [{ number: 1, events: [{ kind: 'note', midi: 60, durationQN: 4 }] }] },
    ]), 0, { selectedMeasures: [0, 0] });
    const block = host.querySelector('[data-measure-index="0"]')!;
    expect(block.classList.contains('is-sel')).toBe(true);
    expect(block.className).not.toMatch(/ring-2/);
  });

  it('marks a narrow placeholder bar in the selection with is-sel, no ring', () => {
    renderStrip(base([
      { number: 1, voices: [{ number: 1, events: [{ kind: 'note', midi: 60, durationQN: 4 }] }] },
      { number: 2, voices: [{ number: 1, events: [{ kind: 'note', midi: 62, durationQN: 4 }] }] },
    ]), 0, { selectedMeasures: [0, 1], pixelsPerSecond: 20 });
    const block = host.querySelector('[data-measure-index="0"]')!;
    expect(block.classList.contains('is-narrow')).toBe(true);
    expect(block.classList.contains('is-sel')).toBe(true);
    expect(block.className).not.toMatch(/ring-2/);
  });

  // Final review Minor 5: the base `.st-mbox` rule's `border-left: 1px solid
  // transparent` used to beat the narrow placeholder's own dashed left edge
  // (same specificity, later in Tailwind's cascade). `.st-mbox.is-narrow` has
  // two classes, so it now wins regardless of source order.
  it('gives the narrow placeholder its own dashed left border, overriding the base rule', () => {
    const css = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8');
    const rule = css.match(/\.st-mbox\.is-narrow\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(rule).toMatch(/border-left:\s*1px dashed hsl\(var\(--border\)\)/);
  });
});
