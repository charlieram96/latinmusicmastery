import type {
  Difficulty,
  EventResult,
  HitGrade,
  InstrumentCategory,
  OnsetEvent,
  TimingFeedback,
  AttemptStats,
  ToleranceWindows,
} from './types'
import {
  TOLERANCE_BY_DIFFICULTY,
  GRADE_POINTS,
  PITCH_TOLERANCE_CENTS,
  PITCH_OCTAVE_AGNOSTIC,
  CHORD_PRESENCE_RATIO,
  CHROMA_PRESENCE_THRESHOLD,
} from './types'

/** Lower a hit grade by one level (perfect → good → ok → miss). */
function downgradeGrade(grade: HitGrade): HitGrade {
  switch (grade) {
    case 'perfect':
      return 'good'
    case 'good':
      return 'ok'
    case 'ok':
      return 'miss'
    default:
      return 'miss'
  }
}

export interface ExpectedEvent {
  eventIndex: number
  timestamp: number // seconds
  /** Expected MIDI note number for pitched instruments */
  expectedPitch?: number
  /** Expected technique for percussion technique scoring */
  expectedTechnique?: string
  /** Expected duration in seconds for sustain scoring */
  expectedDurationSec?: number
  /** Expected drum surface for PlaySense scoring */
  expectedSurface?: string
  /** Chord group id — all notes of one chord share it (pitched instruments only). */
  chordId?: string
}

/**
 * Greedy matching algorithm with 1-event lookahead.
 * Matches detected onsets to expected events based on timing proximity.
 */
export function greedyMatch(
  expectedEvents: ExpectedEvent[],
  detectedOnsets: OnsetEvent[],
  difficulty: Difficulty,
  calibrationOffsetSec: number = 0,
  widenMs: number = 0
): EventResult[] {
  const tolerance = TOLERANCE_BY_DIFFICULTY[difficulty]
  const effectiveTolerance: ToleranceWindows = {
    perfect: tolerance.perfect + widenMs,
    good: tolerance.good + widenMs,
    ok: tolerance.ok + widenMs,
  }

  // Sort both arrays by timestamp
  const sorted = [...expectedEvents].sort((a, b) => a.timestamp - b.timestamp)
  const onsets = [...detectedOnsets]
    .map(o => ({
      ...o,
      timestamp: o.timestamp - calibrationOffsetSec,
    }))
    .sort((a, b) => a.timestamp - b.timestamp)

  const matchedOnsets = new Set<number>()
  const results: EventResult[] = []

  for (let i = 0; i < sorted.length; i++) {
    const expected = sorted[i]
    const expectedMs = expected.timestamp * 1000

    // Find closest unmatched onset within Ok window
    let bestIdx = -1
    let bestAbsOffset = Infinity

    for (let j = 0; j < onsets.length; j++) {
      if (matchedOnsets.has(j)) continue
      const onsetMs = onsets[j].timestamp * 1000
      const absOffset = Math.abs(onsetMs - expectedMs)

      if (absOffset > effectiveTolerance.ok) {
        // If we're past the window and onsets are sorted, we can skip ahead
        if (onsetMs > expectedMs + effectiveTolerance.ok / 1000 * 1000) break
        continue
      }

      if (absOffset < bestAbsOffset) {
        bestAbsOffset = absOffset
        bestIdx = j
      }
    }

    if (bestIdx === -1) {
      // No onset found — miss
      results.push({
        eventIndex: expected.eventIndex,
        grade: 'miss',
        offsetMs: null,
        timing: null,
        onsetEnergy: null,
      })
      continue
    }

    const offsetMs = onsets[bestIdx].timestamp * 1000 - expectedMs

    // Grade the hit
    const grade = gradeHit(Math.abs(offsetMs), effectiveTolerance)

    // Lookahead: if grade is only "ok" and there's a next event, check if this onset
    // is a better match for the next event
    if (grade === 'ok' && i + 1 < sorted.length) {
      const nextExpectedMs = sorted[i + 1].timestamp * 1000
      const nextAbsOffset = Math.abs(onsets[bestIdx].timestamp * 1000 - nextExpectedMs)
      if (nextAbsOffset < bestAbsOffset) {
        // This onset is closer to the next event — skip it, record miss
        results.push({
          eventIndex: expected.eventIndex,
          grade: 'miss',
          offsetMs: null,
          timing: null,
          onsetEnergy: null,
        })
        continue
      }
    }

    // Assign the onset to this event
    matchedOnsets.add(bestIdx)
    const timing: TimingFeedback = offsetMs < -5 ? 'early' : offsetMs > 5 ? 'late' : 'on_time'

    results.push({
      eventIndex: expected.eventIndex,
      grade,
      offsetMs: Math.round(offsetMs * 100) / 100,
      timing,
      onsetEnergy: onsets[bestIdx].energy,
    })
  }

  return results
}

