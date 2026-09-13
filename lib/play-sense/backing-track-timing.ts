// Backing-track placement: studio timeline seconds -> student engine seconds.
//
// An admin positions a backing track against the VISIBLE TIMELINE — the axis
// the waveform is drawn on, which is the exercise video's own time. The student
// engine knows nothing about that video: it runs a fixed-BPM grid whose t=0 is
// measure 1 beat 1, immediately after the count-in (see beatToTimestamp). The
// bridge between them is the score time map, which relates video time to
// musical position.
//
// This module deliberately mirrors beatToTimestamp's arithmetic rather than
// re-deriving it, so the two can never drift:
//
//   beats  = qn / beatLengthInQN      (beatLengthInQN = 4 / denominator)
//   engine = beats * 60 / bpm
//
// KNOWN LIMITATION: the student engine is a strictly uniform grid — it takes a
// single bpm and time signature from the score (scoreToExerciseDefinition) and
// ignores per-measure tempo/meter changes, which the studio time map DOES
// honour. For a score with a mid-piece tempo change the two timelines diverge,
// and a backing track cannot line up in both at once. Uniform-tempo scores —
// effectively all exercises today — are exact.

/**
 * The only thing we need from a time map. Structural so this module never
 * imports the studio's component tree, and so tests can pass a fake.
 */
export interface TimelineToEngine {
  /** Quarter notes from the start of the piece at a given video time. */
  toMusicalPosition(videoTimeSeconds: number): number;
}

/** The engine's single, uniform grid. */
export interface EngineGrid {
  bpm: number;
  timeSignature: [number, number];
}

/**
 * Where a clip positioned at `timelineSeconds` should start, in seconds from
 * the engine's t0 (measure 1, beat 1).
 *
 * A NEGATIVE result is legal and meaningful: the clip begins before beat one,
 * and the scheduler starts it part-way into its buffer. Callers must not clamp.
 *
 * With no time map there is no video axis — the visible timeline IS the score
 * grid — so the position passes through, less the media origin.
 */
export function timelineToEngineSeconds(
  timelineSeconds: number,
  map: TimelineToEngine | null,
  grid: EngineGrid,
  fallbackOriginSeconds = 0
): number {
  if (!Number.isFinite(timelineSeconds)) return 0;

  if (!map) {
    const seconds = timelineSeconds - fallbackOriginSeconds;
    return Number.isFinite(seconds) ? seconds : 0;
  }

  const [, denominator] = grid.timeSignature;
  const beatLengthInQN = 4 / denominator;
  if (!grid.bpm || !Number.isFinite(grid.bpm) || !Number.isFinite(beatLengthInQN) || beatLengthInQN <= 0) {
    return 0;
  }

  const quarterNotes = map.toMusicalPosition(timelineSeconds);
  if (!Number.isFinite(quarterNotes)) return 0;

  const beats = quarterNotes / beatLengthInQN;
  const seconds = (beats * 60) / grid.bpm;
  return Number.isFinite(seconds) ? seconds : 0;
}
