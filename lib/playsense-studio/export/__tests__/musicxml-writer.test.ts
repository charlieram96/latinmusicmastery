// @vitest-environment jsdom
// lib/playsense-studio/export/__tests__/musicxml-writer.test.ts
import { describe, expect, it } from 'vitest';
import { writeMusicXml } from '../musicxml-writer';
import { parseMusicXmlString } from '@/lib/playsense-studio/parsers/musicxml';
import { GUITAR_LICK_FIXTURE, SON_MONTUNO_FIXTURE, CONGA_TUMBAO_FIXTURE } from '@/lib/playsense-studio/score-fixtures';
import { percussionNotation } from '@/lib/playsense-studio/perc-strokes';
import type { ScoreDocument, Measure } from '@/components/playsense-studio/shared/score-model/types';

const parse = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');
const q = (doc: Document, sel: string) => Array.from(doc.querySelectorAll(sel));

describe('writeMusicXml — document shape', () => {
  it('writes a partwise 4.0 document with one part per selected track', () => {
    const xml = writeMusicXml(SON_MONTUNO_FIXTURE, [0, 2]);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN"');
    const doc = parse(xml);
    expect(doc.documentElement.tagName).toBe('score-partwise');
    expect(doc.documentElement.getAttribute('version')).toBe('4.0');
    expect(q(doc, 'part-list > score-part')).toHaveLength(2);
    expect(q(doc, 'part')).toHaveLength(2);
    expect(doc.querySelector('work > work-title')?.textContent).toBe('Son Montuno (C / F / G / C)');
    expect(doc.querySelector('part-list > score-part > part-name')?.textContent).toBe(SON_MONTUNO_FIXTURE.tracks[0].displayName);
  });

  it('escapes XML special characters in titles', () => {
    const xml = writeMusicXml({ ...GUITAR_LICK_FIXTURE, title: 'Tom & Jerry <live>' }, [0]);
    expect(parse(xml).querySelector('work-title')?.textContent).toBe('Tom & Jerry <live>');
  });
});

describe('writeMusicXml — round trip through the importer', () => {
  it('preserves pitches, durations, chords, time and tempo the importer reads', () => {
    const back = parseMusicXmlString(writeMusicXml(SON_MONTUNO_FIXTURE, [0, 1, 2]));
    expect(back.tracks).toHaveLength(3);
    expect(back.initialTempo).toBe(96);
    expect(back.initialTimeSignature).toEqual([4, 4]);
    const src = SON_MONTUNO_FIXTURE.tracks[0].measures;
    back.tracks[0].measures.forEach((m, i) => {
      const events = m.voices[0].events;
      expect(events.map(e => e.kind)).toEqual(src[i].voices[0].events.map(e => e.kind));
      expect(events.map(e => e.durationQN)).toEqual(src[i].voices[0].events.map(e => e.durationQN));
      events.forEach((e, k) => {
        const s = src[i].voices[0].events[k];
        if (e.kind === 'note' && s.kind === 'note') expect(e.midi).toBe(s.midi);
        if (e.kind === 'chord' && s.kind === 'chord') expect(e.notes.map(n => n.midi)).toEqual(s.notes.map(n => n.midi));
      });
    });
    expect(back.tracks[0].measures[2].tempoChange).toBe(110);
  });

  it('round-trips percussion staff positions and noteheads', () => {
    const back = parseMusicXmlString(writeMusicXml(CONGA_TUMBAO_FIXTURE, [0]));
    expect(back.tracks[0].instrument).toBe('perc-conga');
    const first = back.tracks[0].measures[0].voices[0].events[0];
    expect(first.kind).toBe('note');
    const expected = percussionNotation('perc-conga', { midi: 62 }).staffLine;
    if (first.kind === 'note') expect(first.percussion?.staffLine).toBe(expected);
  });
});

