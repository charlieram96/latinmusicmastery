// Compás — auto-fingering for fretted instruments.
//
// MIDI files (and many MusicXML imports) lack fret/string assignments. When
// our renderers need to draw a tab or fretboard, we have to pick a fingering.
//
// Strategy: prefer the LOWEST string that can play the note within the
// instrument's fret range. This produces playable, low-position fingerings
// for typical Latin music passages without doing a full path-search across
// the piece — which is M8 or later territory if it's ever needed.

import type { Instrument } from '@/components/compas/shared/score-model/types';
import { INSTRUMENTS } from './instruments';

export interface Fingering {
  /** 1-based string index, 1 = highest pitch (closest to floor). VexFlow
   * tab convention: string 1 is the top line (highest pitch). */
  string: number;
  /** Fret number, 0 = open. */
  fret: number;
}

const NOTE_LETTERS: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

/**
 * Convert a note name like "E2", "A#3", "Bb4" to a MIDI number.
 * Handles enharmonics: "C#" / "Db" both yield the same MIDI value.
 */
export function noteNameToMidi(name: string): number {
  const match = name.match(/^([A-G])(#|b)?(-?\d+)$/);
  if (!match) throw new Error(`Invalid note name: ${name}`);
  const letter = match[1];
  const accidental = match[2];
  const octave = Number(match[3]);
  let pitchClass = NOTE_LETTERS[letter];
  if (accidental === '#') pitchClass += 1;
  else if (accidental === 'b') pitchClass -= 1;
  return (octave + 1) * 12 + pitchClass;
}

/**
 * Given an instrument and a target MIDI note, return a fingering on the
 * lowest-pitched string that can reach it without exceeding the instrument's
 * fret count. Returns null when the note is below the instrument's range.
 *
 * String numbering follows VexFlow tab convention: string 1 is the top line
 * (highest pitch). Our `tuning` arrays are stored low→high, so the highest-
 * pitch string is at the END of the array.
 */
export function fingerNote(instrument: Instrument, midi: number): Fingering | null {
  const config = INSTRUMENTS[instrument];
  if (!config.fretted) return null;
  if (config.tuning.length === 0) return null;

  const tuningMidi = config.tuning.map(noteNameToMidi);

  // Walk from lowest string (index 0) to highest. The lowest string that
  // can play the note (within fret range) wins — keeps fingerings in low
  // position for readability.
  for (let i = 0; i < tuningMidi.length; i++) {
    const openMidi = tuningMidi[i];
    const fret = midi - openMidi;
    if (fret >= 0 && fret <= config.fretCount) {
      // Convert internal index (0 = lowest pitch) to VexFlow string number
      // (1 = highest pitch).
      return {
        string: tuningMidi.length - i,
        fret,
      };
    }
  }

  return null;
}

/**
 * Compute fingerings for a set of MIDI notes (e.g. a chord) on one instrument.
 * Returns one entry per input note, in input order; null entries indicate
 * out-of-range notes the caller should skip.
 */
export function fingerChord(
  instrument: Instrument,
  midis: number[]
): Array<Fingering | null> {
  // Greedy: assign each note to the lowest available string that hasn't been
  // claimed yet. Falls back to per-note finger() when nothing remains.
  const config = INSTRUMENTS[instrument];
  if (!config.fretted) return midis.map(() => null);

  const tuningMidi = config.tuning.map(noteNameToMidi);
  const claimed = new Set<number>();
  const result: Array<Fingering | null> = [];

  for (const midi of midis) {
    let assignment: Fingering | null = null;
    for (let i = 0; i < tuningMidi.length; i++) {
      if (claimed.has(i)) continue;
      const fret = midi - tuningMidi[i];
      if (fret >= 0 && fret <= config.fretCount) {
        claimed.add(i);
        assignment = { string: tuningMidi.length - i, fret };
        break;
      }
    }
    result.push(assignment ?? fingerNote(instrument, midi));
  }

  return result;
}
