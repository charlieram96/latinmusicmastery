import { describe, expect, it } from 'vitest'
import { bestPreviousAccuracy, buildBarResults, summarizeTake } from '../bar-results'
import type { EventResult, ExerciseEvent } from '../types'

const ev = (measure: number, beat = 1, chordId?: string) => ({ measure, beat, chordId } as unknown as ExerciseEvent)
const res = (eventIndex: number, grade: EventResult['grade'], timing: EventResult['timing'] = 'on_time'): EventResult =>
  ({ eventIndex, grade, offsetMs: 0, timing, onsetEnergy: null })

describe('buildBarResults', () => {
  const exercise = { measures: 4, events: [ev(1), ev(1, 3), ev(2), ev(4)] }

  it('grades each bar: clean, early/late, missed, and rest for a bar with no notes', () => {
    const bars = buildBarResults(exercise, [res(0, 'perfect'), res(1, 'good'), res(2, 'good', 'late'), res(3, 'miss', null)])
    expect(bars.map(b => b.status)).toEqual(['clean', 'close', 'rest', 'miss'])
    expect(bars[1]).toMatchObject({ bar: 2, notes: 1, late: 1, early: 0, missed: 0 })
    expect(bars[2]).toMatchObject({ bar: 3, notes: 0 })
  })

  it('an ok grade is close even when on time', () => {
    expect(buildBarResults(exercise, [res(0, 'ok'), res(1, 'perfect'), res(2, 'perfect'), res(3, 'perfect')])[0].status).toBe('close')
  })

  it('folds every pass of a looped exercise onto the same bar', () => {
    const results = [res(0, 'perfect'), res(1, 'perfect'), res(2, 'perfect'), res(3, 'perfect'),
      res(4, 'perfect'), res(5, 'miss', null), res(6, 'perfect', 'early'), res(7, 'perfect')]
    const bars = buildBarResults(exercise, results)
    expect(bars[0]).toMatchObject({ notes: 4, missed: 1, status: 'miss' })
    // A perfect hit is on time by definition, whatever side of the beat it fell.
    expect(bars[1]).toMatchObject({ notes: 2, early: 0, status: 'clean' })
  })

  it('counts a note with no result as missed', () => {
    expect(buildBarResults(exercise, [res(0, 'perfect'), res(1, 'perfect'), res(2, 'perfect')])[3]).toMatchObject({ status: 'miss', missed: 1 })
  })

  it('grades each note of a chord', () => {
    const chords = { measures: 1, events: [ev(1, 1, 'c1'), ev(1, 1, 'c1')] }
    expect(buildBarResults(chords, [res(0, 'perfect'), res(1, 'miss', null)])[0]).toMatchObject({ notes: 2, missed: 1, status: 'miss' })
  })
})

describe('summarizeTake', () => {
  it('counts clean bars among the bars with notes and lists the missed ones', () => {
    const exercise = { measures: 4, events: [ev(1), ev(2), ev(4)] }
    const bars = buildBarResults(exercise, [res(0, 'perfect'), res(1, 'miss', null), res(2, 'good')])
    expect(summarizeTake(bars)).toEqual({ clean: 2, played: 3, missedBars: [2] })
  })
})

describe('bestPreviousAccuracy', () => {
  it('is the best saved accuracy, or null without one', () => {
    expect(bestPreviousAccuracy([{ accuracy: 71 }, { accuracy: null }, { accuracy: 88.5 }])).toBe(88.5)
    expect(bestPreviousAccuracy([])).toBeNull()
  })
})
