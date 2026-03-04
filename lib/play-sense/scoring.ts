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
import { TOLERANCE_BY_DIFFICULTY, GRADE_POINTS } from './types'

export interface ExpectedEvent {
  eventIndex: number
  timestamp: number // seconds
  /** Expected MIDI note number for pitched instruments */
  expectedPitch?: number
  /** Expected technique for percussion technique scoring */
  expectedTechnique?: string
  /** Expected duration in seconds for sustain scoring */
  expectedDurationSec?: number
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
  detectedFrequency?: number | null
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

  // Pitch scoring for pitched instruments
  let pitchCorrect: boolean | null = null
  let pitchCents: number | null = null
  if (instrumentCategory === 'pitched' && matched.expectedPitch != null && detectedMidiNote != null) {
    pitchCorrect = detectedMidiNote === matched.expectedPitch
    if (detectedFrequency != null) {
      const expectedFreq = 440 * Math.pow(2, (matched.expectedPitch - 69) / 12)
      pitchCents = Math.round(1200 * Math.log2(detectedFrequency / expectedFreq))
      pitchCents = Math.max(-50, Math.min(50, pitchCents))
    }
    // Wrong note degrades the grade
    if (!pitchCorrect) {
      grade = grade === 'perfect' || grade === 'good' ? 'ok' : 'miss'
    }
  }

  // Technique tracking for percussion instruments
  let techniqueCorrect: boolean | null = null
  if (instrumentCategory === 'percussion' && matched.expectedTechnique) {
    // Technique detection from audio requires ML models (future enhancement).
    // For now, mark as null (unknown) rather than penalizing.
    techniqueCorrect = null
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
  }
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
  }
}
