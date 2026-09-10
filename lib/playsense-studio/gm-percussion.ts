// PlaySense Studio — General-MIDI percussion mapping.
//
// MusicXML and MIDI both encode drums as General-MIDI percussion key numbers
// (the GM "drum map", notes 35–81 on channel 10). Our model doesn't store GM
// numbers — it stores per-instrument STROKE midis (see perc-strokes.ts), each
// pinned to a staff line. This module is the single bridge between the two:
//
//   • GM_PERCUSSION   — GM note → { which of our instruments, which stroke }.
//   • inferPercInstrument — given the GM notes used by a part, pick the
//     instrument bucket (conga / bongo / timbal / clave / kit) it best fits.
//   • gmToStrokeMidi  — GM note → a stroke midi VALID for a chosen instrument,
//     so midiToPercStroke() always resolves it to a real staff position.
//
// MusicXML additionally retains written staff positions and symbols, which
// can distinguish several custom strokes sharing the same playback key.

import type { Instrument } from '@/components/playsense-studio/shared/score-model/types';
import { getPercStrokes } from './perc-strokes';

interface GmEntry {
  instrument: Instrument;
  /** Stroke midi within that instrument (must exist in PERC_STROKES). */
  strokeMidi: number;
}

// Standard GM percussion key map, routed onto our stroke midis. Only the keys
// our instruments can represent are listed; anything missing falls back via
// gmToStrokeMidi (nearest stroke of the chosen instrument, else its first).
//
// Conga stroke midis: open-high 64, slap 62, open-low 63, mute 61, bass 60.
// Bongo: macho-open 64, macho-slap 63, hembra-open 62, hembra-slap 61.
// Timbal: stable original IDs plus the extended legend in perc-strokes.ts.
// Clave: stroke 60.
// Kit: crash 49, ride 51, hh-closed 42, hh-open 46, hi-tom 48, mid-tom 45,
//      snare 38, floor-tom 41, kick 36.
export const GM_PERCUSSION: Record<number, GmEntry> = {
  // --- Drum kit ---
  35: { instrument: 'perc-kit', strokeMidi: 36 }, // Acoustic Bass Drum
  36: { instrument: 'perc-kit', strokeMidi: 36 }, // Bass Drum 1
  37: { instrument: 'perc-kit', strokeMidi: 38 }, // Side Stick → snare
  38: { instrument: 'perc-kit', strokeMidi: 38 }, // Acoustic Snare
  39: { instrument: 'perc-kit', strokeMidi: 38 }, // Hand Clap → snare
  40: { instrument: 'perc-kit', strokeMidi: 38 }, // Electric Snare
  41: { instrument: 'perc-kit', strokeMidi: 41 }, // Low Floor Tom
  42: { instrument: 'perc-kit', strokeMidi: 42 }, // Closed Hi-Hat
  43: { instrument: 'perc-kit', strokeMidi: 41 }, // High Floor Tom
  44: { instrument: 'perc-kit', strokeMidi: 42 }, // Pedal Hi-Hat → closed
  45: { instrument: 'perc-kit', strokeMidi: 45 }, // Low Tom
  46: { instrument: 'perc-kit', strokeMidi: 46 }, // Open Hi-Hat
  47: { instrument: 'perc-kit', strokeMidi: 45 }, // Low-Mid Tom
  48: { instrument: 'perc-kit', strokeMidi: 48 }, // Hi-Mid Tom
  49: { instrument: 'perc-kit', strokeMidi: 49 }, // Crash Cymbal 1
  50: { instrument: 'perc-kit', strokeMidi: 48 }, // High Tom
  51: { instrument: 'perc-kit', strokeMidi: 51 }, // Ride Cymbal 1
  52: { instrument: 'perc-kit', strokeMidi: 49 }, // Chinese Cymbal → crash
  53: { instrument: 'perc-kit', strokeMidi: 51 }, // Ride Bell → ride
  55: { instrument: 'perc-kit', strokeMidi: 49 }, // Splash → crash
  57: { instrument: 'perc-kit', strokeMidi: 49 }, // Crash Cymbal 2
  59: { instrument: 'perc-kit', strokeMidi: 51 }, // Ride Cymbal 2

  // --- Bongo ---
  60: { instrument: 'perc-bongo', strokeMidi: 64 }, // Hi Bongo → macho open
  61: { instrument: 'perc-bongo', strokeMidi: 62 }, // Low Bongo → hembra open

  // --- Conga ---
  62: { instrument: 'perc-conga', strokeMidi: 61 }, // Mute Hi Conga → mute
  63: { instrument: 'perc-conga', strokeMidi: 64 }, // Open Hi Conga → open-high
  64: { instrument: 'perc-conga', strokeMidi: 63 }, // Low Conga → open-low

  // --- Timbales ---
  65: { instrument: 'perc-timbal', strokeMidi: 64 }, // High Timbale
  66: { instrument: 'perc-timbal', strokeMidi: 62 }, // Low Timbale
  67: { instrument: 'perc-timbal', strokeMidi: 65 }, // High Agogo → cáscara
  68: { instrument: 'perc-timbal', strokeMidi: 68 }, // Low Agogo → cáscara

  56: { instrument: 'perc-timbal', strokeMidi: 71 }, // Cowbell → contracampana

  // --- Clave / wood ---
  75: { instrument: 'perc-clave', strokeMidi: 60 }, // Claves
  76: { instrument: 'perc-clave', strokeMidi: 60 }, // Hi Wood Block
  77: { instrument: 'perc-clave', strokeMidi: 60 }, // Low Wood Block
};

