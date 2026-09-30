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

  it('preserves the rhythmic slot when the last note is deleted', () => {
    const s0 = stateOf(makeScore([{ kind: 'note', midi: 60, durationQN: 1 }]));
    const s1 = editorReducer(s0, { type: 'delete-event', trackIndex: 0, measureIndex: 0, eventIndex: 0 });
    expect(events(s1)).toMatchObject([{ kind: 'rest', durationQN: 1 }]);
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

describe('set-score-meta (fix round 1)', () => {
  it('ignores a non-finite initial tempo instead of writing NaN', () => {
    const s0 = stateOf(makeScore([]));
    const s1 = editorReducer(s0, { type: 'set-score-meta', initialTempo: NaN });
    expect(s1.score.initialTempo).toBe(120);
  });
});

function scoreWithTempoMarks(): ScoreDocument {
  const score = makeScore([]);
  score.tracks[0].measures = [
    { number: 1, voices: [{ number: 1, events: [] }] },
    { number: 2, voices: [{ number: 1, events: [] }], tempoChange: 120 },
    { number: 3, voices: [{ number: 1, events: [] }], tempoChange: 100 },
  ];
  return score;
}

describe('set-tempo-marks-confirmed / clear-tempo-marks', () => {
  it('set-tempo-marks-confirmed sets the flag', () => {
    const s0 = stateOf(scoreWithTempoMarks());
    const s1 = editorReducer(s0, { type: 'set-tempo-marks-confirmed', confirmed: true });
    expect(s1.score.tempoMarksConfirmed).toBe(true);
    const s2 = editorReducer(s1, { type: 'set-tempo-marks-confirmed', confirmed: false });
    expect(s2.score.tempoMarksConfirmed).toBeUndefined();
  });

  it('is a no-op (no history push) when the flag already matches', () => {
    const s0 = stateOf(scoreWithTempoMarks());
    expect(editorReducer(s0, { type: 'set-tempo-marks-confirmed', confirmed: false })).toBe(s0);
  });

  it('clear-tempo-marks removes every tempoChange on the track and leaves initialTempo alone', () => {
    const s0 = stateOf(scoreWithTempoMarks());
    const s1 = editorReducer(s0, { type: 'clear-tempo-marks', trackIndex: 0 });
    expect(s1.score.tracks[0].measures.every((m) => m.tempoChange === undefined)).toBe(true);
    expect(s1.score.initialTempo).toBe(120);
  });

  it('clear-tempo-marks is a no-op when there is nothing to clear', () => {
    const s0 = stateOf(makeScore([]));
    expect(editorReducer(s0, { type: 'clear-tempo-marks', trackIndex: 0 })).toBe(s0);
  });
});

describe('event-id integrity (Task 13)', () => {
  const note = (id: string, midi = 60): Note => ({ kind: 'note', id, midi, durationQN: 1 });
  const ids = (s: EditorState, mi: number) => s.score.tracks[0].measures[mi].voices[0].events.map((e) => e.id);

  it('gives a newly added note an id', () => {
    const s1 = editorReducer(stateOf(makeScore([])), { type: 'add-note', trackIndex: 0, measureIndex: 0, midi: 60, durationQN: 1 });
    expect(events(s1)[0].id).toMatch(/^e/);
  });

  it('removes a slur when its end note is deleted', () => {
    const score = makeScore([note('a'), note('b')]);
    score.spans = [{ id: 's', type: 'slur', from: 'a', to: 'b' }];
    const s1 = editorReducer(stateOf(score), { type: 'delete-event', trackIndex: 0, measureIndex: 0, eventIndex: 1 });
    expect(s1.score.spans).toEqual([]);
  });

  it('pastes a copy with fresh ids and carries its slur with remapped ends', () => {
    const score = makeScore([note('a'), note('b')]);
    score.spans = [{ id: 's', type: 'slur', from: 'a', to: 'b' }];
    const clip = {
      measures: [JSON.parse(JSON.stringify(score.tracks[0].measures[0]))],
      context: { bpm: 120, timeSignature: [4, 4] as [number, number], keyFifths: 0 },
      instrument: 'staff' as const,
      notationSpans: [{ id: 's', type: 'slur' as const, from: 'a', to: 'b' }],
    };
    const s1 = editorReducer(stateOf(score), { type: 'paste-measures', trackIndex: 0, index: 1, clip });
    const pasted = ids(s1, 1);
    expect(pasted).toHaveLength(2);
    expect(pasted).not.toContain('a');
    expect(pasted).not.toContain('b');
    expect(ids(s1, 0)).toEqual(['a', 'b']);
    expect(s1.score.spans).toHaveLength(2);
    const copy = s1.score.spans![1];
    expect([copy.from, copy.to]).toEqual(pasted);
    expect(copy.id).not.toBe('s');
  });

  it('repeats a bar with per-pass ids', () => {
    const s1 = editorReducer(stateOf(makeScore([note('a')])), { type: 'repeat-measures', trackIndex: 0, start: 0, end: 0, count: 2, id: 'r' });
    expect(ids(s1, 0)).toEqual(['a']);
    expect(ids(s1, 1)).toEqual(['a~1']);
  });

  it('editing pass 2 keeps each pass on its own id and the group intact', () => {
    const s1 = editorReducer(stateOf(makeScore([note('a')])), { type: 'repeat-measures', trackIndex: 0, start: 0, end: 0, count: 2, id: 'r' });
    const s2 = editorReducer(s1, { type: 'set-event-pitch', trackIndex: 0, measureIndex: 1, eventIndex: 0, midi: 67 });
    expect(ids(s2, 0)).toEqual(['a']);
    expect(ids(s2, 1)).toEqual(['a~1']);
    expect(s2.score.tracks[0].measures.map((m) => (m.voices[0].events[0] as Note).midi)).toEqual([67, 67]);
    expect(s2.score.tracks[0].measures.every((m) => m.repeat?.id === 'r')).toBe(true);
  });

  it('adds repeat passes with their own pass ids', () => {
    const s1 = editorReducer(stateOf(makeScore([note('a')])), { type: 'repeat-measures', trackIndex: 0, start: 0, end: 0, count: 2, id: 'r' });
    const s2 = editorReducer(s1, { type: 'set-repeat-count', trackIndex: 0, id: 'r', count: 3 });
    expect([0, 1, 2].map((i) => ids(s2, i)[0])).toEqual(['a', 'a~1', 'a~2']);
    expect(s2.score.tracks[0].measures.every((m) => m.repeat?.id === 'r' && m.repeat.count === 3)).toBe(true);
  });
});


describe('delete selected chord pitches', () => {
  it('removes only the chosen member, preserves rhythm, and supports undo', () => {
    const score = makeScore([{ kind: 'chord', durationQN: 2, notes: [{midi:72}, {midi:60}, {midi:67}] }, {kind:'note',midi:64,durationQN:2}]);
    const state: EditorState = {score,past:[],future:[],isDirty:false};
    const next = editorReducer(state, {type:'delete-selected-pitches',refs:[{trackIndex:0,measureIndex:0,voice:0,eventIndex:0,member:1}]});
    expect(next.score.tracks[0].measures[0].voices[0].events[0]).toMatchObject({kind:'chord',durationQN:2,notes:[{midi:67},{midi:72}]});
    expect(editorReducer(next,{type:'undo'}).score).toEqual(score);
  });
  it('replaces a single note or all selected chord members with an equal-duration rest', () => {
    const score=makeScore([{kind:'chord',durationQN:1,notes:[{midi:60},{midi:64}]},{kind:'note',midi:67,durationQN:3}]);
    const next=editorReducer({score,past:[],future:[],isDirty:false},{type:'delete-selected-pitches',refs:[
      {trackIndex:0,measureIndex:0,voice:0,eventIndex:0,member:0},
      {trackIndex:0,measureIndex:0,voice:0,eventIndex:0,member:1},
      {trackIndex:0,measureIndex:0,voice:0,eventIndex:1,member:0},
    ]});
    expect(next.score.tracks[0].measures[0].voices[0].events).toMatchObject([{kind:'rest',durationQN:1},{kind:'rest',durationQN:3}]);
  });
});


describe('deletion preserves musical time', () => {
  it.each([
    { durationQN: 1 },
    { durationQN: 1.5, dots: 1 as const },
    { durationQN: 1.75, dots: 2 as const },
    { durationQN: 1 / 3, tuplet: { id: 'trip', n: 3, m: 2 } },
  ])('preserves rhythm %j, following notes, repeat deletion and undo', (rhythm) => {
    const s0 = stateOf(makeScore([{kind:'note', midi:60, ...rhythm}, {kind:'note', midi:64, durationQN:1}]));
    const action = {type:'delete-event' as const, trackIndex:0, measureIndex:0, eventIndex:0};
    const s1 = editorReducer(s0, action);
    expect(events(s1)[0]).toMatchObject({kind:'rest', ...rhythm});
    expect(events(s1)[1]).toMatchObject({kind:'note', midi:64, durationQN:1});
    expect(editorReducer(s1, action)).toBe(s1);
    expect(editorReducer(s1, {type:'delete-events', refs:[{trackIndex:0, measureIndex:0, voice:0, eventIndex:0}]})).toBe(s1);
    expect(editorReducer(s1, {type:'undo'}).score).toEqual(s0.score);
  });
});

it('reconciles the opening tempo with the score without deleting later tempo changes, and supports undo', () => {
  const score=scoreWithTempoMarks();
  score.tracks[0].measures[0].tempoChange=100;
  const before=JSON.stringify(score);
  const s0=stateOf(score);
  const s1=editorReducer(s0,{type:'set-score-meta',initialTempo:120});
  expect(s1.score.initialTempo).toBe(120);
  expect(s1.score.tracks[0].measures.map(m=>m.tempoChange)).toEqual([120,120,100]);
  expect(JSON.stringify(score)).toBe(before);
  expect(editorReducer(s1,{type:'undo'}).score).toEqual(score);
});

it('stores a separate admin playback override and resets to the uploaded score without changing its tempo',()=>{
 const score=makeScore([]);score.initialTempo=90;
 const initial=stateOf(score);
 const overridden=editorReducer(initial,{type:'set-playback-tempo',bpm:110});
 expect(overridden.score.initialTempo).toBe(90);
 expect(overridden.score.playbackTempoOverride).toBe(110);
 const reset=editorReducer(overridden,{type:'set-playback-tempo',bpm:null});
 expect(reset.score.initialTempo).toBe(90);
 expect(reset.score.playbackTempoOverride).toBeUndefined();
});

describe('whole-score meter changes', () => {
  it('replaces all meter overrides, preserves notes and uses the new capacity', () => {
    const score=makeScore([{kind:'note',midi:60,durationQN:1}]);
    score.tracks[0].measures[0].timeSignature=[4,4];
    score.tracks[0].measures.push({number:2,timeSignature:[3,4],voices:[{number:1,events:[]}]});
    const initial=stateOf(score);
    let next=editorReducer(initial,{type:'set-score-meta',initialTimeSignature:[7,8],applyTimeSignatureToAll:true});
    expect(next.score.initialTimeSignature).toEqual([7,8]);
    expect(next.score.tracks[0].measures.every(m=>m.timeSignature===undefined)).toBe(true);
    expect(events(next)).toEqual(events(initial));
    next=editorReducer(next,{type:'add-note',trackIndex:0,measureIndex:0,midi:62,durationQN:2});
    next=editorReducer(next,{type:'add-note',trackIndex:0,measureIndex:0,midi:64,durationQN:0.5});
    expect(events(next)).toHaveLength(3);
    expect(editorReducer(next,{type:'add-note',trackIndex:0,measureIndex:0,midi:65,durationQN:0.5})).toBe(next);
    expect(initial.score.tracks[0].measures[1].timeSignature).toEqual([3,4]);
  });
});

it('stores video effects in the score draft, preserves them through serialization, and supports undo', async () => {
  const { parseScoreDocument } = await import('@/components/playsense-studio/shared/score-model/serialization');
  const original = stateOf(makeScore([]));
  const enabled = editorReducer(original, { type: 'set-score-meta', videoCoaching: 'cascara-v1' });
  expect(original.score.videoCoaching).toBeUndefined();
  expect(parseScoreDocument(enabled.score).videoCoaching).toBe('cascara-v1');
  const disabled = editorReducer(enabled, { type: 'set-score-meta', videoCoaching: null });
  expect(parseScoreDocument(disabled.score).videoCoaching).toBeNull();
  expect(editorReducer(disabled, { type: 'undo' }).score.videoCoaching).toBe('cascara-v1');
});
