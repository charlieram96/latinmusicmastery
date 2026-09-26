import { describe, expect, it } from 'vitest';
import { clipFromMeasures, prepareStructuralEdit } from '../structural-timing';
import { nudgeDelta, seedMarkerState, setMarkerTime, setNoteTime, type MarkerState } from '../marker-model';
import { buildWaypoints } from '@/lib/playsense-studio/sync-seed';
import { walkMeasures } from '@/lib/playsense-studio/time-mapping';
import type { Measure, ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

function bar(number: number, extras: Partial<Measure> = {}): Measure {
  return { number, voices: [{ number: 1, events: [1, 2, 3, 4].map(() => ({ kind: 'note' as const, midi: 60, durationQN: 1 })) }], ...extras };
}
function score(bars: number): ScoreDocument {
  return {
    schemaVersion: 1, title: 's', sourceFormat: 'native', initialTempo: 120, initialTimeSignature: [4, 4], initialKeyFifths: 0,
    tracks: [{ index: 0, instrument: 'staff', displayName: 'S', tuning: null, stringMultiplicity: 1, channel: null, defaultView: 'staff',
      measures: Array.from({ length: bars }, (_, i) => bar(i + 1)) }],
  };
}
/** 4 bars, bar 2's beat 2 dragged, a nudge in bar 3, and bar 4 slowed to 3 s by dragging the tail. */
function synced(): { score: ScoreDocument; markers: MarkerState } {
  const s = score(4);
  let m = seedMarkerState(s.tracks[0], s, buildWaypoints(s, 120, 0));
  m = setMarkerTime(m, { measureNumber: 2, beatInMeasure: 2 }, 2.7);
  m = setNoteTime(m, 9, 4.55);
  return { score: s, markers: m };
}
const starts = (m: MarkerState) => m.measures.map((x) => x.beats[0].videoTimeSeconds);

function ok<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  if (!r.ok) throw new Error((r as { problem?: string }).problem);
  return r as Extract<T, { ok: true }>;
}

function agree(r: { score: ScoreDocument; markers: MarkerState }) {
  const rows = [...walkMeasures(r.score.tracks[0], r.score)];
  expect(r.markers.measures).toHaveLength(rows.length);
  rows.forEach((row, i) => {
    expect(r.markers.measures[i].measureNumber).toBe(row.measure.number);
    expect(r.markers.measures[i].downbeatQN).toBe(row.state.cumulativeQN);
  });
}

