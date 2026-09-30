import { describe, expect, it } from 'vitest';
import { editorReducer, type EditorState } from '../editor-state';
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
const at = (measureIndex: number, eventIndex: number | 'end', voice: 0 | 1 = 0) => ({ trackIndex: 0, measureIndex, voice, eventIndex });

describe('write-event', () => {
  it('appends at the end with a fresh id', () => {
    const s = editorReducer(st(doc([bar(1, [n(60)])])), { type: 'write-event', at: at(0, 'end'), kind: 'note', midi: 62, value: 'q' });
    expect(ev(s).map((e) => [e.kind, (e as { midi?: number }).midi, e.durationQN])).toEqual([['note', 60, 1], ['note', 62, 1]]);
    expect(ev(s)[1].id).toMatch(/^e/);
  });
  it('refuses an append that would overflow the bar (Review Focus 1)', () => {
    const s0 = st(doc([bar(1, [n(60, 2), n(62, 1.5)])]));
    expect(editorReducer(s0, { type: 'write-event', at: at(0, 'end'), kind: 'note', midi: 64, value: 'q' })).toBe(s0);
  });
  it('replaces a lone filler rest', () => {
    const s = editorReducer(st(doc([bar(1, [{ kind: 'rest', durationQN: 4 }])])), { type: 'write-event', at: at(0, 'end'), kind: 'note', midi: 60, value: 'h' });
    expect(ev(s).map((e) => e.durationQN)).toEqual([2]);
  });
  it('overwrites the pitch but keeps the rhythm and id', () => {
    const s = editorReducer(st(doc([bar(1, [{ ...n(60, 1.5), dots: 1 }])])), { type: 'write-event', at: at(0, 0), kind: 'note', midi: 67, value: 'w' });
    expect(ev(s)[0]).toMatchObject({ kind: 'note', midi: 67, durationQN: 1.5, dots: 1, id: 'n60' });
  });
  it('turns a note into a rest, dropping tie and marks', () => {
    const s = editorReducer(st(doc([bar(1, [{ ...n(60), tieToNext: true, articulations: ['staccato'] }])])), { type: 'write-event', at: at(0, 0), kind: 'rest' });
    expect(ev(s)[0]).toEqual({ kind: 'rest', durationQN: 1, id: 'n60' });
  });
  it('writing to voice 2 creates it and never touches voice 1 (Review Focus 3)', () => {
    const s0 = st(doc([bar(1, [n(60, 4)])]));
    const s1 = editorReducer(s0, { type: 'write-event', at: at(0, 'end', 1), kind: 'note', midi: 48, value: 'h' });
    expect(ev(s1, 0, 1).map((e) => (e as { midi: number }).midi)).toEqual([48]);
    expect(ev(s1, 0, 0)).toEqual(ev(s0, 0, 0));
  });
});

