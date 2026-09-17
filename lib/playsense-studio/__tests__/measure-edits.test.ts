import { describe, expect, it } from 'vitest';
import { applyMeasureEdit, structuralEditProblem, type MeasureClip } from '../measure-edits';
import { editorReducer } from '../editor-state';
import { repeatGroups } from '../repeats';
import { hasFinalBarline } from '../barlines';
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
