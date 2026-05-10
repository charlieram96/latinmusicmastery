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
 * highest-pitched string that can reach it. Returns null when the note is
 * below the instrument's range.
 *
 * Highest string = lowest fret for the same target pitch, which is what
 * players actually use in practice ("first position" preference). The
 * algorithm walks strings from highest to lowest pitch and picks the first
 * one whose fret is ≥ 0 and ≤ fretCount.
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

  // Walk highest→lowest string. The first string with a positive in-range
  // fret wins — that's the lowest fret available for this note.
  for (let i = tuningMidi.length - 1; i >= 0; i--) {
    const openMidi = tuningMidi[i];
    const fret = midi - openMidi;
    if (fret >= 0 && fret <= config.fretCount) {
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
 *
 * Strategy: process the highest pitch first and assign to the highest-pitched
 * unclaimed string with a non-negative fret. This produces compact fingerings
 * grouped near the top of the neck — the natural way most chords are played.
 * Falls back to fingerNote() when no string is left, which may return a
 * shared string (caller can dedupe if needed).
 */
export function fingerChord(
  instrument: Instrument,
  midis: number[]
): Array<Fingering | null> {
  const config = INSTRUMENTS[instrument];
  if (!config.fretted) return midis.map(() => null);

  const tuningMidi = config.tuning.map(noteNameToMidi);
  const claimed = new Set<number>();

  // Sort indices by descending MIDI so we assign highest pitch to highest
  // string first.
  const order = midis
    .map((midi, idx) => ({ midi, idx }))
    .sort((a, b) => b.midi - a.midi);

  const result: Array<Fingering | null> = midis.map(() => null);

  for (const { midi, idx } of order) {
    let assignment: Fingering | null = null;
    // Walk highest→lowest, take the first unclaimed string with a positive fret.
    for (let i = tuningMidi.length - 1; i >= 0; i--) {
      if (claimed.has(i)) continue;
      const fret = midi - tuningMidi[i];
      if (fret >= 0 && fret <= config.fretCount) {
        claimed.add(i);
        assignment = { string: tuningMidi.length - i, fret };
        break;
      }
    }
    result[idx] = assignment ?? fingerNote(instrument, midi);
  }

  return result;
}
