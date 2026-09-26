import type { PercussionNotation } from '@/components/playsense-studio/shared/score-model/types';
// PlaySense Studio — convert our normalized Score model into VexFlow primitives.
//
// Pure functions. No DOM, no I/O, no React. The staff renderer in
// components/playsense-studio/player/notation/renderers/staff-renderer.tsx calls these
// to build StaveNote arrays per measure, then lays them out with VexFlow's
// Formatter.

import type {
  Articulation,
  Dynamic,
  Measure,
  MusicalEvent,
  Ornament,
  Track,
} from '@/components/playsense-studio/shared/score-model/types';
import {
  beatLengthInQN,
  measureLengthInQN,
} from './time-mapping';
import { isPercussion, percussionNotation } from './perc-strokes';
import { eventArticulations, eventDots, eventTuplet, tupletScale } from '@/components/playsense-studio/shared/score-model/accessors';
import { createAccidentalMemory, keyAlter, spellMidi, vexKey, type AccidentalCode, type SpelledPitch } from './notation/accidentals';
import { legacyTripletGroups } from './legacy-triplets';
// notation/accidentals.ts imports midiToKeyString from this file. That circular
// import is safe: both sides only use each other inside functions, never at
// module top level.

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

/** Clefs the notation renderers know how to draw. */
export type NotationClef = 'treble' | 'bass' | 'alto' | 'tenor' | 'percussion';

/** One grace note ahead of its main event: spelling + whether it's slashed (acciaccatura). */
export interface GraceDescriptor {
  keys: string[];
  accidentals: Array<AccidentalCode | null>;
  slash: boolean;
  /** Set for a percussion flam grace — its stroke's own notation, key and all. */
  percussion?: PercussionNotation;
}

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
  accidentals: Array<AccidentalCode | null>;
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
  /** Number of augmentation dots (0-2); the renderer adds that many Dot modifiers. */
  dots: 0 | 1 | 2;
  /** Tuplet bracket this event belongs to, or null. Events sharing an id share one bracket. */
  tuplet: { id: string; n: number; m: number } | null;
  /** Every articulation glyph to attach (supersedes `articulation`). */
  articulations: Articulation[];
  ornament?: Ornament;
  dynamic?: Dynamic;
  text?: string;
  /** Grace notes ahead of this event, spelled and ready to draw. */
  grace?: GraceDescriptor[];
  id?: string;
  /** 1 = primary voice (drives playback/hit-testing/grading); 2 = display-only. */
  voice: 1 | 2;
}

// Rest placement, keyed by clef. In a two-voice measure, voice 1's rests sit
// higher on the staff and voice 2's lower, so they don't collide visually.
const REST_KEY: Record<NotationClef, string> = { treble: 'b/4', bass: 'd/3', alto: 'c/4', tenor: 'a/3', percussion: 'b/4' };
const REST_KEY_V1: Record<NotationClef, string> = { treble: 'e/5', bass: 'g/3', alto: 'f/4', tenor: 'd/4', percussion: 'e/5' };
const REST_KEY_V2: Record<NotationClef, string> = { treble: 'f/4', bass: 'a/2', alto: 'g/3', tenor: 'e/3', percussion: 'f/4' };

const ACCIDENTAL_BY_ALTER: Record<number, AccidentalCode> = { [-2]: 'bb', [-1]: 'b', 0: 'n', 1: '#', 2: '##' };

/**
 * Extract a flat list of VexEventDescriptors for a single track, with
 * cumulative QN positions ready for cursor mapping. Tempo changes do not
 * affect QN positions — only the score-internal time math (time-mapping.ts)
 * cares about ms.
 *
 * Only voice 1 (`events`) drives playback highlighting, hit-testing, cursor
 * mapping and grading. Voice 2 (`voice2Events`) is drawn for display only.
 */
