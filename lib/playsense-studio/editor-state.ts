// PlaySense Studio — editor state + reducer.
//
// useReducer-based store with a history stack for undo/redo. Each action
// produces a new score; the previous score is pushed to past[]. Undo pops
// past[] back, redo replays from future[]. The state is plain JSON so
// `structuredClone`-equivalent JSON.parse(JSON.stringify(...)) works.

import { useCallback, useReducer } from 'react';
import type {
  Chord,
  Measure,
  MusicalEvent,
  Note,
  Rest,
  ScoreDocument,
  Track,
  Voice,
} from '@/components/playsense-studio/shared/score-model/types';
import { measureLengthInQN } from './time-mapping';

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
  | { type: 'delete-measure'; trackIndex: number; measureIndex: number }
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

function withHistory(state: EditorState, nextScore: ScoreDocument): EditorState {
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
    case 'set-score-meta': {
      const next = clone(state.score);
      if (action.title !== undefined) next.title = action.title;
      if (action.composer !== undefined) next.composer = action.composer;
      if (action.initialTempo !== undefined) {
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
        measures: [emptyMeasure(1, next.initialTimeSignature)],
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
    case 'add-measure': {
      const next = clone(state.score);
      const t = next.tracks[action.trackIndex];
      if (!t) return state;
      const lastNumber = t.measures[t.measures.length - 1]?.number ?? 0;
      t.measures.push(emptyMeasure(lastNumber + 1, next.initialTimeSignature));
      return withHistory(state, next);
    }
    case 'delete-measure': {
      const next = clone(state.score);
      const t = next.tracks[action.trackIndex];
      if (!t || t.measures.length <= 1) return state;
      t.measures.splice(action.measureIndex, 1);
      t.measures.forEach((m, i) => (m.number = i + 1));
      return withHistory(state, next);
    }
    case 'add-note': {
      const next = clone(state.score);
      const measure = next.tracks[action.trackIndex]?.measures[action.measureIndex];
      if (!measure) return state;
      const note: Note = {
        kind: 'note',
        midi: action.midi,
        durationQN: action.durationQN,
        ...(action.dotted ? { dotted: true } : {}),
        ...(action.triplet ? { triplet: true } : {}),
        ...(action.articulation ? { articulation: action.articulation } : {}),
      };
      measure.voices[0].events.push(note);
      return withHistory(state, next);
    }
    case 'add-rest': {
      const next = clone(state.score);
      const measure = next.tracks[action.trackIndex]?.measures[action.measureIndex];
      if (!measure) return state;
      const rest: Rest = {
        kind: 'rest',
        durationQN: action.durationQN,
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
      } else if (event.kind === 'chord') {
        const chord = event as Chord;
        if (chord.notes[0]) chord.notes[0].midi = action.midi;
      }
      return withHistory(state, next);
    }
    case 'set-event-duration': {
      const next = clone(state.score);
      const event = next.tracks[action.trackIndex]?.measures[action.measureIndex]
        ?.voices[0].events[action.eventIndex];
      if (!event) return state;
      event.durationQN = action.durationQN;
      return withHistory(state, next);
    }
    case 'set-event-dotted': {
      const next = clone(state.score);
      const event = next.tracks[action.trackIndex]?.measures[action.measureIndex]
        ?.voices[0].events[action.eventIndex];
      if (!event) return state;
      event.dotted = action.dotted;
      return withHistory(state, next);
    }
    case 'set-event-triplet': {
      const next = clone(state.score);
      const event = next.tracks[action.trackIndex]?.measures[action.measureIndex]
        ?.voices[0].events[action.eventIndex];
      if (!event) return state;
      event.triplet = action.triplet;
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
          ...(event.dotted ? { dotted: true } : {}),
          ...(event.triplet ? { triplet: true } : {}),
        };
        voice.events[action.eventIndex] = rest;
      } else {
        if (event.kind === 'note' || event.kind === 'chord') return state;
        const note: Note = {
          kind: 'note',
          midi: action.midi ?? 60,
          durationQN: event.durationQN,
          ...(event.dotted ? { dotted: true } : {}),
          ...(event.triplet ? { triplet: true } : {}),
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
      // Backfill with a rest so the measure stays time-aligned visually.
      if (measure.voices[0].events.length === 0) {
        measure.voices[0].events.push({
          kind: 'rest',
          durationQN: measureLengthInQN(state.score.initialTimeSignature),
        } satisfies Rest);
      }
      return withHistory(state, next);
    }
    default:
      return state;
  }
}

function emptyMeasure(number: number, timeSignature: [number, number]): Measure {
  const voice: Voice = {
    number: 1,
    events: [
      { kind: 'rest', durationQN: measureLengthInQN(timeSignature) } satisfies Rest,
    ] as MusicalEvent[],
  };
  return { number, voices: [voice] };
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