describe('writeMusicXml — features beyond the importer', () => {
  const note = (midi: number, extra: Partial<Extract<ScoreDocument['tracks'][0]['measures'][0]['voices'][0]['events'][0], { kind: 'note' }>> = {}) =>
    ({ kind: 'note' as const, midi, durationQN: 1, ...extra });
  const scoreWith = (measures: Measure[], track: Partial<ScoreDocument['tracks'][0]> = {}): ScoreDocument => ({
    ...GUITAR_LICK_FIXTURE,
    tracks: [{ ...GUITAR_LICK_FIXTURE.tracks[0], ...track, measures }],
  });

  it('writes ties, slurs, articulations and triplets', () => {
    const score = scoreWith([{ number: 1, voices: [{ number: 1, events: [
      note(60, { tieToNext: true }), note(60, { slurToNext: true, articulation: 'accent' }),
      note(62, { triplet: true, durationQN: 2 / 3 }), note(64, { triplet: true, durationQN: 2 / 3 }), note(65, { triplet: true, durationQN: 2 / 3 }),
    ] }] }]);
    const doc = parse(writeMusicXml(score, [0]));
    const notes = q(doc, 'note');
    expect(notes[0].querySelector('tie')?.getAttribute('type')).toBe('start');
    expect(notes[1].querySelector('tie')?.getAttribute('type')).toBe('stop');
    expect(notes[1].querySelector('notations > slur')?.getAttribute('type')).toBe('start');
    expect(notes[2].querySelector('notations > slur')?.getAttribute('type')).toBe('stop');
    expect(notes[1].querySelector('articulations > accent')).not.toBeNull();
    expect(notes[2].querySelector('time-modification > actual-notes')?.textContent).toBe('3');
    expect(notes[2].querySelector('type')?.textContent).toBe('quarter');
  });

  it('writes fingering, tuning and an octave-transposing G clef for guitar', () => {
    const score = scoreWith([{ number: 1, voices: [{ number: 1, events: [note(64, { fingering: { string: 2, fret: 5 } }), note(60, { durationQN: 3 })] }] }]);
    const doc = parse(writeMusicXml(score, [0]));
    expect(doc.querySelector('clef > sign')?.textContent).toBe('G');
    expect(doc.querySelector('clef > clef-octave-change')?.textContent).toBe('-1');
    expect(q(doc, 'staff-details > staff-tuning')).toHaveLength(6);
    // No <staff-lines>: the part is on a G clef with real pitches, and a
    // 6-line (or, for a tres, 3-line) staff would move every note.
    expect(doc.querySelector('staff-details > staff-lines')).toBeNull();
    expect(doc.querySelector('technical > string')?.textContent).toBe('2');
    expect(doc.querySelector('technical > fret')?.textContent).toBe('5');
  });

  it('writes a second voice with backup', () => {
    const score = scoreWith([{ number: 1, voices: [
      { number: 1, events: [note(67, { durationQN: 4 })] },
      { number: 2, events: [note(60, { durationQN: 2 }), note(62, { durationQN: 2 })] },
    ] }]);
    const doc = parse(writeMusicXml(score, [0]));
    expect(doc.querySelector('backup > duration')?.textContent).toBe(String(4 * 960));
    expect(q(doc, 'note > voice').map(v => v.textContent)).toEqual(['1', '2', '2']);
  });

  it('collapses repeats into repeat barlines', () => {
    const m = (number: number, pass: number) => ({ number, repeat: { id: 'r', pass, count: 2, offset: 0, length: 1 }, voices: [{ number: 1, events: [note(60, { durationQN: 4 })] }] });
    const doc = parse(writeMusicXml(scoreWith([m(1, 0), m(2, 1)]), [0]));
    expect(q(doc, 'measure')).toHaveLength(1);
    expect(doc.querySelector('barline[location="left"] > repeat')?.getAttribute('direction')).toBe('forward');
    expect(doc.querySelector('barline[location="right"] > repeat')?.getAttribute('times')).toBe('2');
  });

  it('spells flats from the spelling hint and ends with a final barline', () => {
    const doc = parse(writeMusicXml(scoreWith([{ number: 1, voices: [{ number: 1, events: [note(61, { spellingHint: 'Db', durationQN: 4 })] }] }]), [0]));
    expect(doc.querySelector('pitch > step')?.textContent).toBe('D');
    expect(doc.querySelector('pitch > alter')?.textContent).toBe('-1');
    expect(doc.querySelector('barline[location="right"] > bar-style')?.textContent).toBe('light-heavy');
  });
});

