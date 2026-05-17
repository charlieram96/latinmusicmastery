// PlaySense Studio — Standard MIDI File → ScoreDocument.
//
// Strategy: read the file with @tonejs/midi, take the first tempo + time
// signature as the score's initial values, then for each non-empty MIDI
// track produce a single-voice Track in our model. Concurrent notes (those
// starting within a small tolerance window) become a Chord; gaps become
// Rests. Durations are snapped to the closest power-of-two QN value (with
// optional dotting) so the renderer doesn't get arbitrary floats.
//
// What's intentionally simple about v1:
//   - Single voice per measure (merging polyphony into chords)
//   - Tempo and time signature lifted from the header start, not tracked
//     across the piece (we'll add tempoChange events when we surface a
//     real "tempo follow" UX)
//   - Drum/percussion programs map to 'staff' for now since the staff
//     renderer is the only one we render

import { Midi } from '@tonejs/midi';
import type {
  Chord,
  Instrument,
  Measure,
  MusicalEvent,
  Note,
  Rest,
  ScoreDocument,
  Track,
  Voice,
} from '@/components/playsense-studio/shared/score-model/types';
import { measureLengthInQN } from '../time-mapping';

const SUPPORTED_DURATIONS_QN: number[] = [
  4, // whole
  2, // half
  1, // quarter
  0.5, // eighth
  0.25, // sixteenth
  0.125, // thirty-second
];

/** Tolerance for grouping near-simultaneous notes into a chord, in QN. */
const CHORD_WINDOW_QN = 0.0625; // 64th-note window

export interface ParseMidiOptions {
  /** Used as the document title; falls back to "Imported MIDI". */
  title?: string;
  /** Instrument override applied to every parsed track. */
  forceInstrument?: Instrument;
}

export async function parseMidi(
  data: ArrayBuffer,
  options: ParseMidiOptions = {}
): Promise<ScoreDocument> {
  const midi = new Midi(data);

  const initialTempo = midi.header.tempos[0]?.bpm ?? 120;
  const sig = midi.header.timeSignatures[0]?.timeSignature ?? [4, 4];
  const initialTimeSignature: [number, number] = [sig[0], sig[1]];
  const initialKeyFifths = midi.header.keySignatures[0]
    ? keySigToFifths(midi.header.keySignatures[0].key)
    : 0;

  const ppq = midi.header.ppq;
  const measureQN = measureLengthInQN(initialTimeSignature);

  const tracks: Track[] = midi.tracks
    .filter((t) => t.notes.length > 0)
    .map((t, idx) => {
      const instrument: Instrument =
        options.forceInstrument ??
        guessInstrument(t.instrument?.number ?? 0, t.channel ?? 0);
      const events = midiNotesToEvents(t.notes, ppq);
      const measures = groupIntoMeasures(events, measureQN);
      return {
        index: idx,
        instrument,
        displayName: t.name?.trim() || t.instrument?.name?.trim() || `Track ${idx + 1}`,
        tuning: null,
        stringMultiplicity: 1,
        channel: t.channel ?? null,
        defaultView: 'staff',
        measures,
      };
    });

  return {
    schemaVersion: 1,
    title: options.title?.trim() || midi.name?.trim() || 'Imported MIDI',
    sourceFormat: 'midi',
    initialTempo,
    initialTimeSignature,
    initialKeyFifths,
    tracks: tracks.length > 0 ? tracks : [emptyStaffTrack()],
  };
}

// ---------------------------------------------------------------------------
// Note → event grouping
// ---------------------------------------------------------------------------

interface RawNote {
  startQN: number;
  durationQN: number;
  midi: number;
}

function midiNotesToEvents(
  notes: { midi: number; ticks: number; durationTicks: number }[],
  ppq: number
): RawNote[] {
  return notes
    .map((n) => ({
      startQN: n.ticks / ppq,
      durationQN: Math.max(n.durationTicks / ppq, 1 / 32),
      midi: n.midi,
    }))
    .sort((a, b) => a.startQN - b.startQN || a.midi - b.midi);
}

/**
 * Group notes by start time (within CHORD_WINDOW_QN) so simultaneous ones
 * become a Chord, and emit Rests for gaps. Each group's duration is the
 * minimum durationQN of its constituent notes (so we don't smear over
 * subsequent events).
 */
