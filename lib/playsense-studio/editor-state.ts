// PlaySense Studio — editor state + reducer.
//
// useReducer-based store with a history stack for undo/redo. Each action
// produces a new score; the previous score is pushed to past[]. Undo pops
// past[] back, redo replays from future[]. The state is plain JSON so
// `structuredClone`-equivalent JSON.parse(JSON.stringify(...)) works.

import { useCallback, useReducer } from 'react';
import { repeatGroups } from './repeats';
import { insertMidiMeasures } from './midi-recording';
import { applyMeasureEdit, contextAt, emptyMeasure, type MeasureClip } from './measure-edits';
import { stripCopyTags } from './measure-clipboard';
import { pruneSpans } from './event-ids';
import type {
  Chord,
  Measure,
  MusicalEvent,
  Note,
  Rest,
  ScoreDocument,
  Track,
} from '@/components/playsense-studio/shared/score-model/types';
import {
  QN_EPS,
  effectiveDurationQN,
  isFillerRest,
  measureLengthInQN,
  occupiedQN,
} from './time-mapping';
import { eventDots, tupletScale } from '@/components/playsense-studio/shared/score-model/accessors';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface EditorState {
  score: ScoreDocument;
  /** History for undo. Newest entry is the score BEFORE the most recent action. */
  past: ScoreDocument[];
  /** Pending entries from undo, available to redo. */
  future: ScoreDocument[];
  /** True when the score has changed since the last clean snapshot. */
  isDirty: boolean;
}

export interface MeasurePropsPatch {
  timeSignature?: [number, number];
  keyFifths?: number;
  clef?: 'treble' | 'bass' | 'alto' | 'tenor';
  tempo?: number;
  repeatStart?: boolean;
  repeatEnd?: boolean;
  endBarline?: 'double' | null; // 'final' stays with set-measure-final-bar
  volta?: '1.' | '2.' | null;
}

export type EditorAction =
  | {
      type: 'set-score-meta';
      title?: string;
      composer?: string;
      initialTempo?: number;
      initialTimeSignature?: [number, number];
    }
  | { type: 'set-track-name'; trackIndex: number; name: string }
  | { type: 'set-track-instrument'; trackIndex: number; instrument: Track['instrument'] }
  | { type: 'add-track' }
  | { type: 'delete-track'; trackIndex: number }
  | { type: 'add-measure'; trackIndex: number }
  | { type: 'insert-measure'; trackIndex: number; index: number }
  | { type: 'delete-measures'; trackIndex: number; start: number; count: number }
  /** Reducer no-op: the studio's dispatch wrapper writes the clipboard (it owns the timing). */
  | { type: 'copy-measures'; trackIndex: number; start: number; count: number }
  | { type: 'paste-measures'; trackIndex: number; index: number; clip: MeasureClip }
  | { type: 'append-score'; score: ScoreDocument }
  /** Adopt a structurally edited score computed outside the reducer (the sync
   *  panel pairs it with transformed markers). Refused when the base moved. */
  | { type: 'apply-structural-score'; score: ScoreDocument; expectedScore: ScoreDocument }
  | { type: 'insert-midi-recording'; trackIndex: number; start: number; replaceCount: number; measures: Measure[]; expectedTrack: Track }
  | { type: 'apply-midi-score'; score: ScoreDocument; expectedScore: ScoreDocument }
  | { type: 'repeat-measures'; trackIndex: number; start: number; end: number; count: number; id: string }
  | { type: 'set-repeat-count'; trackIndex: number; id: string; count: number }
  | { type: 'unlink-repeat'; trackIndex: number; id: string }
  | { type: 'set-measure-final-bar'; trackIndex: number; measureIndex: number; final: boolean }
  | { type: 'clear-measures'; trackIndex: number; start: number; count: number }
  | { type: 'set-measure-props'; trackIndex: number; measureIndex: number; props: MeasurePropsPatch }
  | { type: 'set-tempo-marks-confirmed'; confirmed: boolean }
  | { type: 'clear-tempo-marks'; trackIndex: number }
  | { type: 'duplicate-measures'; trackIndex: number; start: number; count: number }
  | {
      type: 'add-note';
      trackIndex: number;
      measureIndex: number;
      midi: number;
      durationQN: number;
      dotted?: boolean;
      triplet?: boolean;
      articulation?: 'staccato' | 'accent' | 'tenuto';
    }
  | { type: 'add-rest'; trackIndex: number; measureIndex: number; durationQN: number; dotted?: boolean; triplet?: boolean }
  | { type: 'set-event-pitch'; trackIndex: number; measureIndex: number; eventIndex: number; midi: number }
  | { type: 'set-event-duration'; trackIndex: number; measureIndex: number; eventIndex: number; durationQN: number }
  | { type: 'set-event-dotted'; trackIndex: number; measureIndex: number; eventIndex: number; dotted: boolean }
  | { type: 'set-event-triplet'; trackIndex: number; measureIndex: number; eventIndex: number; triplet: boolean }
  | { type: 'set-event-tie'; trackIndex: number; measureIndex: number; eventIndex: number; tieToNext: boolean }
  | {
      type: 'set-event-articulation';
      trackIndex: number;
      measureIndex: number;
      eventIndex: number;
      articulation: 'staccato' | 'accent' | 'tenuto' | null;
    }
  | { type: 'convert-event-kind'; trackIndex: number; measureIndex: number; eventIndex: number; to: 'note' | 'rest'; midi?: number }
  | { type: 'delete-event'; trackIndex: number; measureIndex: number; eventIndex: number }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'mark-clean' }
  | { type: 'replace-score'; score: ScoreDocument };

