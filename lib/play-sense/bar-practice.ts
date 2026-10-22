import type { ExerciseDefinition } from './types'

export interface BarPracticeClip { start: number; end: number; bpm: number; beats: number; beatSeconds: number; clickOffsetSeconds?: number }
/** Same authored grid and bar-one anchor used by graded playback. Never use the Watch clock. */
export function barPracticeClip(exercise: ExerciseDefinition, bar: number, barOne: number, trimIn = 0, trimOut?: number | null, metronomeAnchor?: number | null): BarPracticeClip | null {
  if (!Number.isInteger(bar) || bar < 1 || bar > exercise.measures || !Number.isFinite(barOne)) return null
  const i = bar - 1
  const beatSeconds = exercise.grid ? exercise.grid.secPerQN[i] * exercise.grid.beatQN[i] : 60 / exercise.bpm * 4 / exercise.timeSignature[1]
  const from = exercise.grid?.measureStartSec[i] ?? i * exercise.timeSignature[0] * beatSeconds
  const to = exercise.grid?.measureStartSec[i + 1] ?? from + exercise.timeSignature[0] * beatSeconds
  const start = barOne + from, end = barOne + to
  // A partially available measure is not presented as a complete practice clip.
  if (![start, end, beatSeconds].every(Number.isFinite) || beatSeconds <= 0 || end <= start || start < trimIn - .01 || end > (trimOut ?? Infinity) + .01) return null
  return { start, end, bpm: 60 / (exercise.grid?.secPerQN[i] ?? 60 / exercise.bpm), beats: Math.round((end-start)/beatSeconds), beatSeconds, ...(metronomeAnchor != null ? { clickOffsetSeconds: ((metronomeAnchor - barOne) % beatSeconds + beatSeconds) % beatSeconds } : {}) }
}
