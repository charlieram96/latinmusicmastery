import { describe, expect, it } from 'vitest';
import type { Measure, ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { passEventId, pruneSpans, reidMeasures, withPassIds } from '../event-ids';
import { ensureEventIds } from '@/components/playsense-studio/shared/score-model/accessors';
import { initialEditorState } from '../editor-state';

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
