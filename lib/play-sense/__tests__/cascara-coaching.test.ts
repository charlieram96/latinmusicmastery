import { describe, expect, it } from 'vitest'
import { cascaraCue } from '../cascara-coaching'
import type { ExerciseDefinition } from '../types'
const exercise = {
  bpm: 120, timeSignature: [4, 4], measures: 21, loopCount: 1,
  events: [{ measure: 21, beat: 1, duration: 1 }],
} as ExerciseDefinition

describe('cáscara preview coaching', () => {
  it('counts up on the recorded pre-roll and resets on a backward seek', () => {
    expect([-2, -1.5, -1, -.5, -1.5].map(t => cascaraCue(exercise, t, 'countdown', true)?.number)).toEqual([1, 2, 3, 4, 2])
    expect(cascaraCue(exercise, 0, 'playing', true)?.kind).toBe('title')
  })
  it('warns for the last two-bar pattern before the closing downbeat', () => {
    expect(cascaraCue(exercise, 36, 'playing', true)?.text).toBe('Última ronda')
    expect(cascaraCue(exercise, 39.9, 'playing', true)?.kind).toBe('final')
    expect(cascaraCue(exercise, 40, 'playing', true)?.kind).toBe('done')
    expect(cascaraCue(exercise, 43, 'playing', true)).toBeNull()
  })
  it('uses authored localized text and remains unchanged when paused', () => {
    expect(cascaraCue(exercise, 5, 'playing', true)?.text).toBe('Escucha bien el tiempo')
    expect(cascaraCue(exercise, 5, 'playing', false)?.text).toBe('Listen to the beat')
    expect(cascaraCue(exercise, 5, 'paused', true)).toEqual(cascaraCue(exercise, 5, 'playing', true))
  })
})

it('takes four performed bars and all authored strokes despite automatic game-hand alternation', async () => {
  const { cascaraNotation } = await import('../cascara-coaching')
  const ex = { ...exercise, grid: { measureStartSec: [0,2,4,6,8,10], secPerQN: [.5,.5,.5,.5,.5], beatQN: [1,1,1,1,1], measureStartQN: [0,4,8,12,16,20] }, events: [
    { measure: 1, beat: 1, hand: 'R', duration: .5 },
    { measure: 1, beat: 1.5, hand: 'L', duration: .5 },
    { measure: 4, beat: 4.5, hand: 'R', duration: .5 },
    { measure: 5, beat: 1, hand: 'R', duration: 1 },
  ] } as ExerciseDefinition
  const result = cascaraNotation(ex)
  expect(result.end).toBe(8)
  expect(result.notes.map(note => note.seconds)).toEqual([0,.25,7.75])
})
