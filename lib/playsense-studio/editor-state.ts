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
import { ensureScoreEventIds, newEventId, passEventId, pruneSpans, withPassIds } from './event-ids';
import type {
  Articulation,
  Chord,
  Dynamic,
  Measure,
  MusicalEvent,
  Note,
  Ornament,
  PercussionNotation,
  Rest,
  ScoreDocument,
  Spelling,
  Track,
} from '@/components/playsense-studio/shared/score-model/types';
import {
  QN_EPS,
  effectiveDurationQN,
  isFillerRest,
  measureLengthInQN,
  occupiedQN,
} from './time-mapping';
import { eventArticulations, eventDots, eventSpelling, eventTuplet, tupletScale } from '@/components/playsense-studio/shared/score-model/accessors';
import { octavePitch, semitonePitch, spelledMidi, stepPitch, type Pitch } from './pitch';
import { VALUE_QN, soundingQN, valueFromQN, writtenValue, type NoteValue } from './rhythm';
import { spellMidi } from './notation/accidentals';
import { legacyTripletGroupAt } from './legacy-triplets';

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

/** One event in the score, addressed by bar, voice (0 = graded voice 1, 1 = voice 2) and index. */
export interface EventRef { trackIndex: number; measureIndex: number; voice: 0 | 1; eventIndex: number }
/** Where a written event lands: over an existing event, or appended at the voice's end. */
export interface EntryAt { trackIndex: number; measureIndex: number; voice: 0 | 1; eventIndex: number | 'end' }

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
  // Voice-aware note entry (the measure zoom). The actions above stay for the
  // piano roll and the older controls.
  | {
      type: 'write-event';
      at: EntryAt;
      kind: 'note' | 'rest';
      midi?: number;
      spelling?: Spelling;
      percussion?: PercussionNotation;
      value?: NoteValue;
      dots?: 0 | 1 | 2;
    }
  | { type: 'add-chord-note'; ref: EventRef; midi: number; spelling?: Spelling }
  | { type: 'set-events-rhythm'; refs: EventRef[]; value?: NoteValue; dots?: 0 | 1 | 2 }
  | { type: 'transpose-events'; refs: EventRef[]; kind: 'step' | 'semi' | 'oct'; dir: 1 | -1; keyFifths: number }
  | { type: 'set-events-accidental'; refs: EventRef[]; alter: -2 | -1 | 0 | 1 | 2; keyFifths: number }
  | { type: 'set-event-pitches'; ref: EventRef; midis: number[] }
  | { type: 'delete-events'; refs: EventRef[] }
  // Marks, tuplets and spans (the measure zoom's toolbar and More ▾ tabs).
  | { type: 'toggle-events-articulation'; refs: EventRef[]; articulation: Articulation }
  | { type: 'set-events-ornament'; refs: EventRef[]; ornament: Ornament | null }
  | { type: 'set-events-dynamic'; refs: EventRef[]; dynamic: Dynamic | null }
  | { type: 'set-event-text'; ref: EventRef; text: string | null }
  | { type: 'toggle-event-grace'; ref: EventRef; slash: boolean; keyFifths: number }
  | { type: 'toggle-event-tie'; ref: EventRef }
  | { type: 'apply-tuplet'; ref: EventRef; n: number; m: number }
  /** A tuplet at the voice's end: appends a rest of `value` and splits it, as one undo step. */
  | { type: 'apply-tuplet'; at: EntryAt; value: NoteValue; n: number; m: number }
  | { type: 'toggle-span'; spanType: 'slur' | 'cresc' | 'dim'; from: EventRef; to?: EventRef }
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

// ---------------------------------------------------------------------------
// Voice-aware note entry helpers (the measure zoom)
// ---------------------------------------------------------------------------

/** A bar's events in one voice; `create` adds an empty voice 2 when it's missing. */
function voiceEvents(track: Track, measureIndex: number, voice: 0 | 1, create = false): MusicalEvent[] | null {
  const m = track.measures[measureIndex];
  if (!m) return null;
  if (!m.voices[voice]) {
    if (!create || voice !== 1) return null;
    m.voices[1] = { number: 2, events: [] };
  }
  return m.voices[voice].events;
}

function barLengthQN(score: ScoreDocument, track: Track, measureIndex: number): number {
  return measureLengthInQN(effectiveTimeSignatureAt(track, score.initialTimeSignature, measureIndex));
}

