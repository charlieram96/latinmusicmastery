// Small pure helpers over an ExerciseGrid (lib/play-sense/score-to-exercise.ts
// builds one per score+track). A grid is piecewise-linear in seconds vs.
// quarter notes, one linear piece per measure: measureStartQN[i]..[i+1] maps to
// measureStartSec[i]..[i+1] at the constant rate secPerQN[i]. These helpers
// are the shared math for the graded Studio clock (bar/beat timing, count-in,
// loop length) so callers don't re-derive it.

import type { ExerciseGrid } from './types'

/** Length of one full pass through the grid, in seconds. */
export function gridLoopSeconds(g: ExerciseGrid): number {
  return g.measureStartSec[g.measureStartSec.length - 1]
}

/**
 * The measure index (0-based, into secPerQN/beatQN) whose span covers `value`
 * against the given monotonic `starts` array (measureStartQN or
 * measureStartSec). Values before the first measure resolve to 0; values at
 * or beyond the last measure's start resolve to the last measure (callers
 * extrapolate past its end using its own rate) — a value never falls outside
 * `[0, starts.length - 2]`.
 */
function measureIndexFor(starts: number[], value: number): number {
  const n = starts.length - 1
  for (let i = 0; i < n; i++) {
    if (value < starts[i + 1]) return i
  }
  return Math.max(n - 1, 0)
}

/** Quarter notes → seconds from bar 1. Piecewise by measure; beyond the grid's
 * end (or before its start), extrapolates linearly at the nearest measure's
 * `secPerQN`. */
export function gridSecondsAtQN(g: ExerciseGrid, qn: number): number {
  // A score with no measures has no rate to extrapolate at.
  if (g.secPerQN.length === 0) return 0
  const i = measureIndexFor(g.measureStartQN, qn)
  return g.measureStartSec[i] + (qn - g.measureStartQN[i]) * g.secPerQN[i]
}

/** Seconds from bar 1 → quarter notes. Inverse of `gridSecondsAtQN`. */
export function gridQNAtSeconds(g: ExerciseGrid, s: number): number {
  if (g.secPerQN.length === 0) return 0
  const i = measureIndexFor(g.measureStartSec, s)
  return g.measureStartQN[i] + (s - g.measureStartSec[i]) / g.secPerQN[i]
}

/** Every beat of one pass: seconds from bar 1, whether it's a downbeat, its
 * measure index (0-based, into the grid's per-measure arrays). */
export function gridBeats(g: ExerciseGrid): Array<{ seconds: number; downbeat: boolean; measure: number }> {
  const beats: Array<{ seconds: number; downbeat: boolean; measure: number }> = []
  const n = g.secPerQN.length
  for (let i = 0; i < n; i++) {
    const measureQN = g.measureStartQN[i + 1] - g.measureStartQN[i]
    const beatSec = g.beatQN[i] * g.secPerQN[i]
    const beatCount = Math.round(measureQN / g.beatQN[i])
    for (let b = 0; b < beatCount; b++) {
      beats.push({ seconds: g.measureStartSec[i] + b * beatSec, downbeat: b === 0, measure: i })
    }
  }
  return beats
}

/**
 * Count-in beats before bar 1: `bars` × bar 1's numerator (`beatsPerBar`),
 * spaced at bar 1's beat length. Returned seconds are NEGATIVE (before bar 1,
 * i.e. before `gridSecondsAtQN(g, 0)`), oldest first, ending closest to 0.
 * An empty grid (no measures, so no bar 1) has no count-in: [].
 */
export function gridCountIn(g: ExerciseGrid, bars: 1 | 2, beatsPerBar: number): number[] {
  if (g.secPerQN.length === 0) return []
  const beatSec = g.beatQN[0] * g.secPerQN[0]
  const total = bars * beatsPerBar
  const out: number[] = []
  for (let k = 0; k < total; k++) out.push((k - total) * beatSec)
  return out
}