describe('chords, rhythm, pitch and delete', () => {
  it('adds a chord note, sorted, without duplicates', () => {
    const s = editorReducer(st(doc([bar(1, [n(64)])])), { type: 'add-chord-note', ref: { ...at(0, 0), eventIndex: 0 }, midi: 60 });
    expect(ev(s)[0]).toMatchObject({ kind: 'chord', notes: [{ midi: 60 }, { midi: 64 }] });
    const again = editorReducer(s, { type: 'add-chord-note', ref: { ...at(0, 0), eventIndex: 0 }, midi: 60 });
    expect(again).toBe(s);
  });
  it('sets written value and dots, clearing tuplets on a value change', () => {
    const r = { ...at(0, 0), eventIndex: 0 };
    const s1 = editorReducer(st(doc([bar(1, [n(60)])])), { type: 'set-events-rhythm', refs: [r], dots: 2 });
    expect(ev(s1)[0]).toMatchObject({ durationQN: 1.75, dots: 2 });
    const s2 = editorReducer(s1, { type: 'set-events-rhythm', refs: [r], value: '8' });
    expect(ev(s2)[0]).toMatchObject({ durationQN: 0.875, dots: 2 });
  });
  it('refuses a value change on part of a tuplet group', () => {
    const t = { id: 'g', n: 3, m: 2 };
    const s0 = st(doc([bar(1, [{ ...n(60, 1 / 3), tuplet: t }, { ...n(62, 1 / 3), tuplet: t }, { ...n(64, 1 / 3), tuplet: t }, n(65, 3)])]));
    expect(editorReducer(s0, { type: 'set-events-rhythm', refs: [{ ...at(0, 0), eventIndex: 0 }], value: 'q' })).toBe(s0);
  });
  it('transposes by step in the key, by semitone and by octave', () => {
    const r = { ...at(0, 0), eventIndex: 0 };
    const s0 = st(doc([bar(1, [n(64)])], 2));
    expect(ev(editorReducer(s0, { type: 'transpose-events', refs: [r], kind: 'step', dir: 1, keyFifths: 2 }))[0]).toMatchObject({ midi: 66, spelling: { step: 'F', alter: 1 } });
    expect(ev(editorReducer(s0, { type: 'transpose-events', refs: [r], kind: 'oct', dir: -1, keyFifths: 2 }))[0]).toMatchObject({ midi: 52 });
  });
  it('sets an accidental keeping the step', () => {
    const s = editorReducer(st(doc([bar(1, [n(62)])])), { type: 'set-events-accidental', refs: [{ ...at(0, 0), eventIndex: 0 }], alter: -1, keyFifths: 0 });
    expect(ev(s)[0]).toMatchObject({ midi: 61, spelling: { step: 'D', alter: -1, showAccidental: 'always' } });
  });
  it('replaces deleted notes across voices with rests and prunes slurs', () => {
    const s0 = st({ ...doc([bar(1, [n(60, 2, 'a'), n(62, 2, 'b')], [n(48, 4, 'c')])]), spans: [{ id: 's', type: 'slur', from: 'a', to: 'b' }] });
    const s1 = editorReducer(s0, { type: 'delete-events', refs: [{ ...at(0, 0), eventIndex: 1 }, { ...at(0, 0, 1), eventIndex: 0 }] });
    expect(ev(s1)).toMatchObject([{ id:'a', kind:'note', durationQN:2 }, {kind:'rest', durationQN:2}]);
    expect(s1.score.tracks[0].measures[0].voices).toHaveLength(2);
    expect(ev(s1, 0, 1)).toMatchObject([{kind:'rest',durationQN:4}]);
    expect(s1.score.spans).toEqual([]);
  });
});

