import { describe, expect, it } from 'vitest'
import { beatLinePositions } from '../StageRenderer'
import type { ExerciseGrid } from '@/lib/play-sense/types'

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
})
