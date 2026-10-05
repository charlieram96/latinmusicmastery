import { describe, expect, it } from 'vitest'
import { COUNTS, NOTE_STEPS, ONSETS, judge, loopOf, playheadStep, stepX, type Anchor } from '../staff-demo'

describe('staff demo', () => {
  it('labels only beat numbers over two bars', () => {
    expect(COUNTS.slice(0, 8)).toEqual(['1', '', '2', '', '3', '', '4', ''])
    expect(COUNTS).toHaveLength(16)
  })
  it('every onset is a sounding note step', () => {
    for (const s of ONSETS) expect(NOTE_STEPS).toContain(s)
  })
  it('judges within ±20 ms as on time, ±5 ms as perfect', () => {
    expect(judge(0)).toEqual({ offset: 4, ok: true, perfect: true })
    expect(judge(2)).toEqual({ offset: 12, ok: true, perfect: false })
    expect(judge(5)).toEqual({ offset: 26, ok: false, perfect: false })
    expect(judge(20)).toEqual(judge(0))
  })
  it('interpolates x between anchors and clamps outside', () => {
    const a: Anchor[] = [[0, 10], [4, 50], [16, 170]]
    expect(stepX(a, 2)).toBe(30)
    expect(stepX(a, 10)).toBe(110)
    expect(stepX(a, 99)).toBe(10)
    expect(stepX([], 3)).toBe(0)
  })
  it('walks 16 eighth-note steps per loop at the given tempo', () => {
    expect(playheadStep(0.25, 120)).toBeCloseTo(1)
    expect(playheadStep(4.25, 120)).toBeCloseTo(1)
    expect(loopOf(4.25, 120)).toBe(1)
    expect(loopOf(3.9, 120)).toBe(0)
  })
})
