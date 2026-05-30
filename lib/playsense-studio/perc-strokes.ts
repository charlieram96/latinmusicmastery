// PlaySense Studio — percussion stroke maps.
//
// Percussion tracks don't have a meaningful chromatic pitch. Instead each
// instrument has a small fixed set of named strokes (e.g. a conga's
// Open/Slap/Mute/Bass), each mapped to:
//   • a MIDI number (so the rest of the pipeline — add-note, set-event-pitch,
//     serialization — is unchanged; strokes are just MIDI under the hood), and
//   • a VexFlow staff position (a "key" string like 'g/5') that fixes where the
//     notehead sits on the percussion staff, plus an optional 'x' notehead for
//     muted/slap/cymbal articulations (engraving convention).
//
// The MIDI values follow GM percussion where it makes sense (drum kit) and the
// conga fixture in score-fixtures.ts (62/63/64) for hand drums. The exact value
// only needs to be stable + unique within an instrument so strokes round-trip.

import type { Instrument } from '@/components/playsense-studio/shared/score-model/types';

export interface PercStroke {
  /** Stable id (used for palette keys). */
  id: string;
  /** Human label shown in the stroke palette. */
  label: string;
  /** MIDI number stored on the note. Unique within the instrument. */
  midi: number;
  /** VexFlow key string fixing the notehead's staff position, e.g. 'g/5'. */
  staffLine: string;
  /** 'x' renders an X notehead (slap/mute/cymbal); omitted = normal notehead. */
  noteType?: 'x';
}

// Ordered high→low so the palette reads top-to-bottom like the staff.
const PERC_STROKES: Partial<Record<Instrument, PercStroke[]>> = {
  'perc-conga': [
    { id: 'open-high', label: 'Open High', midi: 64, staffLine: 'g/5' },
    { id: 'slap', label: 'Slap', midi: 62, staffLine: 'g/5', noteType: 'x' },
    { id: 'open-low', label: 'Open Low', midi: 63, staffLine: 'e/5' },
    { id: 'mute', label: 'Mute', midi: 61, staffLine: 'd/5', noteType: 'x' },
    { id: 'bass', label: 'Bass', midi: 60, staffLine: 'c/5' },
  ],
  'perc-bongo': [
    { id: 'macho-open', label: 'Macho Open', midi: 64, staffLine: 'g/5' },
    { id: 'macho-slap', label: 'Macho Slap', midi: 63, staffLine: 'g/5', noteType: 'x' },
    { id: 'hembra-open', label: 'Hembra Open', midi: 62, staffLine: 'e/5' },
    { id: 'hembra-slap', label: 'Hembra Slap', midi: 61, staffLine: 'e/5', noteType: 'x' },
  ],
  'perc-timbal': [
    { id: 'cascara', label: 'Cáscara', midi: 65, staffLine: 'a/5', noteType: 'x' },
    { id: 'high', label: 'High Drum', midi: 64, staffLine: 'g/5' },
    { id: 'low', label: 'Low Drum', midi: 62, staffLine: 'e/5' },
    { id: 'rim', label: 'Rim/Clave', midi: 61, staffLine: 'c/5', noteType: 'x' },
  ],
  'perc-clave': [
    { id: 'stroke', label: 'Clave', midi: 60, staffLine: 'b/4', noteType: 'x' },
  ],
  'perc-kit': [
    { id: 'crash', label: 'Crash', midi: 49, staffLine: 'a/5', noteType: 'x' },
    { id: 'ride', label: 'Ride', midi: 51, staffLine: 'f/5', noteType: 'x' },
    { id: 'hh-closed', label: 'HH Closed', midi: 42, staffLine: 'g/5', noteType: 'x' },
    { id: 'hh-open', label: 'HH Open', midi: 46, staffLine: 'g/5', noteType: 'x' },
    { id: 'hi-tom', label: 'Hi Tom', midi: 48, staffLine: 'e/5' },
    { id: 'mid-tom', label: 'Mid Tom', midi: 45, staffLine: 'd/5' },
    { id: 'snare', label: 'Snare', midi: 38, staffLine: 'c/5' },
    { id: 'floor-tom', label: 'Floor Tom', midi: 41, staffLine: 'a/4' },
    { id: 'kick', label: 'Kick', midi: 36, staffLine: 'f/4' },
  ],
};

/** True for any percussion instrument (perc-kit/conga/bongo/timbal/clave). */
export function isPercussion(instrument: Instrument): boolean {
  return instrument.startsWith('perc-');
}

/** Stroke palette for a percussion instrument, or null for pitched instruments. */
export function getPercStrokes(instrument: Instrument): PercStroke[] | null {
  return PERC_STROKES[instrument] ?? null;
}

/** Resolve a stored MIDI back to its stroke (for rendering + palette highlight). */
export function midiToPercStroke(instrument: Instrument, midi: number): PercStroke | undefined {
  const strokes = PERC_STROKES[instrument];
  if (!strokes) return undefined;
  return strokes.find((s) => s.midi === midi);
}