const voiceKey = (r: EventRef) => `${r.trackIndex}:${r.measureIndex}:${r.voice}`;
const refKey = (r: EventRef) => `${voiceKey(r)}:${r.eventIndex}`;

type ResolvedRef = EventRef & { event: MusicalEvent; events: MusicalEvent[] };

/** The refs that point at an event in `score`, once each, in the order given. */
function resolveRefs(score: ScoreDocument, refs: EventRef[]): ResolvedRef[] {
  const seen = new Set<string>();
  const out: ResolvedRef[] = [];
  for (const r of refs) {
    const key = refKey(r);
    const track = score.tracks[r.trackIndex];
    const events = track ? voiceEvents(track, r.measureIndex, r.voice) : null;
    const event = events?.[r.eventIndex];
    if (seen.has(key) || !events || !event) continue;
    seen.add(key);
    out.push({ ...r, event, events });
  }
  return out;
}

type PitchedNote = Pick<Note, 'midi' | 'spelling' | 'spellingHint' | 'percussion'>;

/** The notes that carry a pitch: the note itself, a chord's notes, none for a rest. */
function pitchedNotes(e: MusicalEvent): PitchedNote[] {
  return e.kind === 'note' ? [e] : e.kind === 'chord' ? e.notes : [];
}

/** Run `fn` on every referenced event; true when any of them changed. */
function mutateEach(refs: ResolvedRef[], fn: (e: MusicalEvent) => void): boolean {
  let changed = false;
  for (const r of refs) {
    const before = JSON.stringify(r.event);
    fn(r.event);
    if (JSON.stringify(r.event) !== before) changed = true;
  }
  return changed;
}

function pick<T extends object, K extends keyof T>(o: T, keys: readonly K[]): Partial<Pick<T, K>> {
  const out: Partial<Pick<T, K>> = {};
  for (const k of keys) if (o[k] !== undefined) out[k] = o[k];
  return out;
}

/**
 * Sort a chord's notes by midi and drop repeated pitches (the first one
 * stays). A chord left with one note becomes that note, keeping the event's
 * own fields and id.
 */
function tidyChordAt(events: MusicalEvent[], index: number): void {
  const e = events[index];
  if (e?.kind !== 'chord') return;
  const seen = new Set<number>();
  const notes = [...e.notes]
    .sort((a, b) => a.midi - b.midi)
    .filter((x) => (seen.has(x.midi) ? false : (seen.add(x.midi), true)));
  if (notes.length !== 1) { e.notes = notes; return; }
  const { kind: _kind, notes: _notes, ...base } = e;
  const only = notes[0];
  events[index] = {
    ...pick(only, ['tieToNext', 'spellingHint', 'spelling', 'percussion', 'fingering'] as const),
    ...base,
    kind: 'note',
    midi: only.midi,
  };
}

/**
 * The indices of the tuplet group holding `events[index]`: every event in
 * the voice sharing its tuplet id or, for an id-less or legacy triplet, the
 * group the renderer draws around it (legacyTripletGroups).
 */
function tupletGroup(events: MusicalEvent[], index: number): number[] {
  const t = eventTuplet(events[index]);
  if (!t) return [];
  if (t.id) return events.flatMap((e, i) => (eventTuplet(e)?.id === t.id ? [i] : []));
  return legacyTripletGroupAt(events, index) ?? [index];
}

/** Where every event id sits: its bar and that bar's repeat tag. */
function eventIdIndex(score: ScoreDocument): Map<string, { trackIndex: number; measureIndex: number; repeat?: Measure['repeat'] }> {
  const out = new Map<string, { trackIndex: number; measureIndex: number; repeat?: Measure['repeat'] }>();
  score.tracks.forEach((t, trackIndex) => t.measures.forEach((m, measureIndex) => {
    for (const v of m.voices) for (const e of v.events) if (e.id) out.set(e.id, { trackIndex, measureIndex, repeat: m.repeat });
  }));
  return out;
}

/** The event after `r` in its voice, crossing into later bars; null at the end. */
function nextEventRef(score: ScoreDocument, r: EventRef): EventRef | null {
  const track = score.tracks[r.trackIndex];
  if (!track) return null;
  for (let mi = r.measureIndex; mi < track.measures.length; mi++) {
    const events = track.measures[mi].voices[r.voice]?.events ?? [];
    const start = mi === r.measureIndex ? r.eventIndex + 1 : 0;
    if (start < events.length) return { ...r, measureIndex: mi, eventIndex: start };
  }
  return null;
}

