import type { PercussionNotation } from '@/components/playsense-studio/shared/score-model/types';
// PlaySense Studio — convert our normalized Score model into VexFlow primitives.
//
// Pure functions. No DOM, no I/O, no React. The staff renderer in
// components/playsense-studio/player/notation/renderers/staff-renderer.tsx calls these
// to build StaveNote arrays per measure, then lays them out with VexFlow's
// Formatter.

import type {
  Measure,
  MusicalEvent,
  Track,
} from '@/components/playsense-studio/shared/score-model/types';
import {
  beatLengthInQN,
  measureLengthInQN,
} from './time-mapping';
import { isPercussion, percussionNotation } from './perc-strokes';
import { eventDots, tupletScale } from '@/components/playsense-studio/shared/score-model/accessors';

/**
 * VexFlow duration code for a quarter-note duration.
 *  4     → 'w'   (whole)
 *  2     → 'h'   (half)
 *  1     → 'q'   (quarter)
 *  0.5   → '8'   (eighth)
 *  0.25  → '16'  (sixteenth)
 *  0.125 → '32'  (thirty-second)
 *  0.0625→ '64'  (sixty-fourth)
 *  0.03125→'128' (hundred-twenty-eighth)
 *
 * Dots and tuplets are undone here; the caller still adds Dot modifiers and tuplet brackets.
 */
export function vexflowDurationCode(durationQN: number, dots: number | boolean = 0, tupletScale = 1): string {
  // Undo the dot (×1.5 or ×1.75) and the tuplet (×m/n) to get the written value.
  const count = dots === true ? 1 : dots === false ? 0 : dots;
  const dotFactor = count >= 2 ? 1.75 : count === 1 ? 1.5 : 1;
  const base = durationQN / dotFactor / (tupletScale || 1);

  const eps = 1e-7;
  if (Math.abs(base - 4) < eps) return 'w';
  if (Math.abs(base - 2) < eps) return 'h';
  if (Math.abs(base - 1) < eps) return 'q';
  if (Math.abs(base - 0.5) < eps) return '8';
  if (Math.abs(base - 0.25) < eps) return '16';
  if (Math.abs(base - 0.125) < eps) return '32';
  if (Math.abs(base - 0.0625) < eps) return '64';
  if (Math.abs(base - 0.03125) < eps) return '128';

  // Fallback for unusual durations: round to the nearest power of 2.
  // Better than throwing — the visual will be close enough for unsupported edge cases.
  const power = Math.round(Math.log2(base));
  if (power >= 2) return 'w';
  if (power === 1) return 'h';
  if (power === 0) return 'q';
  if (power === -1) return '8';
  if (power === -2) return '16';
  if (power === -3) return '32';
  if (power === -4) return '64';
  return '128';
}

const SHARP_NAMES: Record<number, string> = {
  0: 'c',
  1: 'c#',
  2: 'd',
  3: 'd#',
  4: 'e',
  5: 'f',
  6: 'f#',
  7: 'g',
  8: 'g#',
  9: 'a',
  10: 'a#',
  11: 'b',
};

const FLAT_NAMES: Record<number, string> = {
  0: 'c',
  1: 'db',
  2: 'd',
  3: 'eb',
  4: 'e',
  5: 'f',
  6: 'gb',
  7: 'g',
  8: 'ab',
  9: 'a',
  10: 'bb',
  11: 'b',
};

/**
 * MIDI number → VexFlow key string (e.g. 60 → "c/4", 61 → "c#/4" or "db/4").
 *
 * If `spellingHint` is supplied (e.g. "Bb" or "F#"), it overrides default
 * sharp/flat choice. Otherwise:
 *   - keyFifths < 0 (flat keys) prefers flats
 *   - keyFifths >= 0 (sharp keys + C major) prefers sharps
 */
