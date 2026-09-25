import { describe, expect, it } from 'vitest';
import { editorReducer, type EditorState } from '../editor-state';
import { repeatGroups } from '../repeats';
import type { Measure, MusicalEvent, ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

const n = (midi: number, durationQN = 1, id = `n${midi}`): MusicalEvent => ({ kind: 'note', midi, durationQN, id });
const bar = (number: number, v0: MusicalEvent[], v1?: MusicalEvent[]): Measure => ({
  number, voices: v1 ? [{ number: 1, events: v0 }, { number: 2, events: v1 }] : [{ number: 1, events: v0 }],
});
const doc = (measures: Measure[], keyFifths = 0): ScoreDocument => ({
  schemaVersion: 1, title: 't', sourceFormat: 'native', initialTempo: 100, initialTimeSignature: [4, 4], initialKeyFifths: keyFifths,
  tracks: [{ index: 0, instrument: 'piano', displayName: 'P', tuning: null, stringMultiplicity: 1, channel: 0, defaultView: 'staff', measures }],
});
const st = (s: ScoreDocument): EditorState => ({ score: s, past: [], future: [], isDirty: false });
const ev = (s: EditorState, m = 0, v = 0) => s.score.tracks[0].measures[m].voices[v]?.events ?? [];
const at = (measureIndex: number, eventIndex: number, voice: 0 | 1 = 0) => ({ trackIndex: 0, measureIndex, voice, eventIndex });

describe('marks', () => {
  const r = { trackIndex: 0, measureIndex: 0, voice: 0 as const, eventIndex: 0 };
  it('toggles articulations in the array form, migrating the legacy field', () => {
    const s0 = st(doc([bar(1, [{ ...n(60), articulation: 'accent' }])]));
    const s1 = editorReducer(s0, { type: 'toggle-events-articulation', refs: [r], articulation: 'staccato' });
    expect(ev(s1)[0]).toMatchObject({ articulations: ['accent', 'staccato'] });
    expect(ev(s1)[0]).not.toHaveProperty('articulation');
    const s2 = editorReducer(s1, { type: 'toggle-events-articulation', refs: [r], articulation: 'accent' });
    expect(ev(s2)[0]).toMatchObject({ articulations: ['staccato'] });
  });
  it('sets and clears ornaments, dynamics and text', () => {
    let s = editorReducer(st(doc([bar(1, [n(60)])])), { type: 'set-events-ornament', refs: [r], ornament: 'trill' });
    s = editorReducer(s, { type: 'set-events-dynamic', refs: [r], dynamic: 'mf' });
    s = editorReducer(s, { type: 'set-event-text', ref: r, text: '  dolce  ' });
    expect(ev(s)[0]).toMatchObject({ ornament: 'trill', dynamic: 'mf', text: 'dolce' });
    s = editorReducer(s, { type: 'set-event-text', ref: r, text: '' });
    expect(ev(s)[0]).not.toHaveProperty('text');
  });
  it('toggles a grace note a step above', () => {
    const s1 = editorReducer(st(doc([bar(1, [n(60)])])), { type: 'toggle-event-grace', ref: r, slash: true, keyFifths: 0 });
    expect(ev(s1)[0]).toMatchObject({ grace: [{ midi: 62, slash: true }] });
    expect(ev(editorReducer(s1, { type: 'toggle-event-grace', ref: r, slash: true, keyFifths: 0 }))[0]).not.toHaveProperty('grace');
  });
  // Extra coverage beyond the brief.
  it('skips rests for articulations, ornaments and grace, but lets a dynamic sit on a rest', () => {
    const s0 = st(doc([bar(1, [{ kind: 'rest', durationQN: 4, id: 'r' }])]));
    expect(editorReducer(s0, { type: 'toggle-events-articulation', refs: [r], articulation: 'accent' })).toBe(s0);
    expect(editorReducer(s0, { type: 'set-events-ornament', refs: [r], ornament: 'trill' })).toBe(s0);
    expect(editorReducer(s0, { type: 'toggle-event-grace', ref: r, slash: false, keyFifths: 0 })).toBe(s0);
    expect(ev(editorReducer(s0, { type: 'set-events-dynamic', refs: [r], dynamic: 'p' }))[0]).toMatchObject({ dynamic: 'p' });
  });
  it('drops the last articulation and the legacy field, trims text to 60 and replaces a grace of the other kind', () => {
    const s1 = editorReducer(st(doc([bar(1, [{ ...n(60), articulation: 'accent' }])])), { type: 'toggle-events-articulation', refs: [r], articulation: 'accent' });
    expect(ev(s1)[0]).not.toHaveProperty('articulations');
    expect(ev(s1)[0]).not.toHaveProperty('articulation');
    const s2 = editorReducer(s1, { type: 'set-event-text', ref: r, text: 'x'.repeat(80) });
    expect((ev(s2)[0].text ?? '').length).toBe(60);
    const s3 = editorReducer(s2, { type: 'toggle-event-grace', ref: r, slash: true, keyFifths: 0 });
    const s4 = editorReducer(s3, { type: 'toggle-event-grace', ref: r, slash: false, keyFifths: 0 });
    expect(ev(s4)[0].grace).toEqual([{ midi: 62, spelling: { step: 'D', alter: 0 }, slash: false }]);
  });
  it('puts the grace a step above the top note of a chord, in the key', () => {
    const chord: MusicalEvent = { kind: 'chord', durationQN: 4, id: 'c', notes: [{ midi: 60 }, { midi: 64 }] };
    const s = editorReducer(st(doc([bar(1, [chord])], 2)), { type: 'toggle-event-grace', ref: r, slash: false, keyFifths: 2 });
    expect(ev(s)[0].grace).toEqual([{ midi: 66, spelling: { step: 'F', alter: 1 }, slash: false }]);
  });
  it('toggles a tie on a note and refuses a rest', () => {
    const s1 = editorReducer(st(doc([bar(1, [n(60, 4)]), bar(2, [n(60, 4, 'b')])])), { type: 'toggle-event-tie', ref: r });
    expect(ev(s1)[0]).toMatchObject({ tieToNext: true });
    expect(ev(editorReducer(s1, { type: 'toggle-event-tie', ref: r }))[0]).not.toHaveProperty('tieToNext');
    const rest = st(doc([bar(1, [{ kind: 'rest', durationQN: 4 }])]));
    expect(editorReducer(rest, { type: 'toggle-event-tie', ref: r })).toBe(rest);
  });
});

describe('tuplets', () => {
  const r = { trackIndex: 0, measureIndex: 0, voice: 0 as const, eventIndex: 0 };
  it('splits a quarter into a 3:2 group and merges it back', () => {
    const s1 = editorReducer(st(doc([bar(1, [n(60, 1, 'q'), n(62, 3)])])), { type: 'apply-tuplet', ref: r, n: 3, m: 2 });
    const g = ev(s1).slice(0, 3);
    expect(g.map((e) => e.durationQN)).toEqual([1 / 3, 1 / 3, 1 / 3].map((x) => expect.closeTo(x, 9)));
    expect(new Set(g.map((e) => e.tuplet?.id)).size).toBe(1);
    expect(g[0].id).toBe('q');
    const s2 = editorReducer(s1, { type: 'apply-tuplet', ref: { ...r, eventIndex: 1 }, n: 3, m: 2 });
    expect(ev(s2).map((e) => e.durationQN)).toEqual([1, 3]);
    expect(ev(s2)[0]).not.toHaveProperty('tuplet');
  });
  it('makes 5:4 from a quarter and refuses a dotted note', () => {
    const s1 = editorReducer(st(doc([bar(1, [n(60, 1), n(62, 3)])])), { type: 'apply-tuplet', ref: r, n: 5, m: 4 });
    expect(ev(s1).slice(0, 5).map((e) => e.durationQN)).toEqual(Array(5).fill(expect.closeTo(0.2, 9)));
    const dotted = st(doc([bar(1, [{ ...n(60, 1.5), dots: 1 }, n(62, 2.5)])]));
    expect(editorReducer(dotted, { type: 'apply-tuplet', ref: r, n: 3, m: 2 })).toBe(dotted);
  });
  // Extra coverage beyond the brief.
  it('keeps the marks on the first member only and gives the others fresh ids', () => {
    const marked: MusicalEvent = { ...n(60, 1, 'q'), articulations: ['accent'], dynamic: 'f', text: 'solo' };
    const s1 = editorReducer(st(doc([bar(1, [marked, n(62, 3)])])), { type: 'apply-tuplet', ref: r, n: 3, m: 2 });
    const [a, b, c] = ev(s1);
    expect(a).toMatchObject({ id: 'q', articulations: ['accent'], dynamic: 'f', text: 'solo', midi: 60 });
    expect(Object.keys(b).sort()).toEqual(['durationQN', 'id', 'kind', 'midi', 'tuplet']);
    expect(new Set([a.id, b.id, c.id]).size).toBe(3);
  });
  it('merges a legacy id-less triplet run back into one event', () => {
    const s0 = st(doc([bar(1, [{ ...n(60, 1 / 3), triplet: true }, { ...n(62, 1 / 3), triplet: true }, { ...n(64, 1 / 3), triplet: true }, n(65, 3)])]));
    const s1 = editorReducer(s0, { type: 'apply-tuplet', ref: { ...r, eventIndex: 2 }, n: 3, m: 2 });
    expect(ev(s1)).toEqual([{ kind: 'note', midi: 60, durationQN: 1, id: 'n60' }, n(65, 3)]);
  });
  it('refuses a merge whose total is not a note value', () => {
    const t = { id: 'g', n: 3, m: 2 };
    const s0 = st(doc([bar(1, [{ ...n(60, 1 / 3), tuplet: t }, { ...n(62, 1 / 3), tuplet: t }, n(65, 3)])]));
    expect(editorReducer(s0, { type: 'apply-tuplet', ref: r, n: 3, m: 2 })).toBe(s0);
  });
  it('a tuplet made on pass 2 reaches pass 1 and the group stays a group (Review Focus 2)', () => {
    let s = st(doc([bar(1, [n(60, 1, 'a'), n(62, 3, 'b')]), bar(2, [n(64, 4, 'c')])]));
    s = editorReducer(s, { type: 'repeat-measures', trackIndex: 0, start: 0, end: 0, count: 2, id: 'r' });
    s = editorReducer(s, { type: 'apply-tuplet', ref: at(1, 0), n: 3, m: 2 });
    expect(ev(s, 0).map((e) => e.durationQN)).toHaveLength(4);
    expect(ev(s, 0)[0].tuplet?.id).toBe(ev(s, 1)[0].tuplet?.id.replace(/~1$/, ''));
    expect(repeatGroups(s.score.tracks[0])).toHaveLength(1);
  });
});

describe('slurs', () => {
  it('adds a slur to the next note, then toggles it off', () => {
    const s0 = st(doc([bar(1, [n(60, 2, 'a')]), bar(2, [n(62, 4, 'b')])]));
    const from = { trackIndex: 0, measureIndex: 0, voice: 0 as const, eventIndex: 0 };
    const s1 = editorReducer(s0, { type: 'toggle-span', spanType: 'slur', from });
    expect(s1.score.spans).toEqual([expect.objectContaining({ type: 'slur', from: 'a', to: 'b' })]);
    expect(editorReducer(s1, { type: 'toggle-span', spanType: 'slur', from }).score.spans).toEqual([]);
  });
  it('mirrors a slur to every pass of a repeat (Review Focus 2)', () => {
    let s = st(doc([bar(1, [n(60, 2, 'a'), n(62, 2, 'b')]), bar(2, [n(64, 4, 'c')])]));
    s = editorReducer(s, { type: 'repeat-measures', trackIndex: 0, start: 0, end: 0, count: 2, id: 'r' });
    const s1 = editorReducer(s, { type: 'toggle-span', spanType: 'slur', from: { trackIndex: 0, measureIndex: 1, voice: 0, eventIndex: 0 }, to: { trackIndex: 0, measureIndex: 1, voice: 0, eventIndex: 1 } });
    expect(s1.score.spans?.map((x) => [x.from, x.to]).sort()).toEqual([['a', 'b'], ['a~1', 'b~1']]);
    expect(repeatGroups(s1.score.tracks[0])).toHaveLength(1);
  });
  it('a mark on pass 2 reaches pass 1', () => {
    let s = st(doc([bar(1, [n(60, 4, 'a')]), bar(2, [n(64, 4, 'c')])]));
    s = editorReducer(s, { type: 'repeat-measures', trackIndex: 0, start: 0, end: 0, count: 2, id: 'r' });
    s = editorReducer(s, { type: 'set-events-dynamic', refs: [{ trackIndex: 0, measureIndex: 1, voice: 0, eventIndex: 0 }], dynamic: 'p' });
    expect(ev(s, 0)[0]).toMatchObject({ dynamic: 'p' });
    expect(repeatGroups(s.score.tracks[0])).toHaveLength(1);
  });
  // Extra coverage beyond the brief.
  it('toggling a mirrored slur off removes it from every pass', () => {
    let s = st(doc([bar(1, [n(60, 2, 'a'), n(62, 2, 'b')]), bar(2, [n(64, 4, 'c')])]));
    s = editorReducer(s, { type: 'repeat-measures', trackIndex: 0, start: 0, end: 0, count: 2, id: 'r' });
    s = editorReducer(s, { type: 'toggle-span', spanType: 'slur', from: at(0, 0) });
    expect(s.score.spans).toHaveLength(2);
    s = editorReducer(s, { type: 'toggle-span', spanType: 'slur', from: at(1, 0) });
    expect(s.score.spans).toEqual([]);
  });
  it('does not mirror a slur whose end leaves the repeat', () => {
    let s = st(doc([bar(1, [n(60, 4, 'a')]), bar(2, [n(64, 4, 'c')])]));
    s = editorReducer(s, { type: 'repeat-measures', trackIndex: 0, start: 0, end: 0, count: 2, id: 'r' });
    s = editorReducer(s, { type: 'toggle-span', spanType: 'slur', from: at(1, 0) });
    expect(s.score.spans?.map((x) => [x.from, x.to])).toEqual([['a~1', 'c']]);
  });
  it('refuses a span that runs backwards or has no next event, and keeps span ids on the s prefix', () => {
    const s0 = st(doc([bar(1, [n(60, 2, 'a'), n(62, 2, 'b')])]));
    expect(editorReducer(s0, { type: 'toggle-span', spanType: 'slur', from: at(0, 1), to: at(0, 0) })).toBe(s0);
    expect(editorReducer(s0, { type: 'toggle-span', spanType: 'slur', from: at(0, 1) })).toBe(s0);
    const s1 = editorReducer(s0, { type: 'toggle-span', spanType: 'cresc', from: at(0, 0), to: at(0, 1) });
    expect(s1.score.spans).toEqual([{ id: expect.stringMatching(/^s/), type: 'cresc', from: 'a', to: 'b' }]);
    expect(s1.past).toHaveLength(1);
  });
});

describe('fix round 1', () => {
  const r = { trackIndex: 0, measureIndex: 0, voice: 0 as const, eventIndex: 0 };
  it('a slur across a pass boundary is added once, not mirrored', () => {
    let s = st(doc([bar(1, [n(60, 2, 'a'), n(62, 2, 'z')]), bar(2, [n(64, 4, 'c')])]));
    s = editorReducer(s, { type: 'repeat-measures', trackIndex: 0, start: 0, end: 0, count: 3, id: 'r' });
    s = editorReducer(s, { type: 'toggle-span', spanType: 'slur', from: at(1, 1), to: at(2, 0) });
    expect(s.score.spans?.map((x) => [x.from, x.to])).toEqual([['z~1', 'a~2']]);
    s = editorReducer(s, { type: 'toggle-span', spanType: 'slur', from: at(1, 1) });
    expect(s.score.spans).toEqual([]);
  });
  it('removing a slur across a pass boundary leaves the in-pass slurs of other passes', () => {
    let s = st(doc([bar(1, [n(60, 2, 'a'), n(62, 2, 'z')]), bar(2, [n(64, 4, 'c')])]));
    s = editorReducer(s, { type: 'repeat-measures', trackIndex: 0, start: 0, end: 0, count: 3, id: 'r' });
    s = editorReducer(s, { type: 'toggle-span', spanType: 'slur', from: at(0, 1), to: at(1, 0) });
    s = editorReducer(s, { type: 'toggle-span', spanType: 'slur', from: at(1, 0), to: at(1, 1) });
    expect(s.score.spans).toHaveLength(4);
    s = editorReducer(s, { type: 'toggle-span', spanType: 'slur', from: at(0, 1) });
    expect(s.score.spans?.map((x) => [x.from, x.to]).sort()).toEqual([['a', 'z'], ['a~1', 'z~1'], ['a~2', 'z~2']]);
  });
  it('a tuplet merge drops slurs orphaned by the merge', () => {
    let s = editorReducer(st(doc([bar(1, [n(60, 1, 'q'), n(62, 3)])])), { type: 'apply-tuplet', ref: r, n: 3, m: 2 });
    s = editorReducer(s, { type: 'toggle-span', spanType: 'slur', from: at(0, 1), to: at(0, 2) });
    expect(s.score.spans).toHaveLength(1);
    s = editorReducer(s, { type: 'apply-tuplet', ref: r, n: 3, m: 2 });
    expect(s.score.spans).toEqual([]);
  });
  it('a tuplet merge drops orphaned slurs on every pass of a repeat', () => {
    let s = st(doc([bar(1, [n(60, 1, 'q'), n(62, 3, 'w')]), bar(2, [n(64, 4, 'c')])]));
    s = editorReducer(s, { type: 'repeat-measures', trackIndex: 0, start: 0, end: 0, count: 2, id: 'r' });
    s = editorReducer(s, { type: 'apply-tuplet', ref: r, n: 3, m: 2 });
    s = editorReducer(s, { type: 'toggle-span', spanType: 'slur', from: at(0, 1), to: at(0, 2) });
    expect(s.score.spans).toHaveLength(2);
    s = editorReducer(s, { type: 'apply-tuplet', ref: at(1, 0), n: 3, m: 2 });
    expect(ev(s, 0).map((e) => e.durationQN)).toEqual([1, 3]);
    expect(s.score.spans).toEqual([]);
    expect(repeatGroups(s.score.tracks[0])).toHaveLength(1);
  });
  it('a split moves the tie to the group’s last note, keeping the other marks on the first', () => {
    const s = editorReducer(st(doc([bar(1, [{ ...n(60, 1, 'q'), tieToNext: true, dynamic: 'p' }, n(60, 3)])])), { type: 'apply-tuplet', ref: r, n: 3, m: 2 });
    const [a, b, c] = ev(s);
    expect(a).toMatchObject({ dynamic: 'p' });
    expect(a).not.toHaveProperty('tieToNext');
    expect(b).not.toHaveProperty('tieToNext');
    expect(c).toMatchObject({ tieToNext: true });
  });
  it('a grace on a percussion stroke is the same stroke (a flam)', () => {
    const percussion = { staffLine: 'c/5', notehead: 'normal' as const, strokeId: 'snare' };
    const s = editorReducer(st(doc([bar(1, [{ kind: 'note', midi: 38, durationQN: 4, id: 'd', percussion }])])), { type: 'toggle-event-grace', ref: r, slash: true, keyFifths: 0 });
    expect(ev(s)[0].grace).toEqual([{ midi: 38, percussion, slash: true }]);
  });
  it('an automatic slur end never skips a bar', () => {
    const s0 = st(doc([bar(1, [n(60, 4, 'a')], [n(48, 4, 'v')]), bar(2, [n(62, 4, 'b')]), bar(3, [n(64, 4, 'c')], [n(50, 4, 'w')])]));
    expect(editorReducer(s0, { type: 'toggle-span', spanType: 'slur', from: at(0, 0, 1) })).toBe(s0);
    const s1 = editorReducer(s0, { type: 'toggle-span', spanType: 'slur', from: at(0, 0) });
    expect(s1.score.spans?.map((x) => [x.from, x.to])).toEqual([['a', 'b']]);
  });
});
