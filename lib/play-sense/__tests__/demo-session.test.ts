import { describe, expect, it } from 'vitest'
import { makeDemoExercise } from '../demo-exercises'
import { generateExpectedTimestamps, getExerciseDuration } from '../exercise-utils'
import {
  DEMO_LEAD_IN, DEMO_TAIL, comboOf, createDemoSession, demoBeat, demoMeasure, frameDelta, resetDemoSession, stepDemoSession,
} from '../demo-session'
import type { EventResult } from '../types'

const exercise = makeDemoExercise('conga')
const expected = generateExpectedTimestamps(exercise)
const duration = getExerciseDuration(exercise)
const opts = (demo: boolean) => ({ expected, duration, demo })

describe('frameDelta', () => {
  it('is zero on the first frame', () => expect(frameDelta(1000, 0)).toBe(0))
  it('converts ms to seconds', () => expect(frameDelta(1016, 1000)).toBeCloseTo(0.016))
  it('caps long gaps at 0.1 s', () => expect(frameDelta(5000, 1000)).toBe(0.1))
})

describe('stepDemoSession', () => {
  it('starts in the lead-in with nothing graded', () => {
    const s = createDemoSession()
    expect(s.elapsed).toBe(DEMO_LEAD_IN)
    expect(stepDemoSession(s, 0.05, opts(true)).added).toEqual([])
  })

  it('grades each due event perfect exactly once in demo mode', () => {
    const s = createDemoSession()
    s.elapsed = 0.29
    const first = stepDemoSession(s, 0.02, opts(true)) // t = 0.31: events at 0 and 0.3
    expect(first.added.map(r => r.eventIndex)).toEqual([expected[0].eventIndex, expected[1].eventIndex])
    expect(first.added.every(r => r.grade === 'perfect' && r.offsetMs === 0 && r.timing === 'on_time' && r.onsetEnergy === 1)).toBe(true)
    expect(stepDemoSession(s, 0.01, opts(true)).added).toEqual([])
    expect(s.results).toHaveLength(2)
  })

  it('returns a new results array when events are added', () => {
    const s = createDemoSession()
    const before = s.results
    s.elapsed = 0
    stepDemoSession(s, 0.01, opts(true))
    expect(s.results).not.toBe(before)
  })

  it('waits 150 ms before calling a miss in live mode', () => {
    const s = createDemoSession()
    s.elapsed = 0
    expect(stepDemoSession(s, 0.1, opts(false)).added).toEqual([])
    const late = stepDemoSession(s, 0.06, opts(false))
    expect(late.added[0]).toMatchObject({ eventIndex: expected[0].eventIndex, grade: 'miss', offsetMs: null, timing: null, onsetEnergy: null })
  })

  it('loops the demo after the tail and clears judgments', () => {
    const s = createDemoSession()
    s.elapsed = duration + DEMO_TAIL - 0.01
    const r = stepDemoSession(s, 0.02, opts(true))
    expect(r.looped).toBe(true)
    expect(r.ended).toBe(false)
    expect(s.elapsed).toBe(DEMO_LEAD_IN)
    expect(s.results).toEqual([])
    expect(s.matched.size).toBe(0)
  })

  it('ends a live take instead of looping', () => {
    const s = createDemoSession()
    s.elapsed = duration + DEMO_TAIL
    const r = stepDemoSession(s, 0.01, opts(false))
    expect(r).toMatchObject({ looped: false, ended: true })
  })

  it('reset restores the lead-in', () => {
    const s = createDemoSession()
    s.elapsed = 4; s.matched.add(1); s.results = [{ eventIndex: 1, grade: 'perfect', offsetMs: 0, timing: 'on_time', onsetEnergy: 1 }]
    resetDemoSession(s)
    expect(s).toMatchObject({ elapsed: DEMO_LEAD_IN, results: [] })
    expect(s.matched.size).toBe(0)
  })
})

describe('HUD helpers', () => {
  const r = (grade: EventResult['grade']): EventResult => ({ eventIndex: 0, grade, offsetMs: null, timing: null, onsetEnergy: null })
  it('combo counts trailing non-miss results', () => {
    expect(comboOf([])).toBe(0)
    expect(comboOf([r('perfect'), r('miss'), r('good'), r('perfect')])).toBe(2)
    expect(comboOf([r('perfect'), r('miss')])).toBe(0)
  })
  it('measure is 1..4 and clamps the lead-in', () => {
    expect(demoMeasure(-2, 100)).toBe(1)
    expect(demoMeasure(2.39, 100)).toBe(1)
    expect(demoMeasure(2.41, 100)).toBe(2)
    expect(demoMeasure(9.7, 100)).toBe(1)
  })
  it('beat is 0..3', () => {
    expect(demoBeat(-1, 100)).toBe(0)
    expect(demoBeat(0.61, 100)).toBe(1)
    expect(demoBeat(2.41, 100)).toBe(0)
  })
})
