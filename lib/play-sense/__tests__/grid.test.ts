import { describe, expect, it } from 'vitest'
import { gridLoopSeconds, gridSecondsAtQN, gridQNAtSeconds, gridBeats, gridCountIn } from '../grid'
import type { ExerciseGrid } from '../types'

// 4/4 at 120 bpm for bars 1-2 (0.5 s/qn), a confirmed tempo change to 60 bpm
// (1 s/qn) at bar 3, through bar 4. Matches the exercise-grid.test.ts fixture
// for buildExerciseGrid's confirmed-tempo behaviour.
const TEMPO_CHANGE_GRID: ExerciseGrid = {
  measureStartSec: [0, 2, 4, 8, 12],
  measureStartQN: [0, 4, 8, 12, 16],
  secPerQN: [0.5, 0.5, 1, 1],
  beatQN: [1, 1, 1, 1],
}

// [4/4, 6/8] at a uniform tempo, for gridBeats.
const METER_CHANGE_GRID: ExerciseGrid = {
  measureStartSec: [0, 2, 3.5],
  measureStartQN: [0, 4, 7],
  secPerQN: [0.5, 0.5],
  beatQN: [1, 0.5],
}

describe('gridLoopSeconds', () => {
  it('is the seconds of the last measure boundary (one full pass)', () => {
    expect(gridLoopSeconds(TEMPO_CHANGE_GRID)).toBe(12)
  })
})

describe('gridSecondsAtQN / gridQNAtSeconds', () => {
  it('maps a qn within a measure to seconds, honouring the tempo change', () => {
    // qn 10 is 2 qn into bar 3 (starts at qn 8, sec 4), at 1 s/qn -> 6 s.
    expect(gridSecondsAtQN(TEMPO_CHANGE_GRID, 10)).toBeCloseTo(6, 9)
  })

  it('round-trips across a tempo change', () => {
    for (const qn of [0, 1, 3.5, 4, 7, 8, 8.25, 10, 12, 15.9, 16]) {
      const s = gridSecondsAtQN(TEMPO_CHANGE_GRID, qn)
      expect(gridQNAtSeconds(TEMPO_CHANGE_GRID, s)).toBeCloseTo(qn, 9)
    }
  })

  it('extrapolates beyond the end using the last measure secPerQN', () => {
    // qn 20 is 4 qn past the loop end (qn 16, sec 12), at bar 4's 1 s/qn -> 16 s.
    expect(gridSecondsAtQN(TEMPO_CHANGE_GRID, 20)).toBeCloseTo(16, 9)
    // Inverse: 16 s is 4 s past the loop end (sec 12), at bar 4's 1 s/qn -> qn 20.
    expect(gridQNAtSeconds(TEMPO_CHANGE_GRID, 16)).toBeCloseTo(20, 9)
  })
})

describe('gridBeats', () => {
  it('gives 4 beats for a 4/4 bar then 6 eighth-beats for a 6/8 bar, downbeats at measure starts', () => {
    const beats = gridBeats(METER_CHANGE_GRID)
    expect(beats).toHaveLength(10)
    const bar1 = beats.slice(0, 4)
    const bar2 = beats.slice(4)
    expect(bar1.map((b) => b.downbeat)).toEqual([true, false, false, false])
    expect(bar1.map((b) => b.measure)).toEqual([0, 0, 0, 0])
    expect(bar1.map((b) => b.seconds)).toEqual([0, 0.5, 1, 1.5])
    expect(bar2).toHaveLength(6)
    expect(bar2.map((b) => b.downbeat)).toEqual([true, false, false, false, false, false])
    expect(bar2.map((b) => b.measure)).toEqual([1, 1, 1, 1, 1, 1])
    expect(bar2[0].seconds).toBeCloseTo(2, 9)
    // 6/8 beat = eighth note = 0.25 s at this tempo (0.5 s/qn, beatQN 0.5).
    expect(bar2[1].seconds).toBeCloseTo(2.25, 9)
  })
})

describe('gridCountIn', () => {
  it('gives 2 bars x 4 beats at 120 bpm as negative seconds ending at -0.5', () => {
    const g: ExerciseGrid = { measureStartSec: [0, 2], measureStartQN: [0, 4], secPerQN: [0.5], beatQN: [1] }
    expect(gridCountIn(g, 2, 4)).toEqual([-4, -3.5, -3, -2.5, -2, -1.5, -1, -0.5])
  })

  it('gives 1 bar of beats when bars is 1', () => {
    const g: ExerciseGrid = { measureStartSec: [0, 2], measureStartQN: [0, 4], secPerQN: [0.5], beatQN: [1] }
    expect(gridCountIn(g, 1, 4)).toEqual([-2, -1.5, -1, -0.5])
  })
})

describe('an empty grid (a score with no measures)', () => {
  const EMPTY: ExerciseGrid = { measureStartSec: [0], measureStartQN: [0], secPerQN: [], beatQN: [] }

  it('maps quarter notes and seconds to 0, never NaN', () => {
    expect(gridSecondsAtQN(EMPTY, 0)).toBe(0)
    expect(gridSecondsAtQN(EMPTY, 3)).toBe(0)
    expect(gridQNAtSeconds(EMPTY, 0)).toBe(0)
    expect(gridQNAtSeconds(EMPTY, 2.5)).toBe(0)
    expect(gridLoopSeconds(EMPTY)).toBe(0)
  })

  it('has no count-in beats', () => {
    expect(gridCountIn(EMPTY, 1, 4)).toEqual([])
    expect(gridCountIn(EMPTY, 2, 4)).toEqual([])
  })
})