describe('note entry: further rules', () => {
  const r0 = (eventIndex: number, voice: 0 | 1 = 0, measureIndex = 0) => ({ ...at(measureIndex, 0, voice), eventIndex });

  it('overwriting a chord collapses it to one note and keeps its marks', () => {
    const chord: MusicalEvent = { kind: 'chord', id: 'c', durationQN: 1, notes: [{ midi: 60 }, { midi: 64 }], articulations: ['accent'], tieToNext: true };
    const s = editorReducer(st(doc([bar(1, [chord])])), { type: 'write-event', at: at(0, 0), kind: 'note', midi: 67 });
    expect(ev(s)[0]).toEqual({ kind: 'note', id: 'c', durationQN: 1, midi: 67, articulations: ['accent'], tieToNext: true });
  });
  it('a rest that becomes a note brings no marks; an append stores dots only above 0', () => {
    const s = editorReducer(st(doc([bar(1, [{ kind: 'rest', id: 'r', durationQN: 1 }])])), { type: 'write-event', at: at(0, 0), kind: 'note', midi: 62 });
    expect(ev(s)[0]).toEqual({ kind: 'note', id: 'r', durationQN: 1, midi: 62 });
    const a = editorReducer(s, { type: 'write-event', at: at(0, 'end'), kind: 'rest', value: 'q', dots: 1 });
    expect(ev(a)[1]).toMatchObject({ kind: 'rest', durationQN: 1.5, dots: 1 });
    const b = editorReducer(s, { type: 'write-event', at: at(0, 'end'), kind: 'rest', value: 'q', dots: 0 });
    expect(ev(b)[1]).not.toHaveProperty('dots');
  });
  it('voice-2 transpose, rhythm and delete leave voice 1 deep-equal (Review Focus 3)', () => {
    const s0 = st(doc([bar(1, [n(60, 2), n(62, 2)], [n(48, 2), n(50, 2)])]));
    const v0 = JSON.stringify(s0.score.tracks[0].measures[0].voices[0]);
    const s1 = editorReducer(s0, { type: 'transpose-events', refs: [r0(0, 1)], kind: 'semi', dir: 1, keyFifths: 0 });
    const s2 = editorReducer(s1, { type: 'set-events-rhythm', refs: [r0(1, 1)], value: 'q' });
    const s3 = editorReducer(s2, { type: 'delete-events', refs: [r0(0, 1)] });
    expect(ev(s1, 0, 1)[0]).toMatchObject({ midi: 49 });
    expect(ev(s2, 0, 1)[1]).toMatchObject({ durationQN: 1 });
    expect(ev(s3, 0, 1)).toMatchObject([{kind:'rest',durationQN:2},{kind:'note',durationQN:1}]);
    for (const s of [s1, s2, s3]) expect(JSON.stringify(s.score.tracks[0].measures[0].voices[0])).toBe(v0);
  });
  it('changes the value of a whole tuplet group, and keeps a tuplet on a dots-only change', () => {
    const t = { id: 'g', n: 3, m: 2 };
    const s0 = st(doc([bar(1, [{ ...n(60, 1 / 3), tuplet: t }, { ...n(62, 1 / 3), tuplet: t }, { ...n(64, 1 / 3), tuplet: t }])]));
    const whole = editorReducer(s0, { type: 'set-events-rhythm', refs: [r0(0), r0(1), r0(2)], value: '8' });
    expect(ev(whole).map((e) => [e.durationQN, e.tuplet])).toEqual([[0.5, undefined], [0.5, undefined], [0.5, undefined]]);
    const dotted = editorReducer(s0, { type: 'set-events-rhythm', refs: [r0(0)], dots: 1 });
    expect(ev(dotted)[0]).toMatchObject({ durationQN: 0.5, dots: 1, tuplet: t });
  });
  it('refuses a rhythm change that overfills the bar, and skips an unwritable length', () => {
    const s0 = st(doc([bar(1, [n(60, 2), n(62, 2)])]));
    expect(editorReducer(s0, { type: 'set-events-rhythm', refs: [r0(0)], value: 'w' })).toBe(s0);
    const odd = st(doc([bar(1, [n(60, 0.3)])]));
    expect(editorReducer(odd, { type: 'set-events-rhythm', refs: [r0(0)], dots: 1 })).toBe(odd);
  });
  it('leaves percussion notes and rests alone when transposing or setting accidentals', () => {
    const perc: MusicalEvent = { kind: 'note', id: 'p', midi: 38, durationQN: 1, percussion: { staffLine: 'C5', notehead: 'normal' } };
    const s0 = st(doc([bar(1, [perc, { kind: 'rest', durationQN: 1 }])]));
    expect(editorReducer(s0, { type: 'transpose-events', refs: [r0(0), r0(1)], kind: 'step', dir: 1, keyFifths: 0 })).toBe(s0);
    expect(editorReducer(s0, { type: 'set-events-accidental', refs: [r0(0)], alter: 1, keyFifths: 0 })).toBe(s0);
  });
  it('sets chord pitches in order and ignores a length mismatch', () => {
    const chord: MusicalEvent = { kind: 'chord', id: 'c', durationQN: 1, notes: [{ midi: 60, spelling: { step: 'C', alter: 0 } }, { midi: 64 }] };
    const s0 = st(doc([bar(1, [chord])]));
    const s1 = editorReducer(s0, { type: 'set-event-pitches', ref: r0(0), midis: [59, 65] });
    expect(ev(s1)[0]).toEqual({ kind: 'chord', id: 'c', durationQN: 1, notes: [{ midi: 59 }, { midi: 65 }] });
    expect(editorReducer(s0, { type: 'set-event-pitches', ref: r0(0), midis: [59] })).toBe(s0);
  });
  it('an edit to one repeat pass reaches the other pass', () => {
    const rep = (pass: number) => ({ id: 'R', pass, count: 2, offset: 0, length: 1 });
    const s0 = st(doc([{ ...bar(1, [n(60, 4, 'x')]), repeat: rep(0) }, { ...bar(2, [n(60, 4, 'x~1')]), repeat: rep(1) }]));
    const s1 = editorReducer(s0, { type: 'transpose-events', refs: [r0(0, 0, 1)], kind: 'oct', dir: 1, keyFifths: 0 });
    expect(ev(s1, 0)[0]).toMatchObject({ midi: 72, id: 'x' });
    expect(ev(s1, 1)[0]).toMatchObject({ midi: 72, id: 'x~1' });
  });
});

