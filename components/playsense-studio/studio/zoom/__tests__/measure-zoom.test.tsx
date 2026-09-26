// @vitest-environment jsdom
import React, { act, useReducer, useState, type Dispatch } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MusicalEvent, ScoreDocument, Track } from '@/components/playsense-studio/shared/score-model/types';
import { editorReducer, type EditorAction, type EditorState } from '@/lib/playsense-studio/editor-state';
import type { NoteCursor } from '@/lib/playsense-studio/note-cursor';
import { getPercStrokes } from '@/lib/playsense-studio/perc-strokes';
import { extractTrackEvents } from '@/lib/playsense-studio/score-to-vexflow';
import { measureFill } from '@/lib/playsense-studio/measure-fill';
import type { MeasureStripItem } from '../../editable-measure-strip';
import { IntegratedEditor, type IntegratedEditorMeasureTiming } from '../../integrated-editor';
import { MeasureZoom, type ZoomState } from '../measure-zoom';
import { useZoomEditing, type ZoomEditing } from '../use-zoom-editing';
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
        editing={{} as ZoomEditing} dispatch={vi.fn()} onCursor={vi.fn()} clef="treble" keyFifths={0} percStrokes={null}
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

  it('keeps focus where it was when a header button is pressed', () => {
    mount(1);
    const head = host.querySelector('.st-zoom-head')!;
    const labels = [...head.querySelectorAll('button')].map((b) => b.textContent || b.getAttribute('aria-label'));
    expect(labels).toEqual(expect.arrayContaining(['V1', 'V2', 'Previous bar', 'Next bar', 'Close']));
    for (const btn of head.querySelectorAll('button')) {
      const ev = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      act(() => { btn.dispatchEvent(ev); });
      expect(ev.defaultPrevented).toBe(true);
    }
  });

  it('closes from its close button (instantly without animation support)', () => {
    const { onClose } = mount(1);
    act(() => { host.querySelector<HTMLButtonElement>('button[title="Close (Esc)"]')!.click(); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('draws its staff with the notation ink, not VexFlow black', () => {
    mount(1);
    const root = host.querySelector('[data-testid="measure-zoom"]')!;
    expect(root.classList.contains('playsense-studio-notation')).toBe(true);
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

  it('a click on a note in the strip opens the zoom on that note', async () => {
    // The strip draws only the bars inside its measured width.
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 800 });
    try {
      const { onSelectionChange } = renderEditor();
      // The strip's staff draws (and reports its note boxes) on an animation frame.
      await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
      const bar1 = host.querySelector('[data-measure-index="1"]')!;
      // jsdom lays nothing out: the bar's rect sits at 0, so clientX is bar-local.
      for (let x = 0; x < 200 && !zoomEl(); x += 6) {
        const down = new MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX: x, clientY: 120 });
        Object.defineProperty(down, 'pointerId', { value: 1 });
        act(() => { bar1.dispatchEvent(down); });
      }
      expect(zoomEl()).not.toBeNull();
      expect(zoomEl()!.querySelector('.st-zoom-head')!.textContent).toContain('m.2');
      expect(onSelectionChange).toHaveBeenLastCalledWith({ ref: { measureIndex: 1, eventIndex: 0 }, trackIndex: 0 });
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth'); // back to Element's
    }
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

// ---- Pointer editing (Task 10) ---------------------------------------------------

const pitchedDoc = (bars: MusicalEvent[][], instrument: Track['instrument'] = 'piano'): ScoreDocument => ({
  schemaVersion: 1, title: 't', sourceFormat: 'native', initialTempo: 100, initialTimeSignature: [4, 4], initialKeyFifths: 0,
  tracks: [{
    index: 0, instrument, displayName: 'P', tuning: null, stringMultiplicity: 1, channel: 0, defaultView: 'staff',
    measures: bars.map((events, i) => ({ number: i + 1, voices: [{ number: 1, events }] })),
  }],
});

const itemsOf = (s: ScoreDocument): MeasureStripItem[] =>
  extractTrackEvents(s.tracks[0], s.initialTimeSignature, s.initialKeyFifths).map((b, i) => ({
    measureIndex: i, measureNumber: b.measure.number, startVideoTimeSeconds: i * 2, endVideoTimeSeconds: i * 2 + 2,
    events: b.events, voice2Events: b.voice2Events, timeSignature: b.timeSignature, isFirst: i === 0, clef: b.clef,
    keyFifths: b.keyFifths, previousKeyFifths: b.previousKeyFifths, keyChanged: b.keyChanged, clefChanged: b.clefChanged,
    fill: measureFill(b.measure.voices[0]?.events ?? [], b.measure.voices[1]?.events, b.timeSignature),
  }));

interface PointerLatest { score: ScoreDocument; zoom: ZoomState; layout: ZoomLayout | null }

function mountEditing(score: ScoreDocument, opts: { measureIndex?: number; index?: number | 'end'; pencil?: boolean } = {}) {
  const m = opts.measureIndex ?? 0;
  const dispatchSpy = vi.fn<(a: EditorAction) => void>();
  const onCursor = vi.fn<(c: NoteCursor) => void>();
  const flash = vi.fn<(msg: string) => void>();
  const latest = { layout: null } as PointerLatest;
  const percussion = score.tracks[0].instrument.startsWith('perc-');
  function Harness() {
    const [state, rawDispatch] = useReducer(editorReducer, score, (s): EditorState => ({ score: s, past: [], future: [], isDirty: false }));
    const dispatch: Dispatch<EditorAction> = (a) => { dispatchSpy(a); rawDispatch(a); };
    const [zoom, setZoom] = useState<ZoomState | null>({
      measureIndex: m, cursor: { measureIndex: m, voice: 0, index: opts.index ?? 0, anchor: null }, value: 'q', dots: 0, pencil: !!opts.pencil,
    });
    const editing = useZoomEditing({
      score: state.score, dispatch, trackIndex: 0, zoom, setZoom,
      keyFifthsAt: () => 0, clefAt: () => (percussion ? 'percussion' : 'treble'), barQNAt: () => 4,
      percussion, flash, openBar: () => {}, close: () => {},
    });
    Object.assign(latest, { score: state.score, zoom });
    const items = itemsOf(state.score);
    if (!zoom) return null;
    return (
      <MeasureZoom
        items={items} zoom={zoom} height={240} fill={items[zoom.measureIndex].fill} bpm={120}
        percussion={percussion} origin={null}
        onVoice={(voice) => setZoom({ ...zoom, cursor: { measureIndex: zoom.measureIndex, voice, index: 'end', anchor: null } })}
        onNav={() => {}} onClose={() => {}} onLayout={(l) => { latest.layout = l; }}
        editing={editing} dispatch={dispatch}
        onCursor={(c) => { onCursor(c); setZoom({ ...zoom, cursor: c }); }}
        clef={percussion ? 'percussion' : 'treble'} keyFifths={0}
        percStrokes={percussion ? getPercStrokes(score.tracks[0].instrument) : null}
      />
    );
  }
  act(() => root.render(<Harness />));
  return { latest, dispatchSpy, onCursor, flash };
}

function firePointer(type: string, x: number, y: number, mods: { shiftKey?: boolean } = {}) {
  const target = host.querySelector('.st-zoom-center')!;
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, ...mods });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  act(() => { target.dispatchEvent(e); });
}

const centerOf = (h: { x: number; y: number; w: number; h: number }) => ({ x: h.x + h.w / 2, y: h.y + h.h / 2 });
const hitOf = (l: ZoomLayout, eventIndex: number, voice: 0 | 1 = 0) => l.hits.find((h) => h.voice === voice && h.eventIndex === eventIndex)!;
const pn = (midi: number, durationQN: number): MusicalEvent => ({ kind: 'note', midi, durationQN, id: `p${midi}-${durationQN}-${Math.random()}` });

describe('MeasureZoom pointer editing', () => {
  it('a press and release on a note selects it', () => {
    const { latest, onCursor, dispatchSpy } = mountEditing(pitchedDoc([[pn(60, 1), pn(62, 1), pn(64, 2)]]));
    const c = centerOf(hitOf(latest.layout!, 2));
    firePointer('pointerdown', c.x, c.y);
    firePointer('pointerup', c.x, c.y);
    expect(onCursor).toHaveBeenLastCalledWith({ measureIndex: 0, voice: 0, index: 2, anchor: null });
    expect(latest.zoom.cursor.index).toBe(2);
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('⇧-press extends the selection and never drags', () => {
    const { latest, onCursor, dispatchSpy } = mountEditing(pitchedDoc([[pn(60, 1), pn(62, 1), pn(64, 2)]]));
    const c = centerOf(hitOf(latest.layout!, 2));
    firePointer('pointerdown', c.x, c.y, { shiftKey: true });
    firePointer('pointermove', c.x, c.y - 30, { shiftKey: true });
    firePointer('pointerup', c.x, c.y - 30, { shiftKey: true });
    expect(onCursor).toHaveBeenLastCalledWith({ measureIndex: 0, voice: 0, index: 2, anchor: 0 });
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('dragging a C4 up two steps (5 px × the 1.5 scale each) sets E4, in one undo step', () => {
    const { latest, dispatchSpy } = mountEditing(pitchedDoc([[pn(60, 4)]]));
    const c = centerOf(hitOf(latest.layout!, 0));
    firePointer('pointerdown', c.x, c.y);
    firePointer('pointermove', c.x, c.y - 5);
    firePointer('pointermove', c.x, c.y - 15);
    expect(host.querySelector('.st-zoom-tip')!.textContent).toBe('E4');
    firePointer('pointerup', c.x, c.y - 15);
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    expect(dispatchSpy).toHaveBeenCalledWith({
      type: 'set-event-pitches', ref: { trackIndex: 0, measureIndex: 0, voice: 0, eventIndex: 0 }, midis: [64],
    });
    expect(host.querySelector('.st-zoom-tip')).toBeNull();
    const e = latest.score.tracks[0].measures[0].voices[0].events[0];
    expect(e.kind === 'note' && e.midi).toBe(64);
  });

  it('drags every note of a chord by the same steps, naming them all', () => {
    const chord: MusicalEvent = { kind: 'chord', durationQN: 4, id: 'ch', notes: [{ midi: 60 }, { midi: 64 }] };
    const { latest, dispatchSpy } = mountEditing(pitchedDoc([[chord]]));
    const c = centerOf(hitOf(latest.layout!, 0));
    firePointer('pointerdown', c.x, c.y);
    firePointer('pointermove', c.x, c.y + 7.5);
    expect(host.querySelector('.st-zoom-tip')!.textContent).toBe('B3 D4');
    firePointer('pointerup', c.x, c.y + 7.5);
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    expect(dispatchSpy.mock.calls[0][0]).toMatchObject({ type: 'set-event-pitches', midis: [59, 62] });
  });

  it('a press that doesn’t move far enough changes nothing', () => {
    const { latest, dispatchSpy } = mountEditing(pitchedDoc([[pn(60, 4)]]));
    const c = centerOf(hitOf(latest.layout!, 0));
    firePointer('pointerdown', c.x, c.y);
    firePointer('pointermove', c.x, c.y - 3);
    firePointer('pointerup', c.x, c.y - 3);
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('a percussion drag snaps to a stroke line and keeps the stroke’s notation', () => {
    const { latest, dispatchSpy } = mountEditing(pitchedDoc([[{ kind: 'note', midi: 64, durationQN: 4, id: 'c1' } as MusicalEvent]], 'perc-conga'));
    const c = centerOf(hitOf(latest.layout!, 0));
    firePointer('pointerdown', c.x, c.y);
    firePointer('pointermove', c.x, c.y + 7.5);
    expect(host.querySelector('.st-zoom-tip')!.textContent).toBe('Open · low');
    firePointer('pointerup', c.x, c.y + 7.5);
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    expect(dispatchSpy.mock.calls[0][0]).toMatchObject({ type: 'write-event', kind: 'note', midi: 63 });
  });

  it('pencil: a ghost follows the pointer, and a click on empty staff appends a note there', () => {
    const { latest, dispatchSpy } = mountEditing(pitchedDoc([[pn(60, 2)]]), { pencil: true });
    const l = latest.layout!;
    const x = l.noteEndX - 10;
    const y = l.yForLine(3); // G4 in treble
    firePointer('pointermove', x, y + 1);
    const ghost = host.querySelector<HTMLElement>('.st-zoom-ghost')!;
    expect(ghost).not.toBeNull();
    expect(parseFloat(ghost.style.top) + 4).toBeCloseTo(y);
    firePointer('pointerdown', x, y + 1);
    firePointer('pointerup', x, y + 1);
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    expect(dispatchSpy.mock.calls[0][0]).toMatchObject({
      type: 'write-event', at: { eventIndex: 'end' }, kind: 'note', midi: 67, value: 'q',
    });
  });

  it('pencil: a click on a full bar is refused with the bar-full flash', () => {
    const { latest, dispatchSpy, flash } = mountEditing(pitchedDoc([[pn(60, 4)]]), { pencil: true });
    const l = latest.layout!;
    firePointer('pointerdown', l.noteEndX - 2, l.yForLine(-2));
    expect(dispatchSpy).not.toHaveBeenCalled();
    expect(flash).toHaveBeenCalledWith('m.1 is full — shorten a note or pick a smaller value');
  });

  it('V2 shows on a pitched track, switches the cursor voice, and leaves voice 1 unclickable', () => {
    const { latest, onCursor } = mountEditing(pitchedDoc([[pn(60, 1), pn(62, 1), pn(64, 2)]]));
    const v2 = [...host.querySelectorAll<HTMLButtonElement>('.st-seg button')].find((b) => b.textContent === 'V2')!;
    expect(v2).toBeDefined();
    act(() => { v2.click(); });
    expect(latest.zoom.cursor.voice).toBe(1);
    const c = centerOf(hitOf(latest.layout!, 1));
    firePointer('pointerdown', c.x, c.y);
    firePointer('pointerup', c.x, c.y);
    expect(onCursor).not.toHaveBeenCalled();
    // Voice 1's notes are drawn at half opacity while voice 2 is edited.
    expect(host.querySelector('.st-zoom-center svg [opacity="0.5"]')).not.toBeNull();
  });

  it('hides V2 on a percussion bar with no voice-2 notes', () => {
    mountEditing(pitchedDoc([[{ kind: 'note', midi: 64, durationQN: 4, id: 'c1' } as MusicalEvent]], 'perc-conga'));
    expect(host.querySelector('.st-seg')).toBeNull();
  });
});
