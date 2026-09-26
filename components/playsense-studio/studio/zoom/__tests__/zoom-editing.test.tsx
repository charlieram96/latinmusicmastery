// @vitest-environment jsdom
import React, { act, useReducer, useState, type Dispatch } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Chord, Measure, MusicalEvent, Note, ScoreDocument, Track } from '@/components/playsense-studio/shared/score-model/types';
import { editorReducer, type EditorAction, type EditorState } from '@/lib/playsense-studio/editor-state';
import type { NoteCursor } from '@/lib/playsense-studio/note-cursor';
import { IntegratedEditor, type IntegratedEditorMeasureTiming } from '../../integrated-editor';
import type { ZoomState } from '../measure-zoom';
import { useZoomEditing, type ZoomEditing } from '../use-zoom-editing';

beforeAll(() => {
  // VexFlow measures text through a canvas; jsdom has none.
  const ctx = { measureText: (s: string) => ({ width: String(s).length * 7, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2, fontBoundingBoxAscent: 8, fontBoundingBoxDescent: 2 }), font: '' };
  HTMLCanvasElement.prototype.getContext = (() => ctx) as never;
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
  // @ts-expect-error test cleanup of a possibly-defined global
  delete navigator.requestMIDIAccess;
});

const n = (midi: number, durationQN = 1): MusicalEvent => ({ kind: 'note', midi, durationQN, id: `n${midi}-${durationQN}` });
const bar = (number: number, events: MusicalEvent[]): Measure => ({ number, voices: [{ number: 1, events }] });
const doc = (bar1: MusicalEvent[], bar2: MusicalEvent[] = [], instrument: Track['instrument'] = 'piano'): ScoreDocument => ({
  schemaVersion: 1, title: 't', sourceFormat: 'native', initialTempo: 100, initialTimeSignature: [4, 4], initialKeyFifths: 0,
  tracks: [{
    index: 0, instrument, displayName: 'P', tuning: null, stringMultiplicity: 1, channel: 0, defaultView: 'staff',
    measures: [bar(1, bar1), bar(2, bar2)],
  }],
});

interface Latest { score: ScoreDocument; zoom: ZoomState | null; dispatch: Dispatch<EditorAction>; editing: ZoomEditing }

function mount(score: ScoreDocument, opts: { percussion?: boolean; cursor?: Partial<NoteCursor>; keyFifths?: number } = {}) {
  const flash = vi.fn<(msg: string) => void>();
  const openBar = vi.fn<(index: number, dir: 1 | -1) => void>();
  const close = vi.fn<() => void>();
  const latest = {} as Latest;
  const percussion = !!opts.percussion;
  const keyFifths = opts.keyFifths ?? 0;
  const initialZoom: ZoomState = {
    measureIndex: 0,
    cursor: { measureIndex: 0, voice: 0, index: 'end', anchor: null, ...opts.cursor },
    value: 'q', dots: 0, pencil: false,
  };
  function Harness() {
    const [state, dispatch] = useReducer(editorReducer, score, (s): EditorState => ({ score: s, past: [], future: [], isDirty: false }));
    const [zoom, setZoom] = useState<ZoomState | null>(initialZoom);
    const editing = useZoomEditing({
      score: state.score, dispatch, trackIndex: 0, zoom, setZoom,
      keyFifthsAt: () => keyFifths, clefAt: () => (percussion ? 'percussion' : 'treble'), barQNAt: () => 4,
      percussion, flash, openBar, close,
    });
    Object.assign(latest, { score: state.score, zoom, dispatch, editing });
    return null;
  }
  act(() => root.render(<Harness />));
  return { latest, flash, openBar, close };
}

async function keyAsync(k: string, mods: { shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean } = {}) {
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...mods }));
  });
}

// A fake Web MIDI input, as hooks/__tests__/use-midi-input.test.tsx mocks it.
class FakeMidiInput extends EventTarget {
  id = 'piano'; name = 'Test piano'; manufacturer = 'Test'; state = 'connected';
  message(data: number[], stamp = 0) {
    const e = new Event('midimessage');
    Object.defineProperties(e, { data: { value: new Uint8Array(data) }, timeStamp: { value: stamp } });
    this.dispatchEvent(e);
  }
}
class FakeMidiAccess extends EventTarget { inputs = new Map<string, FakeMidiInput>(); }

