import { describe, expect, it } from 'vitest'
import { computeStats, gradeSingleOnset } from '../scoring'
import type { ExpectedEvent } from '../scoring'

describe('hardware scoring', () => {
  it('matches simultaneous MIDI keys in any delivery order', () => {
    const expected: ExpectedEvent[] = [60, 64, 67].map((expectedPitch, eventIndex) => ({ expectedPitch, eventIndex, timestamp: 1 }))
    const matched = new Set<number>()
    const results = [67, 60, 64].map(note => gradeSingleOnset(1, 1, expected, matched, 'beginner', 0, 0, 'pitched', note, undefined, undefined, 'midi'))
    expect(results.map(r => r?.eventIndex)).toEqual([2, 0, 1])
    expect(results.every(r => r?.grade === 'perfect')).toBe(true)
  })
  it('does not accept the wrong MIDI octave or downgrade it to a successful grade', () => {
    const result = gradeSingleOnset(1, 1, [{ eventIndex: 0, timestamp: 1, expectedPitch: 60 }], new Set(), 'beginner', 0, 0, 'pitched', 72, undefined, undefined, 'midi')
    expect(result?.grade).toBe('miss')
    expect(result?.pitchCorrect).toBe(false)
  })
  it('matches simultaneous prototype drum hits to their actual surfaces', () => {
    const events = ['macho', 'campana'].map((expectedSurface, eventIndex) => ({ expectedSurface, eventIndex, timestamp: 1 }))
    const matched = new Set<number>()
    expect(gradeSingleOnset(1, 1, events, matched, 'beginner', 0, 0, 'percussion', undefined, undefined, 'campana')?.eventIndex).toBe(1)
    expect(gradeSingleOnset(1, 1, events, matched, 'beginner', 0, 0, 'percussion', undefined, undefined, 'macho')?.grade).toBe('perfect')
  })
  it('does not invent zero pitch accuracy for percussion', () => {
    const result = gradeSingleOnset(1, 1, [{ eventIndex: 0, timestamp: 1 }], new Set(), 'beginner')!
    expect(computeStats([result], 0, 2).pitchAccuracy).toBeNull()
  })
})
