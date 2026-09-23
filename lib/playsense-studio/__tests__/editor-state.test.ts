import { describe, it, expect } from 'vitest';
import { editorReducer, type EditorState } from '../editor-state';
import type { Note, Rest, ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { eventDots, tupletScale } from '@/components/playsense-studio/shared/score-model/accessors';
import { vexflowDurationCode } from '../score-to-vexflow';

function makeScore(events: ScoreDocument['tracks'][0]['measures'][0]['voices'][0]['events']): ScoreDocument {
  return {
    schemaVersion: 1,
    title: 'Test',
    sourceFormat: 'native',
    initialTempo: 120,
    initialTimeSignature: [4, 4],
    initialKeyFifths: 0,
    tracks: [
      {
        index: 0,
        instrument: 'staff',
        displayName: 'Track 1',
        tuning: null,
        stringMultiplicity: 1,
        channel: null,
        defaultView: 'staff',
        measures: [{ number: 1, voices: [{ number: 1, events }] }],
      },
    ],
  } as ScoreDocument;
}

function stateOf(score: ScoreDocument): EditorState {
  return { score, past: [], future: [], isDirty: false };
}

const events = (s: EditorState) => s.score.tracks[0].measures[0].voices[0].events;

describe('editor-state capacity guard', () => {
  it('starts new measures empty (no placeholder rest)', () => {
    const s0 = stateOf(makeScore([]));
    const s1 = editorReducer(s0, { type: 'add-measure', trackIndex: 0 });
    expect(s1.score.tracks[0].measures[1].voices[0].events).toEqual([]);
  });

  it('adds a note straight into an empty measure', () => {
    const s0 = stateOf(makeScore([]));
    const s1 = editorReducer(s0, { type: 'add-note', trackIndex: 0, measureIndex: 0, midi: 60, durationQN: 1 });
    expect(events(s1)).toHaveLength(1);
    expect(events(s1)[0]).toMatchObject({ kind: 'note', midi: 60, durationQN: 1 });
  });

  it('replaces a full-measure filler rest with the first real note', () => {
    const filler: Rest = { kind: 'rest', durationQN: 4 }; // full bar in 4/4
    const s0 = stateOf(makeScore([filler]));
    const s1 = editorReducer(s0, { type: 'add-note', trackIndex: 0, measureIndex: 0, midi: 62, durationQN: 1 });
    expect(events(s1)).toHaveLength(1);
    expect(events(s1)[0]).toMatchObject({ kind: 'note', midi: 62 });
  });

  it('blocks adding a note that would overflow the measure', () => {
    // 4/4 already filled with four quarter notes.
    const full = Array.from({ length: 4 }, () => ({ kind: 'note' as const, midi: 60, durationQN: 1 }));
    const s0 = stateOf(makeScore(full));
    const s1 = editorReducer(s0, { type: 'add-note', trackIndex: 0, measureIndex: 0, midi: 60, durationQN: 1 });
    expect(s1).toBe(s0); // unchanged — blocked
    expect(events(s1)).toHaveLength(4);
  });

  it('stores the effective duration for a dotted note (1.5x)', () => {
    const s0 = stateOf(makeScore([]));
    const s1 = editorReducer(s0, { type: 'add-note', trackIndex: 0, measureIndex: 0, midi: 60, durationQN: 1, dotted: true });
    expect(events(s1)[0].durationQN).toBeCloseTo(1.5);
    expect(events(s1)[0].dotted).toBe(true);
  });

  it('does not backfill a rest when the last note is deleted', () => {
    const s0 = stateOf(makeScore([{ kind: 'note', midi: 60, durationQN: 1 }]));
    const s1 = editorReducer(s0, { type: 'delete-event', trackIndex: 0, measureIndex: 0, eventIndex: 0 });
    expect(events(s1)).toEqual([]);
  });
});

describe('editor-state final barline', () => {
  const twoMeasures = () => editorReducer(stateOf(makeScore([])), { type: 'add-measure', trackIndex: 0 });

  it('stores only overrides: removing the bar on the last measure persists, re-adding clears the field', () => {
    const s1 = editorReducer(twoMeasures(), { type: 'set-measure-final-bar', trackIndex: 0, measureIndex: 1, final: false });
    expect(s1.score.tracks[0].measures[1].endBarline).toBe('single');
    expect(s1.isDirty).toBe(true);
    const s2 = editorReducer(s1, { type: 'set-measure-final-bar', trackIndex: 0, measureIndex: 1, final: true });
    expect(s2.score.tracks[0].measures[1].endBarline).toBeUndefined();
  });

  it('adds an explicit final bar to an inner measure and clears it again', () => {
    const s1 = editorReducer(twoMeasures(), { type: 'set-measure-final-bar', trackIndex: 0, measureIndex: 0, final: true });
    expect(s1.score.tracks[0].measures[0].endBarline).toBe('final');
    const s2 = editorReducer(s1, { type: 'set-measure-final-bar', trackIndex: 0, measureIndex: 0, final: false });
    expect(s2.score.tracks[0].measures[0].endBarline).toBeUndefined();
  });

  it('ignores an out-of-range measure', () => {
    const s0 = twoMeasures();
    expect(editorReducer(s0, { type: 'set-measure-final-bar', trackIndex: 0, measureIndex: 7, final: true })).toBe(s0);
  });

  it('undo restores the previous barline', () => {
    const s1 = editorReducer(twoMeasures(), { type: 'set-measure-final-bar', trackIndex: 0, measureIndex: 1, final: false });
    expect(editorReducer(s1, { type: 'undo' }).score.tracks[0].measures[1].endBarline).toBeUndefined();
  });
});

describe('editor-state rhythm reducers keep new and legacy fields in step', () => {
  // Shaped like a MusicXML import: legacy AND new fields both present, as the
  // importer emits them (F1/F3 companions in accessors.ts read the new field
  // first, falling back to the legacy one).
  const tripletEighth: Note = {
    kind: 'note', midi: 60, durationQN: 1 / 3, triplet: true, tuplet: { id: 't', n: 3, m: 2 },
  };
  const doubleDottedQuarter: Note = {
    kind: 'note', midi: 60, durationQN: 1.75, dots: 2,
  };

  it('set-event-triplet(false) removes both `tuplet` and `triplet`, restoring the written eighth', () => {
    const s0 = stateOf(makeScore([tripletEighth]));
    const s1 = editorReducer(s0, { type: 'set-event-triplet', trackIndex: 0, measureIndex: 0, eventIndex: 0, triplet: false });
    const e = events(s1)[0];
    expect(e.tuplet).toBeUndefined();
    expect(e.triplet).toBeUndefined();
    expect(vexflowDurationCode(e.durationQN, eventDots(e), tupletScale(e))).toBe('8');
  });

  it('set-event-triplet(true) on a plain note sets a fresh 3:2 tuplet object', () => {
    const s0 = stateOf(makeScore([{ kind: 'note', midi: 60, durationQN: 0.5 }]));
    const s1 = editorReducer(s0, { type: 'set-event-triplet', trackIndex: 0, measureIndex: 0, eventIndex: 0, triplet: true });
    const e = events(s1)[0];
    expect(e.tuplet).toMatchObject({ n: 3, m: 2 });
    expect(typeof e.tuplet?.id).toBe('string');
    expect(e.tuplet?.id.length).toBeGreaterThan(0);
    expect(vexflowDurationCode(e.durationQN, eventDots(e), tupletScale(e))).toBe('8');
  });

  it('set-event-triplet(true) on an event that already carries a tuplet id keeps that id', () => {
    const s0 = stateOf(makeScore([{ kind: 'note', midi: 60, durationQN: 0.4, tuplet: { id: 'keep-me', n: 5, m: 4 } }]));
    const s1 = editorReducer(s0, { type: 'set-event-triplet', trackIndex: 0, measureIndex: 0, eventIndex: 0, triplet: true });
    expect(events(s1)[0].tuplet).toMatchObject({ id: 'keep-me', n: 3, m: 2 });
  });

  it('set-event-dotted on a double-dotted import (dots: 2) keeps eventDots consistent with durationQN', () => {
    const s0 = stateOf(makeScore([doubleDottedQuarter]));
    const s1 = editorReducer(s0, { type: 'set-event-dotted', trackIndex: 0, measureIndex: 0, eventIndex: 0, dotted: false });
    const e = events(s1)[0];
    expect(e.dots).toBeUndefined();
    expect(eventDots(e)).toBe(0);
    expect(e.durationQN).toBeCloseTo(1, 9);

    const s2 = editorReducer(s1, { type: 'set-event-dotted', trackIndex: 0, measureIndex: 0, eventIndex: 0, dotted: true });
    const e2 = events(s2)[0];
    expect(e2.dots).toBeUndefined();
    expect(eventDots(e2)).toBe(1);
    expect(e2.durationQN).toBeCloseTo(1.5, 9);
  });

  it('set-event-duration on an event carrying new-field dots/tuplet drops them so the legacy flags stay authoritative', () => {
    // `set-event-duration` only recomputes durationQN from the LEGACY dotted/triplet
    // flags (effectiveDurationQN never looks at dots/tuplet). tripletEighth still
    // carries `triplet: true`, so picking a written "quarter" base keeps it scaled
    // as a triplet quarter (2/3) — the stale `tuplet`/`dots` objects are dropped so
    // eventTuplet()/eventDots() fall through to the legacy flags that actually drove
    // the recompute, keeping durationQN === base × dotFactor × tupletScale true.
    const s0 = stateOf(makeScore([{ ...tripletEighth, midi: 60 }]));
    const s1 = editorReducer(s0, { type: 'set-event-duration', trackIndex: 0, measureIndex: 0, eventIndex: 0, durationQN: 1 });
    const e = events(s1)[0];
    expect(e.durationQN).toBeCloseTo(2 / 3, 9);
    expect(e.tuplet).toBeUndefined();
    expect(e.dots).toBeUndefined();
    expect(e.triplet).toBe(true);
    expect(vexflowDurationCode(e.durationQN, eventDots(e), tupletScale(e))).toBe('q');
  });

  it('convert-event-kind keeps the id, dots and tuplet from the old event', () => {
    const s0 = stateOf(makeScore([{ kind: 'note', midi: 60, durationQN: 1 / 3, id: 'ev-1', tuplet: { id: 't', n: 3, m: 2 }, triplet: true }]));
    const s1 = editorReducer(s0, { type: 'convert-event-kind', trackIndex: 0, measureIndex: 0, eventIndex: 0, to: 'rest' });
    const e = events(s1)[0];
    expect(e.id).toBe('ev-1');
    expect(e.tuplet).toMatchObject({ id: 't', n: 3, m: 2 });
    expect(e.triplet).toBe(true);
  });
});

describe('set-event-pitch spelling', () => {
  it('drops a stale spelling and hint from an edited note', () => {
    const note: Note = { kind: 'note', midi: 64, durationQN: 1, spelling: { step: 'E', alter: 0 }, spellingHint: 'E' };
    const s1 = editorReducer(stateOf(makeScore([note])), { type: 'set-event-pitch', trackIndex: 0, measureIndex: 0, eventIndex: 0, midi: 65 });
    const e = events(s1)[0] as Note;
    expect(e.midi).toBe(65);
    expect(e.spelling).toBeUndefined();
    expect(e.spellingHint).toBeUndefined();
  });

  it('drops a stale spelling from the edited chord note only', () => {
    const chord = {
      kind: 'chord' as const,
      durationQN: 1,
      notes: [
        { midi: 64, spelling: { step: 'E' as const, alter: 0 as const }, spellingHint: 'E' },
        { midi: 67, spelling: { step: 'G' as const, alter: 0 as const } },
      ],
    };
    const s1 = editorReducer(stateOf(makeScore([chord])), { type: 'set-event-pitch', trackIndex: 0, measureIndex: 0, eventIndex: 0, midi: 65 });
    const e = events(s1)[0] as typeof chord;
    expect(e.notes[0]).toEqual({ midi: 65 });
    expect(e.notes[1].spelling).toEqual({ step: 'G', alter: 0 });
  });
});
