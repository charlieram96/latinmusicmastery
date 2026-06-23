import { describe, it, expect } from 'vitest';
import { editorReducer, type EditorState } from '../editor-state';
import type { Rest, ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

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