const PERC_FAMILIES: Instrument[] = [
  'perc-conga',
  'perc-bongo',
  'perc-timbal',
  'perc-clave',
  'perc-kit',
];

/**
 * Pick the instrument bucket that best fits a set of GM percussion notes. Counts
 * how many notes fall into each family and returns the winner; ties and unknowns
 * default to `perc-kit` (the most general staff).
 */
export function inferPercInstrument(gmNotes: number[]): Instrument {
  const counts = new Map<Instrument, number>();
  for (const n of gmNotes) {
    const entry = GM_PERCUSSION[n];
    if (!entry) continue;
    counts.set(entry.instrument, (counts.get(entry.instrument) ?? 0) + 1);
  }
  let best: Instrument = 'perc-kit';
  let bestCount = 0; // a family must have at least one matching note to win
  // Iterate families in priority order so ties resolve deterministically.
  for (const fam of PERC_FAMILIES) {
    const c = counts.get(fam) ?? 0;
    if (c > bestCount) {
      bestCount = c;
      best = fam;
    }
  }
  return best;
}

/**
 * Map a GM percussion note to a stroke midi VALID for `instrument`. If the GM
 * note maps to this instrument we use that stroke; otherwise we fall back to the
 * instrument's first stroke so the note still lands on a defined staff line
 * (rather than the renderer's generic c/5 fallback).
 */
export function gmToStrokeMidi(gmNote: number, instrument: Instrument): number {
  // These auxiliary sounds also belong to a timbal setup. Keep their identity
  // when the track has explicitly been selected as timbal.
  if (instrument === 'perc-timbal') {
    const auxiliary: Record<number, number> = { 37: 69, 49: 70, 51: 70, 52: 70, 55: 70, 56: 71, 57: 70, 59: 70, 75: 72, 76: 72, 77: 72 };
    if (auxiliary[gmNote] !== undefined) return auxiliary[gmNote];
  }
  const strokes = getPercStrokes(instrument);
  const first = strokes?.[0]?.midi ?? 60;
  const entry = GM_PERCUSSION[gmNote];
  if (!entry) return first;
  if (entry.instrument === instrument && strokes?.some((s) => s.midi === entry.strokeMidi)) {
    return entry.strokeMidi;
  }
  return first;
}
