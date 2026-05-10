import { describe, expect, it } from 'vitest';
import { fingerChord, fingerNote, noteNameToMidi } from '../auto-fingering';

describe('noteNameToMidi', () => {
  it('C4 = 60', () => {
    expect(noteNameToMidi('C4')).toBe(60);
  });
  it('A4 = 69', () => {
    expect(noteNameToMidi('A4')).toBe(69);
  });
  it('handles sharps and flats', () => {
    expect(noteNameToMidi('C#4')).toBe(61);
    expect(noteNameToMidi('Db4')).toBe(61);
    expect(noteNameToMidi('Bb3')).toBe(58);
  });
  it('throws on garbage', () => {
    expect(() => noteNameToMidi('Hello')).toThrow();
  });
});

describe('fingerNote — guitar (prefers highest string with positive fret)', () => {
  // Tuning: ["E2","A2","D3","G3","B3","E4"] = MIDI [40,45,50,55,59,64]
  // VexFlow strings: E4=1, B3=2, G3=3, D3=4, A2=5, E2=6.
  it('open low E (E2 = 40) → string 6 fret 0 (only option)', () => {
    expect(fingerNote('guitar', 40)).toEqual({ string: 6, fret: 0 });
  });
  it('open high E (E4 = 64) → string 1 fret 0', () => {
    expect(fingerNote('guitar', 64)).toEqual({ string: 1, fret: 0 });
  });
  it('C4 (60) → string 2 fret 1 (1st position)', () => {
    expect(fingerNote('guitar', 60)).toEqual({ string: 2, fret: 1 });
  });
  it('returns null for notes below the lowest string', () => {
    expect(fingerNote('guitar', 36)).toBeNull();
  });
});

describe('fingerNote — bass', () => {
  // Tuning: ["E1","A1","D2","G2"] = MIDI [28,33,38,43]
  // Strings: G2=1, D2=2, A1=3, E1=4.
  it('open low E (E1 = 28) → string 4 fret 0', () => {
    expect(fingerNote('bass', 28)).toEqual({ string: 4, fret: 0 });
  });
  it('G2 (43) → string 1 fret 0 (open)', () => {
    expect(fingerNote('bass', 43)).toEqual({ string: 1, fret: 0 });
  });
  it('C2 (36) → string 3 fret 3 (1st position on A string)', () => {
    expect(fingerNote('bass', 36)).toEqual({ string: 3, fret: 3 });
  });
});

describe('fingerNote — tres (Cuban)', () => {
  // Tuning: ["G3","C4","E4"] = MIDI [55,60,64]. Strings: E4=1, C4=2, G3=3.
  it('open G3 (55) → string 3 fret 0', () => {
    expect(fingerNote('tres', 55)).toEqual({ string: 3, fret: 0 });
  });
  it('open C4 (60) → string 2 fret 0', () => {
    expect(fingerNote('tres', 60)).toEqual({ string: 2, fret: 0 });
  });
  it('open E4 (64) → string 1 fret 0', () => {
    expect(fingerNote('tres', 64)).toEqual({ string: 1, fret: 0 });
  });
});

describe('fingerChord — assigns each chord note a unique string', () => {
  // C major chord on guitar: midi 60, 64, 67
  const result = fingerChord('guitar', [60, 64, 67]);

  it('returns one fingering per input note', () => {
    expect(result).toHaveLength(3);
  });

  it('all three are non-null', () => {
    expect(result.every((r) => r !== null)).toBe(true);
  });

  it('uses distinct strings', () => {
    const strings = result.map((r) => r?.string);
    expect(new Set(strings).size).toBe(strings.length);
  });
});

describe('non-fretted instruments', () => {
  it('piano returns null', () => {
    expect(fingerNote('piano', 60)).toBeNull();
  });
  it('perc-conga returns null', () => {
    expect(fingerNote('perc-conga', 60)).toBeNull();
  });
});
