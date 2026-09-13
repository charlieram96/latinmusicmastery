import { describe, expect, it } from 'vitest';
import { Midi } from '@tonejs/midi';
import { strokeToGm, writeMidi } from '../midi-writer';
import { CONGA_TUMBAO_FIXTURE, GUITAR_LICK_FIXTURE, SON_MONTUNO_FIXTURE } from '@/lib/playsense-studio/score-fixtures';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

describe('writeMidi', () => {
  it('writes one track per selected model track with the right notes', () => {
    const midi = new Midi(writeMidi(GUITAR_LICK_FIXTURE, [0]));
    expect(midi.tracks).toHaveLength(1);
    expect(midi.tracks[0].notes.map(n => n.midi)).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
    expect(midi.header.tempos[0].bpm).toBe(120);
    expect(midi.header.timeSignatures[0].timeSignature).toEqual([4, 4]);
    expect(midi.tracks[0].notes[1].ticks).toBe(midi.header.ppq);
  });

  it('puts percussion on channel 10 with GM keys', () => {
    const midi = new Midi(writeMidi(CONGA_TUMBAO_FIXTURE, [0]));
    expect(midi.tracks[0].channel).toBe(9);
    const keys = new Set(midi.tracks[0].notes.map(n => n.midi));
    for (const k of keys) expect(k).toBeGreaterThanOrEqual(35);
  });

  it('writes tempo changes and chords', () => {
    const midi = new Midi(writeMidi(SON_MONTUNO_FIXTURE, [0, 1, 2]));
    expect(midi.tracks).toHaveLength(3);
    // Standard MIDI stores tempo as an integer microseconds-per-quarter-note
    // meta event (@tonejs/midi's Encode.js does Math.floor(60000000 / bpm)),
    // so 110 BPM (which doesn't evenly divide 60,000,000) can't round-trip to
    // an exact float through real SMF bytes — it comes back ~110.00011.
    const bpms = midi.header.tempos.map(t => t.bpm);
    expect(bpms).toHaveLength(2);
    expect(bpms[0]).toBe(96);
    expect(bpms[1]).toBeCloseTo(110, 2);
    const chordTicks = midi.tracks[0].notes.filter(n => n.ticks === 0);
    expect(chordTicks.length).toBeGreaterThan(1);
  });

  it('merges tied notes into one', () => {
    const tied: ScoreDocument = {
      ...GUITAR_LICK_FIXTURE,
      tracks: [{ ...GUITAR_LICK_FIXTURE.tracks[0], measures: [
        { number: 1, voices: [{ number: 1, events: [{ kind: 'note', midi: 60, durationQN: 4, tieToNext: true }] }] },
        { number: 2, voices: [{ number: 1, events: [{ kind: 'note', midi: 60, durationQN: 4 }] }] },
      ] }],
    };
    const midi = new Midi(writeMidi(tied, [0]));
    expect(midi.tracks[0].notes).toHaveLength(1);
    expect(midi.tracks[0].notes[0].durationTicks).toBe(8 * midi.header.ppq);
  });

  it('still emits a note for a tie left dangling at the end of the track', () => {
    const dangling: ScoreDocument = {
      ...GUITAR_LICK_FIXTURE,
      tracks: [{ ...GUITAR_LICK_FIXTURE.tracks[0], measures: [
        { number: 1, voices: [{ number: 1, events: [{ kind: 'note', midi: 60, durationQN: 4, tieToNext: true }] }] },
      ] }],
    };
    const midi = new Midi(writeMidi(dangling, [0]));
    expect(midi.tracks[0].notes).toHaveLength(1);
    expect(midi.tracks[0].notes[0].midi).toBe(60);
    expect(midi.tracks[0].notes[0].durationTicks).toBe(4 * midi.header.ppq);
  });
});

describe('strokeToGm', () => {
  it('prefers the recorded source key, then the GM table, then 60', () => {
    expect(strokeToGm('perc-conga', 64, 63)).toBe(63);
    expect(strokeToGm('perc-conga', 64)).toBeGreaterThanOrEqual(35);
    expect(strokeToGm('perc-clave', 999)).toBe(60);
  });
});
