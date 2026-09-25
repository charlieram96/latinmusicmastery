import { describe, expect, it } from 'vitest'
import { scoreCursorAt } from '../notation-playback'
import { packScoreRows } from '../notation-layout'

describe('scoreCursorAt with bar tails', () => {
  const anchors = [
    { ms: 0, x: 10, system: 0, bar: 1, barEndX: 100 },
    { ms: 1000, x: 60, system: 0, bar: 1, barEndX: 100 },
    { ms: 2000, x: 130, system: 0, bar: 2, barEndX: 200 },
  ]
  it('runs the last note of a bar to its barline, not into the next bar', () => {
    expect(scoreCursorAt(1500, anchors, 3000, [200]).x).toBe(80)
  })
  it('keeps interpolating between notes of the same bar', () => {
    expect(scoreCursorAt(500, anchors, 3000, [200]).x).toBe(35)
  })
  it('behaves as before without bar data', () => {
    const plain = anchors.map(({ ms, x, system }) => ({ ms, x, system }))
    expect(scoreCursorAt(1500, plain, 3000, [200]).x).toBe(95)
  })
})

describe('packScoreRows maxPerRow', () => {
  it('caps a row at the given number of bars', () => {
    expect(packScoreRows([100, 100, 100, 100, 100], 1000, [], 4).map(r => r.widths.length)).toEqual([4, 1])
    expect(packScoreRows([100, 100, 100, 100, 100], 1000, [], 2).map(r => r.widths.length)).toEqual([2, 2, 1])
  })
  it('still never squeezes bars below their width', () => {
    expect(packScoreRows([300, 300, 300], 500, [], 4).map(r => r.widths.length)).toEqual([1, 1, 1])
  })
})

describe('scoreCursorAt across a blank bar', () => {
  it('sweeps through a bar with no notes instead of stalling at the barline', () => {
    const anchors = [
      { ms: 0, x: 10, system: 0, bar: 0, barEndX: 100 },
      { ms: 4000, x: 210, system: 0, bar: 2, barEndX: 300 },
    ]
    // Halfway through the blank bar 1 the playhead is well past bar 0's barline.
    expect(scoreCursorAt(3000, anchors, 6000, [300]).x).toBeGreaterThan(100)
  })
})