function stubMidiAccess(resolve: () => Promise<FakeMidiAccess>) {
  Object.defineProperty(navigator, 'requestMIDIAccess', { configurable: true, value: vi.fn(resolve) });
}

function key(k: string, mods: { shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean } = {}, target: EventTarget = window) {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...mods }));
  });
}

const events = (s: ScoreDocument, m = 0) => s.tracks[0].measures[m].voices[0].events;
const midis = (s: ScoreDocument, m = 0) => events(s, m).map((e) => (e.kind === 'note' ? e.midi : e.kind));

describe('useZoomEditing keys', () => {
  it('types c d e f into an empty bar at the octave nearest the clef, then moves on to the next bar', () => {
    const { latest, openBar } = mount(doc([]));
    for (const k of ['c', 'd', 'e', 'f']) key(k);
    // No earlier note: the treble clef's reference (B4) puts C at C5.
    expect(midis(latest.score)).toEqual([72, 74, 76, 77]);
    expect(events(latest.score).map((e) => e.durationQN)).toEqual([1, 1, 1, 1]);
    expect(latest.zoom?.cursor).toEqual({ measureIndex: 1, voice: 0, index: 'end', anchor: null });
    expect(latest.zoom?.measureIndex).toBe(1);
    expect(openBar).toHaveBeenCalledWith(1, 1);
  });

  it('follows the previous note’s octave', () => {
    const { latest } = mount(doc([n(60)]));
    for (const k of ['d', 'e', 'f']) key(k);
    expect(midis(latest.score)).toEqual([60, 62, 64, 65]);
  });

  it('refuses a note that doesn’t fit and says the bar is full (Review Focus 1)', () => {
    const { latest, flash } = mount(doc([n(60, 2), n(62, 2)]));
    const before = latest.score;
    key('g');
    expect(latest.score).toBe(before);
    expect(flash).toHaveBeenCalledWith('m.1 is full — shorten a note or pick a smaller value');
  });

  it('refuses a half note in a bar with only a beat left', () => {
    const { latest, flash } = mount(doc([n(60, 2), n(62, 1)]));
    const before = latest.score;
    key('6');
    key('a');
    expect(latest.score).toBe(before);
    expect(flash).toHaveBeenCalledWith('m.1 is full — shorten a note or pick a smaller value');
  });

  it('replaces a lone filler rest', () => {
    const { latest, flash } = mount(doc([{ kind: 'rest', durationQN: 4, id: 'r0' }]));
    key('c');
    expect(flash).not.toHaveBeenCalled();
    expect(midis(latest.score)).toEqual([72]);
  });

  it('3 then r appends a 16th rest', () => {
    const { latest } = mount(doc([n(60)]));
    key('3');
    expect(latest.zoom?.value).toBe('16');
    key('r');
    expect(events(latest.score).map((e) => [e.kind, e.durationQN])).toEqual([['note', 1], ['rest', 0.25]]);
    expect(latest.zoom?.cursor.index).toBe('end');
  });

  it('← then ↑ steps the last note; ⇧↑ a semitone; ⌘↑ an octave', () => {
    const { latest } = mount(doc([n(60), n(64)]));
    key('ArrowLeft');
    expect(latest.zoom?.cursor.index).toBe(1);
    key('ArrowUp');
    expect(midis(latest.score)).toEqual([60, 65]);
    key('ArrowUp', { shiftKey: true });
    expect(midis(latest.score)).toEqual([60, 66]);
    key('ArrowUp', { metaKey: true });
    expect(midis(latest.score)).toEqual([60, 78]);
    key('ArrowDown');
    expect(midis(latest.score)).toEqual([60, 76]); // F♯5 steps down to E5 in C
  });

  it('⇧E on a C adds E to make a chord', () => {
    const { latest } = mount(doc([n(60)]));
    key('E', { shiftKey: true });
    const e = events(latest.score)[0] as Chord;
    expect(e.kind).toBe('chord');
    expect(e.notes.map((x) => x.midi)).toEqual([60, 64]);
    expect(latest.zoom?.cursor.index).toBe('end');
  });

  it('t on a quarter makes a 3:2 group', () => {
    const { latest } = mount(doc([n(60)]));
    key('ArrowLeft');
    key('t');
    const evs = events(latest.score);
    expect(evs).toHaveLength(3);
    expect(evs.map((e) => e.tuplet && [e.tuplet.n, e.tuplet.m])).toEqual([[3, 2], [3, 2], [3, 2]]);
    expect(new Set(evs.map((e) => e.tuplet?.id)).size).toBe(1);
  });

  it('t at the end appends a rest of the current value and splits it', () => {
    const { latest } = mount(doc([n(60)]));
    key('t');
    const evs = events(latest.score);
    expect(evs.map((e) => [e.kind, e.tuplet?.n])).toEqual([['note', undefined], ['rest', 3], ['rest', 3], ['rest', 3]]);
    expect(latest.zoom?.cursor.index).toBe(1);
  });

  it('t at the end is one undo step', () => {
    const { latest } = mount(doc([n(60)]));
    const before = latest.score;
    key('t');
    expect(events(latest.score)).toHaveLength(4);
    act(() => latest.dispatch({ type: 'undo' }));
    expect(latest.score).toEqual(before);
  });

  it('t on member 4 of six legacy triplets merges only its drawn group and lands on its start', () => {
    const t3 = (midi: number): MusicalEvent => ({ ...n(midi, 1 / 3), triplet: true });
    const { latest } = mount(doc([t3(60), t3(62), t3(64), t3(65), t3(67), t3(69), n(71, 2)]), { cursor: { index: 4 } });
    key('t');
    expect(events(latest.score).map((e) => [e.durationQN, !!e.triplet])).toEqual([
      [expect.closeTo(1 / 3, 9), true], [expect.closeTo(1 / 3, 9), true], [expect.closeTo(1 / 3, 9), true], [1, false], [2, false],
    ]);
    expect(latest.zoom?.cursor.index).toBe(3);
  });

  it('t on a dotted note flashes and changes nothing', () => {
    const { latest, flash } = mount(doc([{ ...n(60, 1.5), dots: 1 }]));
    key('ArrowLeft');
    const before = latest.score;
    key('t');
    expect(latest.score).toBe(before);
    expect(flash).toHaveBeenCalledWith('Tuplets need an undotted note.');
  });

  it('t on a 64th flashes that it can’t be split', () => {
    const { latest, flash } = mount(doc([n(60, 0.0625)]));
    key('ArrowLeft');
    const before = latest.score;
    key('t');
    expect(latest.score).toBe(before);
    expect(flash).toHaveBeenCalledWith('A 64th can’t be split 3:2. Try a longer note.');
  });

  it('+ sets a tie; + on a rest flashes', () => {
    const { latest, flash } = mount(doc([n(60), { kind: 'rest', durationQN: 1, id: 'r1' }]));
    key('ArrowLeft');
    key('ArrowLeft');
    key('+', { shiftKey: true });
    expect((events(latest.score)[0] as Note).tieToNext).toBe(true);
    key('ArrowRight');
    key('+', { shiftKey: true });
    expect(flash).toHaveBeenCalledWith('Select a note to tie from.');
  });

  it('Backspace at the end deletes the last note', () => {
    const { latest } = mount(doc([n(60), n(62)]));
    key('Backspace');
    expect(midis(latest.score)).toEqual([60]);
    expect(latest.zoom?.cursor).toEqual({ measureIndex: 0, voice: 0, index: 'end', anchor: null });
  });

  it('Delete removes the note under the cursor and keeps the cursor there', () => {
    const { latest } = mount(doc([n(60), n(62), n(64)]), { cursor: { index: 1 } });
    key('Delete');
    expect(midis(latest.score)).toEqual([60, 64]);
    expect(latest.zoom?.cursor.index).toBe(1);
  });

  it('4 over a selected tuplet member flashes instead of breaking the group', () => {
    const t = { id: 'tA', n: 3, m: 2 };
    const third = 1 / 3;
    const { latest, flash } = mount(doc([
      { ...n(60, third), tuplet: t }, { ...n(62, third), tuplet: t }, { ...n(64, third), tuplet: t },
    ]), { cursor: { index: 0 } });
    const before = latest.score;
    key('4');
    expect(latest.score).toBe(before);
    expect(flash).toHaveBeenCalledWith('Remove the tuplet first, or make room in the bar');
    expect(latest.zoom?.value).toBe('8');
  });

  it('walks across bars through openBar', () => {
    const { latest, openBar } = mount(doc([n(60)], [n(67)]));
    key('ArrowRight');
    expect(latest.zoom?.cursor).toEqual({ measureIndex: 1, voice: 0, index: 0, anchor: null });
    expect(latest.zoom?.measureIndex).toBe(1);
    expect(openBar).toHaveBeenLastCalledWith(1, 1);
    key('ArrowLeft', { metaKey: true });
    expect(latest.zoom?.cursor).toEqual({ measureIndex: 0, voice: 0, index: 'end', anchor: null });
    expect(openBar).toHaveBeenLastCalledWith(0, -1);
  });

  it('Esc calls close and N toggles the pencil', () => {
    const { latest, close } = mount(doc([]));
    key('n');
    expect(latest.zoom?.pencil).toBe(true);
    key('Escape');
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('letters on a percussion track never write a pitch (Review Focus 4)', () => {
    const { latest, flash } = mount(doc([], [], 'perc-conga'), { percussion: true });
    const before = latest.score;
    key('c');
    expect(latest.score).toBe(before);
    expect(flash).toHaveBeenCalledWith('Pick a stroke in the toolbar');
    act(() => latest.editing.enterStroke(62));
    expect(midis(latest.score)).toEqual([62]);
  });

  it('5 then r in a bar holding only a filler rest writes a quarter rest and stays in the bar', () => {
    const { latest } = mount(doc([{ kind: 'rest', durationQN: 4, id: 'r0' }]), { cursor: { index: 0 } });
    key('5');
    key('r');
    expect(events(latest.score).map((e) => [e.kind, e.durationQN])).toEqual([['rest', 1]]);
    expect(latest.zoom?.cursor).toEqual({ measureIndex: 0, voice: 0, index: 'end', anchor: null });
    expect(latest.zoom?.measureIndex).toBe(0);
  });

  it('a stroke typed over a filler rest replaces it rather than filling the bar', () => {
    const { latest } = mount(doc([{ kind: 'rest', durationQN: 4, id: 'r0' }], [], 'perc-conga'), { percussion: true, cursor: { index: 0 } });
    act(() => latest.editing.enterStroke(64));
    expect(events(latest.score).map((e) => [e.kind, e.durationQN])).toEqual([['note', 1]]);
  });

  it('writes a stroke with its notation; ↑/↓ step through the strokes and accidentals do nothing', () => {
    const { latest } = mount(doc([], [], 'perc-conga'), { percussion: true });
    act(() => latest.editing.enterStroke(64)); // Open · high
    expect(events(latest.score)[0]).toMatchObject({ kind: 'note', midi: 64, percussion: { strokeId: 'open-high', staffLine: 'e/5', notehead: 'normal' } });
    key('ArrowLeft');
    key('ArrowUp');
    expect(events(latest.score)[0]).toMatchObject({ kind: 'note', midi: 63, durationQN: 1, percussion: { strokeId: 'open-low', staffLine: 'd/5', notehead: 'normal' } });
    key('ArrowDown');
    expect(events(latest.score)[0]).toMatchObject({ midi: 64, percussion: { strokeId: 'open-high' } });
    key('ArrowDown'); // already the first stroke
    expect(events(latest.score)[0]).toMatchObject({ midi: 64 });
    const before = latest.score;
    act(() => latest.editing.accidental(1));
    key('ArrowUp', { shiftKey: true });
    expect(events(latest.score)[0]).toMatchObject({ midi: 63 }); // ⇧↑ steps a stroke too, never a semitone
    act(() => latest.dispatch({ type: 'undo' }));
    expect(latest.score).toEqual(before);
  });

  it('ignores keys typed into a field (Review Focus 5)', () => {
    const { latest } = mount(doc([n(60)]));
    const input = document.createElement('input');
    document.body.appendChild(input);
    const before = latest.score;
    const zoomBefore = latest.zoom;
    key('d', {}, input);
    key('ArrowLeft', {}, input);
    expect(latest.score).toBe(before);
    expect(latest.zoom).toBe(zoomBefore);
    input.remove();
  });

  it('clamps the cursor when an undo shortens the bar', () => {
    const { latest } = mount(doc([n(60)]));
    key('d');
    key('ArrowLeft');
    expect(latest.zoom?.cursor.index).toBe(1);
    act(() => latest.dispatch({ type: 'undo' }));
    expect(midis(latest.score)).toEqual([60]);
    expect(latest.zoom?.cursor.index).toBe('end');
  });

  it('marks flash without a selection and toggle off when picked again', () => {
    const { latest, flash } = mount(doc([n(60)]));
    act(() => latest.editing.ornament('trill'));
    expect(flash).toHaveBeenCalledWith('Select a note first.');
    key('ArrowLeft');
    act(() => latest.editing.ornament('trill'));
    expect(events(latest.score)[0].ornament).toBe('trill');
    act(() => latest.editing.ornament('trill'));
    expect(events(latest.score)[0].ornament).toBeUndefined();
    act(() => latest.editing.dynamic('mf'));
    expect(events(latest.score)[0].dynamic).toBe('mf');
    act(() => latest.editing.dynamic('mf'));
    expect(events(latest.score)[0].dynamic).toBeUndefined();
  });

  it('s slurs to the next note and flashes when there is none', () => {
    const { latest, flash } = mount(doc([n(60), n(62)]), { cursor: { index: 0 } });
    key('s');
    expect(latest.score.spans?.map((s) => s.type)).toEqual(['slur']);
    key('ArrowRight');
    key('s');
    expect(flash).toHaveBeenCalledWith('There’s no next note to end on.');
  });
});

// ---- The Keys panel: MIDI input and the on-screen keys (Task 5) ---------------

describe('useZoomEditing Keys panel', () => {
  it('K toggles the Keys panel', async () => {
    // No requestMIDIAccess stub here: the panel still opens and closes (the
    // hook falls back to 'unavailable' on its own), so await through keyAsync
    // to let that settle cleanly within act before the test ends.
    const { latest } = mount(doc([]));
    expect(latest.zoom?.keysOpen).toBeFalsy();
    await keyAsync('k');
    expect(latest.zoom?.keysOpen).toBe(true);
    await keyAsync('k');
    expect(latest.zoom?.keysOpen).toBe(false);
  });

  it('a MIDI note-on enters a note spelled by the key in force (F major spells 70 as B♭)', async () => {
    const midiInput = new FakeMidiInput();
    const access = new FakeMidiAccess();
    access.inputs.set(midiInput.id, midiInput);
    stubMidiAccess(async () => access);
    const { latest } = mount(doc([]), { keyFifths: -1 });
    await keyAsync('k');
    act(() => midiInput.message([0x90, 70, 100], 0));
    const e = events(latest.score)[0] as Note;
    expect(e).toMatchObject({ kind: 'note', midi: 70, spelling: { step: 'B', alter: -1 } });
  });

  it('groups two note-ons 20 ms apart into one chord, and 60 ms apart into two notes', async () => {
    const midiInput = new FakeMidiInput();
    const access = new FakeMidiAccess();
    access.inputs.set(midiInput.id, midiInput);
    stubMidiAccess(async () => access);
    const { latest } = mount(doc([]));
    await keyAsync('k');
    // Each note-on gets its own render commit, as separate hardware messages
    // would: the second's chord lookup must see the first's just-written note.
    act(() => midiInput.message([0x90, 60, 100], 0));
    act(() => midiInput.message([0x90, 64, 100], 20));
    const chord = events(latest.score)[0] as Chord;
    expect(chord.kind).toBe('chord');
    expect(chord.notes.map((x) => x.midi)).toEqual([60, 64]);

    act(() => midiInput.message([0x90, 67, 100], 80));
    act(() => midiInput.message([0x90, 71, 100], 140));
    expect(midis(latest.score)).toEqual(['chord', 67, 71]);
  });

  it('adds a chord note to the note that filled the bar, after the cursor has moved on', async () => {
    const midiInput = new FakeMidiInput();
    const access = new FakeMidiAccess();
    access.inputs.set(midiInput.id, midiInput);
    stubMidiAccess(async () => access);
    const { latest } = mount(doc([n(60), n(62), n(64)], [n(72)]));
    await keyAsync('k');
    act(() => midiInput.message([0x90, 65, 100], 0));
    act(() => midiInput.message([0x90, 69, 100], 20));
    const chord = events(latest.score)[3] as Chord;
    expect(chord.kind).toBe('chord');
    expect(chord.notes.map((x) => x.midi)).toEqual([65, 69]);
    expect(midis(latest.score, 1)).toEqual([72]);
  });

  it('maps a GM percussion note to a stroke on a percussion score', async () => {
    const midiInput = new FakeMidiInput();
    const access = new FakeMidiAccess();
    access.inputs.set(midiInput.id, midiInput);
    stubMidiAccess(async () => access);
    const { latest } = mount(doc([], [], 'perc-conga'), { percussion: true });
    await keyAsync('k');
    // GM 63 (Open Hi Conga) maps to the conga's open-high stroke, midi 64.
    act(() => midiInput.message([0x90, 63, 100], 0));
    expect(midis(latest.score)).toEqual([64]);
  });

  it('shows the fallback text when MIDI access is refused, and an on-screen key click still enters a note (Review Focus 5)', async () => {
    stubMidiAccess(async () => { throw new DOMException('Denied', 'NotAllowedError'); });
    const { latest } = mount(doc([]));
    await keyAsync('k');
    expect(latest.editing.midiStatus).toBe('unavailable');
    act(() => latest.editing.enterMidiPitch?.(72));
    expect(midis(latest.score)).toEqual([72]);
  });
});

// ---- IntegratedEditor: the zoom follows score changes (undo, redo) -------------

describe('IntegratedEditor zoom editing', () => {
  const timings: IntegratedEditorMeasureTiming[] = [0, 1].map((i) => ({
    measureNumber: i + 1, startVideoTimeSeconds: i * 2, endVideoTimeSeconds: i * 2 + 2,
  }));
  function renderEditor(score: ScoreDocument) {
    const dispatch = vi.fn<(a: EditorAction) => void>();
    const onSelectionChange = vi.fn();
    const render = (s: ScoreDocument) => act(() => {
      root.render(
        <IntegratedEditor
          score={s} dispatch={dispatch} measureTimings={timings} pixelsPerSecond={100} scrollLeftPx={0}
          viewportWidth={800} onRequestZoom={vi.fn()} onSelectionChange={onSelectionChange}
        />,
      );
    });
    render(score);
    return { dispatch, onSelectionChange, render };
  }
  const zoomEl = () => host.querySelector('[data-testid="measure-zoom"]');

  it('types into the zoomed bar through the editor’s dispatch', () => {
    const { dispatch } = renderEditor(doc([n(60, 2)], [n(62)]));
    key('ArrowRight');
    key('Enter');
    key('ArrowRight'); // past the half note: the bar's end
    key('d');
    expect(dispatch).toHaveBeenLastCalledWith(expect.objectContaining({
      type: 'write-event', kind: 'note', value: 'q', at: { trackIndex: 0, measureIndex: 0, voice: 0, eventIndex: 'end' },
    }));
  });

  it('clamps the cursor and drops the note selection when the bar shrinks under it', () => {
    const { dispatch, onSelectionChange, render } = renderEditor(doc([n(60), n(62)], [n(64)]));
    key('ArrowRight');
    key('Enter');
    key('ArrowRight'); // cursor on the second note
    expect(onSelectionChange).toHaveBeenLastCalledWith({ ref: { measureIndex: 0, eventIndex: 1 }, trackIndex: 0 });
    render(doc([n(60)], [n(64)])); // an undo took the second note away
    expect(onSelectionChange).toHaveBeenLastCalledWith(null);
    key('e');
    expect(dispatch).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'write-event', at: expect.objectContaining({ eventIndex: 'end' }) }));
  });

  it('closes the zoom when its bar no longer exists', () => {
    const { render } = renderEditor(doc([n(60)], [n(64)]));
    key('ArrowRight');
    key('ArrowRight');
    key('Enter');
    expect(zoomEl()!.querySelector('.st-zoom-head')!.textContent).toContain('m.2');
    const one = doc([n(60)]);
    one.tracks[0].measures.pop();
    render(one);
    expect(zoomEl()).toBeNull();
  });

  it('Esc closes the zoom through the zoom keys', () => {
    renderEditor(doc([n(60)], [n(64)]));
    key('ArrowRight');
    key('Enter');
    expect(zoomEl()).not.toBeNull();
    key('Escape');
    expect(zoomEl()).toBeNull();
  });
});
