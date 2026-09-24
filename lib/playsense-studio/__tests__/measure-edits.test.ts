import { describe, expect, it } from 'vitest';
import { applyMeasureEdit, structuralEditProblem, type MeasureClip } from '../measure-edits';
import { editorReducer, type MeasurePropsPatch } from '../editor-state';
import { repeatGroups } from '../repeats';
import { hasFinalBarline } from '../barlines';
import { walkMeasures } from '../time-mapping';
import type { Measure, ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

function bar(number: number, midi = 60, extras: Partial<Measure> = {}): Measure {
  return { number, voices: [{ number: 1, events: [{ kind: 'note', midi, durationQN: 4 }] }], ...extras };
}

function score(measures: Measure[], instrument: ScoreDocument['tracks'][0]['instrument'] = 'staff'): ScoreDocument {
  return {
    schemaVersion: 1, title: 't', sourceFormat: 'native', initialTempo: 120,
    initialTimeSignature: [4, 4], initialKeyFifths: 0,
    tracks: [{ index: 0, instrument, displayName: 'T', tuning: null, stringMultiplicity: 1, channel: null, defaultView: 'staff', measures }],
  };
}

const three = () => score([bar(1, 60), bar(2, 62), bar(3, 64)]);
const numbers = (s: ScoreDocument) => s.tracks[0].measures.map((m) => m.number);
const midis = (s: ScoreDocument) => s.tracks[0].measures.map((m) => (m.voices[0].events[0] as { midi?: number })?.midi ?? null);

function repeated(): ScoreDocument {
  return editorReducer({ score: three(), past: [], future: [], isDirty: false },
    { type: 'repeat-measures', trackIndex: 0, start: 0, end: 1, count: 2, id: 'g' }).score;
}

function ok(r: ReturnType<typeof applyMeasureEdit>) {
  if (!r.ok) throw new Error(r.problem);
  return r;
}

describe('insert-measure', () => {
  it('inserts an empty bar at the start, middle, and end and renumbers', () => {
    for (const index of [0, 1, 3]) {
      const r = ok(applyMeasureEdit(three(), { type: 'insert-measure', trackIndex: 0, index }));
      expect(numbers(r.score)).toEqual([1, 2, 3, 4]);
      expect(r.score.tracks[0].measures[index].voices[0].events).toEqual([]);
      expect(midis(r.score).filter((m) => m !== null)).toEqual([60, 62, 64]);
      expect(r.splice).toEqual({ index, removeCount: 0, insertCount: 1 });
    }
  });

  it('keeps a following bar\'s own time signature and adds no stamps otherwise', () => {
    const s = score([bar(1), bar(2, 62, { timeSignature: [3, 4] }), bar(3)]);
    const r = ok(applyMeasureEdit(s, { type: 'insert-measure', trackIndex: 0, index: 1 }));
    expect(r.score.tracks[0].measures[1]).toEqual({ number: 2, voices: [{ number: 1, events: [] }] });
    expect(r.score.tracks[0].measures[2].timeSignature).toEqual([3, 4]);
  });

  it('is refused strictly inside a repeat group but allowed at its edges', () => {
    const s = repeated(); // bars 1-2 ×2 (indices 0..3), then bar 5
    expect(structuralEditProblem(s, { type: 'insert-measure', trackIndex: 0, index: 1 })).toMatch(/Unlink/);
    expect(structuralEditProblem(s, { type: 'insert-measure', trackIndex: 0, index: 2 })).toMatch(/Unlink/);
    expect(structuralEditProblem(s, { type: 'insert-measure', trackIndex: 0, index: 0 })).toBeNull();
    expect(structuralEditProblem(s, { type: 'insert-measure', trackIndex: 0, index: 4 })).toBeNull();
    expect(structuralEditProblem(s, { type: 'insert-measure', trackIndex: 0, index: 9 })).toMatch(/valid/);
  });

  it('keeps the repeat group intact when inserting right before it', () => {
    const r = ok(applyMeasureEdit(repeated(), { type: 'insert-measure', trackIndex: 0, index: 0 }));
    expect(repeatGroups(r.score.tracks[0])).toEqual([{ id: 'g', start: 1, length: 2, count: 2 }]);
  });

  it('add-measure is an insert at the end', () => {
    const r = ok(applyMeasureEdit(three(), { type: 'add-measure', trackIndex: 0 }));
    expect(numbers(r.score)).toEqual([1, 2, 3, 4]);
    expect(r.splice).toEqual({ index: 3, removeCount: 0, insertCount: 1 });
  });
});

describe('delete-measures', () => {
  it('removes a range and renumbers', () => {
    const r = ok(applyMeasureEdit(three(), { type: 'delete-measures', trackIndex: 0, start: 0, count: 2 }));
    expect(midis(r.score)).toEqual([64]);
    expect(numbers(r.score)).toEqual([1]);
    expect(r.splice).toEqual({ index: 0, removeCount: 2, insertCount: 0 });
  });

  it('re-stamps the next bar when the deleted bar carried a tempo or meter change', () => {
    const s = score([bar(1), bar(2, 62, { tempoChange: 90, timeSignature: [3, 4] }), bar(3), bar(4)]);
    const r = ok(applyMeasureEdit(s, { type: 'delete-measures', trackIndex: 0, start: 1, count: 1 }));
    expect(r.score.tracks[0].measures[1]).toMatchObject({ number: 2, tempoChange: 90, timeSignature: [3, 4] });
    expect(r.score.tracks[0].measures[2].tempoChange).toBeUndefined();
    // Deleting a bar with no changes adds nothing.
    const plain = ok(applyMeasureEdit(three(), { type: 'delete-measures', trackIndex: 0, start: 1, count: 1 }));
    expect(plain.score.tracks[0].measures[1]).toEqual(bar(2, 64));
  });

  it('keeps at least one bar', () => {
    expect(structuralEditProblem(three(), { type: 'delete-measures', trackIndex: 0, start: 0, count: 3 })).toMatch(/at least one/);
    expect(structuralEditProblem(three(), { type: 'delete-measures', trackIndex: 0, start: 2, count: 2 })).toMatch(/valid/);
    expect(structuralEditProblem(three(), { type: 'delete-measures', trackIndex: 0, start: 0, count: 0 })).toMatch(/valid/);
  });

  it('allows deleting a whole repeat group and refuses part of one', () => {
    const s = repeated();
    expect(structuralEditProblem(s, { type: 'delete-measures', trackIndex: 0, start: 0, count: 4 })).toBeNull();
    expect(structuralEditProblem(s, { type: 'delete-measures', trackIndex: 0, start: 1, count: 1 })).toMatch(/whole repeat/);
    expect(structuralEditProblem(s, { type: 'delete-measures', trackIndex: 0, start: 3, count: 2 })).toMatch(/whole repeat/);
    const r = ok(applyMeasureEdit(s, { type: 'delete-measures', trackIndex: 0, start: 0, count: 4 }));
    expect(midis(r.score)).toEqual([64]);
  });
});

describe('paste-measures', () => {
  const clip = (): MeasureClip => ({
    measures: [bar(9, 70, { repeat: { id: 'x', pass: 0, count: 2, offset: 0, length: 1 }, endBarline: 'final' }), bar(10, 71)],
    context: { bpm: 100, timeSignature: [4, 4], keyFifths: 2 },
    instrument: 'staff',
  });

  it('inserts clones, strips repeat and barline overrides, stamps only differing context', () => {
    const r = ok(applyMeasureEdit(three(), { type: 'paste-measures', trackIndex: 0, index: 1, clip: clip() }));
    expect(midis(r.score)).toEqual([60, 70, 71, 62, 64]);
    expect(numbers(r.score)).toEqual([1, 2, 3, 4, 5]);
    const first = r.score.tracks[0].measures[1];
    expect(first.repeat).toBeUndefined();
    expect(first.endBarline).toBeUndefined();
    expect(first.tempoChange).toBe(100);
    expect(first.keyFifths).toBe(2);
    expect(first.timeSignature).toBeUndefined();
    // The bar after the paste gets its context back.
    expect(r.score.tracks[0].measures[3]).toMatchObject({ tempoChange: 120, keyFifths: 0 });
    expect(r.splice).toEqual({ index: 1, removeCount: 0, insertCount: 2 });
  });

  it('refuses an empty clip and a percussion/pitched mismatch', () => {
    expect(structuralEditProblem(three(), { type: 'paste-measures', trackIndex: 0, index: 0, clip: { ...clip(), measures: [] } })).toMatch(/valid|nothing/i);
    expect(structuralEditProblem(three(), { type: 'paste-measures', trackIndex: 0, index: 0, clip: { ...clip(), instrument: 'perc-conga' } })).toMatch(/percussion/);
    expect(structuralEditProblem(score([bar(1)], 'perc-conga'), { type: 'paste-measures', trackIndex: 0, index: 0, clip: clip() })).toMatch(/percussion/);
  });
});

describe('append-score', () => {
  const imported = (): ScoreDocument => ({
    ...score([bar(1, 80, { tempoChange: 140 }), bar(2, 81, { tempoChange: 150 }), bar(3, 82)]),
    initialTempo: 100, initialTimeSignature: [3, 4], initialKeyFifths: -1,
  });

  it('appends after the last bar, stamping header differences on the first appended bar only', () => {
    const r = ok(applyMeasureEdit(three(), { type: 'append-score', score: imported() }));
    expect(midis(r.score)).toEqual([60, 62, 64, 80, 81, 82]);
    expect(numbers(r.score)).toEqual([1, 2, 3, 4, 5, 6]);
    const first = r.score.tracks[0].measures[3];
    expect(first.tempoChange).toBe(140); // its own override wins over the header
    expect(first.timeSignature).toEqual([3, 4]);
    expect(first.keyFifths).toBe(-1);
    expect(r.score.tracks[0].measures[4].tempoChange).toBe(150);
    expect(r.score.tracks[0].measures[5].timeSignature).toBeUndefined();
    expect(r.splice).toEqual({ index: 3, removeCount: 0, insertCount: 3 });
  });

  it('moves the automatic final bar to the new last measure', () => {
    const r = ok(applyMeasureEdit(three(), { type: 'append-score', score: imported() }));
    const ms = r.score.tracks[0].measures;
    expect(hasFinalBarline(ms, 2)).toBe(false);
    expect(hasFinalBarline(ms, 5)).toBe(true);
  });

  it('refuses an import with no measures', () => {
    const empty = { ...imported(), tracks: [{ ...imported().tracks[0], measures: [] }] };
    expect(structuralEditProblem(three(), { type: 'append-score', score: empty })).toMatch(/no measures/);
  });
});

describe('repeat-measures via applyMeasureEdit', () => {
  it('reports the splice of the expanded range', () => {
    const r = ok(applyMeasureEdit(three(), { type: 'repeat-measures', trackIndex: 0, start: 1, end: 2, count: 3, id: 'r' }));
    expect(r.splice).toEqual({ index: 1, removeCount: 2, insertCount: 6 });
    expect(numbers(r.score)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

const st = (s: ScoreDocument) => ({ score: s, past: [], future: [], isDirty: false });
const ev = (s: ScoreDocument, i: number) => s.tracks[0].measures[i].voices[0].events;

describe('clear-measures', () => {
  it('empties the bars but keeps their meter and count', () => {
    const s0 = score([bar(1), bar(2, 62, { timeSignature: [3, 4] }), bar(3)]);
    const s1 = editorReducer(st(s0), { type: 'clear-measures', trackIndex: 0, start: 1, count: 2 }).score;
    expect(numbers(s1)).toEqual([1, 2, 3]);
    expect(s1.tracks[0].measures[1].voices).toEqual([{ number: 1, events: [] }]);
    expect(s1.tracks[0].measures[1].timeSignature).toEqual([3, 4]);
    expect(ev(s1, 0)).toHaveLength(1);
  });
  it('clearing one pass of a repeat clears that bar in every pass and keeps the group (Review Focus 4)', () => {
    const s1 = editorReducer(st(repeated()), { type: 'clear-measures', trackIndex: 0, start: 2, count: 1 }).score;
    expect(ev(s1, 0)).toEqual([]);
    expect(ev(s1, 2)).toEqual([]);
    expect(ev(s1, 1)).toHaveLength(1);
    expect(ev(s1, 3)).toHaveLength(1);
    expect(repeatGroups(s1.tracks[0])).toEqual([expect.objectContaining({ id: 'g', count: 2 })]);
  });
  it('drops slurs whose notes were cleared', () => {
    const s0 = score([{ number: 1, voices: [{ number: 1, events: [
      { kind: 'note', id: 'a', midi: 60, durationQN: 2 }, { kind: 'note', id: 'b', midi: 62, durationQN: 2 }] }] }, bar(2)]);
    s0.spans = [{ id: 's', type: 'slur', from: 'a', to: 'b' }];
    expect(editorReducer(st(s0), { type: 'clear-measures', trackIndex: 0, start: 0, count: 1 }).score.spans).toEqual([]);
  });
  it('drops a slur even when its notes only disappear via a repeat clearing the OTHER pass (fix round 1)', () => {
    const s0 = score([{ number: 1, voices: [{ number: 1, events: [
      { kind: 'note', id: 'a', midi: 60, durationQN: 2 }, { kind: 'note', id: 'b', midi: 62, durationQN: 2 }] }] }]);
    s0.spans = [{ id: 's', type: 'slur', from: 'a', to: 'b' }];
    const rep = editorReducer(st(s0), { type: 'repeat-measures', trackIndex: 0, start: 0, end: 0, count: 2, id: 'g' }).score;
    // Clearing pass 2 alone (index 1) makes withHistory mirror the clear onto
    // pass 1 (index 0) too — pruning must happen after that mirroring, or the
    // slur (still pointing at pass 1's notes at prune time) survives dangling.
    const s1 = editorReducer(st(rep), { type: 'clear-measures', trackIndex: 0, start: 1, count: 1 }).score;
    expect(ev(s1, 0)).toEqual([]);
    expect(ev(s1, 1)).toEqual([]);
    expect(s1.spans).toEqual([]);
  });
});

describe('set-measure-props', () => {
  const set = (s: ScoreDocument, measureIndex: number, props: MeasurePropsPatch) =>
    editorReducer(st(s), { type: 'set-measure-props', trackIndex: 0, measureIndex, props }).score;
  it('a time signature on a later bar is an override; the inherited one removes it', () => {
    const s1 = set(three(), 1, { timeSignature: [3, 4] });
    expect(s1.tracks[0].measures[1].timeSignature).toEqual([3, 4]);
    expect(set(s1, 1, { timeSignature: [4, 4] }).tracks[0].measures[1].timeSignature).toBeUndefined();
  });
  it('bar 0 writes the score defaults', () => {
    const s1 = set(three(), 0, { tempo: 132, keyFifths: -2 });
    expect(s1.initialTempo).toBe(132);
    expect(s1.initialKeyFifths).toBe(-2);
    expect(s1.tracks[0].measures[0].tempoChange).toBeUndefined();
  });
  it('clamps tempo', () => {
    expect(set(three(), 1, { tempo: 999 }).tracks[0].measures[1].tempoChange).toBe(400);
  });
  it('toggles endings and repeat barlines', () => {
    const s1 = set(three(), 1, { volta: '1.', repeatEnd: true });
    expect(s1.tracks[0].measures[1]).toMatchObject({ volta: '1.', repeatEnd: true });
    const s2 = set(s1, 1, { volta: null, repeatEnd: false });
    expect(s2.tracks[0].measures[1].volta).toBeUndefined();
    expect(s2.tracks[0].measures[1].repeatEnd).toBeUndefined();
  });
  it('a no-op change adds no history', () => {
    const s0 = st(three());
    expect(editorReducer(s0, { type: 'set-measure-props', trackIndex: 0, measureIndex: 1, props: { timeSignature: [4, 4] } })).toBe(s0);
  });
  it('ignores a non-finite tempo but still applies the rest of the patch (fix round 1)', () => {
    const s1 = set(three(), 1, { tempo: NaN, keyFifths: 2 });
    expect(s1.tracks[0].measures[1].tempoChange).toBeUndefined();
    expect(s1.initialTempo).toBe(120);
    expect(s1.tracks[0].measures[1].keyFifths).toBe(2);
  });
  it('a repeat pass keeps its own meter anchor even when reset to what it locally inherits (fix round 1)', () => {
    // m1 plain 4/4, then group g = [m2 explicit 4/4, m3 3/4] ×2.
    const s0 = score([bar(1), bar(2, 62, { timeSignature: [4, 4] }), bar(3, 64, { timeSignature: [3, 4] })]);
    const rep = editorReducer(st(s0), { type: 'repeat-measures', trackIndex: 0, start: 1, end: 2, count: 2, id: 'g' }).score;
    // Setting m2 (index 1) back to 4/4 used to delete its override (since 4/4
    // is also what index 1 inherits from m1), which withHistory then mirrored
    // onto m4 (index 3, pass 2's copy) — losing pass 2's own anchor.
    const s1 = editorReducer(st(rep), { type: 'set-measure-props', trackIndex: 0, measureIndex: 1, props: { timeSignature: [4, 4] } }).score;
    const rows = [...walkMeasures(s1.tracks[0], s1)];
    expect(rows[3].state.timeSignature).toEqual([4, 4]); // m4: pass 2's copy of m2
    expect(rows[3].measure.number).toBe(4);
  });
  it('bar 0 in a repeat group writes the score default AND keeps its own anchor for later passes (fix round 1)', () => {
    const s0 = score([bar(1), bar(2, 62, { tempoChange: 150 })]);
    const rep = editorReducer(st(s0), { type: 'repeat-measures', trackIndex: 0, start: 0, end: 1, count: 2, id: 'g' }).score;
    // Bar 0 (index 0) is itself part of the group. Changing its tempo used to
    // delete its override (bar-0 branch always deleted), which withHistory
    // then mirrored onto index 2 (pass 2's own bar-0 copy) — so pass 2 fell
    // through to bar 2's 150 bpm instead of the new default.
    const s1 = editorReducer(st(rep), { type: 'set-measure-props', trackIndex: 0, measureIndex: 0, props: { tempo: 90 } }).score;
    expect(s1.initialTempo).toBe(90);
    const rows = [...walkMeasures(s1.tracks[0], s1)];
    expect(rows[2].state.tempo).toBe(90); // pass 2's own bar-1 copy, not bar 2's 150
  });
});

describe('duplicate-measures', () => {
  it('inserts copies right after the range', () => {
    const s1 = editorReducer(st(three()), { type: 'duplicate-measures', trackIndex: 0, start: 0, count: 2 }).score;
    expect(numbers(s1)).toEqual([1, 2, 3, 4, 5]);
    expect(midis(s1)).toEqual([60, 62, 60, 62, 64]);
  });
  it('refuses to duplicate a bar from the middle of a repeat group, leaving the group intact (fix round 1)', () => {
    const source = repeated(); // bars 1-2 ×2 (indices 0..3), then bar 3
    const state = st(source);
    // Duplicating index 1 alone would paste at index 2 — strictly inside the
    // group — which the paste-measures guard already refuses.
    const result = editorReducer(state, { type: 'duplicate-measures', trackIndex: 0, start: 1, count: 1 });
    expect(result).toBe(state);
    expect(result.score).toBe(source);
    expect(repeatGroups(result.score.tracks[0])).toEqual([{ id: 'g', start: 0, length: 2, count: 2 }]);
  });
});

describe('set-repeat-count', () => {
  it('adds passes as copies of pass 1 after the group', () => {
    const r = ok(applyMeasureEdit(repeated(), { type: 'set-repeat-count', trackIndex: 0, id: 'g', count: 3 }));
    expect(midis(r.score)).toEqual([60, 62, 60, 62, 60, 62, 64]);
    expect(r.score.tracks[0].measures.slice(0, 6).every((m) => m.repeat?.count === 3)).toBe(true);
    expect(r.score.tracks[0].measures[4].repeat?.pass).toBe(2);
    expect(r.splice).toEqual({ index: 4, removeCount: 0, insertCount: 2 });
  });
  it('removes trailing passes', () => {
    const tripled = ok(applyMeasureEdit(repeated(), { type: 'set-repeat-count', trackIndex: 0, id: 'g', count: 3 })).score;
    const r = ok(applyMeasureEdit(tripled, { type: 'set-repeat-count', trackIndex: 0, id: 'g', count: 2 }));
    expect(midis(r.score)).toEqual([60, 62, 60, 62, 64]);
    expect(r.splice).toEqual({ index: 4, removeCount: 2, insertCount: 0 });
  });
  it('refuses an unknown group, the same count or a count outside 2–8', () => {
    const s = repeated();
    expect(structuralEditProblem(s, { type: 'set-repeat-count', trackIndex: 0, id: 'nope', count: 3 })).toBe('That repeat no longer exists.');
    expect(structuralEditProblem(s, { type: 'set-repeat-count', trackIndex: 0, id: 'g', count: 2 })).toBe('It already plays that many times.');
    expect(structuralEditProblem(s, { type: 'set-repeat-count', trackIndex: 0, id: 'g', count: 9 })).toBe('Choose between 2 and 8 times.');
  });
});
