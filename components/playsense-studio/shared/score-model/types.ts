// PlaySense Studio score model — normalized internal representation.
//
// This is the source of truth for every renderer, the player, and the editor.
// All imports (MusicXML, MIDI, PDF/image) are normalized into ScoreDocument.
// All exports go back through this type.
//
// Designed as a thin subset of MusicXML's information model: just enough
// to render staff/tab/fretboard/percussion and round-trip the features
// Latin music courses actually use. Explicit non-goals: cross-staff beaming,
// tuplets beyond triplets, advanced ornaments — see plan §M8 scope cap.

export type SchemaVersion = 1;

export type SourceFormat = 'musicxml' | 'midi' | 'pdf' | 'image' | 'native';

export type Instrument =
  | 'guitar'
  | 'bass'
  | 'tres'
  | 'cuatro'
  | 'tiple'
  | 'ukulele'
  | 'mandolin'
  | 'piano'
  | 'staff'
  | 'perc-kit'
  | 'perc-conga'
  | 'perc-bongo'
  | 'perc-timbal'
  | 'perc-clave';

export type DefaultView = 'staff' | 'tab' | 'fretboard' | 'rhythm-grid' | 'pdf';

export interface ScoreDocument {
  schemaVersion: SchemaVersion;
  title: string;
  composer?: string;
  sourceFormat: SourceFormat;
  /** Initial tempo in BPM (quarter-note BPM). Tempo changes live in measures[].tempoChange. */
  initialTempo: number;
  /** [numerator, denominator] e.g. [4,4]. */
  initialTimeSignature: [number, number];
  /** Concert key signature, expressed as MusicXML "fifths" (-7..+7; negative = flats, positive = sharps). */
  initialKeyFifths: number;
  tracks: Track[];
}

export interface Track {
  index: number;
  instrument: Instrument;
  displayName: string;
  /** Note names per open string, low-to-high (e.g. ["E2","A2","D3","G3","B3","E4"] for guitar). Null for unpitched. */
  tuning: string[] | null;
  /** 1 = single course, 2 = double course (tres), 3 = triple course (tiple). */
  stringMultiplicity: number;
  /** MIDI channel if originated from MIDI; null otherwise. */
  channel: number | null;
  defaultView: DefaultView;
  measures: Measure[];
}

export interface Measure {
  /** Expanded performance order; matching offsets share notation across passes. */
  repeat?: { id: string; pass: number; count: number; offset: number; length: number };
  /** 1-based measure number. */
  number: number;
  /** Optional time-signature change at this measure. */
  timeSignature?: [number, number];
  /** Optional tempo change at start of this measure (BPM). */
  tempoChange?: number;
  /** Optional key signature change (fifths). */
  keyFifths?: number;
  /** Voices within this measure. Editor permits max 2 in v1. */
  voices: Voice[];
}

export interface Voice {
  /** 1-based voice number within the measure. */
  number: number;
  events: MusicalEvent[];
}

export type MusicalEvent = Note | Rest | Chord;

export interface NoteBase {
  /** Quarter-note duration. 1.0 = quarter, 0.5 = eighth, 2.0 = half, etc. */
  durationQN: number;
  /** True if this event is dotted (1.5x duration). */
  dotted?: boolean;
  /** Triplet flag — 2/3 of nominal duration. */
  triplet?: boolean;
  /** Tied to next event of same pitch. */
  tieToNext?: boolean;
  /** Slurred to next event. */
  slurToNext?: boolean;
  articulation?: 'staccato' | 'accent' | 'tenuto';
}

export interface Note extends NoteBase {
  kind: 'note';
  /** MIDI note number (0-127). 60 = middle C. */
  midi: number;
  /** Optional enharmonic spelling hint (e.g. "Bb" vs "A#"). */
  spellingHint?: string;
  /** Optional fret position (string is 1-based, low to high). For tab/fretboard tracks. */
  fingering?: { string: number; fret: number; finger?: number };
}

export interface Rest extends NoteBase {
  kind: 'rest';
}

export interface Chord extends NoteBase {
  kind: 'chord';
  /** Each note's MIDI + optional fingering. Shared duration. */
  notes: Array<{
    midi: number;
    spellingHint?: string;
    fingering?: { string: number; fret: number; finger?: number };
    tieToNext?: boolean;
  }>;
}