/** Where an event starts in reading order: its bar, then its onset in the bar. */
function readingPosition(r: ResolvedRef): [number, number] {
  return [r.measureIndex, occupiedQN(r.events.slice(0, r.eventIndex))];
}

/** Only the pitch content of an event: a note's pitch, a chord's notes, or a bare rest. */
function pitchContent(e: MusicalEvent): Note | Chord | Rest {
  const notePitch = (x: PitchedNote) => ({ midi: x.midi, ...pick(x, ['spelling', 'spellingHint', 'percussion'] as const) });
  if (e.kind === 'note') return { kind: 'note', durationQN: e.durationQN, ...notePitch(e) };
  if (e.kind === 'chord') return { kind: 'chord', durationQN: e.durationQN, notes: e.notes.map(notePitch) };
  return { kind: 'rest', durationQN: e.durationQN };
}

const RHYTHM_KEYS = ['id', 'durationQN', 'dots', 'dotted', 'tuplet', 'triplet'] as const;
const NOTE_KEEP_KEYS = [...RHYTHM_KEYS, 'tieToNext', 'dynamic', 'text'] as const;
const MARK_KEYS = ['articulations', 'articulation', 'ornament', 'grace', 'slurToNext'] as const;

/** Overwrite with a single note: the rhythm, tie, dynamic and text stay; a chord
 *  collapses; a note or chord keeps its marks, a rest brings none. */
function overwriteNote(old: MusicalEvent, midi: number, spelling?: Spelling, percussion?: PercussionNotation): Note {
  return {
    ...pick(old, NOTE_KEEP_KEYS),
    ...(old.kind === 'rest' ? {} : pick(old, MARK_KEYS)),
    kind: 'note',
    midi,
    durationQN: old.durationQN,
    ...(spelling ? { spelling } : {}),
    ...(percussion ? { percussion } : {}),
  };
}

/** Overwrite with a rest: the rhythm (and a dynamic or text) stay; tie, marks,
 *  ornament and grace go. */