function gradeHit(absOffsetMs: number, tolerance: ToleranceWindows): HitGrade {
  if (absOffsetMs <= tolerance.perfect) return 'perfect'
  if (absOffsetMs <= tolerance.good) return 'good'
  if (absOffsetMs <= tolerance.ok) return 'ok'
  return 'miss'
}

/**
 * Grade a single onset against the nearest expected event in real-time.
 * Supports both percussion (onset-only) and pitched instruments (onset + pitch).
 */
export function gradeSingleOnset(
  onsetTimestamp: number,
  onsetEnergy: number,
  expectedEvents: ExpectedEvent[],
  matchedIndices: Set<number>,
  difficulty: Difficulty,
  calibrationOffsetSec: number = 0,
  widenMs: number = 0,
  instrumentCategory: InstrumentCategory = 'percussion',
  detectedMidiNote?: number | null,
  detectedFrequency?: number | null,
  detectedSurface?: string | null
): EventResult | null {
  const tolerance = TOLERANCE_BY_DIFFICULTY[difficulty]
  const effectiveTolerance: ToleranceWindows = {
    perfect: tolerance.perfect + widenMs,
    good: tolerance.good + widenMs,
    ok: tolerance.ok + widenMs,
  }

  const correctedTimestamp = onsetTimestamp - calibrationOffsetSec
  const correctedMs = correctedTimestamp * 1000

  let bestIdx = -1
  let bestAbsOffset = Infinity

  for (let i = 0; i < expectedEvents.length; i++) {
    if (matchedIndices.has(expectedEvents[i].eventIndex)) continue
    const expectedMs = expectedEvents[i].timestamp * 1000
    const absOffset = Math.abs(correctedMs - expectedMs)

    if (absOffset <= effectiveTolerance.ok && absOffset < bestAbsOffset) {
      bestAbsOffset = absOffset
      bestIdx = i
    }
  }

  if (bestIdx === -1) return null

  const matched = expectedEvents[bestIdx]
  const expectedMs = matched.timestamp * 1000
  const offsetMs = correctedMs - expectedMs
  let grade = gradeHit(Math.abs(offsetMs), effectiveTolerance)
  const timing: TimingFeedback = offsetMs < -5 ? 'early' : offsetMs > 5 ? 'late' : 'on_time'

  // Pitch scoring for pitched instruments — tolerant by cents + (optionally)
  // octave-agnostic, so a slightly flat/sharp or octave-confused note is not
  // automatically zeroed.
  let pitchCorrect: boolean | null = null
  let pitchCents: number | null = null
  if (instrumentCategory === 'pitched' && matched.expectedPitch != null) {
    const toleranceCents = PITCH_TOLERANCE_CENTS[difficulty]
    const octaveAgnostic = PITCH_OCTAVE_AGNOSTIC[difficulty]

    if (detectedFrequency != null) {
      const expectedFreq = 440 * Math.pow(2, (matched.expectedPitch - 69) / 12)
      const rawCents = 1200 * Math.log2(detectedFrequency / expectedFreq)

      // Display value: deviation to the nearest semitone, clamped to ±50 cents.
      const semitoneCents = rawCents - 100 * Math.round(rawCents / 100)
      pitchCents = Math.max(-50, Math.min(50, Math.round(semitoneCents)))

      // Deviation to the nearest *matching* pitch. When octave-agnostic, fold
      // out whole octaves so an octave error reads as in-tune, not wildly off.
      const trueCents = octaveAgnostic
        ? rawCents - 1200 * Math.round(rawCents / 1200)
        : rawCents
      pitchCorrect = Math.abs(trueCents) <= toleranceCents
    } else if (detectedMidiNote != null) {
      // No frequency available — fall back to MIDI comparison.
      pitchCorrect = octaveAgnostic
        ? detectedMidiNote % 12 === matched.expectedPitch % 12
        : detectedMidiNote === matched.expectedPitch
    } else {
      // Pitch expected but nothing detected — treat as a miss.
      pitchCorrect = false
      grade = 'miss'
    }

    // A clearly-wrong pitch downgrades the hit one level rather than zeroing a
    // well-timed note. (A note with no detected pitch is already a miss above.)
    if (pitchCorrect === false && (detectedFrequency != null || detectedMidiNote != null)) {
      grade = downgradeGrade(grade)
    }
  }

  // Technique tracking for percussion instruments
  let techniqueCorrect: boolean | null = null
  if (instrumentCategory === 'percussion' && matched.expectedTechnique) {
    // Technique detection from audio requires ML models (future enhancement).
    // For now, mark as null (unknown) rather than penalizing.
    techniqueCorrect = null
  }

  // Surface scoring for PlaySense device
  let surfaceCorrect: boolean | null = null
  let detectedSurfaceResult: string | null = detectedSurface ?? null
  if (matched.expectedSurface && detectedSurface != null) {
    surfaceCorrect = detectedSurface === matched.expectedSurface
    if (!surfaceCorrect) {
      grade = 'miss' // wrong drum = miss
    }
  }

  matchedIndices.add(matched.eventIndex)

  return {
    eventIndex: matched.eventIndex,
    grade,
    offsetMs: Math.round(offsetMs * 100) / 100,
    timing,
    onsetEnergy: onsetEnergy,
    detectedPitch: detectedFrequency ?? null,
    pitchCorrect,
    pitchCents,
    techniqueCorrect,
    surfaceCorrect,
    detectedSurface: detectedSurfaceResult,
  }
}