describe('note entry: fix round 1', () => {
  const r0 = (eventIndex: number) => ({ ...at(0, 0), eventIndex });

  it('a step transpose that merges chord notes collapses the chord to one note', () => {
    const chord: MusicalEvent = { kind: 'chord', id: 'c', durationQN: 1, tieToNext: true, notes: [{ midi: 60 }, { midi: 61 }] };
    const s = editorReducer(st(doc([bar(1, [chord])])), { type: 'transpose-events', refs: [r0(0)], kind: 'step', dir: 1, keyFifths: 0 });
    expect(ev(s)[0]).toEqual({ kind: 'note', id: 'c', durationQN: 1, tieToNext: true, midi: 62, spelling: { step: 'D', alter: 0 } });
  });
  it('re-sorts chord notes and drops duplicates after an accidental or a pitch drag', () => {
    const chord: MusicalEvent = { kind: 'chord', id: 'c', durationQN: 1, notes: [{ midi: 60 }, { midi: 64 }, { midi: 67 }] };
    const s0 = st(doc([bar(1, [chord])]));
    const dragged = editorReducer(s0, { type: 'set-event-pitches', ref: r0(0), midis: [67, 62, 67] });
    expect(ev(dragged)[0]).toMatchObject({ kind: 'chord', notes: [{ midi: 62 }, { midi: 67 }] });
    const sharp = editorReducer(st(doc([bar(1, [{ kind: 'chord', id: 'c', durationQN: 1, notes: [{ midi: 62 }, { midi: 63, spelling: { step: 'D', alter: 1 } }] }])])),
      { type: 'set-events-accidental', refs: [r0(0)], alter: -1, keyFifths: 0 });
    expect(ev(sharp)[0]).toMatchObject({ kind: 'note', midi: 61, spelling: { step: 'D', alter: -1, showAccidental: 'always' } });
  });
  it('refuses a value change on part of a legacy triplet run', () => {
    const t3 = (midi: number): MusicalEvent => ({ ...n(midi, 1 / 3), triplet: true });
    const s0 = st(doc([bar(1, [t3(60), t3(62), t3(64), n(65, 2)])]));
    expect(editorReducer(s0, { type: 'set-events-rhythm', refs: [r0(0)], value: 'q' })).toBe(s0);
    const all = editorReducer(s0, { type: 'set-events-rhythm', refs: [r0(0), r0(1), r0(2)], value: '16' });
    expect(ev(all).slice(0, 3).map((e) => [e.durationQN, e.triplet])).toEqual([[0.25, undefined], [0.25, undefined], [0.25, undefined]]);
  });
  it('allows a value change on one whole drawn group of a longer legacy run', () => {
    const t3 = (midi: number): MusicalEvent => ({ ...n(midi, 1 / 3), triplet: true });
    const s0 = st(doc([bar(1, [t3(60), t3(62), t3(64), t3(65), t3(67), t3(69), n(71, 2)])]));
    const s1 = editorReducer(s0, { type: 'set-events-rhythm', refs: [r0(3), r0(4), r0(5)], value: '16' });
    expect(s1).not.toBe(s0);
    expect(ev(s1).slice(3, 6).map((e) => [e.durationQN, e.triplet])).toEqual([[0.25, undefined], [0.25, undefined], [0.25, undefined]]);
    expect(ev(s1).slice(0, 3)).toEqual(ev(s0).slice(0, 3));
  });
  it('a voice-2 tuplet split and merge leave voice 1 untouched (Review Focus 3)', () => {
    const s0 = st(doc([bar(1, [n(60, 2), { ...n(62, 2), tieToNext: true }], [n(48, 1, 'b'), n(50, 2, 'c')])]));
    const v2 = { ...at(0, 0, 1), eventIndex: 0 };
    const s1 = editorReducer(s0, { type: 'apply-tuplet', ref: v2, n: 3, m: 2 });
    expect(ev(s1, 0, 1)).toHaveLength(4);
    expect(s1.score.tracks[0].measures[0].voices[0]).toEqual(s0.score.tracks[0].measures[0].voices[0]);
    const s2 = editorReducer(s1, { type: 'apply-tuplet', ref: v2, n: 3, m: 2 });
    expect(s2.score.tracks[0].measures[0].voices[0]).toEqual(s0.score.tracks[0].measures[0].voices[0]);
    const s3 = editorReducer(s0, { type: 'apply-tuplet', at: at(0, 'end', 1), value: 'q', n: 3, m: 2 });
    expect(ev(s3, 0, 1)).toHaveLength(5);
    expect(s3.score.tracks[0].measures[0].voices[0]).toEqual(s0.score.tracks[0].measures[0].voices[0]);
  });
  it('refuses to add a chord note to a percussion note', () => {
    const s0 = st(doc([bar(1, [{ kind: 'note', id: 'p', midi: 38, durationQN: 1, percussion: { staffLine: 'C5', notehead: 'normal' } }])]));
    expect(editorReducer(s0, { type: 'add-chord-note', ref: r0(0), midi: 42 })).toBe(s0);
  });
});