export function extractTrackEvents(
  track: Track,
  initialTimeSignature: [number, number],
  keyFifths: number = 0
): Array<{
  measure: Measure;
  events: VexEventDescriptor[];
  voice2Events: VexEventDescriptor[];
  cumulativeQN: number;
  timeSignature: [number, number];
  clef: NotationClef;
  keyFifths: number;
  /** The key in force before this bar (equals keyFifths when unchanged). */
  previousKeyFifths: number;
  keyChanged: boolean;
  clefChanged: boolean;
}> {
  const result: Array<{
    measure: Measure;
    events: VexEventDescriptor[];
    voice2Events: VexEventDescriptor[];
    cumulativeQN: number;
    timeSignature: [number, number];
    clef: NotationClef;
    keyFifths: number;
    /** The key in force before this bar (equals keyFifths when unchanged). */
    previousKeyFifths: number;
    keyChanged: boolean;
    clefChanged: boolean;
  }> = [];

  const percussion = isPercussion(track.instrument);

  let cumulativeQN = 0;
  let currentTimeSig: [number, number] = initialTimeSignature;
  let previousClef: NotationClef | null = null;
  let previousKeyFifths: number | null = null;
  // Tied-from-same-pitch memory per voice, carried across barlines.
  const tieCarry: Record<1 | 2, number[]> = { 1: [], 2: [] };

  for (const measure of track.measures) {
    if (measure.timeSignature) currentTimeSig = measure.timeSignature;
    const measureStartQN = cumulativeQN;
    const beatQN = beatLengthInQN(currentTimeSig);

    const clef: NotationClef = percussion ? 'percussion' : (measure.clef ?? previousClef ?? 'treble');
    // A percussion staff has no pitches to key, so it never carries a key signature.
    const measureKeyFifths: number = percussion ? 0 : (measure.keyFifths ?? previousKeyFifths ?? keyFifths);
    const clefChanged = previousClef !== null && clef !== previousClef;
    const keyChanged = previousKeyFifths !== null && measureKeyFifths !== previousKeyFifths;
    const keyBefore = previousKeyFifths ?? measureKeyFifths;
    previousClef = clef;
    previousKeyFifths = measureKeyFifths;

    const voice1Raw = measure.voices[0]?.events ?? [];
    // A voice 2 of only rests has nothing to show and must not push voice 1
    // into the two-voice layout (raised rests, forced stems), so it is dropped.
    const voice2HasPitches = (measure.voices[1]?.events ?? []).some(e => e.kind !== 'rest');
    const voice2Raw = voice2HasPitches ? measure.voices[1].events : [];
    const twoVoices = voice2HasPitches;
    // Accidental decisions are queued per pitched event and run afterwards in
    // time order across both voices, so the bar's memory sees what came first.
    const accidentalQueue: Array<{
      onset: number;
      voice: 1 | 2;
      seq: number;
      pitches: SpelledPitch[];
      tiedFromSame: boolean[];
      target: Array<AccidentalCode | null>;
    }> = [];
    // A voice with no events in this measure can't carry a tie into the next
    // measure it does appear in — clear its cross-barline tie memory so a
    // later reappearance isn't mistaken for a tied continuation.
    if (voice1Raw.length === 0) tieCarry[1] = [];
    if (voice2Raw.length === 0) tieCarry[2] = [];

    // Per-voice event loop, shared by voice 1 and voice 2. Legacy (id-less)
    // triplets are grouped by legacyTripletGroups — the same groups the editor
    // merges and re-values — and each group gets its own fresh id.
    const describeVoice = (events: MusicalEvent[], voiceNo: 1 | 2): VexEventDescriptor[] => {
      const out: VexEventDescriptor[] = [];
      let qnInMeasure = 0;
      const legacyIdAt = new Map<number, string>();
      legacyTripletGroups(events).forEach((group, g) => {
        for (const i of group) legacyIdAt.set(i, `legacy-${measure.number}-${voiceNo}-${g}`);
      });

      for (const [eventIndex, event] of events.entries()) {
        const beatInMeasure = qnInMeasure / beatQN + 1;
        const dots = eventDots(event);
        const dotted = dots >= 1;
        const durationCode = vexflowDurationCode(event.durationQN, dots, tupletScale(event));
        const isRest = event.kind === 'rest';

        const rawTuplet = eventTuplet(event);
        let tuplet: { id: string; n: number; m: number } | null = null;
        if (rawTuplet?.id) {
          tuplet = { id: rawTuplet.id, n: rawTuplet.n, m: rawTuplet.m };
        } else if (rawTuplet) {
          tuplet = { id: legacyIdAt.get(eventIndex)!, n: rawTuplet.n, m: rawTuplet.m };
        }

        let keys: string[];
        let accidentals: Array<AccidentalCode | null>;
        let midi: number | null = null;
        let midiPitches: number[] = [];
        let tiedMidiPitches: number[] = [];
        let percussionHeads: PercussionNotation[] | undefined;

        if (event.kind === 'note') {
          midi = event.midi;
          midiPitches = [event.midi];
          tiedMidiPitches = event.tieToNext ? [event.midi] : [];
          if (percussion) {
            percussionHeads = [percussionNotation(track.instrument, event)];
            keys = percussionHeads.map(n => n.staffLine);
            accidentals = [null];
          } else {
            const spelled = spellMidi(event.midi, { spelling: event.spelling, spellingHint: event.spellingHint, keyFifths: measureKeyFifths });
            keys = [vexKey(spelled)];
            accidentals = [null];
            accidentalQueue.push({
              onset: qnInMeasure, voice: voiceNo, seq: accidentalQueue.length,
              pitches: [spelled], tiedFromSame: [tieCarry[voiceNo].includes(event.midi)], target: accidentals,
            });
          }
        } else if (event.kind === 'chord') {
          midi = event.notes[0]?.midi ?? null;
          midiPitches = event.notes.map(n => n.midi);
          tiedMidiPitches = event.notes.filter(n => event.tieToNext || n.tieToNext).map(n => n.midi);
          if (percussion) {
            percussionHeads = event.notes.map(n => percussionNotation(track.instrument, n));
            keys = percussionHeads.map(n => n.staffLine);
            accidentals = keys.map(() => null);
          } else {
            const spelledNotes = event.notes.map(n =>
              spellMidi(n.midi, { spelling: n.spelling, spellingHint: n.spellingHint, keyFifths: measureKeyFifths })
            );
            keys = spelledNotes.map(vexKey);
            accidentals = spelledNotes.map(() => null);
            accidentalQueue.push({
              onset: qnInMeasure, voice: voiceNo, seq: accidentalQueue.length,
              pitches: spelledNotes, tiedFromSame: event.notes.map(n => tieCarry[voiceNo].includes(n.midi)), target: accidentals,
            });
          }
        } else {
          // rest — VexFlow needs a key for visual placement.
          keys = [twoVoices ? (voiceNo === 1 ? REST_KEY_V1 : REST_KEY_V2)[clef] : REST_KEY[clef]];
          accidentals = [null];
        }

        // Grace notes are spelled against the key only — no bar memory. A
        // percussion flam grace gets its stroke's own key and notehead, the
        // same way a main percussion note does, and no accidental.
        const grace = event.grace?.map(g => {
          if (g.percussion) {
            const stroke = percussionNotation(track.instrument, g);
            return { keys: [stroke.staffLine], accidentals: [null], slash: g.slash, percussion: stroke };
          }
          const spelled = spellMidi(g.midi, { spelling: g.spelling, keyFifths: measureKeyFifths });
          const accidental = spelled.alter !== keyAlter(spelled.step, measureKeyFifths) ? ACCIDENTAL_BY_ALTER[spelled.alter] : null;
          return { keys: [vexKey(spelled)], accidentals: [accidental], slash: g.slash };
        });

        out.push({
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
          midiPitches,
          tiedMidiPitches,
          percussion: percussionHeads,
          triplet: event.triplet ?? false,
          tieToNext: event.tieToNext ?? false,
          articulation: event.kind === 'rest' ? undefined : event.articulation,
          dots,
          tuplet,
          articulations: event.kind === 'rest' ? [] : eventArticulations(event),
          ornament: event.ornament,
          dynamic: event.dynamic,
          text: event.text,
          grace,
          id: event.id,
          voice: voiceNo,
        });

        tieCarry[voiceNo] = tiedMidiPitches;
        qnInMeasure += event.durationQN;
      }

      return out;
    };

    const events = describeVoice(voice1Raw, 1);
    const voice2Events = describeVoice(voice2Raw, 2);

    // Run the bar's accidental memory in onset order (voice 1 first on ties)
    // and write each decision back into its descriptor's accidentals array.
    // Grace notes are decided against the key alone, so they don't take part.
    const memory = createAccidentalMemory(measureKeyFifths);
    accidentalQueue
      .sort((a, b) => (Math.abs(a.onset - b.onset) > 1e-6 ? a.onset - b.onset : a.voice - b.voice || a.seq - b.seq))
      .forEach(q => q.pitches.forEach((p, i) => { q.target[i] = memory.code(p, { tiedFromSame: q.tiedFromSame[i] }); }));

    result.push({
      measure,
      events,
      voice2Events,
      cumulativeQN: measureStartQN,
      timeSignature: currentTimeSig,
      clef,
      keyFifths: measureKeyFifths,
      previousKeyFifths: keyBefore,
      keyChanged,
      clefChanged,
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
