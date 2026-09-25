import { describe, expect, it } from 'vitest';
import {
  CLEF_REF_INDEX, fromStaffIndex, letterAbove, letterPitch, midiToParts, octavePitch, pitchIndex, pitchName,
  semitonePitch, staffIndex, stepPitch,
} from '../pitch';

describe('pitch', () => {
  it('staff index round-trips', () => {
    expect(staffIndex('C', 4)).toBe(28);
    expect(fromStaffIndex(30)).toEqual({ step: 'E', octave: 4 });
    expect(fromStaffIndex(-1)).toEqual({ step: 'B', octave: -1 });
  });
  it('a letter lands on the octave nearest the previous note, in the key', () => {
    expect(letterPitch('c', staffIndex('E', 4), 0)).toEqual({ midi: 60, spelling: { step: 'C', alter: 0 } });
    expect(letterPitch('b', staffIndex('C', 4), 0)).toEqual({ midi: 59, spelling: { step: 'B', alter: 0 } });
    expect(letterPitch('f', staffIndex('E', 4), 2)).toEqual({ midi: 66, spelling: { step: 'F', alter: 1 } });
    expect(letterPitch('B', staffIndex('A', 4), -1)).toEqual({ midi: 70, spelling: { step: 'B', alter: -1 } });
  });
  it('a chord letter goes above the top note', () => {
    expect(letterAbove('e', staffIndex('C', 4), 0)).toEqual({ midi: 64, spelling: { step: 'E', alter: 0 } });
    expect(letterAbove('c', staffIndex('C', 4), 0)).toEqual({ midi: 72, spelling: { step: 'C', alter: 0 } });
  });
  it('steps follow the key; semitones respell by direction; octaves keep the spelling', () => {
    expect(stepPitch(60, undefined, 0, 1)).toEqual({ midi: 62, spelling: { step: 'D', alter: 0 } });
    expect(stepPitch(64, undefined, 2, 1)).toEqual({ midi: 66, spelling: { step: 'F', alter: 1 } });
    expect(semitonePitch(60, 1, 0)).toEqual({ midi: 61, spelling: { step: 'C', alter: 1 } });
    expect(semitonePitch(62, -1, 0)).toEqual({ midi: 61, spelling: { step: 'D', alter: -1 } });
    expect(semitonePitch(64, 1, 0)).toEqual({ midi: 65, spelling: { step: 'F', alter: 0 } });
    expect(octavePitch(61, { step: 'D', alter: -1 }, 0, 1)).toEqual({ midi: 73, spelling: { step: 'D', alter: -1 } });
  });
  it('indexes and names use the spelling', () => {
    expect(pitchIndex(61, { step: 'D', alter: -1 }, 0)).toBe(staffIndex('D', 4));
    expect(pitchIndex(61, undefined, 0)).toBe(staffIndex('C', 4));
    expect(pitchName(61, { step: 'D', alter: -1 })).toBe('D♭4');
    expect(pitchName(66, undefined, 2)).toBe('F♯4');
    expect(pitchName(60)).toBe('C4');
  });
  it('respells from the clamped midi at the keyboard’s edges', () => {
    expect(stepPitch(0, undefined, 0, -1)).toEqual({ midi: 0, spelling: { step: 'C', alter: 0 } });
    expect(octavePitch(125, undefined, 0, 1)).toEqual({ midi: 127, spelling: { step: 'G', alter: 0 } });
  });
  it('keeps the stepper helper and clef references', () => {
    expect(midiToParts(61)).toEqual({ letter: 'C', accidental: 1, octave: 4 });
    expect(CLEF_REF_INDEX.treble).toBe(staffIndex('B', 4));
    expect(CLEF_REF_INDEX.bass).toBe(staffIndex('D', 3));
  });
});
