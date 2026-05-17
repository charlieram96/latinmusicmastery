// PlaySense Studio — instrument tuning + fretboard configuration.
//
// Single source of truth for fretboard, tab, and auto-fingering systems.
// Adding a new instrument should be a row addition here, not a code change
// elsewhere.

import type { Instrument } from '@/components/playsense-studio/shared/score-model/types';

export interface InstrumentConfig {
  instrument: Instrument;
  displayName: string;
  /** Open-string note names, low-to-high (course-by-course). */
  tuning: string[];
  /** Number of distinct courses (strings/string-groups). */
  courseCount: number;
  /** Strings per course. 1 = single, 2 = double (tres), 3 = triple (tiple). */
  stringMultiplicity: number;
  /** Number of frets shown on the fretboard view. */
  fretCount: number;
  /** True if the instrument is fretted and supports tab/fretboard views. */
  fretted: boolean;
  /** Used by auto-fingering — preferred string for a given pitch range. */
  preferredFingeringHint?: string;
}

export const INSTRUMENTS: Record<Instrument, InstrumentConfig> = {
  guitar: {
    instrument: 'guitar',
    displayName: 'Guitar',
    tuning: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
    courseCount: 6,
    stringMultiplicity: 1,
    fretCount: 22,
    fretted: true,
  },
  bass: {
    instrument: 'bass',
    displayName: 'Bass',
    tuning: ['E1', 'A1', 'D2', 'G2'],
    courseCount: 4,
    stringMultiplicity: 1,
    fretCount: 22,
    fretted: true,
  },
  tres: {
    instrument: 'tres',
    displayName: 'Cuban Tres',
    // Cuban tres: 3 double courses, traditional tuning G3-G4 / C4-C4 / E4-E4
    // Stored as the lower note of each course; UI shows both per course.
    tuning: ['G3', 'C4', 'E4'],
    courseCount: 3,
    stringMultiplicity: 2,
    fretCount: 19,
    fretted: true,
  },
  cuatro: {
    instrument: 'cuatro',
    displayName: 'Venezuelan Cuatro',
    // Standard 4-string Venezuelan cuatro: A3-D4-F#4-B3 (re-entrant).
    tuning: ['A3', 'D4', 'F#4', 'B3'],
    courseCount: 4,
    stringMultiplicity: 1,
    fretCount: 17,
    fretted: true,
  },
  tiple: {
    instrument: 'tiple',
    displayName: 'Colombian Tiple',
    // Colombian tiple: 4 triple courses. Each course shown as its octave-pair root.
    tuning: ['D3', 'G3', 'B3', 'E4'],
    courseCount: 4,
    stringMultiplicity: 3,
    fretCount: 18,
    fretted: true,
  },
  ukulele: {
    instrument: 'ukulele',
    displayName: 'Ukulele',
    tuning: ['G4', 'C4', 'E4', 'A4'],
    courseCount: 4,
    stringMultiplicity: 1,
    fretCount: 15,
    fretted: true,
  },
  mandolin: {
    instrument: 'mandolin',
    displayName: 'Mandolin',
    tuning: ['G3', 'D4', 'A4', 'E5'],
    courseCount: 4,
    stringMultiplicity: 2,
    fretCount: 20,
    fretted: true,
  },
  piano: {
    instrument: 'piano',
    displayName: 'Piano',
    tuning: [],
    courseCount: 0,
    stringMultiplicity: 0,
    fretCount: 0,
    fretted: false,
  },
  staff: {
    instrument: 'staff',
    displayName: 'Staff',
    tuning: [],
    courseCount: 0,
    stringMultiplicity: 0,
    fretCount: 0,
    fretted: false,
  },
  'perc-kit': {
    instrument: 'perc-kit',
    displayName: 'Drum Kit',
    tuning: [],
    courseCount: 0,
    stringMultiplicity: 0,
    fretCount: 0,
    fretted: false,
  },
  'perc-conga': {
    instrument: 'perc-conga',
    displayName: 'Conga',
    tuning: [],
    courseCount: 0,
    stringMultiplicity: 0,
    fretCount: 0,
    fretted: false,
  },
  'perc-bongo': {
    instrument: 'perc-bongo',
    displayName: 'Bongo',
    tuning: [],
    courseCount: 0,
    stringMultiplicity: 0,
    fretCount: 0,
    fretted: false,
  },
  'perc-timbal': {
    instrument: 'perc-timbal',
    displayName: 'Timbales',
    tuning: [],
    courseCount: 0,
    stringMultiplicity: 0,
    fretCount: 0,
    fretted: false,
  },
  'perc-clave': {
    instrument: 'perc-clave',
    displayName: 'Clave',
    tuning: [],
    courseCount: 0,
    stringMultiplicity: 0,
    fretCount: 0,
    fretted: false,
  },
};

export function isFretted(instrument: Instrument): boolean {
  return INSTRUMENTS[instrument].fretted;
}

export function getTuning(instrument: Instrument): string[] {
  return INSTRUMENTS[instrument].tuning;
}
