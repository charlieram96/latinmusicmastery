'use client';

// PlaySense Studio — note editing inside the measure zoom (v6's enterLetter,
// enterRest, setDuration, cycleDots, applyTuplet, toggleTie, addSpan,
// transposeSel, setAccidental and deleteNote). One set of handlers serves the
// zoom's keys (registered here while the zoom is open) and its toolbar.
//
// The handlers read the latest options through a ref (the use-measure-keys
// pattern), so neither the key listener nor a toolbar button holds a stale
// score. Where the reducer would refuse an edit, the refusal is predicted by
// running the reducer itself on the current score (never a loose copy of its
// rules), and a flash says why instead of the edit silently doing nothing.

import { useEffect, useLayoutEffect, useMemo, useRef, type Dispatch } from 'react';
import type {
  Articulation,
  Dynamic,
  MusicalEvent,
  Ornament,
  PercussionNotation,
  ScoreDocument,
} from '@/components/playsense-studio/shared/score-model/types';
import { eventDots, eventTuplet } from '@/components/playsense-studio/shared/score-model/accessors';
import { editorReducer, type EditorAction, type EditorState, type EventRef } from '@/lib/playsense-studio/editor-state';
import {
  advanceCursor,
  clampCursor,
  cursorRange,
  entryReference,
  walkCursor,
  type CursorContext,
  type NoteCursor,
} from '@/lib/playsense-studio/note-cursor';
import { getPercStrokes, resolvePercStroke, strokeNotation } from '@/lib/playsense-studio/perc-strokes';
import { CLEF_REF_INDEX, letterAbove, letterPitch, pitchIndex, type Pitch } from '@/lib/playsense-studio/pitch';
import { soundingQN, VALUE_NAME, writtenValue, type NoteValue } from '@/lib/playsense-studio/rhythm';
import { legacyTripletGroupAt } from '@/lib/playsense-studio/legacy-triplets';
import type { NotationClef } from '@/lib/playsense-studio/score-to-vexflow';
import { isFillerRest, occupiedQN, QN_EPS } from '@/lib/playsense-studio/time-mapping';
import { isTypingTarget } from '@/lib/playsense-studio/typing-target';
import { zoomIntent, type ZoomIntent } from '@/lib/playsense-studio/zoom-keys';
import type { ZoomState } from './measure-zoom';

export interface ZoomEditing {
  enterLetter(letter: string, chord: boolean): void;
  /** The pencil's click: append this pitch at the end of the cursor's bar and voice (the letter path's fit check and flash). */
  enterPitch(midi: number, spelling: Pitch['spelling']): void;
  enterRest(): void;
  /** Percussion entry: the stroke's midi. */
  enterStroke(midi: number): void;
  setValue(value: NoteValue): void;
  cycleDots(to?: 0 | 1 | 2): void;
  tuplet(n: number, m: number): void;
  toggleTie(): void;
  slur(type: 'slur' | 'cresc' | 'dim'): void;
  transpose(how: 'step' | 'semi' | 'oct', dir: 1 | -1): void;
  accidental(alter: -2 | -1 | 0 | 1 | 2): void;
  articulation(a: Articulation): void;
  ornament(o: Ornament): void;
  dynamic(d: Dynamic): void;
  text(t: string | null): void;
  grace(slash: boolean): void;
  remove(back: boolean): void;
  walk(dir: 1 | -1, extend: boolean): void;
  bar(dir: 1 | -1): void;
  selectedRefs(): EventRef[];
  currentEvent(): MusicalEvent | null;
  /** The event at `eventIndex` of `voice` in the zoomed bar, with its ref (the zoom's pointer). */
  eventAt(voice: 0 | 1, eventIndex: number): { ref: EventRef; event: MusicalEvent } | null;
}

export interface ZoomEditingOptions {
  score: ScoreDocument;
  dispatch: Dispatch<EditorAction>;
  trackIndex: number;
  zoom: ZoomState | null;
  setZoom: (z: ZoomState | null) => void;
  keyFifthsAt: (m: number) => number;
  clefAt: (m: number) => NotationClef;
  barQNAt: (m: number) => number;
  percussion: boolean;
  flash: (msg: string) => void;
  /** Move the zoom to bar `index` (zooms the waveform and slides the bar in). */
  openBar: (index: number, dir: 1 | -1) => void;
  /** Close the zoom (with its exit animation). */
  close: () => void;
}

