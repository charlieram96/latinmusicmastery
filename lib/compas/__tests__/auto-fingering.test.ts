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

describe('fingerNote — guitar', () => {
  it('open low E (E2 = midi 40) → string 6, fret 0', () => {
    expect(fingerNote('guitar', 40)).toEqual({ string: 6, fret: 0 });
  });
  it('high E (E4 = midi 64) → first string available is low E at fret 24, but our string is 22 frets, so it picks A2 string at fret 19? Actually open high E (string 1) at fret 0 wins? It should pick the LOWEST string', () => {
    // Lowest pitch string that reaches E4 (midi 64) within 22 frets:
    //   E2 (40) → fret 24 — past 22, no
    //   A2 (45) → fret 19 — fits
    //   D3 (50) → fret 14 — fits
    //   G3 (55) → fret 9 — fits
    //   B3 (59) → fret 5 — fits
    //   E4 (64) → fret 0 — fits
    // Lowest pitch = E2 = string index 0 = VexFlow string 6. But E2 → fret 24
    // exceeds the 22-fret limit, so it skips to A2 (string 5).
    expect(fingerNote('guitar', 64)).toEqual({ string: 5, fret: 19 });
  });
  it('returns null for notes below the lowest string', () => {
    // C2 = midi 36, below open low E (40). Guitar can't play it.
    expect(fingerNote('guitar', 36)).toBeNull();
  });
});

describe('fingerNote — bass', () => {
  it('open low E (E1 = midi 28) → string 4, fret 0', () => {
    expect(fingerNote('bass', 28)).toEqual({ string: 4, fret: 0 });
  });
  it('G2 = 43 → fits on lowest string', () => {
    // E1 (28) → fret 15
    expect(fingerNote('bass', 43)).toEqual({ string: 4, fret: 15 });
  });
});

describe('fingerNote — tres (Cuban)', () => {
  // Tres tuning: ["G3","C4","E4"] = MIDI [55, 60, 64].
  // String index 0 = G3 (lowest pitch) = VexFlow string 3.
  it('open G3 (midi 55) → string 3, fret 0', () => {
    expect(fingerNote('tres', 55)).toEqual({ string: 3, fret: 0 });
  });
  it('C4 (midi 60) → lowest string (G3) at fret 5', () => {
    expect(fingerNote('tres', 60)).toEqual({ string: 3, fret: 5 });
  });
  it('E4 (midi 64) → still picks G3 (fret 9), the lowest reachable', () => {
    expect(fingerNote('tres', 64)).toEqual({ string: 3, fret: 9 });
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
