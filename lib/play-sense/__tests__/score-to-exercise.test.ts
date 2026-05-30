import { describe, expect, it } from 'vitest'
import { scoreToExerciseDefinition } from '../score-to-exercise'
import {
  CONGA_TUMBAO_FIXTURE,
  GUITAR_LICK_FIXTURE,
  SON_MONTUNO_FIXTURE,
} from '@/lib/playsense-studio/score-fixtures'

describe('scoreToExerciseDefinition — guitar (pitched)', () => {
  const ex = scoreToExerciseDefinition(GUITAR_LICK_FIXTURE, { audioUrl: 'v.mp4' })

  it('carries tempo, time signature and measure count from the score', () => {
    expect(ex.bpm).toBe(120)
    expect(ex.timeSignature).toEqual([4, 4])
    expect(ex.measures).toBe(2)
    expect(ex.instrument).toBe('guitar')
    expect(ex.audioUrl).toBe('v.mp4')
  })

  it('emits one event per note (8 quarter notes)', () => {
    expect(ex.events).toHaveLength(8)
  })

  it('places quarter notes on beats 1-4 of each measure', () => {
    const m1 = ex.events.filter((e) => e.measure === 1)
    expect(m1.map((e) => e.beat)).toEqual([1, 2, 3, 4])
    expect(m1.every((e) => e.duration === 1)).toBe(true)
  })

  it('sets expected pitch + note name for pitched notes', () => {
    expect(ex.events[0].expectedPitch).toBe(60) // C4
    expect(ex.events[0].expectedNoteName).toBe('C4')
    expect(ex.events[0].vexKey).toBe('c/4')
    expect(ex.events[0].surface).toBeUndefined()
  })
})

describe('scoreToExerciseDefinition — conga (percussion)', () => {
  const ex = scoreToExerciseDefinition(CONGA_TUMBAO_FIXTURE)

  it('maps perc-conga → conga', () => {
    expect(ex.instrument).toBe('conga')
    expect(ex.bpm).toBe(100)
  })

  it('emits 6 struck events per bar (2 rests skipped) → 12 total', () => {
    expect(ex.events).toHaveLength(12)
  })

  it('places eighth notes on the right sub-beats (1, 2, 2.5, 3, 4, 4.5)', () => {
    const m1 = ex.events.filter((e) => e.measure === 1)
    expect(m1.map((e) => e.beat)).toEqual([1, 2, 2.5, 3, 4, 4.5])
    expect(m1.every((e) => e.duration === 0.5)).toBe(true)
  })

  it('maps strokes to technique + drum surface', () => {
    const m1 = ex.events.filter((e) => e.measure === 1)
    // slap (62) on beat 1
    expect(m1[0].technique).toBe('slap')
    expect(m1[0].surface).toBe('quinto')
    expect(m1[0].vexKey).toBe('g/5')
    // open high (64) on beat 2
    expect(m1[1].technique).toBe('open')
    expect(m1[1].surface).toBe('quinto')
    // bass low (63 = open-low) on beat 3 → conga surface
    expect(m1[3].surface).toBe('conga')
    // percussion has no pitch
    expect(m1[0].expectedPitch).toBeUndefined()
  })
})

describe('scoreToExerciseDefinition — track selection', () => {
  it('selects the requested track (bass) from a multi-track score', () => {
    const ex = scoreToExerciseDefinition(SON_MONTUNO_FIXTURE, { trackIndex: 1 })
    expect(ex.instrument).toBe('bass')
    // bass plays 2 notes per bar across 4 bars = 8 events
    expect(ex.events).toHaveLength(8)
    expect(ex.events.every((e) => e.expectedPitch !== undefined)).toBe(true)
  })

  it('defaults to track 0 (tres, chords) and expands chords to one event per note', () => {
    const ex = scoreToExerciseDefinition(SON_MONTUNO_FIXTURE)
    expect(ex.instrument).toBe('tres')
    // each bar: 2 chords of 3 notes = 6 events, x4 bars = 24
    expect(ex.events).toHaveLength(24)
  })
})
