// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScoreDocument, Track } from '@/components/playsense-studio/shared/score-model/types';
import { extractTrackEvents } from '@/lib/playsense-studio/score-to-vexflow';
import { measureFill } from '@/lib/playsense-studio/measure-fill';
import type { MeasureStripItem } from '../../editable-measure-strip';
import { IntegratedEditor, type IntegratedEditorMeasureTiming } from '../../integrated-editor';
import { MeasureZoom, type ZoomState } from '../measure-zoom';
import type { ZoomLayout } from '../zoom-staff';

beforeAll(() => {
  // VexFlow measures text through a canvas; jsdom has none.
  const ctx = { measureText: (s: string) => ({ width: String(s).length * 7, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2, fontBoundingBoxAscent: 8, fontBoundingBoxDescent: 2 }), font: '' };
  HTMLCanvasElement.prototype.getContext = (() => ctx) as never;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

const n = (midi: number, durationQN: number) => ({ kind: 'note' as const, id: `n${midi}-${durationQN}-${Math.random()}`, midi, durationQN });
const track: Track = {
  index: 0, instrument: 'staff', displayName: 'T', tuning: null, stringMultiplicity: 1, channel: null, defaultView: 'staff',
  measures: [
    { number: 1, voices: [{ number: 1, events: [n(60, 4)] }] },
    { number: 2, voices: [{ number: 1, events: [n(60, 1), n(62, 1), n(64, 2)] }] },
    { number: 3, voices: [{ number: 1, events: [n(67, 4)] }] },
  ],
};

const items: MeasureStripItem[] = extractTrackEvents(track, [4, 4], 0).map((b, i) => ({
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
}));

const zoomAt = (measureIndex: number): ZoomState => ({
  measureIndex, cursor: { measureIndex, voice: 0, index: 0, anchor: null }, value: 'q', dots: 0, pencil: false,
});

function mount(measureIndex: number) {
  const onNav = vi.fn();
  const onClose = vi.fn();
  const onVoice = vi.fn();
  const onLayout = vi.fn<(l: ZoomLayout) => void>();
  act(() => {
    root.render(
      <MeasureZoom
        items={items} zoom={zoomAt(measureIndex)} height={240} fill={items[measureIndex].fill} bpm={120}
        percussion={false} origin={null} onVoice={onVoice} onNav={onNav} onClose={onClose} onLayout={onLayout}
      />,
    );
  });
  return { onNav, onClose, onVoice, onLayout };
}

describe('MeasureZoom', () => {
  it('shows the bar with its number and tempo', () => {
    mount(1);
    const head = host.querySelector('.st-zoom-head')!.textContent!;
    expect(head).toContain('m.2');
    expect(head).toContain('≈120.0 BPM');
  });

  it('draws both neighbours as labelled slivers, and a click on one navigates', () => {
    const { onNav } = mount(1);
    const labels = [...host.querySelectorAll('.st-zoom-sliver-label')].map((l) => l.textContent);
    expect(labels).toEqual(['m.1', 'm.3']);
    act(() => { host.querySelector<HTMLElement>('.st-zoom-sliver[data-side="next"]')!.click(); });
    expect(onNav).toHaveBeenCalledWith(1);
    act(() => { host.querySelector<HTMLElement>('.st-zoom-sliver[data-side="prev"]')!.click(); });
    expect(onNav).toHaveBeenCalledWith(-1);
  });

  it('shades one band per beat, odd beats marked', () => {
    mount(1);
    const bands = [...host.querySelectorAll('.st-zoom-band')];
    expect(bands).toHaveLength(4);
    expect(bands.map((b) => b.getAttribute('data-odd'))).toEqual(['true', 'false', 'true', 'false']);
    expect(bands.map((b) => b.textContent)).toEqual(['1', '2', '3', '4']);
  });

  it('meters each event by its share of the bar', () => {
    mount(1);
    const meter = host.querySelector('.st-zoom-meter')!;
    const segs = [...meter.querySelectorAll('i')];
    expect(segs.map((s) => s.style.width)).toEqual(['25%', '25%', '50%']);
    expect(meter.classList.contains('is-over')).toBe(false);
  });

  it('reports the center bar’s layout with a hit per voice-1 note', () => {
    const { onLayout } = mount(1);
    expect(onLayout).toHaveBeenCalled();
    const layout = onLayout.mock.calls.at(-1)![0];
    expect(layout.hits.filter((h) => h.voice === 0).map((h) => h.eventIndex)).toEqual([0, 1, 2]);
    expect(layout.noteEndX).toBeGreaterThan(layout.noteStartX);
    // lineForY and yForLine are inverses.
    expect(layout.lineForY(layout.yForLine(2))).toBeCloseTo(2);
  });

  it('leaves the sliver past the score’s edge empty', () => {
    const { onNav } = mount(0);
    const prev = host.querySelector<HTMLElement>('.st-zoom-sliver[data-side="prev"]')!;
    expect(prev.childElementCount).toBe(0);
    act(() => { prev.click(); });
    expect(onNav).not.toHaveBeenCalled();
    expect([...host.querySelectorAll('.st-zoom-sliver-label')].map((l) => l.textContent)).toEqual(['m.2']);
  });

  it('closes from its close button (instantly without animation support)', () => {
    const { onClose } = mount(1);
    act(() => { host.querySelector<HTMLButtonElement>('button[title="Close (Esc)"]')!.click(); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ---- IntegratedEditor: ⏎ opens the zoom, Esc closes it -----------------------

const makeScore = (bars: number): ScoreDocument => ({
  schemaVersion: 1, title: 'T', sourceFormat: 'native', initialTempo: 120,
  initialTimeSignature: [4, 4], initialKeyFifths: 0,
  tracks: [{
    index: 0, instrument: 'staff', displayName: 'T', tuning: null, stringMultiplicity: 1, channel: null, defaultView: 'staff',
    measures: Array.from({ length: bars }, (_, i) => ({ number: i + 1, voices: [{ number: 1, events: [{ kind: 'note' as const, midi: 60, durationQN: 2 }] }] })),
  }],
} as ScoreDocument);
const timings: IntegratedEditorMeasureTiming[] = [0, 1, 2].map((i) => ({
  measureNumber: i + 1, startVideoTimeSeconds: i * 2, endVideoTimeSeconds: i * 2 + 2,
}));

function renderEditor() {
  const dispatch = vi.fn();
  const onRequestZoom = vi.fn();
  const onSelectionChange = vi.fn();
  act(() => {
    root.render(
      <IntegratedEditor
        score={makeScore(3)} dispatch={dispatch} measureTimings={timings} pixelsPerSecond={100} scrollLeftPx={0}
        viewportWidth={800} onRequestZoom={onRequestZoom} onSelectionChange={onSelectionChange}
      />,
    );
  });
  return { dispatch, onRequestZoom, onSelectionChange };
}

function key(k: string, mods: { metaKey?: boolean; shiftKey?: boolean } = {}) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: k, metaKey: !!mods.metaKey, shiftKey: !!mods.shiftKey, bubbles: true, cancelable: true }));
  });
}

const zoomEl = () => host.querySelector('[data-testid="measure-zoom"]');
const barInfo = () => host.querySelector('[role="toolbar"][aria-label="Selected bars"] .st-fbar-info')?.textContent ?? null;
const types = (d: ReturnType<typeof vi.fn>) => d.mock.calls.map((c) => c[0].type);

describe('IntegratedEditor measure zoom', () => {
  it('⏎ on a selected bar opens it in the zoom, and Esc closes it keeping the bar selected', () => {
    const { onRequestZoom } = renderEditor();
    key('ArrowRight'); // select m.1
    key('Enter');
    expect(zoomEl()).not.toBeNull();
    expect(zoomEl()!.querySelector('.st-zoom-head')!.textContent).toContain('m.1');
    // The waveform still zooms so the bar fills 56% of the viewport.
    expect(onRequestZoom).toHaveBeenCalledWith(Math.min(600, (800 * 0.56) / 2), expect.any(Number));
    // The measure bar and the strip footer hide while the zoom is open.
    expect(barInfo()).toBeNull();
    expect(host.querySelector('.st-strip-foot')).toBeNull();

    key('Escape');
    expect(zoomEl()).toBeNull();
    expect(barInfo()).toContain('m.1');
  });

  it('keeps the note selection in step with the zoom cursor', () => {
    const { onSelectionChange } = renderEditor();
    key('ArrowRight');
    key('Enter');
    expect(onSelectionChange).toHaveBeenLastCalledWith({ ref: { measureIndex: 0, eventIndex: 0 }, trackIndex: 0 });
    key('Escape');
    expect(onSelectionChange).toHaveBeenLastCalledWith(null);
  });

  it('bar keys are off while the zoom is open: ⌫ deletes neither the bar nor a note', () => {
    const { dispatch } = renderEditor();
    key('ArrowRight');
    key('Enter');
    key('Backspace');
    expect(types(dispatch)).not.toContain('delete-measures');
    expect(types(dispatch)).not.toContain('delete-event');
    expect(zoomEl()).not.toBeNull();
  });

  it('› moves the zoom to the next bar and zooms the waveform to it', () => {
    const { onRequestZoom } = renderEditor();
    key('ArrowRight');
    key('Enter');
    onRequestZoom.mockClear();
    act(() => { host.querySelector<HTMLButtonElement>('button[title="Next bar (⌘→)"]')!.click(); });
    expect(zoomEl()!.querySelector('.st-zoom-head')!.textContent).toContain('m.2');
    expect(onRequestZoom).toHaveBeenCalledTimes(1);
    key('Escape');
    expect(barInfo()).toContain('m.2');
  });

  // Fix round 1: a percussion track's stroke row can be far wider (and
  // wrap taller) than the note toolbar's 520px pre-measure fallback. jsdom
  // never lays anything out, so offsetWidth/offsetHeight are stubbed to
  // stand in for a real (measured) oversized toolbar.
  it('measures the note toolbar and clamps it inside the zoom', () => {
    const widthDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')!;
    const heightDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')!;
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get(this: HTMLElement) { return this.getAttribute('data-testid') === 'note-toolbar' ? 900 : 0; },
    });
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get(this: HTMLElement) { return this.getAttribute('data-testid') === 'note-toolbar' ? 300 : 0; },
    });
    try {
      renderEditor();
      key('ArrowRight');
      key('Enter');
      const bar = host.querySelector<HTMLElement>('[data-testid="note-toolbar"]');
      expect(bar).not.toBeNull();
      // The center column is the jsdom fallback panel (800px) minus its two
      // 104px slivers = 592px. A 900px-wide bar can't fit either way, so its
      // clamp bound collapses to its own half-width from the left edge.
      expect(bar!.style.left).toBe('458px');
      // The center row (well under 300px here) is shorter than the bar, so
      // it clamps flush to the row's top instead of running past its bottom.
      expect(bar!.style.top).toBe('0px');
      // Kept inside the center column: capped at its width minus 16px.
      expect(bar!.style.maxWidth).toBe('576px');
      expect(bar!.style.flexWrap).toBe('wrap');
    } finally {
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', widthDesc);
      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', heightDesc);
    }
  });

  // Fix round 1 (Task 9, Bug 3): the More popover no longer keeps the anchor
  // it was opened with — it's positioned under the toolbar's own (live,
  // clamped) position every render, so it keeps following the cursor instead
  // of going stale.
  it('the More popover recomputes its position from the toolbar as the cursor moves', () => {
    renderEditor();
    key('ArrowRight'); // select m.1
    key('Enter'); // open the zoom — cursor starts on m.1's first note
    act(() => { host.querySelector<HTMLButtonElement>('button[aria-label="More"]')!.click(); });

    const popover = () => host.querySelector<HTMLElement>('[role="dialog"][aria-label="More"]');
    const toolbar = () => host.querySelector<HTMLElement>('[data-testid="note-toolbar"]')!;
    expect(popover()).not.toBeNull();
    // Directly under the toolbar: same left, top plus the toolbar's measured
    // height (0 here — jsdom never lays anything out).
    expect(popover()!.style.left).toBe(toolbar().style.left);
    expect(popover()!.style.top).toBe(toolbar().style.top);
    const beforeLeft = popover()!.style.left;

    // Walk to the bar's second note — a different x under a real layout —
    // without closing the popover.
    key('ArrowRight');
    expect(popover()).not.toBeNull();
    expect(popover()!.style.left).not.toBe(beforeLeft);
    expect(popover()!.style.left).toBe(toolbar().style.left);
    expect(popover()!.style.top).toBe(toolbar().style.top);
  });
});