export const MSG_PICK_STROKE = 'Pick a stroke in the toolbar';
export const MSG_SELECT_NOTE = 'Select a note first.';
export const MSG_TIE_FROM = 'Select a note to tie from.';
export const MSG_NO_NEXT = 'There’s no next note to end on.';
export const MSG_RHYTHM_REFUSED = 'Remove the tuplet first, or make room in the bar';
export const MSG_TUPLET_DOTTED = 'Tuplets need an undotted note.';
export const MSG_TUPLET_MERGE = 'That group doesn’t add up to one note value.';
export const barFullMessage = (measureNumber: number) => `m.${measureNumber} is full — shorten a note or pick a smaller value`;
export const tupletSplitMessage = (name: string, n: number, m: number) => `A ${name} can’t be split ${n}:${m}. Try a longer note.`;

// ---- Pure helpers over the options ----------------------------------------------

function trackOf(o: ZoomEditingOptions) {
  return o.score.tracks[o.trackIndex];
}

function voiceEvents(o: ZoomEditingOptions, m: number, v: 0 | 1): MusicalEvent[] {
  return trackOf(o)?.measures[m]?.voices[v]?.events ?? [];
}

function contextOf(o: ZoomEditingOptions): CursorContext {
  return {
    count: trackOf(o)?.measures.length ?? 0,
    events: (m, v) => voiceEvents(o, m, v),
    barQN: o.barQNAt,
  };
}

/** The context with one bar/voice's events replaced (a prediction of an edit). */
function contextWith(ctx: CursorContext, m: number, v: 0 | 1, events: MusicalEvent[]): CursorContext {
  return { ...ctx, events: (mm, vv) => (mm === m && vv === v ? events : ctx.events(mm, vv)) };
}

/** A lone full-bar placeholder rest in voice 1 (the reducer replaces it on the first append). */
function isFiller(events: MusicalEvent[], voice: 0 | 1, barQN: number): boolean {
  // measureLengthInQN([barQN, 4]) === barQN.
  return voice === 0 && isFillerRest(events, [barQN, 4]);
}

function refAt(o: ZoomEditingOptions, c: NoteCursor, eventIndex: number): EventRef {
  return { trackIndex: o.trackIndex, measureIndex: c.measureIndex, voice: c.voice, eventIndex };
}

function selectedRefsOf(o: ZoomEditingOptions): EventRef[] {
  if (!o.zoom) return [];
  const c = o.zoom.cursor;
  const len = voiceEvents(o, c.measureIndex, c.voice).length;
  return cursorRange(c, len).filter((i) => i >= 0 && i < len).map((i) => refAt(o, c, i));
}

function eventOf(o: ZoomEditingOptions, r: EventRef): MusicalEvent | undefined {
  return voiceEvents(o, r.measureIndex, r.voice)[r.eventIndex];
}

function currentEventOf(o: ZoomEditingOptions): MusicalEvent | null {
  if (!o.zoom) return null;
  const c = o.zoom.cursor;
  return c.index === 'end' ? null : voiceEvents(o, c.measureIndex, c.voice)[c.index] ?? null;
}

const isPitched = (e: MusicalEvent | undefined): boolean => !!e && e.kind !== 'rest';

/** True when the reducer would change the score for `action`. */
function wouldChange(score: ScoreDocument, action: EditorAction): boolean {
  const state: EditorState = { score, past: [], future: [], isDirty: false };
  return editorReducer(state, action) !== state;
}

function sameCursor(a: NoteCursor, b: NoteCursor): boolean {
  return a.measureIndex === b.measureIndex && a.voice === b.voice && a.index === b.index && a.anchor === b.anchor;
}

// ---- The hook -------------------------------------------------------------------------

