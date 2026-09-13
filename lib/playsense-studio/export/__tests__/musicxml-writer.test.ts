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