function overwriteRest(old: MusicalEvent): Rest {
  return { ...pick(old, [...RHYTHM_KEYS, 'dynamic', 'text'] as const), kind: 'rest', durationQN: old.durationQN };
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
      // Each pass keeps its own ids (`${base}~${pass}`) so spans can tell them apart.
      track.measures = track.measures.map(m => m.repeat?.id === r.id && m.repeat.offset === r.offset
        ? withPassIds({ ...clone(content), number: m.number, repeat: m.repeat }, m.repeat.pass) : m);
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
    case 'replace-score':
      return initialEditorState(action.score);
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
      const ids = new Set<string>();
      for (const m of measures) for (const v of m.voices) for (const e of v.events) if (e.id) ids.add(e.id);
      const notationSpans = (state.score.spans ?? []).filter((sp) => ids.has(sp.from) && ids.has(sp.to));
      const result = applyMeasureEdit(state.score, {
        type: 'paste-measures',
        trackIndex: action.trackIndex,
        index: action.start + measures.length,
        clip: { measures, context: contextAt(state.score, track, action.start), instrument: track.instrument, notationSpans },
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
        id: newEventId(),
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
        id: newEventId(),
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
      const result = withHistory(state, next);
      // After withHistory, so a note removed from every pass of a repeat is caught too.
      if (result.score.spans) result.score.spans = pruneSpans(result.score);
      return result;
    }
    case 'write-event': {
      const { at } = action;
      if (action.kind === 'note' && action.midi === undefined) return state;
      const next = clone(state.score);
      const track = next.tracks[at.trackIndex];
      if (!track) return state;
      if (at.eventIndex === 'end') {
        if (!action.value) return state;
        const events = voiceEvents(track, at.measureIndex, at.voice, true);
        if (!events) return state;
        const ts = effectiveTimeSignatureAt(track, next.initialTimeSignature, at.measureIndex);
        // A lone full-bar placeholder rest in voice 1 gives way to the first real event.
        if (at.voice === 0 && isFillerRest(events, ts)) events.length = 0;
        const dots = action.dots ?? 0;
        const durationQN = soundingQN(action.value, dots, null);
        // Refuse rather than overfill the bar (the zoom flashes "m.N is full").
        if (occupiedQN(events) + durationQN > measureLengthInQN(ts) + QN_EPS) return state;
        const rhythm = { id: newEventId(), durationQN, ...(dots > 0 ? { dots: dots as 1 | 2 } : {}) };
        events.push(action.kind === 'note'
          ? {
              kind: 'note',
              midi: action.midi!,
              ...rhythm,
              ...(action.spelling ? { spelling: action.spelling } : {}),
              ...(action.percussion ? { percussion: action.percussion } : {}),
            }
          : { kind: 'rest', ...rhythm });
        return withHistory(state, next);
      }
      const events = voiceEvents(track, at.measureIndex, at.voice);
      const old = events?.[at.eventIndex];
      if (!events || !old) return state;
      const written = action.kind === 'note'
        ? overwriteNote(old, action.midi!, action.spelling, action.percussion)
        : overwriteRest(old);
      if (JSON.stringify(written) === JSON.stringify(old)) return state;
      events[at.eventIndex] = written;
      return withHistory(state, next);
    }
    case 'add-chord-note': {
      const next = clone(state.score);
      const [r] = resolveRefs(next, [action.ref]);
      if (!r || r.event.kind === 'rest') return state;
      // A percussion stroke has no pitch to stack on.
      if (r.event.kind === 'note' && r.event.percussion) return state;
      const added = { midi: action.midi, ...(action.spelling ? { spelling: action.spelling } : {}) };
      const byMidi = (a: { midi: number }, b: { midi: number }) => a.midi - b.midi;
      if (r.event.kind === 'note') {
        if (r.event.midi === action.midi) return state;
        const { kind: _kind, midi: _midi, spelling: _sp, spellingHint: _hint, percussion: _perc, fingering: _fing, ...base } = r.event;
        const first = pick(r.event, ['spellingHint', 'spelling', 'percussion', 'fingering'] as const);
        const chord: Chord = { ...base, kind: 'chord', notes: [{ midi: r.event.midi, ...first }, added].sort(byMidi) };
        r.events[r.eventIndex] = chord;
      } else {
        if (r.event.notes.some((x) => x.midi === action.midi)) return state;
        r.event.notes = [...r.event.notes, added].sort(byMidi);
      }
      return withHistory(state, next);
    }
    case 'set-events-rhythm': {
      if (action.value === undefined && action.dots === undefined) return state;
      const next = clone(state.score);
      const refs = resolveRefs(next, action.refs);
      if (!refs.length) return state;
      if (action.value !== undefined) {
        // A new value leaves the tuplet, so it has to take the whole group with it.
        const picked = new Set(refs.map(refKey));
        for (const r of refs) {
          const partial = tupletGroup(r.events, r.eventIndex).some((i) => !picked.has(refKey({ ...r, eventIndex: i })));
          if (partial) return state;
        }
      }
      const voices = new Map<string, { r: ResolvedRef; before: number }>();
      for (const r of refs) if (!voices.has(voiceKey(r))) voices.set(voiceKey(r), { r, before: occupiedQN(r.events) });
      const changed = mutateEach(refs, (e) => {
        const dots = action.dots ?? eventDots(e);
        let durationQN: number;
        if (action.value !== undefined) {
          durationQN = soundingQN(action.value, dots, null);
          delete e.tuplet;
          delete e.triplet;
        } else {
          const value = writtenValue(e);
          if (!value) return; // an unwritable length (e.g. from MIDI) keeps its rhythm
          durationQN = soundingQN(value, dots, eventTuplet(e));
        }
        e.durationQN = durationQN;
        if (dots > 0) e.dots = dots as 1 | 2;
        else delete e.dots;
        delete e.dotted;
      });
      if (!changed) return state;
      for (const { r, before } of voices.values()) {
        const after = occupiedQN(r.events);
        const len = barLengthQN(next, next.tracks[r.trackIndex], r.measureIndex);
        // A bar that was already over (an import) may still shrink.
        if (after > len + QN_EPS && after > before + QN_EPS) return state;
      }
      return withHistory(state, next);
    }
    case 'transpose-events': {
      const next = clone(state.score);
      const { kind, dir, keyFifths } = action;
      const refs = resolveRefs(next, action.refs);
      const changed = mutateEach(refs, (e) => {
        for (const p of pitchedNotes(e)) {
          if (p.percussion) continue;
          const spelling = eventSpelling(p) ?? undefined;
          const to: Pitch = kind === 'step'
            ? stepPitch(p.midi, spelling, keyFifths, dir)
            : kind === 'semi'
              ? semitonePitch(p.midi, dir, keyFifths)
              : octavePitch(p.midi, spelling, keyFifths, dir);
          p.midi = to.midi;
          p.spelling = { step: to.spelling.step, alter: to.spelling.alter };
          delete p.spellingHint;
        }
      });
      if (!changed) return state;
      refs.forEach((r) => tidyChordAt(r.events, r.eventIndex));
      return withHistory(state, next);
    }
    case 'set-events-accidental': {
      const next = clone(state.score);
      const { alter, keyFifths } = action;
      const refs = resolveRefs(next, action.refs);
      const changed = mutateEach(refs, (e) => {
        for (const p of pitchedNotes(e)) {
          if (p.percussion) continue;
          const s = spellMidi(p.midi, { spelling: p.spelling, spellingHint: p.spellingHint, keyFifths });
          const midi = spelledMidi(s.step, alter, s.octave);
          if (midi < 0 || midi > 127) continue;
          p.midi = midi;
          p.spelling = { step: s.step, alter, showAccidental: 'always' };
          delete p.spellingHint;
        }
      });
      if (!changed) return state;
      refs.forEach((r) => tidyChordAt(r.events, r.eventIndex));
      return withHistory(state, next);
    }
    case 'set-event-pitches': {
      const next = clone(state.score);
      const [r] = resolveRefs(next, [action.ref]);
      const notes = r ? pitchedNotes(r.event) : [];
      const { midis } = action;
      if (!notes.length || notes.length !== midis.length) return state;
      if (!midis.every((m) => Number.isInteger(m) && m >= 0 && m <= 127)) return state;
      if (notes.every((p, i) => p.midi === midis[i])) return state;
      notes.forEach((p, i) => {
        p.midi = midis[i];
        // A spelling names the old pitch; the new one takes the key's default.
        delete p.spelling;
        delete p.spellingHint;
      });
      tidyChordAt(r.events, r.eventIndex);
      return withHistory(state, next);
    }
    case 'delete-events': {
      const next = clone(state.score);
      const refs = resolveRefs(next, action.refs);
      if (!refs.length) return state;
      // Highest index first so earlier indices in the same voice stay valid.
      for (const r of [...refs].sort((a, b) => b.eventIndex - a.eventIndex)) r.events.splice(r.eventIndex, 1);
      for (const r of refs) {
        const m = next.tracks[r.trackIndex].measures[r.measureIndex];
        if (r.voice === 1 && m.voices[1]?.events.length === 0) m.voices.splice(1, 1);
      }
      const result = withHistory(state, next);
      // After withHistory, so an event removed from every pass of a repeat is caught too.
      const spans = pruneSpans(result.score);
      if (spans) result.score.spans = spans;
      return result;
    }
    case 'toggle-events-articulation': {
      const next = clone(state.score);
      const refs = resolveRefs(next, action.refs).filter((r) => r.event.kind !== 'rest');
      const changed = mutateEach(refs, (e) => {
        const current = eventArticulations(e);
        const marks = current.includes(action.articulation)
          ? current.filter((a) => a !== action.articulation)
          : [...current, action.articulation];
        if (marks.length) e.articulations = marks;
        else delete e.articulations;
        delete e.articulation;
      });
      return changed ? withHistory(state, next) : state;
    }
    case 'set-events-ornament': {
      const next = clone(state.score);
      const refs = resolveRefs(next, action.refs).filter((r) => r.event.kind !== 'rest');
      const changed = mutateEach(refs, (e) => {
        if (action.ornament) e.ornament = action.ornament;
        else delete e.ornament;
      });
      return changed ? withHistory(state, next) : state;
    }
    case 'set-events-dynamic': {
      const next = clone(state.score);
      const changed = mutateEach(resolveRefs(next, action.refs), (e) => {
        if (action.dynamic) e.dynamic = action.dynamic;
        else delete e.dynamic;
      });
      return changed ? withHistory(state, next) : state;
    }
    case 'set-event-text': {
      const next = clone(state.score);
      const text = (action.text ?? '').trim().slice(0, 60);
      const changed = mutateEach(resolveRefs(next, [action.ref]), (e) => {
        if (text) e.text = text;
        else delete e.text;
      });
      return changed ? withHistory(state, next) : state;
    }
    case 'toggle-event-grace': {
      const next = clone(state.score);
      const [r] = resolveRefs(next, [action.ref]);
      if (!r || r.event.kind === 'rest') return state;
      const e = r.event;
      if (e.grace?.length && e.grace.every((g) => g.slash === action.slash)) {
        delete e.grace;
      } else {
        const top = pitchedNotes(e).reduce((a, b) => (b.midi > a.midi ? b : a));
        if (top.percussion) {
          // A drum stroke's grace is the same stroke (a flam), not a pitch above.
          e.grace = [{ midi: top.midi, percussion: clone(top.percussion), slash: action.slash }];
        } else {
          const to = stepPitch(top.midi, eventSpelling(top) ?? undefined, action.keyFifths, 1);
          e.grace = [{ midi: to.midi, spelling: { step: to.spelling.step, alter: to.spelling.alter }, slash: action.slash }];
        }
      }
      return withHistory(state, next);
    }
    case 'toggle-event-tie': {
      const next = clone(state.score);
      const [r] = resolveRefs(next, [action.ref]);
      if (!r || r.event.kind === 'rest') return state;
      if (r.event.tieToNext) delete r.event.tieToNext;
      else r.event.tieToNext = true;
      return withHistory(state, next);
    }
    case 'apply-tuplet': {
      if ('at' in action) {
        const { at, value, n, m } = action;
        if (at.eventIndex !== 'end') {
          return editorReducer(state, { type: 'apply-tuplet', ref: { ...at, eventIndex: at.eventIndex }, n, m });
        }
        // write-event checks the fit (and clears a lone filler rest).
        const appended = editorReducer(state, { type: 'write-event', at, kind: 'rest', value, dots: 0 });
        if (appended === state) return state;
        const events = appended.score.tracks[at.trackIndex]?.measures[at.measureIndex]?.voices[at.voice]?.events ?? [];
        const split = editorReducer(appended, { type: 'apply-tuplet', ref: { ...at, eventIndex: events.length - 1 }, n, m });
        if (split === appended) return state;
        // Both steps land as one history entry.
        return { ...split, past: [...state.past, state.score].slice(-HISTORY_LIMIT) };
      }
      const next = clone(state.score);
      const [r] = resolveRefs(next, [action.ref]);
      if (!r) return state;
      const e = r.event;
      if (eventTuplet(e)) {
        // Merge back: the contiguous run of the group holding this event.
        const group = new Set(tupletGroup(r.events, r.eventIndex));
        let start = r.eventIndex;
        let end = r.eventIndex;
        while (group.has(start - 1)) start--;
        while (group.has(end + 1)) end++;
        const members = r.events.slice(start, end + 1);
        const value = valueFromQN(members.reduce((sum, x) => sum + x.durationQN, 0));
        if (!value) return state;
        const merged = { ...members[0], durationQN: VALUE_QN[value] };
        delete merged.tuplet;
        delete merged.triplet;
        delete merged.dots;
        delete merged.dotted;
        // The tie leaves the group from its last note, so it comes back from there.
        const last = members[members.length - 1];
        if (last.kind !== 'rest' && last.tieToNext) merged.tieToNext = true;
        else delete merged.tieToNext;
        if (merged.kind === 'chord') {
          const tiedOut = new Set(last.kind === 'chord' ? last.notes.filter((x) => x.tieToNext).map((x) => x.midi) : []);
          merged.notes = merged.notes.map((x) => {
            const { tieToNext: _tie, ...note } = x;
            return tiedOut.has(x.midi) ? { ...note, tieToNext: true } : note;
          });
        }
        r.events.splice(start, members.length, merged);
        const result = withHistory(state, next);
        // After withHistory, so a span on a member dropped from every pass is caught too.
        const spans = pruneSpans(result.score);
        if (spans) result.score.spans = spans;
        return result;
      }
      if (eventDots(e) > 0) return state;
      const { n, m } = action;
      if (!Number.isInteger(n) || !Number.isInteger(m) || n < 2 || m < 1) return state;
      const written = writtenValue(e);
      const base = written ? valueFromQN(VALUE_QN[written] / m) : null;
      if (!base) return state;
      const durationQN = (VALUE_QN[base] * m) / n;
      const tuplet = { id: newTupletId(), n, m };
      const first: MusicalEvent = { ...e, durationQN, tuplet: { ...tuplet } };
      delete first.triplet;
      const rest = Array.from({ length: n - 1 }, (): MusicalEvent => ({
        ...pitchContent(e),
        id: newEventId(),
        durationQN,
        tuplet: { ...tuplet },
      }));
      // The tie leaves the group from its last note, not its first.
      const last = rest[rest.length - 1];
      if (first.tieToNext) { last.tieToNext = true; delete first.tieToNext; }
      if (first.kind === 'chord' && last.kind === 'chord') {
        first.notes.forEach((x, i) => {
          if (x.tieToNext) { last.notes[i].tieToNext = true; delete x.tieToNext; }
        });
      }
      r.events.splice(r.eventIndex, 1, first, ...rest);
      return withHistory(state, next);
    }
    case 'toggle-span': {
      const next = clone(state.score);
      const { spanType } = action;
      const [from] = resolveRefs(next, [action.from]);
      const fromId = from?.event.id;
      if (!from || !fromId) return state;
      const spans = next.spans ?? [];
      const ids = eventIdIndex(next);
      const group = ids.get(fromId)?.repeat;
      // The span `fromId → toId` on every pass of `from`'s repeat, own pass
      // first. It is mirrored only when both ends sit in the same pass of the
      // same repeat; a span across a pass boundary (or out of the repeat) stays
      // single. A pass is skipped when either end is missing from it.
      const mirrored = (toId: string) => {
        const pairs = [{ from: fromId, to: toId }];
        const toRepeat = ids.get(toId)?.repeat;
        if (!group || toRepeat?.id !== group.id || toRepeat.pass !== group.pass) return pairs;
        const inPass = (id: string, p: number) => {
          const rep = ids.get(id)?.repeat;
          return rep?.id === group.id && rep.pass === p;
        };
        for (let p = 0; p < group.count; p++) {
          if (p === group.pass) continue;
          const f = passEventId(fromId, p);
          const t = passEventId(toId, p);
          if (inPass(f, p) && inPass(t, p)) pairs.push({ from: f, to: t });
        }
        return pairs;
      };
      const isPair = (pairs: Array<{ from: string; to: string }>) => (sp: { type: string; from: string; to: string }) =>
        sp.type === spanType && pairs.some((p) => p.from === sp.from && p.to === sp.to);
      const sameAsFrom = !action.to || refKey(action.to) === refKey(action.from);
      const starting = spans.filter((sp) => sp.type === spanType && sp.from === fromId);
      if (sameAsFrom && starting.length) {
        const gone = isPair(starting.flatMap((sp) => mirrored(sp.to)));
        next.spans = spans.filter((sp) => !gone(sp));
        return withHistory(state, next);
      }
      const toRef = sameAsFrom ? nextEventRef(next, action.from) : action.to!;
      // An automatic end is the next event in this bar or the next one, never further.
      if (sameAsFrom && toRef && toRef.measureIndex > action.from.measureIndex + 1) return state;
      const [to] = toRef ? resolveRefs(next, [toRef]) : [];
      const toId = to?.event.id;
      if (!to || !toId || to.trackIndex !== from.trackIndex) return state;
      const [fm, fq] = readingPosition(from);
      const [tm, tq] = readingPosition(to);
      if (tm < fm || (tm === fm && tq < fq - QN_EPS)) return state;
      const pairs = mirrored(toId);
      const exists = (p: { from: string; to: string }) => spans.some(isPair([p]));
      if (exists(pairs[0])) {
        // The same span again (an explicit `to`): toggle it off on every pass.
        const gone = isPair(pairs);
        next.spans = spans.filter((sp) => !gone(sp));
      } else {
        next.spans = [
          ...spans,
          ...pairs.filter((p) => !exists(p)).map((p) => ({ id: 's' + newEventId().slice(1), type: spanType, ...p })),
        ];
      }
      return withHistory(state, next);
    }
    default:
      return state;
  }
}


// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * The state a score opens in. Missing or duplicate event ids are fixed here,
 * keeping repeat groups intact (older saves have passes with no ids or with
 * pass 0's ids), but the score stays clean with no history: opening a score
 * never saves it by itself (the ids are written with the next real edit).
 */
export function initialEditorState(score: ScoreDocument): EditorState {
  return { score: ensureScoreEventIds(score, newEventId), past: [], future: [], isDirty: false };
}

export function useEditor(initialScore: ScoreDocument) {
  const [state, dispatch] = useReducer(editorReducer, initialScore, initialEditorState);

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