export function midiToKeyString(
  midi: number,
  options: { spellingHint?: string; keyFifths?: number } = {}
): string {
  const { spellingHint, keyFifths = 0 } = options;

  if (spellingHint) {
    const match = spellingHint.match(/^([A-Ga-g])([#b])?(\d?)$/);
    if (match) {
      const letter = match[1].toLowerCase();
      const accidental = match[2] ?? '';
      const octave = match[3] ? Number(match[3]) : Math.floor(midi / 12) - 1;
      return `${letter}${accidental}/${octave}`;
    }
  }

  const pitchClass = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const table = keyFifths < 0 ? FLAT_NAMES : SHARP_NAMES;
  return `${table[pitchClass]}/${octave}`;
}

/**
 * Detect whether a key string carries a sharp/flat that VexFlow will need
 * an explicit Accidental modifier for.
 *
 * VexFlow draws the accidental glyph only when an Accidental is added; the
 * `#`/`b` in the key string just affects the pitch position. So we surface
 * the accidental separately for the renderer to attach.
 */
export function extractAccidental(keyString: string): '#' | 'b' | null {
  // The first 'b' in b/4 is the pitch B, not a flat accidental.
  const accidental = /^[a-g]([#b])\//i.exec(keyString)?.[1];
  return accidental === '#' || accidental === 'b' ? accidental : null;
}

// ---------------------------------------------------------------------------
// Diatonic <-> MIDI helpers (for staff drag-to-pitch)
//
// A "diatonic index" counts staff steps continuously: each line/space is one
// step. We define it as `octave * 7 + letterIndex` where C=0..B=6. Dragging a
// note up/down the staff changes this index by whole steps; the accidental
// (from the toolbar) is applied separately so the chromatic pitch is exact.
// ---------------------------------------------------------------------------

// Chromatic pitch class → diatonic letter index (sharp spelling: C/C#→C, etc.).
const PC_TO_LETTER_INDEX: Record<number, number> = {
  0: 0, // C
  1: 0, // C#
  2: 1, // D
  3: 1, // D#
  4: 2, // E
  5: 3, // F
  6: 3, // F#
  7: 4, // G
  8: 4, // G#
  9: 5, // A
  10: 5, // A#
  11: 6, // B
};

// Diatonic letter index → base chromatic pitch class.
const LETTER_INDEX_TO_PC = [0, 2, 4, 5, 7, 9, 11];

/** MIDI number → continuous diatonic staff index (octave*7 + letterIndex). */
export function midiToDiatonic(midi: number): number {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return octave * 7 + PC_TO_LETTER_INDEX[pc];
}

/**
 * Diatonic staff index back to MIDI, applying an accidental (-1 flat, 0 natural,
 * +1 sharp). `keyFifths` is accepted for future key-aware spelling; v1 applies
 * only the explicit accidental.
 */
export function diatonicToMidi(
  diatonicIndex: number,
  accidental: number = 0,
  _keyFifths: number = 0
): number {
  const octave = Math.floor(diatonicIndex / 7);
  const letterIndex = ((diatonicIndex % 7) + 7) % 7;
  const basePc = LETTER_INDEX_TO_PC[letterIndex];
  const midi = (octave + 1) * 12 + basePc + accidental;
  return Math.max(0, Math.min(127, midi));
}

// ---------------------------------------------------------------------------
// Per-measure event extraction
// ---------------------------------------------------------------------------

export interface VexEventDescriptor {
  /** 'note' | 'rest' | 'chord' — drives StaveNote construction. */
  kind: MusicalEvent['kind'];
  /** Cumulative QN from start of track at the START of this event. */
  qnStart: number;
  /** Quarter-note duration of this event. */
  durationQN: number;
  /** 1-based beat in measure (downbeat is 1; mid-measure offsets are fractional). */
  beatInMeasure: number;
  /** VexFlow key strings for the event's pitches. Rests use ['b/4']. */
  keys: string[];
  /** Accidental glyphs to attach, indexed parallel to keys. null = none. */
  accidentals: Array<'#' | 'b' | null>;
  /** VexFlow duration code (without the rest suffix). */
  durationCode: string;
  /** True if this is a rest (the renderer appends 'r' to the duration code). */
  isRest: boolean;
  /** True if this event is dotted; the renderer adds a Dot modifier. */
  dotted: boolean;
  /** MIDI of the (first) pitch — for staff drag anchoring. null for rests. */
  midi: number | null;
  /** Pitches and ties parallel to keys, including individual held chord notes. */
  midiPitches?: number[];
  tiedMidiPitches?: number[];
  /** 'x' for percussion slap/mute/cymbal noteheads; undefined = normal. */
  noteType?: 'x';
  percussion?: PercussionNotation[];
  /** True if part of a triplet group (consecutive run forms one tuplet). */
  triplet: boolean;
  /** True if all pitches are tied to the next event. */
  tieToNext: boolean;
  /** Articulation glyph to attach, or undefined. */
  articulation?: 'staccato' | 'accent' | 'tenuto';
}

/**
 * Extract a flat list of VexEventDescriptors for a single track, with
 * cumulative QN positions ready for cursor mapping. Tempo changes do not
 * affect QN positions — only the score-internal time math (time-mapping.ts)
 * cares about ms.
 *
 * Voice 1 only for M2. Multi-voice support lands in M8.
 */
export function extractTrackEvents(
  track: Track,
  initialTimeSignature: [number, number],
  keyFifths: number = 0
): Array<{
  measure: Measure;
  events: VexEventDescriptor[];
  cumulativeQN: number;
  timeSignature: [number, number];
  clef: 'treble' | 'percussion';
}> {
  const result: Array<{
    measure: Measure;
    events: VexEventDescriptor[];
    cumulativeQN: number;
    timeSignature: [number, number];
    clef: 'treble' | 'percussion';
  }> = [];

  const percussion = isPercussion(track.instrument);
  const clef: 'treble' | 'percussion' = percussion ? 'percussion' : 'treble';

  let cumulativeQN = 0;
  let currentTimeSig: [number, number] = initialTimeSignature;

  for (const measure of track.measures) {
    if (measure.timeSignature) currentTimeSig = measure.timeSignature;
    const measureStartQN = cumulativeQN;
    const beatQN = beatLengthInQN(currentTimeSig);
    const voice = measure.voices[0]; // M2: voice 1 only
    const events: VexEventDescriptor[] = [];

    let qnInMeasure = 0;
    for (const event of voice.events) {
      const beatInMeasure = qnInMeasure / beatQN + 1;
      const dotted = event.dotted ?? false;
      const durationCode = vexflowDurationCode(event.durationQN, eventDots(event), tupletScale(event));
      const isRest = event.kind === 'rest';

      let keys: string[];
      let accidentals: Array<'#' | 'b' | null>;
      let midi: number | null = null;
      let percussionHeads: PercussionNotation[] | undefined;

      if (event.kind === 'note') {
        midi = event.midi;
        if (percussion) {
          percussionHeads = [percussionNotation(track.instrument, event)];
          keys = percussionHeads.map(n => n.staffLine);
          accidentals = [null];
        } else {
          const k = midiToKeyString(event.midi, {
            spellingHint: event.spellingHint,
            keyFifths,
          });
          keys = [k];
          accidentals = [extractAccidental(k)];
        }
      } else if (event.kind === 'chord') {
        midi = event.notes[0]?.midi ?? null;
        if (percussion) {
          percussionHeads = event.notes.map(n => percussionNotation(track.instrument, n));
          keys = percussionHeads.map(n => n.staffLine);
          accidentals = keys.map(() => null);
        } else {
          keys = event.notes.map((n) =>
            midiToKeyString(n.midi, { spellingHint: n.spellingHint, keyFifths })
          );
          accidentals = keys.map((k) => extractAccidental(k));
        }
      } else {
        // rest — VexFlow needs a key for visual placement; b/4 is the convention
        keys = ['b/4'];
        accidentals = [null];
      }

      events.push({
        kind: event.kind,
        qnStart: measureStartQN + qnInMeasure,
        durationQN: event.durationQN,
        beatInMeasure,
        keys,
        accidentals,
        durationCode,
        isRest,
        dotted,
        midi,
        midiPitches: event.kind === 'note' ? [event.midi] : event.kind === 'chord' ? event.notes.map(n => n.midi) : [],
        tiedMidiPitches: event.kind === 'note' ? (event.tieToNext ? [event.midi] : []) : event.kind === 'chord' ? event.notes.filter(n => event.tieToNext || n.tieToNext).map(n => n.midi) : [],
        percussion: percussionHeads,
        triplet: event.triplet ?? false,
        tieToNext: event.tieToNext ?? false,
        articulation: event.kind === 'rest' ? undefined : event.articulation,
      });

      qnInMeasure += event.durationQN;
    }

    result.push({
      measure,
      events,
      cumulativeQN: measureStartQN,
      timeSignature: currentTimeSig,
      clef,
    });

    cumulativeQN += measureLengthInQN(currentTimeSig);
  }

  return result;
}

/** Match pitches, never chord positions: a held C can change its index in the next chord. */
export function scoreTieIndices(first: VexEventDescriptor, next: VexEventDescriptor) {
  const firstIndexes: number[] = [];
  const lastIndexes: number[] = [];
  if (first.isRest || next.isRest || Math.abs(first.qnStart + first.durationQN - next.qnStart) > 1e-6) return { firstIndexes, lastIndexes };
  const pitches = first.midiPitches ?? (first.midi === null ? [] : [first.midi]);
  const following = next.midiPitches ?? (next.midi === null ? [] : [next.midi]);
  for (const midi of first.tiedMidiPitches ?? (first.tieToNext ? pitches : [])) {
    const a = pitches.indexOf(midi), b = following.indexOf(midi);
    if (a >= 0 && b >= 0) { firstIndexes.push(a); lastIndexes.push(b); }
  }
  return { firstIndexes, lastIndexes };
}