describe('prepareStructuralEdit', () => {
  it('insert-measure takes the neighbouring bar\'s pace and ripples', () => {
    const { score: s, markers } = synced();
    const r = ok(prepareStructuralEdit(markers, s, { type: 'insert-measure', trackIndex: 0, index: 1 }));
    agree(r);
    expect(starts(r.markers)).toEqual([0, 2, 4, 6, 8].map((t) => expect.closeTo(t, 9)));
    expect(r.markers.tailVideoTimeSeconds).toBeCloseTo(10, 9);
    expect(r.markers.measures[2].beats[1].videoTimeSeconds).toBeCloseTo(4.7, 9);
    expect(nudgeDelta(r.markers, 13)).toBeCloseTo(0.05, 9);
  });

  it('insert at 0 uses the first bar\'s pace; add-measure appends after the tail', () => {
    const { score: s, markers } = synced();
    const first = ok(prepareStructuralEdit(markers, s, { type: 'insert-measure', trackIndex: 0, index: 0 }));
    expect(starts(first.markers)).toEqual([0, 2, 4, 6, 8].map((t) => expect.closeTo(t, 9)));
    const added = ok(prepareStructuralEdit(markers, s, { type: 'add-measure', trackIndex: 0 }));
    agree(added);
    expect(starts(added.markers)).toEqual([0, 2, 4, 6, 8].map((t) => expect.closeTo(t, 9)));
    expect(added.markers.tailVideoTimeSeconds).toBeCloseTo(10, 9);
  });

  it('delete-measures slides later bars earlier', () => {
    const { score: s, markers } = synced();
    const r = ok(prepareStructuralEdit(markers, s, { type: 'delete-measures', trackIndex: 0, start: 1, count: 2 }));
    agree(r);
    expect(starts(r.markers)).toEqual([0, 2].map((t) => expect.closeTo(t, 9)));
    expect(r.markers.tailVideoTimeSeconds).toBeCloseTo(4, 9);
  });

  it('repeat-measures gives every pass the source\'s span', () => {
    const { score: s, markers } = synced();
    const r = ok(prepareStructuralEdit(markers, s, { type: 'repeat-measures', trackIndex: 0, start: 1, end: 2, count: 3, id: 'g' }));
    agree(r);
    expect(r.score.tracks[0].measures).toHaveLength(8);
    expect(starts(r.markers)).toEqual([0, 2, 4, 6, 8, 10, 12, 14].map((t) => expect.closeTo(t, 9)));
    // Beat 2 of every pass's first bar sits at +0.7; each pass's second bar carries the nudge.
    for (const i of [1, 3, 5]) expect(r.markers.measures[i].beats[1].videoTimeSeconds).toBeCloseTo(starts(r.markers)[i] + 0.7, 9);
    for (const i of [2, 4, 6]) expect(nudgeDelta(r.markers, r.markers.measures[i].downbeatQN + 1)).toBeCloseTo(0.05, 9);
  });

  it('paste-measures reuses the clip\'s timing', () => {
    const { score: s, markers } = synced();
    const clip = clipFromMeasures(markers, s, 0, 1, 2);
    expect(clip.timing).toHaveLength(2);
    expect(clip.context).toEqual({ bpm: 120, timeSignature: [4, 4], keyFifths: 0 });
    const r = ok(prepareStructuralEdit(markers, s, { type: 'paste-measures', trackIndex: 0, index: 4, clip }));
    agree(r);
    expect(starts(r.markers)).toEqual([0, 2, 4, 6, 8, 10].map((t) => expect.closeTo(t, 9)));
    expect(r.markers.measures[4].beats[1].videoTimeSeconds).toBeCloseTo(8.7, 9);
    expect(nudgeDelta(r.markers, r.markers.measures[5].downbeatQN + 1)).toBeCloseTo(0.05, 9);
  });

  it('clipFromMeasures carries only the slurs whose two ends are in the copied bars', () => {
    const { score: s, markers } = synced();
    s.tracks[0].measures.forEach((m, i) => m.voices[0].events.forEach((e, j) => { e.id = `m${i}n${j}`; }));
    s.spans = [
      { id: 'in', type: 'slur', from: 'm1n0', to: 'm2n3' },
      { id: 'out', type: 'slur', from: 'm0n3', to: 'm1n0' },
    ];
    expect(clipFromMeasures(markers, s, 0, 1, 2).notationSpans).toEqual([s.spans[0]]);
  });

  it('append-score paces the new bars like the last existing bar, honouring their meter', () => {
    const { score: s, markers } = synced();
    const imported: ScoreDocument = { ...score(2), initialTempo: 60, initialTimeSignature: [3, 4] };
    const r = ok(prepareStructuralEdit(markers, s, { type: 'append-score', score: imported }));
    agree(r);
    // Last existing bar: 2 s for 4 QN → 0.5 s/QN; 3/4 bars → 1.5 s each.
    expect(starts(r.markers)).toEqual([0, 2, 4, 6, 8, 9.5].map((t) => expect.closeTo(t, 9)));
    expect(r.markers.tailVideoTimeSeconds).toBeCloseTo(11, 9);
  });

  it('surfaces guard problems instead of throwing', () => {
    const { score: s, markers } = synced();
    const r = prepareStructuralEdit(markers, s, { type: 'delete-measures', trackIndex: 0, start: 0, count: 4 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problem).toMatch(/at least one/);
  });

  it('set-repeat-count: new passes take pass 1’s timing and later bars move to make room', () => {
    const s = score(3);
    const markers = seedMarkerState(s.tracks[0], s, buildWaypoints(s, 120, 0));
    const rep = ok(prepareStructuralEdit(markers, s, { type: 'repeat-measures', trackIndex: 0, start: 0, end: 0, count: 2, id: 'g' }));
    const r = ok(prepareStructuralEdit(rep.markers, rep.score, { type: 'set-repeat-count', trackIndex: 0, id: 'g', count: 3 }));
    agree(r);
    expect(starts(r.markers)).toEqual([0, 2, 4, 6, 8].map((t) => expect.closeTo(t, 9)));
    expect(r.markers.tailVideoTimeSeconds).toBeCloseTo(10, 9);
  });
});