const HISTORY_LIMIT = 100;

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

/** New id for a freshly-created tuplet group (the triplet toggle button). */
function newTupletId(): string {
  return `t${(globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).slice(0, 8)}`;
}

/**
 * The time signature in effect AT a measure, honoring any per-measure overrides
 * carried forward from earlier measures (falls back to the score's initial).
 */
function effectiveTimeSignatureAt(
  track: Track,
  initialTimeSignature: [number, number],
  measureIndex: number
): [number, number] {
  let ts = initialTimeSignature;
  for (let i = 0; i <= measureIndex && i < track.measures.length; i++) {
    if (track.measures[i].timeSignature) ts = track.measures[i].timeSignature!;
  }
  return ts;
}

/** Meter, key, tempo and clef in force just before `index`. */
function inheritedContext(score: ScoreDocument, track: Track, index: number) {
  let timeSignature = score.initialTimeSignature;
  let keyFifths = score.initialKeyFifths;
  let tempo = score.initialTempo;
  let clef: NonNullable<Measure['clef']> = 'treble';
  for (let i = 0; i < index && i < track.measures.length; i++) {
    const m = track.measures[i];
    if (m.timeSignature) timeSignature = m.timeSignature;
    if (m.keyFifths !== undefined) keyFifths = m.keyFifths;
    if (m.tempoChange !== undefined) tempo = m.tempoChange;
    if (m.clef) clef = m.clef;
  }
  return { timeSignature, keyFifths, tempo, clef };
}

/** True if changing one event's length to `nextDuration` would overfill its measure. */
function overflowsMeasure(
  track: Track,
  initialTimeSignature: [number, number],
  measureIndex: number,
  events: MusicalEvent[],
  eventIndex: number,
  nextDuration: number
): boolean {
  const ts = effectiveTimeSignatureAt(track, initialTimeSignature, measureIndex);
  const others = occupiedQN(events) - (events[eventIndex]?.durationQN ?? 0);
  return others + nextDuration > measureLengthInQN(ts) + QN_EPS;
}

