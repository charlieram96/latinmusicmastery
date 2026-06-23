// PlaySense Studio — score-internal time math.
//
// Given a ScoreDocument with an initial tempo and per-measure tempo/time-signature
// changes, compute the millisecond offset (from start of piece) of any musical
// position. This is the "score-relative" clock — it knows nothing about video.
// The video-relative clock lives in components/playsense-studio/shared/time-map/.
//
// Conventions:
//   - `tempo` is always quarter-note BPM (matches the MusicXML default beat-unit=4).
//   - `beat` within a measure is denominator-of-time-signature units. In 4/4 that's
//     a quarter note, in 6/8 an eighth note. Beat numbers are 1-based: beat 1 is
//     the downbeat.
//   - `qn` is "quarter notes from the start of the piece" — the canonical position
//     unit used everywhere else (TimeMap waypoints, score events, etc.).

import type {
  MusicalEvent,
  ScoreDocument,
  Track,
  Measure,
} from '@/components/playsense-studio/shared/score-model/types';

/** Quarter notes per measure for a given time signature. */
export function measureLengthInQN(timeSignature: [number, number]): number {
  const [numerator, denominator] = timeSignature;
  return (numerator * 4) / denominator;
}

/** Quarter notes per beat for a given time signature. */
export function beatLengthInQN(timeSignature: [number, number]): number {
  const [, denominator] = timeSignature;
  return 4 / denominator;
}

/** Floating-point slack for QN capacity comparisons. */
export const QN_EPS = 1e-7;

/**
 * The TRUE occupied length of a note/rest in quarter notes, given a base
 * duration and its modifiers. A dot adds half (×1.5); a triplet member occupies
 * two-thirds of its nominal value (×2/3). This is the single source of truth for
 * how much room an event takes in a measure — the reducer stores this value as
 * `durationQN` so `occupiedQN` (and `extractTrackEvents`, which positions by raw
 * `durationQN`) stay consistent.
 */
export function effectiveDurationQN(
  baseDurationQN: number,
  modifiers?: { dotted?: boolean; triplet?: boolean }
): number {
  let qn = baseDurationQN;
  if (modifiers?.dotted) qn *= 1.5;
  if (modifiers?.triplet) qn *= 2 / 3;
  return qn;
}

/** Total quarter notes occupied by a measure's events (their stored durations). */
export function occupiedQN(events: Pick<MusicalEvent, 'durationQN'>[]): number {
  return events.reduce((sum, e) => sum + e.durationQN, 0);
}

/**
 * True when a measure holds nothing but a single full-measure rest — the
 * placeholder older scores were seeded with. Such a rest should be replaced
 * (not appended to) when the first real note is added.
 */
export function isFillerRest(
  events: MusicalEvent[],
  timeSignature: [number, number]
): boolean {
  return (
    events.length === 1 &&
    events[0].kind === 'rest' &&
    Math.abs(events[0].durationQN - measureLengthInQN(timeSignature)) < QN_EPS
  );
}

/** Milliseconds per quarter note at the given quarter-note BPM. */
export function qnToMs(qn: number, tempo: number): number {
  return (qn * 60_000) / tempo;
}

interface MeasureWalkState {
  /** Cumulative quarter notes at the START of this measure. */
  cumulativeQN: number;
  /** Cumulative milliseconds at the START of this measure. */
  cumulativeMs: number;
  /** Time signature in effect AT this measure (after any change at its start). */
  timeSignature: [number, number];
  /** Quarter-note BPM in effect AT this measure (after any change at its start). */
  tempo: number;
}

/**
 * Walk a track's measures and yield the cumulative state at the start of each.
 * Pure iterator-style helper used by every other function in this module.
 */
