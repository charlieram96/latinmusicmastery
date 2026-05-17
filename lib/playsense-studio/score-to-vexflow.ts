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

/**
 * VexFlow duration code for a quarter-note duration.
 *  4   → 'w'   (whole)
 *  2   → 'h'   (half)
 *  1   → 'q'   (quarter)
 *  0.5 → '8'   (eighth)
 *  0.25→ '16'  (sixteenth)
 *  0.125→'32'  (thirty-second)
 *
 * Dotted notes return the base code; the caller adds a Dot modifier.
 * Triplets return the base code; tuplet bracketing is the caller's concern.
 */
export function vexflowDurationCode(durationQN: number, dotted?: boolean): string {
  // If dotted, the underlying duration is durationQN * 2/3; reverse before lookup.
  const base = dotted ? (durationQN * 2) / 3 : durationQN;

  const eps = 1e-6;
  if (Math.abs(base - 4) < eps) return 'w';
  if (Math.abs(base - 2) < eps) return 'h';
  if (Math.abs(base - 1) < eps) return 'q';
  if (Math.abs(base - 0.5) < eps) return '8';
  if (Math.abs(base - 0.25) < eps) return '16';
  if (Math.abs(base - 0.125) < eps) return '32';

  // Fallback for unusual durations: round to the nearest power of 2.
  // Better than throwing — the visual will be close enough for unsupported edge cases.
  const power = Math.round(Math.log2(base));
  if (power >= 2) return 'w';
  if (power === 1) return 'h';
  if (power === 0) return 'q';
  if (power === -1) return '8';
  if (power === -2) return '16';
  return '32';
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
  if (keyString.includes('#')) return '#';
  if (keyString.includes('b')) return 'b';
  return null;
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
): Array<{ measure: Measure; events: VexEventDescriptor[]; cumulativeQN: number; timeSignature: [number, number] }> {
  const result: Array<{
    measure: Measure;
    events: VexEventDescriptor[];
    cumulativeQN: number;
    timeSignature: [number, number];
  }> = [];

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
      const durationCode = vexflowDurationCode(event.durationQN, dotted);
      const isRest = event.kind === 'rest';

      let keys: string[];
      let accidentals: Array<'#' | 'b' | null>;

      if (event.kind === 'note') {
        const k = midiToKeyString(event.midi, {
          spellingHint: event.spellingHint,
          keyFifths,
        });
        keys = [k];
        accidentals = [extractAccidental(k)];
      } else if (event.kind === 'chord') {
        keys = event.notes.map((n) =>
          midiToKeyString(n.midi, { spellingHint: n.spellingHint, keyFifths })
        );
        accidentals = keys.map((k) => extractAccidental(k));
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
      });

      qnInMeasure += event.durationQN;
    }

    result.push({
      measure,
      events,
      cumulativeQN: measureStartQN,
      timeSignature: currentTimeSig,
    });

    cumulativeQN += measureLengthInQN(currentTimeSig);
  }

  return result;
}