function withHistory(state: EditorState, nextScore: ScoreDocument): EditorState {
  // Editing notation in any pass updates the same measure in every pass.
  nextScore.tracks.forEach((track, ti) => {
    track.measures.forEach((measure, mi) => {
      const old = state.score.tracks[ti]?.measures[mi];
      const r = measure.repeat;
      if (!r || !old?.repeat || old.repeat.id !== r.id || old.repeat.offset !== r.offset || old.repeat.pass !== r.pass) return;
      const { number: _n, repeat: _r, ...content } = measure;
      const { number: _on, repeat: _or, ...oldContent } = old;
      if (JSON.stringify(content) === JSON.stringify(oldContent)) return;
      track.measures = track.measures.map(m => m.repeat?.id === r.id && m.repeat.offset === r.offset
        ? { ...clone(content), number: m.number, repeat: m.repeat } : m);
    });
    const valid = new Set(repeatGroups(track).map(g => g.id));
    track.measures.forEach(m => { if (m.repeat && !valid.has(m.repeat.id)) delete m.repeat; });
  });
  const past = [...state.past, state.score].slice(-HISTORY_LIMIT);
  return { score: nextScore, past, future: [], isDirty: true };
}

/**
 * History push for STRUCTURAL edits: measure indices shifted, so the
 * index-keyed cross-pass propagation in withHistory must not run. Repeat
 * metadata that no longer forms a valid group is still stripped. Returns the
 * given score object by identity so callers can key on it.
 */