export function* walkMeasures(track: Track, score: ScoreDocument): Generator<{
  measure: Measure;
  state: MeasureWalkState;
}> {
  let cumulativeQN = 0;
  let cumulativeMs = 0;
  let timeSignature = score.initialTimeSignature;
  let tempo = score.initialTempo;

  for (const measure of track.measures) {
    if (measure.timeSignature) timeSignature = measure.timeSignature;
    if (measure.tempoChange !== undefined) tempo = measure.tempoChange;

    yield {
      measure,
      state: { cumulativeQN, cumulativeMs, timeSignature, tempo },
    };

    const measureQN = measureLengthInQN(timeSignature);
    cumulativeQN += measureQN;
    cumulativeMs += qnToMs(measureQN, tempo);
  }
}

/**
 * Total duration of a track in milliseconds.
 * If the track has no measures, returns 0.
 */
export function trackDurationMs(track: Track, score: ScoreDocument): number {
  let cumulativeMs = 0;
  for (const { state, measure: _measure } of walkMeasures(track, score)) {
    const { tempo, timeSignature } = state;
    cumulativeMs = state.cumulativeMs + qnToMs(measureLengthInQN(timeSignature), tempo);
  }
  return cumulativeMs;
}

/** Total duration of a track in quarter notes. */
export function trackDurationQN(track: Track, score: ScoreDocument): number {
  let cumulativeQN = 0;
  for (const { state } of walkMeasures(track, score)) {
    cumulativeQN = state.cumulativeQN + measureLengthInQN(state.timeSignature);
  }
  return cumulativeQN;
}

/**
 * Convert (measureNumber, beatInMeasure) to cumulative quarter notes from start.
 * Beat numbers are 1-based: beat 1 is the downbeat.
 *
 * Returns null if the measure does not exist on this track.
 */
export function measureBeatToQN(
  track: Track,
  score: ScoreDocument,
  measureNumber: number,
  beatInMeasure: number
): number | null {
  for (const { measure, state } of walkMeasures(track, score)) {
    if (measure.number === measureNumber) {
      const beatsFromDownbeat = beatInMeasure - 1;
      return state.cumulativeQN + beatsFromDownbeat * beatLengthInQN(state.timeSignature);
    }
  }
  return null;
}

/**
 * Convert (measureNumber, beatInMeasure) to milliseconds from start.
 *
 * Returns null if the measure does not exist on this track.
 */
export function measureBeatToMs(
  track: Track,
  score: ScoreDocument,
  measureNumber: number,
  beatInMeasure: number
): number | null {
  for (const { measure, state } of walkMeasures(track, score)) {
    if (measure.number === measureNumber) {
      const beatsFromDownbeat = beatInMeasure - 1;
      const qnIntoMeasure = beatsFromDownbeat * beatLengthInQN(state.timeSignature);
      return state.cumulativeMs + qnToMs(qnIntoMeasure, state.tempo);
    }
  }
  return null;
}

/**
 * Convert a quarter-note position from the start of a track into milliseconds.
 * Walks tempo changes accumulating ms per measure until the target qn is found.
 *
 * If `qn` exceeds the track's length, extrapolates using the final tempo
 * (matches the contract from the plan's TimeMap edge-handling section).
 */
export function qnToTrackMs(track: Track, score: ScoreDocument, qn: number): number {
  if (qn < 0) return -qnToMs(-qn, score.initialTempo);

  let lastTempo = score.initialTempo;
  let lastTimeSig = score.initialTimeSignature;
  let lastCumulativeQN = 0;
  let lastCumulativeMs = 0;

  for (const { state } of walkMeasures(track, score)) {
    const { cumulativeQN, cumulativeMs, timeSignature, tempo } = state;
    const measureQN = measureLengthInQN(timeSignature);
    const measureEndQN = cumulativeQN + measureQN;

    if (qn <= measureEndQN) {
      const qnIntoMeasure = qn - cumulativeQN;
      return cumulativeMs + qnToMs(qnIntoMeasure, tempo);
    }

    lastTempo = tempo;
    lastTimeSig = timeSignature;
    lastCumulativeQN = measureEndQN;
    lastCumulativeMs = cumulativeMs + qnToMs(measureQN, tempo);
  }

  // qn is past the end of the score — extrapolate at the final tempo.
  void lastTimeSig;
  return lastCumulativeMs + qnToMs(qn - lastCumulativeQN, lastTempo);
}