export function useZoomEditing(opts: ZoomEditingOptions): ZoomEditing {
  const ref = useRef(opts);
  useLayoutEffect(() => {
    ref.current = opts;
  });

  // The zoom tracks its bar by index: when the score changes under it (undo,
  // redo, an edit elsewhere), clamp the cursor to what's there now. A bar
  // that's gone entirely is the editor's to close.
  const { score, zoom, setZoom, trackIndex, barQNAt } = opts;
  useLayoutEffect(() => {
    if (!zoom) return;
    const o = { ...ref.current, score, zoom, trackIndex, barQNAt };
    const ctx = contextOf(o);
    if (zoom.measureIndex >= ctx.count) return;
    const clamped = clampCursor(zoom.cursor, ctx);
    if (!sameCursor(clamped, zoom.cursor)) setZoom({ ...zoom, cursor: clamped });
  }, [score, zoom, setZoom, trackIndex, barQNAt]);

  const editing = useMemo<ZoomEditing>(() => {
    const get = () => ref.current;

    const setCursor = (o: ZoomEditingOptions, cursor: NoteCursor) => {
      if (o.zoom) o.setZoom({ ...o.zoom, cursor });
    };

    /** Put the cursor at `next`, moving the zoom (and the waveform) when it changes bar. */
    const moveTo = (o: ZoomEditingOptions, next: NoteCursor, dir: 1 | -1) => {
      const z = o.zoom;
      if (!z) return;
      if (next.measureIndex !== z.measureIndex) {
        o.setZoom({ ...z, measureIndex: next.measureIndex, cursor: next });
        o.openBar(next.measureIndex, dir);
      } else {
        o.setZoom({ ...z, cursor: next });
      }
    };

    /** Dispatch `action` when the reducer would take it; false when it would refuse. */
    const attempt = (o: ZoomEditingOptions, action: EditorAction): boolean => {
      if (!wouldChange(o.score, action)) return false;
      o.dispatch(action);
      return true;
    };

    const measureNumber = (o: ZoomEditingOptions, m: number) => trackOf(o)?.measures[m]?.number ?? m + 1;

    /**
     * Write at the cursor: over an event (then advance), or appended at the
     * end when it fits (then on to the next bar once this one is full). A
     * bar holding only a filler rest is written through the append, which
     * replaces the filler (overwriting it would fill the whole bar).
     * `append` writes at the end whatever the cursor sits on (the pencil).
     */
    const enter = (o: ZoomEditingOptions, write: {
      kind: 'note' | 'rest'; midi?: number; percussion?: PercussionNotation;
      spelling?: { step: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'; alter: -2 | -1 | 0 | 1 | 2 };
    }, append = false) => {
      const z = o.zoom;
      if (!z) return;
      const c: NoteCursor = append ? { ...z.cursor, index: 'end', anchor: null } : z.cursor;
      const ctx = contextOf(o);
      const events = ctx.events(c.measureIndex, c.voice);
      const barQN = ctx.barQN(c.measureIndex);
      const filler = isFiller(events, c.voice, barQN);
      const pitch = write.kind === 'note'
        ? { midi: write.midi, ...(write.spelling ? { spelling: write.spelling } : {}), ...(write.percussion ? { percussion: write.percussion } : {}) }
        : {};

      if (c.index !== 'end' && !filler) {
        o.dispatch({ type: 'write-event', at: { ...refAt(o, c, c.index) }, kind: write.kind, ...pitch });
        moveTo(o, advanceCursor(c, ctx), 1);
        return;
      }

      const base = filler ? [] : events;
      const add = soundingQN(z.value, z.dots);
      if (occupiedQN(base) + add > barQN + QN_EPS) {
        o.flash(barFullMessage(measureNumber(o, c.measureIndex)));
        return;
      }
      o.dispatch({
        type: 'write-event',
        at: { trackIndex: o.trackIndex, measureIndex: c.measureIndex, voice: c.voice, eventIndex: 'end' },
        kind: write.kind, ...pitch, value: z.value, dots: z.dots,
      });
      const predicted: MusicalEvent[] = [...base, write.kind === 'note' ? { kind: 'note', midi: write.midi ?? 60, durationQN: add } : { kind: 'rest', durationQN: add }];
      const at: NoteCursor = { ...c, index: 'end', anchor: null };
      if (occupiedQN(predicted) >= barQN - QN_EPS) moveTo(o, advanceCursor(at, contextWith(ctx, c.measureIndex, c.voice, predicted)), 1);
      else setCursor(o, at);
    };

    /** The note or chord the cursor sits on, else the one right before it. */
    const chordTarget = (o: ZoomEditingOptions): { ref: EventRef; event: MusicalEvent } | null => {
      const c = o.zoom!.cursor;
      const events = voiceEvents(o, c.measureIndex, c.voice);
      const at = c.index === 'end' ? events.length : c.index;
      for (const i of [at, at - 1]) {
        const e = events[i];
        if (i >= 0 && isPitched(e)) return { ref: refAt(o, c, i), event: e };
      }
      return null;
    };

    /** The selected refs holding a note or chord; flashes when there are none. */
    const pitchedRefs = (o: ZoomEditingOptions, msg = MSG_SELECT_NOTE): EventRef[] | null => {
      const refs = selectedRefsOf(o).filter((r) => isPitched(eventOf(o, r)));
      if (!refs.length) {
        o.flash(msg);
        return null;
      }
      return refs;
    };

    const anyRefs = (o: ZoomEditingOptions): EventRef[] | null => {
      const refs = selectedRefsOf(o);
      if (!refs.length) {
        o.flash(MSG_SELECT_NOTE);
        return null;
      }
      return refs;
    };

    const api: ZoomEditing = {
      enterLetter(letter, chord) {
        const o = get();
        const z = o.zoom;
        if (!z) return;
        // Letters never write a pitch on a drum part (Review Focus 4).
        if (o.percussion) {
          o.flash(MSG_PICK_STROKE);
          return;
        }
        const m = z.cursor.measureIndex;
        const key = o.keyFifthsAt(m);
        if (chord) {
          const target = chordTarget(o);
          if (target) {
            const notes = target.event.kind === 'chord' ? target.event.notes : target.event.kind === 'note' ? [target.event] : [];
            const top = notes.reduce((a, b) => (b.midi > a.midi ? b : a));
            const p = letterAbove(letter, pitchIndex(top.midi, top.spelling, key), key);
            o.dispatch({ type: 'add-chord-note', ref: target.ref, midi: p.midi, spelling: p.spelling });
            return;
          }
        }
        const near = entryReference(z.cursor, contextOf(o), key, CLEF_REF_INDEX[o.clefAt(m)]);
        const p = letterPitch(letter, near, key);
        enter(o, { kind: 'note', midi: p.midi, spelling: p.spelling });
      },

      enterPitch(midi, spelling) {
        const o = get();
        if (!o.zoom) return;
        // Pitches never land on a drum part (Review Focus 4); strokes come from the toolbar.
        if (o.percussion) {
          o.flash(MSG_PICK_STROKE);
          return;
        }
        enter(o, { kind: 'note', midi, spelling }, true);
      },

      enterRest() {
        enter(get(), { kind: 'rest' });
      },

      enterStroke(midi) {
        const o = get();
        const instrument = trackOf(o)?.instrument;
        const stroke = instrument ? getPercStrokes(instrument)?.find((s) => s.midi === midi) : undefined;
        enter(o, { kind: 'note', midi, ...(stroke ? { percussion: strokeNotation(stroke) } : {}) });
      },

      setValue(value) {
        const o = get();
        const z = o.zoom;
        if (!z) return;
        o.setZoom({ ...z, value });
        const refs = selectedRefsOf(o);
        if (!refs.length) return;
        const already = refs.every((r) => {
          const e = eventOf(o, r)!;
          return !eventTuplet(e) && Math.abs(e.durationQN - soundingQN(value, eventDots(e))) < QN_EPS;
        });
        if (already) return;
        if (!attempt(o, { type: 'set-events-rhythm', refs, value })) o.flash(MSG_RHYTHM_REFUSED);
      },

      cycleDots(to) {
        const o = get();
        const z = o.zoom;
        if (!z) return;
        const next = (d: 0 | 1 | 2): 0 | 1 | 2 => (to !== undefined ? (d === to ? 0 : to) : (((d + 1) % 3) as 0 | 1 | 2));
        const refs = selectedRefsOf(o);
        if (!refs.length) {
          o.setZoom({ ...z, dots: next(z.dots) });
          return;
        }
        const dots = next(eventDots(eventOf(o, refs[0])!));
        // The only refusal left for dots alone is an overflow.
        if (!attempt(o, { type: 'set-events-rhythm', refs, dots })) {
          const changes = refs.some((r) => eventDots(eventOf(o, r)!) !== dots);
          if (changes) o.flash(barFullMessage(measureNumber(o, z.cursor.measureIndex)));
        }
      },

      tuplet(n, m) {
        const o = get();
        const z = o.zoom;
        if (!z) return;
        const c = z.cursor;
        const ctx = contextOf(o);
        const events = ctx.events(c.measureIndex, c.voice);
        if (c.index === 'end') {
          // Nothing under the cursor: append a rest of the current value and
          // split it, in one action so one undo takes both back.
          const barQN = ctx.barQN(c.measureIndex);
          const base = isFiller(events, c.voice, barQN) ? [] : events;
          if (occupiedQN(base) + soundingQN(z.value, 0) > barQN + QN_EPS) {
            o.flash(barFullMessage(measureNumber(o, c.measureIndex)));
            return;
          }
          const at = { trackIndex: o.trackIndex, measureIndex: c.measureIndex, voice: c.voice, eventIndex: 'end' as const };
          const apply: EditorAction = { type: 'apply-tuplet', at, value: z.value, n, m };
          if (!wouldChange(o.score, apply)) {
            o.flash(tupletSplitMessage(VALUE_NAME[z.value].toLowerCase(), n, m));
            return;
          }
          o.dispatch(apply);
          // The cursor sits on the group's first note: the appended rest.
          setCursor(o, { ...c, index: base.length, anchor: null });
          return;
        }
        const index = c.index;
        const e = events[index];
        if (!e) return;
        const apply: EditorAction = { type: 'apply-tuplet', ref: refAt(o, c, index), n, m };
        if (!wouldChange(o.score, apply)) {
          const written = writtenValue(e);
          o.flash(
            eventTuplet(e) ? MSG_TUPLET_MERGE
              : eventDots(e) > 0 ? MSG_TUPLET_DOTTED
                : tupletSplitMessage(written ? VALUE_NAME[written].toLowerCase() : 'note', n, m),
          );
          return;
        }
        o.dispatch(apply);
        // The cursor sits on the group's first note (a merge lands there too).
        const t = eventTuplet(e);
        const first = t?.id ? events.findIndex((x) => eventTuplet(x)?.id === t.id)
          : t ? (legacyTripletGroupAt(events, index)?.[0] ?? index) : index;
        setCursor(o, { ...c, index: first >= 0 ? first : index, anchor: null });
      },

      toggleTie() {
        const o = get();
        const z = o.zoom;
        if (!z) return;
        const refs = selectedRefsOf(o);
        const c = z.cursor;
        const r = c.index === 'end' ? refs[refs.length - 1] : refAt(o, c, c.index);
        if (!r || !isPitched(eventOf(o, r))) {
          o.flash(MSG_TIE_FROM);
          return;
        }
        o.dispatch({ type: 'toggle-event-tie', ref: r });
      },

      slur(type) {
        const o = get();
        const refs = anyRefs(o);
        if (!refs) return;
        const from = refs[0];
        const to = refs.length > 1 ? refs[refs.length - 1] : undefined;
        if (!attempt(o, { type: 'toggle-span', spanType: type, from, ...(to ? { to } : {}) }) && !to) o.flash(MSG_NO_NEXT);
      },

      transpose(how, dir) {
        const o = get();
        const refs = pitchedRefs(o);
        if (!refs) return;
        if (o.percussion) {
          // A drum part has no pitch to move: ↑/↓ step through the instrument's
          // strokes instead (the old editor's stepSelectedPitch).
          const instrument = trackOf(o)?.instrument;
          const strokes = (instrument && getPercStrokes(instrument)) || [];
          if (!instrument || !strokes.length) return;
          for (const r of refs) {
            const e = eventOf(o, r);
            if (e?.kind !== 'note') continue; // a stacked stroke (chord) keeps its strokes
            const id = resolvePercStroke(instrument, e)?.id;
            const at = strokes.findIndex((s) => s.id === id);
            const next = strokes[Math.min(Math.max(at + dir, 0), strokes.length - 1)];
            if (!next || (at >= 0 && strokes[at] === next)) continue;
            o.dispatch({ type: 'write-event', at: r, kind: 'note', midi: next.midi, percussion: strokeNotation(next) });
          }
          return;
        }
        o.dispatch({ type: 'transpose-events', refs, kind: how, dir, keyFifths: o.keyFifthsAt(refs[0].measureIndex) });
      },

      accidental(alter) {
        const o = get();
        if (o.percussion) return; // strokes have no accidentals
        const refs = pitchedRefs(o);
        if (!refs) return;
        o.dispatch({ type: 'set-events-accidental', refs, alter, keyFifths: o.keyFifthsAt(refs[0].measureIndex) });
      },

      articulation(a) {
        const o = get();
        const refs = pitchedRefs(o);
        if (refs) o.dispatch({ type: 'toggle-events-articulation', refs, articulation: a });
      },

      ornament(orn) {
        const o = get();
        const refs = pitchedRefs(o);
        if (!refs) return;
        const same = eventOf(o, refs[0])?.ornament === orn;
        o.dispatch({ type: 'set-events-ornament', refs, ornament: same ? null : orn });
      },

      dynamic(d) {
        const o = get();
        const refs = anyRefs(o);
        if (!refs) return;
        const same = eventOf(o, refs[0])?.dynamic === d;
        o.dispatch({ type: 'set-events-dynamic', refs, dynamic: same ? null : d });
      },

      text(t) {
        const o = get();
        const refs = anyRefs(o);
        if (refs) o.dispatch({ type: 'set-event-text', ref: refs[0], text: t });
      },

      grace(slash) {
        const o = get();
        const refs = pitchedRefs(o);
        if (refs) o.dispatch({ type: 'toggle-event-grace', ref: refs[0], slash, keyFifths: o.keyFifthsAt(refs[0].measureIndex) });
      },

      remove(back) {
        const o = get();
        const z = o.zoom;
        if (!z) return;
        const c = z.cursor;
        const ctx = contextOf(o);
        const events = ctx.events(c.measureIndex, c.voice);
        if (c.index === 'end' && c.anchor === null) {
          // ⌫ at the end takes the last event; Delete there has nothing ahead of it.
          if (!back || !events.length) return;
          o.dispatch({ type: 'delete-events', refs: [refAt(o, c, events.length - 1)] });
          setCursor(o, { ...c, index: 'end', anchor: null });
          return;
        }
        const refs = selectedRefsOf(o);
        if (!refs.length) return;
        o.dispatch({ type: 'delete-events', refs });
        const gone = new Set(refs.map((r) => r.eventIndex));
        const left = events.filter((_, i) => !gone.has(i));
        // The cursor stays where the range started: on what followed it, or the end.
        const next = clampCursor({ ...c, index: Math.min(...gone), anchor: null }, contextWith(ctx, c.measureIndex, c.voice, left));
        setCursor(o, next);
      },

      walk(dir, extend) {
        const o = get();
        if (!o.zoom) return;
        moveTo(o, walkCursor(o.zoom.cursor, dir, extend, contextOf(o)), dir);
      },

      bar(dir) {
        const o = get();
        const z = o.zoom;
        if (!z) return;
        const target = z.measureIndex + dir;
        const ctx = contextOf(o);
        if (target < 0 || target >= ctx.count) return;
        const voice = z.cursor.voice;
        const index = dir === 1 && ctx.events(target, voice).length ? 0 : 'end';
        moveTo(o, { measureIndex: target, voice, index, anchor: null }, dir);
      },

      selectedRefs: () => selectedRefsOf(get()),
      currentEvent: () => currentEventOf(get()),
      eventAt(voice, eventIndex) {
        const o = get();
        if (!o.zoom) return null;
        const m = o.zoom.measureIndex;
        const event = voiceEvents(o, m, voice)[eventIndex];
        return event ? { ref: { trackIndex: o.trackIndex, measureIndex: m, voice, eventIndex }, event } : null;
      },
    };
    return api;
  }, []);

  // The zoom's keys, while it's open. Anything typed into a field is left alone (Review Focus 5).
  const open = zoom !== null;
  useEffect(() => {
    if (!open) return;
    const run = (intent: ZoomIntent) => {
      const o = ref.current;
      switch (intent.kind) {
        case 'letter': return editing.enterLetter(intent.letter, intent.chord);
        case 'value': return editing.setValue(intent.value);
        case 'rest': return editing.enterRest();
        case 'dots': return editing.cycleDots();
        case 'triplet': return editing.tuplet(3, 2);
        case 'tie': return editing.toggleTie();
        case 'slur': return editing.slur('slur');
        case 'pencil': return o.zoom && o.setZoom({ ...o.zoom, pencil: !o.zoom.pencil });
        case 'walk': return editing.walk(intent.dir, intent.extend);
        case 'bar': return editing.bar(intent.dir);
        case 'transpose': return editing.transpose(intent.how, intent.dir);
        case 'delete': return editing.remove(intent.back);
        case 'close': return o.close();
      }
    };
    const handler = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const intent = zoomIntent(e);
      if (!intent) return;
      e.preventDefault();
      run(intent);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, editing]);

  return editing;
}
