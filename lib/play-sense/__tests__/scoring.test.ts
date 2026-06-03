import { describe, expect, it } from 'vitest'
import { gradeSingleOnset, type ExpectedEvent } from '../scoring'

// MIDI 69 = A4 = 440 Hz.
const A4 = 440
const A4_MIDI = 69

/** Frequency `cents` away from `baseHz`. */
function freqOffByCents(baseHz: number, cents: number): number {
  return baseHz * Math.pow(2, cents / 1200)
}

/** A single pitched event at t=1.000s expecting A4. */
function pitchedEvent(): ExpectedEvent {
  return { eventIndex: 0, timestamp: 1.0, expectedPitch: A4_MIDI }
}

function grade(
  detectedFrequency: number | null,
  difficulty: 'beginner' | 'intermediate' | 'advanced' = 'beginner',
  onsetTimestamp = 1.0
) {
  return gradeSingleOnset(
    onsetTimestamp,
    1.0, // energy
    [pitchedEvent()],
    new Set<number>(),
    difficulty,
    0, // calibration offset
    0, // widen
    'pitched',
    detectedFrequency != null ? Math.round(69 + 12 * Math.log2(detectedFrequency / 440)) : null,
    detectedFrequency
  )
}

describe('gradeSingleOnset — tolerant pitch scoring', () => {
  it('an in-tune, on-time note is a perfect hit', () => {
    const r = grade(A4)
    expect(r).not.toBeNull()
    expect(r!.pitchCorrect).toBe(true)
    expect(r!.grade).toBe('perfect')
  })

  it('a slightly-flat note within tolerance keeps full credit (not a miss)', () => {
    // -40 cents, inside the 80-cent beginner window.
    const r = grade(freqOffByCents(A4, -40))
    expect(r!.pitchCorrect).toBe(true)
    expect(r!.grade).toBe('perfect')
    expect(r!.pitchCents).toBe(-40)
  })

  it('an octave error counts as correct for beginner (octave-agnostic)', () => {
    const r = grade(A4 * 2) // A5
    expect(r!.pitchCorrect).toBe(true)
    expect(r!.grade).toBe('perfect')
  })

  it('an octave error is downgraded (not zeroed) for advanced', () => {
    const r = grade(A4 * 2, 'advanced')
    expect(r!.pitchCorrect).toBe(false)
    // On-time perfect timing downgraded one level rather than forced to miss.
    expect(r!.grade).toBe('good')
  })

  it('a clearly-wrong pitch downgrades one level rather than instant miss', () => {
    // Tritone above A4 (+600 cents) — well outside any tolerance.
    const r = grade(freqOffByCents(A4, 600))
    expect(r!.pitchCorrect).toBe(false)
    expect(r!.grade).toBe('good') // perfect → good
  })

  it('an expected pitch with no detected pitch is a miss', () => {
    const r = grade(null)
    expect(r!.pitchCorrect).toBe(false)
    expect(r!.grade).toBe('miss')
  })
})

describe('gradeSingleOnset — percussion ignores pitch', () => {
  it('grades on timing alone for percussion', () => {
    const r = gradeSingleOnset(
      1.0,
      1.0,
      [{ eventIndex: 0, timestamp: 1.0 }],
      new Set<number>(),
      'beginner',
      0,
      0,
      'percussion'
    )
    expect(r!.grade).toBe('perfect')
    expect(r!.pitchCorrect).toBeNull()
  })
})