function groupIntoMeasures(notes: RawNote[], measureQN: number): Measure[] {
  if (notes.length === 0) return [];

  const events: MusicalEvent[] = [];
  let cursor = 0;
  let i = 0;

  while (i < notes.length) {
    const first = notes[i];
    if (first.startQN > cursor + CHORD_WINDOW_QN) {
      events.push({
        kind: 'rest',
        durationQN: snapDuration(first.startQN - cursor),
      } satisfies Rest);
      cursor = first.startQN;
    }

    // Collect all notes that start within the chord window of `first`.
    const chord: RawNote[] = [first];
    let j = i + 1;
    while (j < notes.length && notes[j].startQN - first.startQN <= CHORD_WINDOW_QN) {
      chord.push(notes[j]);
      j++;
    }

    const minDuration = chord.reduce((m, n) => Math.min(m, n.durationQN), Infinity);
    const snapped = snapDuration(minDuration);

    if (chord.length === 1) {
      events.push({
        kind: 'note',
        midi: chord[0].midi,
        durationQN: snapped,
      } satisfies Note);
    } else {
      events.push({
        kind: 'chord',
        durationQN: snapped,
        notes: chord.map((c) => ({ midi: c.midi })),
      } satisfies Chord);
    }

    cursor = first.startQN + snapped;
    i = j;
  }

  // Slice the flat event stream into measures, splitting any event that
  // straddles a barline into two pieces with a tie.
  return sliceIntoMeasures(events, measureQN);
}

function sliceIntoMeasures(events: MusicalEvent[], measureQN: number): Measure[] {
  const measures: Measure[] = [];
  let measureNumber = 1;
  let measureRemaining = measureQN;
  let currentVoiceEvents: MusicalEvent[] = [];

  const flushMeasure = () => {
    if (currentVoiceEvents.length === 0) {
      currentVoiceEvents.push({ kind: 'rest', durationQN: measureQN } satisfies Rest);
    }
    const voice: Voice = { number: 1, events: currentVoiceEvents };
    measures.push({ number: measureNumber, voices: [voice] });
    measureNumber += 1;
    measureRemaining = measureQN;
    currentVoiceEvents = [];
  };

  for (const event of events) {
    let remaining = event.durationQN;
    let isFirstSlice = true;

    while (remaining > 0) {
      const slice = Math.min(remaining, measureRemaining);
      const sliced = withDuration(event, snapDuration(slice));
      if (!isFirstSlice && sliced.kind !== 'rest') {
        sliced.tieToNext = false;
      }
      // Mark a tie if we're slicing across a barline.
      if (slice < remaining && sliced.kind !== 'rest') {
        sliced.tieToNext = true;
      }
      currentVoiceEvents.push(sliced);
      remaining -= slice;
      measureRemaining -= slice;
      isFirstSlice = false;
      if (measureRemaining <= 0.0001) flushMeasure();
    }
  }

  if (currentVoiceEvents.length > 0) {
    // Pad final partial measure with a rest so it adds up to measureQN.
    if (measureRemaining > 0.0001) {
      currentVoiceEvents.push({ kind: 'rest', durationQN: snapDuration(measureRemaining) } satisfies Rest);
    }
    flushMeasure();
  }

  return measures;
}

function withDuration<T extends MusicalEvent>(event: T, durationQN: number): T {
  return { ...event, durationQN };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Snap a raw duration in QN to the closest supported value (or dotted variant). */
function snapDuration(qn: number): number {
  let bestExact = SUPPORTED_DURATIONS_QN[0];
  let bestExactDelta = Math.abs(qn - bestExact);
  for (const d of SUPPORTED_DURATIONS_QN) {
    const delta = Math.abs(qn - d);
    if (delta < bestExactDelta) {
      bestExactDelta = delta;
      bestExact = d;
    }
    const dotted = d * 1.5;
    const dottedDelta = Math.abs(qn - dotted);
    if (dottedDelta < bestExactDelta) {
      bestExactDelta = dottedDelta;
      bestExact = dotted;
    }
  }
  return bestExact;
}

/** GM program-number / channel → PlaySense Studio instrument bucket. */
function guessInstrument(programNumber: number, channel: number): Instrument {
  if (channel === 9) return 'staff'; // drum channel — no dedicated renderer yet
  if (programNumber >= 24 && programNumber <= 31) return 'guitar';
  if (programNumber >= 32 && programNumber <= 39) return 'bass';
  if (programNumber === 105 || programNumber === 106) return 'mandolin';
  return 'staff';
}

function keySigToFifths(key: string): number {
  // @tonejs/midi gives keys like "C" or "Cm". Major-only mapping for v1.
  const map: Record<string, number> = {
    'C': 0, 'G': 1, 'D': 2, 'A': 3, 'E': 4, 'B': 5, 'F#': 6, 'C#': 7,
    'F': -1, 'Bb': -2, 'Eb': -3, 'Ab': -4, 'Db': -5, 'Gb': -6, 'Cb': -7,
  };
  const root = key.replace(/m$/, '');
  return map[root] ?? 0;
}

function emptyStaffTrack(): Track {
  return {
    index: 0,
    instrument: 'staff',
    displayName: 'Staff',
    tuning: null,
    stringMultiplicity: 1,
    channel: null,
    defaultView: 'staff',
    measures: [
      {
        number: 1,
        voices: [{ number: 1, events: [{ kind: 'rest', durationQN: 4 } satisfies Rest] }],
      },
    ],
  };
}
