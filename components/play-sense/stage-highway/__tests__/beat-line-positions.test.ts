import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ExerciseGrid } from '@/lib/play-sense/types'

vi.mock('@/lib/play-sense/grid', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/play-sense/grid')>()
  return {
    ...actual,
    gridBeats: vi.fn(actual.gridBeats),
    gridLoopSeconds: vi.fn(actual.gridLoopSeconds),
  }
})

import { beatLinePositions } from '../StageRenderer'
import { gridBeats, gridLoopSeconds } from '@/lib/play-sense/grid'

// 4/4 at 120 bpm for bar 1, then a confirmed tempo change to 4/4 at 60 bpm for
// bar 2 (bar 2 spans seconds 2-6, at 1 s/qn). One full loop is 6 s.
const GRID: ExerciseGrid = {
  measureStartSec: [0, 2, 6],
  measureStartQN: [0, 4, 8],
  secPerQN: [0.5, 1],
  beatQN: [1, 1],
}

describe('beatLinePositions', () => {
  it('returns every beat within the window, tagging downbeats', () => {
    const positions = beatLinePositions(GRID, 0, 2)
    expect(positions.map(p => p.seconds)).toEqual([0, 0.5, 1, 1.5, 2])
    expect(positions.map(p => p.downbeat)).toEqual([true, false, false, false, true])
  })

  it('shifts the window forward within the same loop', () => {
    const positions = beatLinePositions(GRID, 2.1, 5)
    expect(positions.map(p => p.seconds)).toEqual([3, 4, 5])
    expect(positions.every(p => !p.downbeat)).toBe(true)
  })

  it('wraps into the next loop pass, keeping downbeats correct', () => {
    // 5.5-6.5 s crosses the loop boundary at 6 s (loop length = 6 s); 6 s is
    // the next pass's downbeat, 6.5 s its second beat.
    const positions = beatLinePositions(GRID, 5.5, 6.5)
    expect(positions.map(p => p.seconds)).toEqual([6, 6.5])
    expect(positions.map(p => p.downbeat)).toEqual([true, false])
  })

  it('returns nothing for an empty or inverted window', () => {
    expect(beatLinePositions(GRID, 10, 9)).toEqual([])
  })

  it('spaces the count-in (before bar 1) at bar 1\'s beat length, not the last bar of a wrapped loop pass', () => {
    // Bar 2 is at a different tempo (1 s/qn vs bar 1's 0.5 s/qn), so a naive
    // wrap of the loop's tail into negative time would space these 1 s apart
    // instead of bar 1's 0.5 s, and would get the downbeat wrong.
    const positions = beatLinePositions(GRID, -2, -0.5)
    expect(positions.map(p => p.seconds)).toEqual([-2, -1.5, -1, -0.5])
    expect(positions.map(p => p.downbeat)).toEqual([true, false, false, false])
  })

  it('splices the count-in and bar-1-onward halves across a window straddling t=0', () => {
    const positions = beatLinePositions(GRID, -1, 1)
    expect(positions.map(p => p.seconds)).toEqual([-1, -0.5, 0, 0.5, 1])
    expect(positions.map(p => p.downbeat)).toEqual([false, false, true, false, false])
  })
})

describe('beatLinePositions caching', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('computes gridBeats/gridLoopSeconds once per grid object, not per call', () => {
    const grid: ExerciseGrid = { measureStartSec: [0, 2], measureStartQN: [0, 4], secPerQN: [0.5], beatQN: [1] }
    beatLinePositions(grid, 0, 1)
    beatLinePositions(grid, 1, 2)
    beatLinePositions(grid, -1, 0.5)
    expect(gridBeats).toHaveBeenCalledTimes(1)
    expect(gridLoopSeconds).toHaveBeenCalledTimes(1)
  })

  it('recomputes for a different grid object', () => {
    const gridA: ExerciseGrid = { measureStartSec: [0, 2], measureStartQN: [0, 4], secPerQN: [0.5], beatQN: [1] }
    const gridB: ExerciseGrid = { measureStartSec: [0, 2], measureStartQN: [0, 4], secPerQN: [0.5], beatQN: [1] }
    beatLinePositions(gridA, 0, 1)
    beatLinePositions(gridB, 0, 1)
    expect(gridBeats).toHaveBeenCalledTimes(2)
  })
})