describe('writeMusicXml — chord and multi-voice tie state', () => {
  const note = (midi: number, extra: Partial<Extract<ScoreDocument['tracks'][0]['measures'][0]['voices'][0]['events'][0], { kind: 'note' }>> = {}) =>
    ({ kind: 'note' as const, midi, durationQN: 1, ...extra });
  const chord = (notes: Array<{ midi: number; tieToNext?: boolean }>, extra: Partial<Extract<ScoreDocument['tracks'][0]['measures'][0]['voices'][0]['events'][0], { kind: 'chord' }>> = {}) =>
    ({ kind: 'chord' as const, durationQN: 1, notes, ...extra });
  const scoreWith = (measures: Measure[], track: Partial<ScoreDocument['tracks'][0]> = {}): ScoreDocument => ({
    ...GUITAR_LICK_FIXTURE,
    tracks: [{ ...GUITAR_LICK_FIXTURE.tracks[0], ...track, measures }],
  });

  it('ties every pitch of a whole-chord tie across a barline', () => {
    const score = scoreWith([
      { number: 1, voices: [{ number: 1, events: [chord([{ midi: 60 }, { midi: 64 }], { tieToNext: true })] }] },
      { number: 2, voices: [{ number: 1, events: [chord([{ midi: 60 }, { midi: 64 }])] }] },
    ]);
    const doc = parse(writeMusicXml(score, [0]));
    const measures = q(doc, 'measure');
    const firstChordNotes = Array.from(measures[0].querySelectorAll('note'));
    const secondChordNotes = Array.from(measures[1].querySelectorAll('note'));
    expect(firstChordNotes).toHaveLength(2);
    expect(secondChordNotes).toHaveLength(2);
    firstChordNotes.forEach(n => {
      expect(n.querySelector('tie')?.getAttribute('type')).toBe('start');
      expect(n.querySelector('notations > tied')?.getAttribute('type')).toBe('start');
    });
    secondChordNotes.forEach(n => {
      expect(n.querySelector('tie')?.getAttribute('type')).toBe('stop');
      expect(n.querySelector('notations > tied')?.getAttribute('type')).toBe('stop');
    });
  });

  it('ties only the specific pitch tied in a partial chord tie, not the whole chord', () => {
    const score = scoreWith([{ number: 1, voices: [{ number: 1, events: [
      chord([{ midi: 60 }, { midi: 64, tieToNext: true }]),
      chord([{ midi: 60 }, { midi: 64 }]),
    ] }] }]);
    const doc = parse(writeMusicXml(score, [0]));
    const notes = q(doc, 'note');
    expect(notes).toHaveLength(4);
    // First chord [60, 64]: only 64 starts a tie.
    expect(notes[0].querySelector('tie')).toBeNull();
    expect(notes[1].querySelector('tie')?.getAttribute('type')).toBe('start');
    // Second chord [60, 64]: only 64 (the matching pitch) receives the stop.
    expect(notes[2].querySelector('tie')).toBeNull();
    expect(notes[3].querySelector('tie')?.getAttribute('type')).toBe('stop');
  });

  it('carries a voice-2 tie across a barline (voice-1 state must not be shared or reset)', () => {
    const score = scoreWith([
      { number: 1, voices: [
        { number: 1, events: [note(67, { durationQN: 4 })] },
        { number: 2, events: [note(60, { durationQN: 4, tieToNext: true })] },
      ] },
      { number: 2, voices: [
        { number: 1, events: [note(69, { durationQN: 4 })] },
        { number: 2, events: [note(60, { durationQN: 4 })] },
      ] },
    ]);
    const doc = parse(writeMusicXml(score, [0]));
    const voice2Notes = q(doc, 'note').filter(n => n.querySelector('voice')?.textContent === '2');
    expect(voice2Notes).toHaveLength(2);
    expect(voice2Notes[0].querySelector('tie')?.getAttribute('type')).toBe('start');
    expect(voice2Notes[1].querySelector('tie')?.getAttribute('type')).toBe('stop');
  });
});

