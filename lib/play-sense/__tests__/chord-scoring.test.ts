import { describe, expect, it } from 'vitest'
import { gradeChordOnset, matchOnsetToExpected, type ExpectedEvent } from '../scoring'

// A C major triad at t=1.000s, expanded to one expected event per note, all
// sharing chordId 'c0'. MIDI 60=C(pc0), 64=E(pc4), 67=G(pc7).
function triad(): ExpectedEvent[] {
  return [
    { eventIndex: 0, timestamp: 1.0, expectedPitch: 60, chordId: 'c0' },
    { eventIndex: 1, timestamp: 1.0, expectedPitch: 64, chordId: 'c0' },
    { eventIndex: 2, timestamp: 1.0, expectedPitch: 67, chordId: 'c0' },
  ]
}

/** Build a normalized 12-bin chroma with the given pitch classes "present" (=1). */
function chromaWith(pitchClasses: number[]): number[] {
  const c = new Array(12).fill(0)
  for (const pc of pitchClasses) c[pc] = 1
  return c
}

function gradeTriad(
  chroma: number[] | null,
  difficulty: 'beginner' | 'intermediate' | 'advanced' = 'beginner'
) {
  return gradeChordOnset(
    1.0, // on-time onset
    1.0, // energy
    triad(),
    new Set<number>(),
    'c0',
    difficulty,
    0,
    0,
    chroma
  )
}

describe('gradeChordOnset — chord-as-set scoring', () => {
  it('a full triad (all 3 pitch classes present) is a perfect hit for every note', () => {
    const results = gradeTriad(chromaWith([0, 4, 7]))
    expect(results).toHaveLength(3)
    expect(results.every(r => r.grade === 'perfect')).toBe(true)
    expect(results.every(r => r.pitchCorrect === true)).toBe(true)
  })

  it('2-of-3 present is a hit at beginner (ratio 0.66)', () => {
    const results = gradeTriad(chromaWith([0, 4])) // missing G
    expect(results.every(r => r.grade === 'perfect')).toBe(true)
    // The absent note is flagged, but the chord still passes.
    expect(results.find(r => r.eventIndex === 2)!.pitchCorrect).toBe(false)
  })

  it('2-of-3 present is downgraded at advanced (requires all)', () => {
    const results = gradeTriad(chromaWith([0, 4]), 'advanced')
    expect(results.every(r => r.grade !== 'perfect')).toBe(true)
    expect(results.every(r => r.grade !== 'miss')).toBe(true) // downgraded, not zeroed
  })

  it('1-of-3 present is heavily downgraded toward a miss', () => {
    const results = gradeTriad(chromaWith([0]))
    expect(results.every(r => r.grade === 'miss')).toBe(true)
  })

  it('extra/wrong pitch classes do not penalize (presence-only)', () => {
    const results = gradeTriad(chromaWith([0, 4, 7, 1, 6])) // triad + two wrong notes
    expect(results.every(r => r.grade === 'perfect')).toBe(true)
  })

  it('relative threshold: a quiet bin below 35% of max is not "present"', () => {
    const chroma = chromaWith([0, 4]) // C and E loud
    chroma[7] = 0.2 // G present but only 20% of max → below threshold
    const results = gradeTriad(chroma, 'advanced')
    // Still effectively 2-of-3 → downgraded at advanced.
    expect(results.every(r => r.grade !== 'perfect')).toBe(true)
  })

  it('missing chroma falls back to a lenient timing-only hit (no zeroing)', () => {
    const results = gradeTriad(null)
    expect(results.every(r => r.grade === 'perfect')).toBe(true)
  })

  it('marks every group event as matched', () => {
    const matched = new Set<number>()
    gradeChordOnset(1.0, 1.0, triad(), matched, 'c0', 'beginner', 0, 0, chromaWith([0, 4, 7]))
    expect(matched.has(0) && matched.has(1) && matched.has(2)).toBe(true)
  })
})

describe('matchOnsetToExpected — chord routing helper', () => {
  it('returns a chord-group event when an onset lands in the timing window', () => {
    const cand = matchOnsetToExpected(1.0, triad(), new Set(), 'beginner')
    expect(cand).not.toBeNull()
    expect(cand!.chordId).toBe('c0')
  })

  it('returns null when no event is within the Ok window', () => {
    const cand = matchOnsetToExpected(5.0, triad(), new Set(), 'beginner')
    expect(cand).toBeNull()
  })

  it('does not consume the matched event (read-only)', () => {
    const matched = new Set<number>()
    matchOnsetToExpected(1.0, triad(), matched, 'beginner')
    expect(matched.size).toBe(0)
  })
})
