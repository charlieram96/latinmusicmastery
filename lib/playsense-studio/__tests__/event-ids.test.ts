import { describe, expect, it } from 'vitest';
import type { Measure, ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { passEventId, pruneSpans, reidMeasures, withPassIds } from '../event-ids';
import { ensureEventIds } from '@/components/playsense-studio/shared/score-model/accessors';
import { editorReducer, initialEditorState } from '../editor-state';
import { repeatGroups } from '../repeats';

const bar = (ids: string[], tuplet?: string): Measure => ({
  number: 1,
  voices: [{ number: 1, events: ids.map((id) => ({ kind: 'note' as const, id, midi: 60, durationQN: 1, ...(tuplet ? { tuplet: { id: tuplet, n: 3, m: 2 } } : {}) })) }],
});
const doc = (measures: Measure[], spans?: ScoreDocument['spans']): ScoreDocument => ({
  schemaVersion: 1, title: 't', sourceFormat: 'native', initialTempo: 100, initialTimeSignature: [4, 4], initialKeyFifths: 0, spans,
  tracks: [{ index: 0, instrument: 'piano', displayName: 'P', tuning: null, stringMultiplicity: 1, channel: 0, defaultView: 'staff', measures }],
});

describe('event ids', () => {
  it('ensureEventIds replaces duplicates and keeps the first', () => {
    let n = 0;
    const out = ensureEventIds(doc([bar(['a', 'a', 'b'])]), () => `n${++n}`);
    expect(out.tracks[0].measures[0].voices[0].events.map((e) => e.id)).toEqual(['a', 'n1', 'b']);
  });
  it('opening an old score assigns ids without marking it dirty (Review Focus 1)', () => {
    const s = initialEditorState(doc([{ number: 1, voices: [{ number: 1, events: [{ kind: 'note', midi: 60, durationQN: 4 }] }] }]));
    expect(s.isDirty).toBe(false);
    expect(s.past).toEqual([]);
    expect(s.score.tracks[0].measures[0].voices[0].events[0].id).toMatch(/^e/);
  });
  it('re-ids copies and carries the slurs inside them', () => {
    let n = 0;
    const { measures, spans } = reidMeasures([bar(['a', 'b'], 'T')], [
      { id: 's1', type: 'slur', from: 'a', to: 'b' },
      { id: 's2', type: 'slur', from: 'b', to: 'zz' },
    ], () => `k${++n}`);
    const ids = measures[0].voices[0].events.map((e) => e.id);
    expect(ids).not.toContain('a');
    expect(new Set(measures[0].voices[0].events.map((e) => e.tuplet?.id)).size).toBe(1);
    expect(measures[0].voices[0].events[0].tuplet?.id).not.toBe('T');
    expect(spans).toHaveLength(1);
    expect([spans[0].from, spans[0].to]).toEqual(ids);
    expect(spans[0].id).not.toBe('s1');
  });
  it('repeat passes get stable, distinct ids', () => {
    expect(passEventId('a', 0)).toBe('a');
    expect(passEventId('a', 2)).toBe('a~2');
    expect(passEventId('a~2', 1)).toBe('a~1');
    const p2 = withPassIds(bar(['a', 'b'], 'T'), 2);
    expect(p2.voices[0].events.map((e) => e.id)).toEqual(['a~2', 'b~2']);
    expect(p2.voices[0].events[0].tuplet?.id).toBe('T~2');
  });
  it('prunes spans that lost an end', () => {
    expect(pruneSpans(doc([bar(['a'])], [{ id: 's', type: 'slur', from: 'a', to: 'gone' }]))).toEqual([]);
  });
});

describe('opening a score saved before per-pass ids (fix round 2)', () => {
  const tagged = (m: Measure, pass: number, number: number): Measure =>
    ({ ...m, number, repeat: { id: 'r', pass, count: 2, offset: 0, length: 1 } });
  const noIds = (midi: number): Measure => ({ number: 1, voices: [{ number: 1, events: [
    { kind: 'note', midi, durationQN: 2 }, { kind: 'note', midi: midi + 2, durationQN: 2, tuplet: { id: 'T', n: 3, m: 2 } },
  ] }] });
  const ids = (s: ScoreDocument, i: number) => s.tracks[0].measures[i].voices[0].events.map((e) => e.id);

  it('keeps a repeat without ids a group, and an unrelated edit keeps its tags', () => {
    const s = initialEditorState(doc([tagged(noIds(60), 0, 1), tagged(noIds(60), 1, 2), { ...noIds(64), number: 3 }]));
    expect(s.isDirty).toBe(false);
    expect(s.past).toEqual([]);
    expect(repeatGroups(s.score.tracks[0])).toEqual([{ id: 'r', start: 0, length: 1, count: 2 }]);
    const [a, b] = ids(s.score, 0);
    expect(ids(s.score, 1)).toEqual([`${a}~1`, `${b}~1`]);
    expect(s.score.tracks[0].measures[1].voices[0].events[1].tuplet?.id).toBe('T~1');
    const edited = editorReducer(s, { type: 'set-event-pitch', trackIndex: 0, measureIndex: 2, eventIndex: 0, midi: 70 });
    expect(edited.score.tracks[0].measures.map((m) => m.repeat?.id ?? null)).toEqual(['r', 'r', null]);
    expect(repeatGroups(edited.score.tracks[0])).toHaveLength(1);
  });

  it('gives passes that shared pass 0\'s ids their own pass ids', () => {
    const s = initialEditorState(doc([tagged(bar(['a']), 0, 1), tagged(bar(['a']), 1, 2)]));
    expect([ids(s.score, 0), ids(s.score, 1)].flat()).toEqual(['a', 'a~1']);
    expect(repeatGroups(s.score.tracks[0])).toEqual([{ id: 'r', start: 0, length: 1, count: 2 }]);
    expect(s.isDirty).toBe(false);
  });

  it('keeps a slur saved on pass 0', () => {
    const slur = { id: 's1', type: 'slur' as const, from: 'a', to: 'b' };
    const s = initialEditorState(doc([tagged(bar(['a', 'b']), 0, 1), tagged(bar(['a', 'b']), 1, 2)], [slur]));
    expect(ids(s.score, 0)).toEqual(['a', 'b']);
    expect(ids(s.score, 1)).toEqual(['a~1', 'b~1']);
    expect(s.score.spans).toEqual([slur]);
    expect(pruneSpans(s.score)).toEqual([slur]);
  });

  it('leaves bars whose passes differ to plain id repair', () => {
    const s = initialEditorState(doc([tagged(bar(['a']), 0, 1), tagged({ ...bar(['a']), voices: [{ number: 1, events: [{ kind: 'note', id: 'a', midi: 61, durationQN: 1 }] }] }, 1, 2)]));
    const all = [ids(s.score, 0), ids(s.score, 1)].flat();
    expect(all[0]).toBe('a');
    expect(new Set(all).size).toBe(2);
  });

  it('never lets a group pass id collide with an id held elsewhere', () => {
    const s = initialEditorState(doc([bar(['a~1']), tagged(bar(['a']), 0, 2), tagged(bar(['a']), 1, 3)]));
    const all = [0, 1, 2].flatMap((i) => ids(s.score, i));
    expect(new Set(all).size).toBe(3);
    expect(repeatGroups(s.score.tracks[0])).toHaveLength(1);
  });
});