function pushHistory(state: EditorState, nextScore: ScoreDocument): EditorState {
  nextScore.tracks.forEach((track) => {
    const valid = new Set(repeatGroups(track).map(g => g.id));
    track.measures.forEach(m => { if (m.repeat && !valid.has(m.repeat.id)) delete m.repeat; });
  });
  const past = [...state.past, state.score].slice(-HISTORY_LIMIT);
  return { score: nextScore, past, future: [], isDirty: true };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'undo': {
      if (state.past.length === 0) return state;
      const prev = state.past[state.past.length - 1];
      return {
        score: prev,
        past: state.past.slice(0, -1),
        future: [state.score, ...state.future],
        isDirty: true,
      };
    }
    case 'redo': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        score: next,
        past: [...state.past, state.score],
        future: state.future.slice(1),
        isDirty: true,
      };
    }
    case 'mark-clean':
      return { ...state, isDirty: false };
    case 'replace-score': {
      return { score: action.score, past: [], future: [], isDirty: false };
    }
    case 'apply-midi-score': {
      return state.score === action.expectedScore ? withHistory(state, action.score) : state;
    }
    case 'apply-structural-score': {
      return state.score === action.expectedScore ? pushHistory(state, action.score) : state;
    }
    case 'copy-measures':
      return state;
    case 'insert-midi-recording': {
      if (state.score.tracks[action.trackIndex] !== action.expectedTrack) return state;
      try {
        const next = insertMidiMeasures(state.score, action.trackIndex, action.start, action.replaceCount, action.measures);
        // Structural insertion shifts measure indices; don't propagate repeat edits by old index.
        return { score: next, past: [...state.past, state.score].slice(-HISTORY_LIMIT), future: [], isDirty: true };
      } catch { return state; }
    }
    case 'set-score-meta': {
      const next = clone(state.score);
      if (action.title !== undefined) next.title = action.title;
      if (action.composer !== undefined) next.composer = action.composer;
      if (action.initialTempo !== undefined && Number.isFinite(action.initialTempo)) {
        next.initialTempo = Math.min(400, Math.max(20, Math.round(action.initialTempo)));
      }
      if (action.initialTimeSignature !== undefined) {
        next.initialTimeSignature = action.initialTimeSignature;
      }
      return withHistory(state, next);
    }
    case 'set-track-name': {
      const next = clone(state.score);
      const t = next.tracks[action.trackIndex];
      if (!t) return state;
      t.displayName = action.name;
      return withHistory(state, next);
    }
    case 'set-track-instrument': {
      const next = clone(state.score);
      const t = next.tracks[action.trackIndex];
      if (!t) return state;
      t.instrument = action.instrument;
      return withHistory(state, next);
    }
    case 'add-track': {
      const next = clone(state.score);
      next.tracks.push({
        index: next.tracks.length,
        instrument: 'staff',
        displayName: `Track ${next.tracks.length + 1}`,
        tuning: null,
        stringMultiplicity: 1,
        channel: null,
        defaultView: 'staff',
        measures: [emptyMeasure(1)],
      });
      return withHistory(state, next);
    }
    case 'delete-track': {
      const next = clone(state.score);
      if (next.tracks.length <= 1) return state; // keep at least one
      next.tracks.splice(action.trackIndex, 1);
      next.tracks.forEach((t, i) => (t.index = i));
      return withHistory(state, next);
    }
    case 'add-measure':
    case 'insert-measure':
    case 'delete-measures':
    case 'paste-measures':
    case 'append-score':
    case 'repeat-measures':
    case 'set-repeat-count': {
      const result = applyMeasureEdit(state.score, action);
      return result.ok ? pushHistory(state, result.score) : state;
    }
    case 'unlink-repeat': {
      const next = clone(state.score);
      next.tracks[action.trackIndex]?.measures.forEach(m => { if (m.repeat?.id === action.id) delete m.repeat; });
      return withHistory(state, next);
    }
    case 'set-measure-final-bar': {
      const next = clone(state.score);
      const track = next.tracks[action.trackIndex];
      const measure = track?.measures[action.measureIndex];
      if (!track || !measure) return state;
      // Persist only overrides of the automatic rule so the bar follows the
      // last measure as measures are added or deleted.
      const automatic = action.measureIndex === track.measures.length - 1;
      if (action.final === automatic) delete measure.endBarline;
      else measure.endBarline = action.final ? 'final' : 'single';
      return withHistory(state, next);
    }
    case 'clear-measures': {
      const next = clone(state.score);
      const track = next.tracks[action.trackIndex];
      if (!track || action.count < 1) return state;
      const end = Math.min(track.measures.length, action.start + action.count);
      let changed = false;
      for (let i = Math.max(0, action.start); i < end; i++) {
        const m = track.measures[i];
        if (m.voices.length === 1 && m.voices[0].events.length === 0) continue;
        m.voices = [{ number: 1, events: [] }];
        changed = true;
      }
      if (!changed) return state;
      const result = withHistory(state, next);
      // Prune AFTER withHistory has mirrored this clear onto every other pass —
      // a span whose note only disappeared through that mirroring (not this
      // action's own loop) still needs to be caught.
      const spans = pruneSpans(result.score);
      if (spans) result.score.spans = spans;
      return result;
    }
    case 'set-measure-props': {
      const next = clone(state.score);
      const track = next.tracks[action.trackIndex];
      const m = track?.measures[action.measureIndex];
      if (!track || !m) return state;
      const first = action.measureIndex === 0;
      // A repeat pass must keep its own explicit anchor even when the new
      // value happens to equal what THIS pass alone inherits: withHistory
      // mirrors whatever this bar ends up with onto every other pass sharing
      // its offset, and later passes inherit from the PREVIOUS pass's last
      // bar, not from this one — deleting the override here would leave
      // those passes reading the wrong meter/key/tempo/clef.
      const anchored = !!m.repeat;
      const before = inheritedContext(next, track, action.measureIndex);
      const p = action.props;
      if (p.timeSignature) {
        if (first) next.initialTimeSignature = p.timeSignature;
        const matchesInherited = !first && p.timeSignature[0] === before.timeSignature[0] && p.timeSignature[1] === before.timeSignature[1];
        if ((first || matchesInherited) && !anchored) delete m.timeSignature;
        else m.timeSignature = [p.timeSignature[0], p.timeSignature[1]];
      }
      if (p.keyFifths !== undefined) {
        if (first) next.initialKeyFifths = p.keyFifths;
        const matchesInherited = !first && p.keyFifths === before.keyFifths;
        if ((first || matchesInherited) && !anchored) delete m.keyFifths;
        else m.keyFifths = p.keyFifths;
      }
      if (p.tempo !== undefined && Number.isFinite(p.tempo)) {
        const bpm = Math.max(20, Math.min(400, Math.round(p.tempo)));
        if (first) next.initialTempo = bpm;
        const matchesInherited = !first && bpm === before.tempo;
        if ((first || matchesInherited) && !anchored) delete m.tempoChange;
        else m.tempoChange = bpm;
      }
      if (p.clef) {
        if (p.clef === before.clef && !anchored) delete m.clef;
        else m.clef = p.clef;
      }
      if (p.repeatStart !== undefined) { if (p.repeatStart) m.repeatStart = true; else delete m.repeatStart; }
      if (p.repeatEnd !== undefined) { if (p.repeatEnd) m.repeatEnd = true; else delete m.repeatEnd; }
      if (p.endBarline !== undefined) { if (p.endBarline) m.endBarline = p.endBarline; else if (m.endBarline === 'double') delete m.endBarline; }
      if (p.volta !== undefined) { if (p.volta) m.volta = p.volta; else delete m.volta; }
      if (JSON.stringify(next) === JSON.stringify(state.score)) return state;
      return withHistory(state, next);
    }
    case 'set-tempo-marks-confirmed': {
      if (!!state.score.tempoMarksConfirmed === action.confirmed) return state;
      const next = clone(state.score);
      if (action.confirmed) next.tempoMarksConfirmed = true; else delete next.tempoMarksConfirmed;
      return withHistory(state, next);
    }
    case 'clear-tempo-marks': {
      const next = clone(state.score);
      const track = next.tracks[action.trackIndex];
      if (!track || !track.measures.some((m) => m.tempoChange !== undefined)) return state;
      track.measures.forEach((m) => { delete m.tempoChange; });
      return withHistory(state, next);
    }
    case 'duplicate-measures': {
      const track = state.score.tracks[action.trackIndex];
      if (!track || action.count < 1) return state;
      const measures = track.measures.slice(action.start, action.start + action.count).map((m) => stripCopyTags(clone(m)));
      if (!measures.length) return state;
      const result = applyMeasureEdit(state.score, {
        type: 'paste-measures',
        trackIndex: action.trackIndex,
        index: action.start + measures.length,
        clip: { measures, context: contextAt(state.score, track, action.start), instrument: track.instrument },
      });
      return result.ok ? pushHistory(state, result.score) : state;
    }
    case 'add-note': {
      const next = clone(state.score);
      const track = next.tracks[action.trackIndex];
      const measure = track?.measures[action.measureIndex];
      if (!track || !measure) return state;
      const ts = effectiveTimeSignatureAt(track, next.initialTimeSignature, action.measureIndex);
      // A lone full-measure placeholder rest is replaced by the first real event.
      if (isFillerRest(measure.voices[0].events, ts)) measure.voices[0].events = [];
      const need = effectiveDurationQN(action.durationQN, action);
      if (occupiedQN(measure.voices[0].events) + need > measureLengthInQN(ts) + QN_EPS) {
        return state; // measure full — block (UI also disables the control)
      }
      const note: Note = {
        kind: 'note',
        midi: action.midi,
        durationQN: need,
        ...(action.dotted ? { dotted: true } : {}),
        ...(action.triplet ? { triplet: true } : {}),
        ...(action.articulation ? { articulation: action.articulation } : {}),
      };
      measure.voices[0].events.push(note);
      return withHistory(state, next);
    }
    case 'add-rest': {
      const next = clone(state.score);
      const track = next.tracks[action.trackIndex];
      const measure = track?.measures[action.measureIndex];
      if (!track || !measure) return state;
      const ts = effectiveTimeSignatureAt(track, next.initialTimeSignature, action.measureIndex);
      if (isFillerRest(measure.voices[0].events, ts)) measure.voices[0].events = [];
      const need = effectiveDurationQN(action.durationQN, action);
      if (occupiedQN(measure.voices[0].events) + need > measureLengthInQN(ts) + QN_EPS) {
        return state; // measure full — block
      }
      const rest: Rest = {
        kind: 'rest',
        durationQN: need,
        ...(action.dotted ? { dotted: true } : {}),
        ...(action.triplet ? { triplet: true } : {}),
      };
      measure.voices[0].events.push(rest);
      return withHistory(state, next);
    }
    case 'set-event-pitch': {
      const next = clone(state.score);
      const event = next.tracks[action.trackIndex]?.measures[action.measureIndex]
        ?.voices[0].events[action.eventIndex];
      if (!event) return state;
      if (event.kind === 'note') {
        (event as Note).midi = action.midi;
        delete event.percussion;
        // A spelling names the old pitch; keep it and the note draws there.
        delete (event as Note).spelling;
        delete (event as Note).spellingHint;
      } else if (event.kind === 'chord') {
        const chord = event as Chord;
        if (chord.notes[0]) {
          chord.notes[0].midi = action.midi;
          delete chord.notes[0].percussion;
          delete chord.notes[0].spelling;
          delete chord.notes[0].spellingHint;
        }
      }
      return withHistory(state, next);
    }
    case 'set-event-duration': {
      const next = clone(state.score);
      const track = next.tracks[action.trackIndex];
      const events = track?.measures[action.measureIndex]?.voices[0].events;
      const event = events?.[action.eventIndex];
      if (!track || !events || !event) return state;
      // This recompute only ever consults the LEGACY dotted/triplet flags
      // (effectiveDurationQN doesn't know about dots/tuplet). Drop the new
      // fields so eventDots()/eventTuplet() fall through to the flags that
      // actually drove this duration, keeping durationQN === base × dotFactor
      // × tupletScale true for every reader.
      const nextDuration = effectiveDurationQN(action.durationQN, {
        dotted: event.dotted,
        triplet: event.triplet,
      });
      if (overflowsMeasure(track, next.initialTimeSignature, action.measureIndex, events, action.eventIndex, nextDuration)) {
        return state; // would exceed the measure — keep it valid
      }
      delete event.dots;
      delete event.tuplet;
      event.durationQN = nextDuration;
      return withHistory(state, next);
    }
    case 'set-event-dotted': {
      const next = clone(state.score);
      const track = next.tracks[action.trackIndex];
      const events = track?.measures[action.measureIndex]?.voices[0].events;
      const event = events?.[action.eventIndex];
      if (!track || !events || !event) return state;
      // The dot toggle is single-dot only; `dots` (which can hold a double
      // dot from import) is retired here so `dotted` becomes the sole source
      // of truth again, per eventDots()'s precedence.
      const oldFactor = eventDots(event) === 2 ? 1.75 : eventDots(event) === 1 ? 1.5 : 1;
      const newFactor = action.dotted ? 1.5 : 1;
      const nextDuration = (event.durationQN / oldFactor) * newFactor;
      if (oldFactor !== newFactor && overflowsMeasure(track, next.initialTimeSignature, action.measureIndex, events, action.eventIndex, nextDuration)) {
        return state;
      }
      delete event.dots;
      event.dotted = action.dotted;
      event.durationQN = nextDuration;
      return withHistory(state, next);
    }
    case 'set-event-triplet': {
      const next = clone(state.score);
      const track = next.tracks[action.trackIndex];
      const events = track?.measures[action.measureIndex]?.voices[0].events;
      const event = events?.[action.eventIndex];
      if (!track || !events || !event) return state;
      // Reverse whatever tuplet scale is actually in effect (an imported
      // event may carry a non-3:2 `tuplet`), not just an assumed 2/3, so
      // durationQN stays consistent with eventTuplet()/tupletScale() no
      // matter what this event started as.
      const oldScale = tupletScale(event);
      const newScale = action.triplet ? 2 / 3 : 1;
      const nextDuration = (event.durationQN / oldScale) * newScale;
      if (oldScale !== newScale && overflowsMeasure(track, next.initialTimeSignature, action.measureIndex, events, action.eventIndex, nextDuration)) {
        return state;
      }
      if (action.triplet) {
        event.tuplet = { id: event.tuplet?.id ?? newTupletId(), n: 3, m: 2 };
        event.triplet = true;
      } else {
        delete event.tuplet;
        delete event.triplet;
      }
      event.durationQN = nextDuration;
      return withHistory(state, next);
    }
    case 'set-event-tie': {
      const next = clone(state.score);
      const event = next.tracks[action.trackIndex]?.measures[action.measureIndex]
        ?.voices[0].events[action.eventIndex];
      if (!event || event.kind === 'rest') return state;
      event.tieToNext = action.tieToNext;
      return withHistory(state, next);
    }
    case 'set-event-articulation': {
      const next = clone(state.score);
      const event = next.tracks[action.trackIndex]?.measures[action.measureIndex]
        ?.voices[0].events[action.eventIndex];
      if (!event || event.kind === 'rest') return state;
      if (action.articulation === null) delete event.articulation;
      else event.articulation = action.articulation;
      return withHistory(state, next);
    }
    case 'convert-event-kind': {
      const next = clone(state.score);
      const voice = next.tracks[action.trackIndex]?.measures[action.measureIndex]?.voices[0];
      const event = voice?.events[action.eventIndex];
      if (!voice || !event) return state;
      if (action.to === 'rest') {
        if (event.kind === 'rest') return state;
        const rest: Rest = {
          kind: 'rest',
          durationQN: event.durationQN,
          ...(event.id ? { id: event.id } : {}),
          ...(event.dotted ? { dotted: true } : {}),
          ...(event.dots ? { dots: event.dots } : {}),
          ...(event.triplet ? { triplet: true } : {}),
          ...(event.tuplet ? { tuplet: event.tuplet } : {}),
        };
        voice.events[action.eventIndex] = rest;
      } else {
        if (event.kind === 'note' || event.kind === 'chord') return state;
        const note: Note = {
          kind: 'note',
          midi: action.midi ?? 60,
          durationQN: event.durationQN,
          ...(event.id ? { id: event.id } : {}),
          ...(event.dotted ? { dotted: true } : {}),
          ...(event.dots ? { dots: event.dots } : {}),
          ...(event.triplet ? { triplet: true } : {}),
          ...(event.tuplet ? { tuplet: event.tuplet } : {}),
        };
        voice.events[action.eventIndex] = note;
      }
      return withHistory(state, next);
    }
    case 'delete-event': {
      const next = clone(state.score);
      const measure = next.tracks[action.trackIndex]?.measures[action.measureIndex];
      if (!measure) return state;
      measure.voices[0].events.splice(action.eventIndex, 1);
      // Leave the measure empty (a blank staff) rather than backfilling a rest —
      // the author adds the next note straight into the free space.
      return withHistory(state, next);
    }
    default:
      return state;
  }
}


// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useEditor(initialScore: ScoreDocument) {
  const [state, dispatch] = useReducer(editorReducer, undefined, () => ({
    score: clone(initialScore),
    past: [],
    future: [],
    isDirty: false,
  }));

  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const redo = useCallback(() => dispatch({ type: 'redo' }), []);
  const markClean = useCallback(() => dispatch({ type: 'mark-clean' }), []);
  const replaceScore = useCallback(
    (score: ScoreDocument) => dispatch({ type: 'replace-score', score }),
    []
  );

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  return { state, dispatch, undo, redo, markClean, replaceScore, canUndo, canRedo };
}
