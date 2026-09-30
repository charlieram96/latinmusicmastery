// Stroke IDs are internal, stable MIDI-sized identifiers, not General MIDI keys.
// Conga/timbal positions and symbols follow the user-supplied Finale legends:
// Leyenda Congas.musx and Leyenda de Timbal.musx (Mauricio Upmann).
// Finale's percussion layout harmLev is diatonic from C4: 9 = E5, 5 = A4.
// Timbal reference verified against Leyenda de Timbal_LMM.mxl (16 named
// strokes). The original lives in __tests__/fixtures/timbal-lmm-legend.mxl;
// timbal-legend.test.ts checks import, persistence and appending against it.

import type { Instrument, PercussionNotation, PercussionNotehead } from '@/components/playsense-studio/shared/score-model/types';

export interface PercStroke {
  /** Stable id (used for palette keys). */
  id: string;
  defaultForEntry?: boolean;
  /** Human label shown in the stroke palette. */
  label: string;
  /** MIDI number stored on the note. Unique within the instrument. */
  midi: number;
  /** VexFlow key string fixing the notehead's staff position, e.g. 'g/5'. */
  staffLine: string;
  /** Legacy shape field for the unchanged bongo, clave and kit palettes. */
  noteType?: 'x';
  notehead?: PercussionNotehead;
  /** The legend's extra marcato distinguishes the pressed high slap. */
  marcato?: boolean;
  description?: string;
  group?: string;
}