/**
 * Find the nearest unmatched expected event within the Ok timing window, without
 * consuming it. Read-only — used to decide whether an onset lands on a chord group
 * (so the caller can route to chord scoring) before committing a grade.
 */
export function matchOnsetToExpected(
  onsetTimestamp: number,
  expectedEvents: ExpectedEvent[],
  matchedIndices: Set<number>,
  difficulty: Difficulty,
  calibrationOffsetSec: number = 0,
  widenMs: number = 0
): ExpectedEvent | null {
  const tolerance = TOLERANCE_BY_DIFFICULTY[difficulty]
  const okWindow = tolerance.ok + widenMs
  const correctedMs = (onsetTimestamp - calibrationOffsetSec) * 1000

  let best: ExpectedEvent | null = null
  let bestAbsOffset = Infinity
  for (const ev of expectedEvents) {
    if (matchedIndices.has(ev.eventIndex)) continue
    const absOffset = Math.abs(correctedMs - ev.timestamp * 1000)
    if (absOffset <= okWindow && absOffset < bestAbsOffset) {
      bestAbsOffset = absOffset
      best = ev
    }
  }
  return best
}

/**
 * Grade a strummed chord as a SET. Given the onset (timing) plus the strum's
 * chroma vector, check how many of the chord's distinct pitch classes are present
 * and grade the whole group at once. Returns one EventResult per group event (same
 * grade) so expected/result cardinality — and computeStats normalization — is
 * preserved. Presence-only: extra/wrong pitch classes do not penalize.
 *
 * If chroma is missing (analysis failed/late), grades leniently on timing alone so
 * a real strum is never zeroed for a dropped analysis frame.
 */
export function gradeChordOnset(
  onsetTimestamp: number,
  onsetEnergy: number,
  expectedEvents: ExpectedEvent[],
  matchedIndices: Set<number>,
  chordId: string,
  difficulty: Difficulty,
  calibrationOffsetSec: number = 0,
  widenMs: number = 0,
  chroma?: number[] | null
): EventResult[] {
  // Grade the whole chord group by id. The caller reserves the group's indices in
  // matchedIndices when it schedules this, so we group by chordId alone here.
  const group = expectedEvents.filter(e => e.chordId === chordId)
  if (group.length === 0) return []

  const tolerance = TOLERANCE_BY_DIFFICULTY[difficulty]
  const effectiveTolerance: ToleranceWindows = {
    perfect: tolerance.perfect + widenMs,
    good: tolerance.good + widenMs,
    ok: tolerance.ok + widenMs,
  }

  // Timing graded against the group's shared timestamp.
  const expectedMs = group[0].timestamp * 1000
  const correctedMs = (onsetTimestamp - calibrationOffsetSec) * 1000
  const offsetMs = correctedMs - expectedMs
  const timingGrade = gradeHit(Math.abs(offsetMs), effectiveTolerance)
  const timing: TimingFeedback = offsetMs < -5 ? 'early' : offsetMs > 5 ? 'late' : 'on_time'

  // Distinct expected pitch classes for this chord.
  const pitchClasses = Array.from(
    new Set(
      group
        .map(e => e.expectedPitch)
        .filter((p): p is number => p != null)
        .map(p => ((p % 12) + 12) % 12)
    )
  )

  // Presence per pitch class. With no chroma, assume present (lenient fallback).
  const present = new Set<number>()
  if (chroma && chroma.length === 12) {
    const max = Math.max(...chroma)
    const floor = max > 0 ? max * CHROMA_PRESENCE_THRESHOLD : Infinity
    for (const pc of pitchClasses) {
      if (chroma[pc] >= floor) present.add(pc)
    }
  } else {
    pitchClasses.forEach(pc => present.add(pc))
  }

  const ratio = pitchClasses.length > 0 ? present.size / pitchClasses.length : 1
  const required = CHORD_PRESENCE_RATIO[difficulty]

  // At/above the required ratio → full timing grade. Below → downgrade by how
  // complete the chord is in absolute terms (fraction of tones present),
  // bottoming out at a miss for under ~40% of the chord.
  let chordGrade: HitGrade = timingGrade
  if (ratio < required) {
    let levels: number
    if (ratio >= 0.6) levels = 1
    else if (ratio >= 0.4) levels = 2
    else levels = 3
    for (let i = 0; i < levels; i++) chordGrade = downgradeGrade(chordGrade)
  }

  return group.map(ev => {
    const pc = ev.expectedPitch != null ? ((ev.expectedPitch % 12) + 12) % 12 : null
    const notePresent = pc != null ? present.has(pc) : null
    matchedIndices.add(ev.eventIndex)
    return {
      eventIndex: ev.eventIndex,
      grade: chordGrade,
      offsetMs: Math.round(offsetMs * 100) / 100,
      timing,
      onsetEnergy,
      detectedPitch: null,
      pitchCorrect: notePresent,
      pitchCents: null,
      techniqueCorrect: null,
      surfaceCorrect: null,
      detectedSurface: null,
    }
  })
}