describe('writeMusicXml — element order is pinned, not just tag presence', () => {
  const note = (midi: number, extra: Partial<Extract<ScoreDocument['tracks'][0]['measures'][0]['voices'][0]['events'][0], { kind: 'note' }>> = {}) =>
    ({ kind: 'note' as const, midi, durationQN: 1, ...extra });
  const scoreWith = (measures: Measure[], track: Partial<ScoreDocument['tracks'][0]> = {}): ScoreDocument => ({
    ...GUITAR_LICK_FIXTURE,
    tracks: [{ ...GUITAR_LICK_FIXTURE.tracks[0], ...track, measures }],
  });

  it('orders a fully-loaded pitched note: pitch, duration, tie, voice, type, dot, time-modification, notations', () => {
    const score = scoreWith([{ number: 1, voices: [{ number: 1, events: [
      note(64, { dotted: true, triplet: true, tieToNext: true, slurToNext: true, articulation: 'accent', fingering: { string: 2, fret: 5 } }),
    ] }] }]);
    const doc = parse(writeMusicXml(score, [0]));
    const noteEl = doc.querySelector('note')!;
    expect(Array.from(noteEl.children).map(c => c.tagName)).toEqual(
      ['pitch', 'duration', 'tie', 'voice', 'type', 'dot', 'time-modification', 'notations']
    );
  });

  it('orders a percussion note with a resolved instrument id: unpitched, duration, instrument, voice, type, notehead, notations', () => {
    const score: ScoreDocument = {
      ...CONGA_TUMBAO_FIXTURE,
      tracks: [{
        ...CONGA_TUMBAO_FIXTURE.tracks[0],
        measures: [{ number: 1, voices: [{ number: 1, events: [
          { kind: 'note', midi: 62, durationQN: 1, percussion: { staffLine: 'e/5', notehead: 'x', marcato: true, sourceMidi: 40 } },
        ] }] }],
      }],
    };
    const doc = parse(writeMusicXml(score, [0]));
    const noteEl = doc.querySelector('note')!;
    expect(Array.from(noteEl.children).map(c => c.tagName)).toEqual(
      ['unpitched', 'duration', 'instrument', 'voice', 'type', 'notehead', 'notations']
    );
  });

  it('orders score-part children: part-name, then all score-instrument, then all midi-instrument', () => {
    const score: ScoreDocument = {
      ...CONGA_TUMBAO_FIXTURE,
      tracks: [{
        ...CONGA_TUMBAO_FIXTURE.tracks[0],
        measures: [{ number: 1, voices: [{ number: 1, events: [
          { kind: 'note', midi: 62, durationQN: 1, percussion: { staffLine: 'e/5', notehead: 'normal', sourceMidi: 40 } },
          { kind: 'note', midi: 63, durationQN: 1, percussion: { staffLine: 'd/5', notehead: 'normal', sourceMidi: 41 } },
        ] }] }],
      }],
    };
    const doc = parse(writeMusicXml(score, [0]));
    const scorePartEl = doc.querySelector('score-part')!;
    expect(Array.from(scorePartEl.children).map(c => c.tagName)).toEqual(
      ['part-name', 'score-instrument', 'score-instrument', 'midi-instrument', 'midi-instrument']
    );
  });
});