// Grouped by playing technique; positions come from the notation legends.
const PERC_STROKES: Partial<Record<Instrument, PercStroke[]>> = {
  'perc-conga': [
    { id: 'open-high', label: 'Open · high', midi: 64, staffLine: 'e/5', group: 'Open tones', description: 'Golpe abierto · tumbadora aguda' },
    { id: 'open-low', label: 'Open · low', midi: 63, staffLine: 'd/5', group: 'Open tones', description: 'Golpe abierto · tumbadora grave' },
    { id: 'open-middle', label: 'Open · middle', midi: 67, staffLine: 'g/5', group: 'Open tones', description: '3ra tumbadora · afinación media' },
    { id: 'slap', label: 'Slap', midi: 62, staffLine: 'e/5', notehead: 'ornate-x', group: 'Slaps & muted', description: 'Tapado · abierto o presionado' },
    { id: 'pressed-slap', label: 'Pressed slap', midi: 65, staffLine: 'e/5', notehead: 'ornate-x', marcato: true, group: 'Slaps & muted', description: 'Tapado agudo · mano contraria sobre el parche' },
    { id: 'mute', label: 'Muffled tone', midi: 61, staffLine: 'e/5', notehead: 'slash', group: 'Slaps & muted', description: 'Sonido presionado' },
    { id: 'bass', label: 'Bass · heel', midi: 60, staffLine: 'e/5', notehead: 'circled', group: 'Heel & toe', description: 'Sonido bajo · heel' },
    { id: 'tip', label: 'Tip · toe', midi: 66, staffLine: 'e/5', notehead: 'plus', group: 'Heel & toe', description: 'Sonido de dedos · toe' },
  ],
  'perc-bongo': [
    { id: 'macho-open', label: 'Macho Open', midi: 64, staffLine: 'g/5' },
    { id: 'macho-slap', label: 'Macho Slap', midi: 63, staffLine: 'g/5', noteType: 'x' },
    { id: 'hembra-open', label: 'Hembra Open', midi: 62, staffLine: 'e/5' },
    { id: 'hembra-slap', label: 'Hembra Slap', midi: 61, staffLine: 'e/5', noteType: 'x' },
  ],
  'perc-timbal': [
    { id: 'high', label: 'High timbal', midi: 64, staffLine: 'a/4', group: 'Drums', description: 'Timbal agudo' },
    { id: 'low', label: 'Low timbal', midi: 62, staffLine: 'f/4', group: 'Drums', description: 'Timbal grave' },
    { id: 'rim', label: 'High rim shot', midi: 61, staffLine: 'a/4', notehead: 'x', group: 'Drums' },
    { id: 'high-mute', label: 'High · muffled', midi: 66, staffLine: 'a/4', notehead: 'slash', group: 'Drums' },
    { id: 'low-mute', label: 'Low · muffled', midi: 67, staffLine: 'f/4', notehead: 'slash', group: 'Drums' },
    { id: 'low-cross-stick', label: 'Low cross-stick', midi: 69, staffLine: 'f/4', notehead: 'slashed', group: 'Drums' },
    { id: 'cascara', defaultForEntry: true, label: 'Cáscara · high', midi: 65, staffLine: 'a/4', notehead: 'plus', group: 'Shells & block' },
    { id: 'cascara-low', defaultForEntry: true, label: 'Cáscara · low', midi: 68, staffLine: 'f/4', notehead: 'plus', group: 'Shells & block' },
    { id: 'jam-block', label: 'Jam block', midi: 72, staffLine: 'f/5', notehead: 'square', group: 'Shells & block' },
    { id: 'timbal-bell', label: 'Timbal bell', midi: 71, staffLine: 'g/4', notehead: 'diamond', group: 'Bells & cymbal', description: 'Contracampana' },
    { id: 'bongo-bell-mouth', label: 'Bongo bell · mouth', midi: 73, staffLine: 'f/5', notehead: 'triangle-down', group: 'Bells & cymbal' },
    { id: 'bongo-bell-body', label: 'Bongo bell · body', midi: 74, staffLine: 'f/5', notehead: 'triangle-up', group: 'Bells & cymbal' },
    { id: 'chacha-bell-mouth', label: 'Cha-cha · mouth', midi: 75, staffLine: 'a/5', notehead: 'triangle-down', group: 'Bells & cymbal' },
    { id: 'chacha-bell-body', label: 'Cha-cha · body', midi: 76, staffLine: 'a/5', notehead: 'triangle-up', group: 'Bells & cymbal' },
    { id: 'elbow-strike', label: 'Elbow strike', midi: 77, staffLine: 'c/4', group: 'Drums', description: 'Golpe de Codo' },
    { id: 'cymbal', label: 'Cymbal', midi: 70, staffLine: 'a/5', notehead: 'x', group: 'Bells & cymbal', description: 'Platillo' },
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

/** Written notation takes precedence over playback MIDI, which is often shared by
 * several Finale strokes. An unmatched imported symbol stays at its written position. */
export function resolvePercStroke(instrument: Instrument, note: { midi: number; percussion?: PercussionNotation }): PercStroke | undefined {
  if (!note.percussion) return midiToPercStroke(instrument, note.midi);
  const strokes = getPercStrokes(instrument) ?? [];
  return strokes.find(s => s.id === note.percussion?.strokeId)
    ?? strokes.find(s => s.staffLine === note.percussion?.staffLine
      && (s.notehead ?? s.noteType ?? 'normal') === note.percussion?.notehead
      && !!s.marcato === !!note.percussion?.marcato);
}

export function percussionNotation(instrument: Instrument, note: { midi: number; percussion?: PercussionNotation }): PercussionNotation {
  if (note.percussion) return note.percussion;
  const stroke = midiToPercStroke(instrument, note.midi);
  return { staffLine: stroke?.staffLine ?? 'b/4', notehead: stroke?.notehead ?? stroke?.noteType ?? 'normal', marcato: stroke?.marcato };
}

/** The written notation a stroke is entered with (its position, notehead and id). */
export function strokeNotation(stroke: PercStroke): PercussionNotation {
  return {
    staffLine: stroke.staffLine,
    notehead: stroke.notehead ?? stroke.noteType ?? 'normal',
    strokeId: stroke.id,
    ...(stroke.marcato ? { marcato: true } : {}),
  };
}