/**
 * Convert a frequency in Hz to the nearest MIDI note number.
 */
export function frequencyToMidi(freq: number): number {
  return Math.round(69 + 12 * Math.log2(freq / 440))
}

/**
 * Convert a MIDI note number to a note name (e.g. 60 → 'C4').
 */
export function midiToNoteName(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const note = names[((midi % 12) + 12) % 12]
  const octave = Math.floor((midi - 12) / 12)
  return `${note}${octave}`
}

/**
 * Compute aggregate stats from event results.
 */
export function computeStats(
  results: EventResult[],
  extraHits: number,
  durationSeconds: number
): AttemptStats {
  const perfectCount = results.filter(r => r.grade === 'perfect').length
  const goodCount = results.filter(r => r.grade === 'good').length
  const okCount = results.filter(r => r.grade === 'ok').length
  const missCount = results.filter(r => r.grade === 'miss').length
  const totalEvents = results.length

  // Accuracy: (perfect + good) / total
  const accuracy = totalEvents > 0 ? ((perfectCount + goodCount) / totalEvents) * 100 : 0

  // Score with combo multiplier
  let combo = 0
  let maxCombo = 0
  let streak = 0
  let maxStreak = 0
  let totalScore = 0

  for (const result of results) {
    if (result.grade !== 'miss') {
      combo++
      maxCombo = Math.max(maxCombo, combo)
      if (result.grade === 'perfect') {
        streak++
        maxStreak = Math.max(maxStreak, streak)
      } else {
        streak = 0
      }
    } else {
      combo = 0
      streak = 0
    }

    const multiplier = Math.min(Math.floor(combo / 10) + 1, 4)
    totalScore += GRADE_POINTS[result.grade] * multiplier
  }

  // Normalize to 0-100: simulate a perfect run with the same combo ramp-up
  let maxPossibleScore = 0
  for (let i = 0; i < totalEvents; i++) {
    const maxMultiplier = Math.min(Math.floor((i + 1) / 10) + 1, 4)
    maxPossibleScore += GRADE_POINTS.perfect * maxMultiplier
  }
  let score = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0

  // Penalize extra hits: each extra hit deducts 2% of the score (min 0)
  if (extraHits > 0 && score > 0) {
    const penalty = extraHits * 2
    score = Math.max(0, score - penalty)
  }

  // Average offset (excluding misses)
  const hitResults = results.filter(r => r.offsetMs !== null)
  const avgOffsetMs = hitResults.length > 0
    ? hitResults.reduce((sum, r) => sum + r.offsetMs!, 0) / hitResults.length
    : 0

  // Tempo drift: running average of last 8 offsets
  const driftWindow = hitResults.slice(-8)
  const tempoDriftMs = driftWindow.length > 0
    ? driftWindow.reduce((sum, r) => sum + r.offsetMs!, 0) / driftWindow.length
    : 0

  // Pitch accuracy: percentage of notes with pitchCorrect === true
  // out of notes that had expectedPitch (pitchCorrect !== undefined)
  const pitchedResults = results.filter(r => r.pitchCorrect !== undefined)
  const pitchAccuracy = pitchedResults.length > 0
    ? Math.round(
        (pitchedResults.filter(r => r.pitchCorrect === true).length / pitchedResults.length) * 10000
      ) / 100
    : null

  return {
    score: Math.round(score * 100) / 100,
    accuracy: Math.round(accuracy * 100) / 100,
    perfectCount,
    goodCount,
    okCount,
    missCount,
    extraHits,
    maxCombo,
    maxStreak,
    avgOffsetMs: Math.round(avgOffsetMs * 100) / 100,
    tempoDriftMs: Math.round(tempoDriftMs * 100) / 100,
    durationSeconds: Math.round(durationSeconds * 100) / 100,
    pitchAccuracy,
  }
}