describe('meter capacity across score changes', () => {
  it.each([[3,4,3,'q'],[7,8,7,'8'],[4,4,4,'q']] as const)('%i/%i permits exactly %i units', (num,den,count,value)=>{
    const score=doc([bar(1,[])]);score.initialTimeSignature=[num,den];
    let state=st(score);
    for(let i=0;i<count;i++) state=editorReducer(state,{type:'write-event',at:at(0,'end'),kind:i%2?'rest':'note',midi:60,value});
    expect(ev(state)).toHaveLength(count);
    expect(editorReducer(state,{type:'write-event',at:at(0,'end'),kind:'note',midi:60,value:'64'})).toBe(state);
  });
  it('uses a local 7/8 meter and accepts a dotted half plus an eighth',()=>{
    const score=doc([bar(1,[]),{...bar(2,[]),timeSignature:[7,8]}]);
    let state=editorReducer(st(score),{type:'write-event',at:at(1,'end'),kind:'note',midi:60,value:'h',dots:1});
    state=editorReducer(state,{type:'write-event',at:at(1,'end'),kind:'rest',value:'8'});
    expect(ev(state,1).reduce((sum,e)=>sum+e.durationQN,0)).toBe(3.5);
    expect(editorReducer(state,{type:'write-event',at:at(1,'end'),kind:'rest',value:'64'})).toBe(state);
  });
});
