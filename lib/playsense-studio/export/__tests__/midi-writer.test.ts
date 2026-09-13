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

  it('does not let a dangling tie in one voice absorb an untied note in another voice', () => {
    const twoVoices: ScoreDocument = {
      ...GUITAR_LICK_FIXTURE,
      tracks: [{ ...GUITAR_LICK_FIXTURE.tracks[0], measures: [
        { number: 1, voices: [
          { number: 1, events: [{ kind: 'note', midi: 60, durationQN: 4, tieToNext: true }] },
          { number: 2, events: [{ kind: 'note', midi: 60, durationQN: 1 }] },
        ] },
      ] }],
    };
    const midi = new Midi(writeMidi(twoVoices, [0]));
    // Two independent notes: voice 2's untied hit, plus voice 1's dangling tie
    // (never resolved, so it still gets flushed at track end) — not one note
    // where voice 2's duration was merged into voice 1's held note.
    expect(midi.tracks[0].notes).toHaveLength(2);
    const [short, long] = [...midi.tracks[0].notes].sort((a, b) => a.durationTicks - b.durationTicks);
    expect(short.ticks).toBe(0);
    expect(short.durationTicks).toBe(1 * midi.header.ppq); // voice 2, un-extended
    expect(long.ticks).toBe(0);
    expect(long.durationTicks).toBe(4 * midi.header.ppq); // voice 1's dangling tie
  });

  it('clears a dangling tie at a rest instead of letting it absorb a later note of the same pitch', () => {
    const tieThenRest: ScoreDocument = {
      ...GUITAR_LICK_FIXTURE,
      tracks: [{ ...GUITAR_LICK_FIXTURE.tracks[0], measures: [
        { number: 1, voices: [{ number: 1, events: [
          { kind: 'note', midi: 60, durationQN: 2, tieToNext: true },
          { kind: 'rest', durationQN: 1 },
          { kind: 'note', midi: 60, durationQN: 1 },
        ] }] },
      ] }],
    };
    const midi = new Midi(writeMidi(tieThenRest, [0]));
    // Two separate notes, not one merged (2 + 1 = 3 QN) note.
    expect(midi.tracks[0].notes).toHaveLength(2);
    expect(midi.tracks[0].notes[0].ticks).toBe(0);
    expect(midi.tracks[0].notes[0].durationTicks).toBe(2 * midi.header.ppq);
    expect(midi.tracks[0].notes[1].ticks).toBe(3 * midi.header.ppq);
    expect(midi.tracks[0].notes[1].durationTicks).toBe(1 * midi.header.ppq);
  });
});

describe('strokeToGm', () => {
  it('prefers the recorded source key, then the GM table, then 60', () => {
    expect(strokeToGm('perc-conga', 64, 63)).toBe(63);
    expect(strokeToGm('perc-conga', 64)).toBeGreaterThanOrEqual(35);
    expect(strokeToGm('perc-clave', 999)).toBe(60);
  });

  it('prefers identity over an earlier ascending GM match for perc-kit', () => {
    // Kit stroke ids are the standard GM drum numbers themselves; without the
    // identity check, snare (38) would hit gm=37 "Side Stick -> snare" first.
    expect(strokeToGm('perc-kit', 38)).toBe(38);
    expect(strokeToGm('perc-kit', 36)).toBe(36);
  });

  it('falls back to the perc-timbal auxiliary reverse table when GM_PERCUSSION has no forward entry', () => {
    expect(strokeToGm('perc-timbal', 70)).toBe(49);
    expect(strokeToGm('perc-timbal', 73)).toBe(56);
  });

  it('still lets a recorded source key win over identity and the auxiliary table', () => {
    expect(strokeToGm('perc-kit', 38, 40)).toBe(40);
    expect(strokeToGm('perc-timbal', 73, 56)).toBe(56);
  });
});
