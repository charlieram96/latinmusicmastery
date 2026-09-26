// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { countdownFor } from '../use-exercise-session'

describe('countdownFor', () => {
  it('counts down from countInBeats to 1 as elapsed advances one beat at a time', () => {
    const countInBeats = 4
    const beatSec = 0.5
    expect(countdownFor(0, countInBeats, beatSec)).toBe(4)
    expect(countdownFor(0.5, countInBeats, beatSec)).toBe(3)
    expect(countdownFor(1, countInBeats, beatSec)).toBe(2)
    expect(countdownFor(1.5, countInBeats, beatSec)).toBe(1)
  })

  it('clamps to 0 once the count-in has finished', () => {
    expect(countdownFor(2, 4, 0.5)).toBe(0)
    expect(countdownFor(10, 4, 0.5)).toBe(0)
  })

  it('holds the current number for the rest of the beat', () => {
    expect(countdownFor(0.24, 4, 0.5)).toBe(4)
    expect(countdownFor(0.49, 4, 0.5)).toBe(4)
  })

  it('is 0 before the count-in has started (a tick that lands just before t=0)', () => {
    // The first scheduling tick can land microseconds before the audio clock
    // reaches countInStart, giving a negative elapsed. It must not flash
    // countInBeats + 1 (the old `countInBeats - floor(elapsed/beatSec)` bug).
    expect(countdownFor(-0.025, 4, 0.5)).toBe(0)
    expect(countdownFor(-1, 4, 0.5)).toBe(0)
  })
})
