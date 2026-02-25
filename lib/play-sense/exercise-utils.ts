import type { ExerciseDefinition, ExerciseEvent } from './types'

/**
 * Convert a beat position to a timestamp in seconds relative to exercise start.
 * beat is 1-based, measure is 1-based.
 */
export function beatToTimestamp(
  event: ExerciseEvent,
  bpm: number,
  timeSignature: [number, number],
  loopIndex: number = 0,
  totalMeasures: number = 0
): number {
  const beatsPerMeasure = timeSignature[0]
  const beatDuration = 60 / bpm

  // Total beats from start: (measure-1) * beatsPerMeasure + (beat-1)
  // Plus loop offset
  const loopOffsetBeats = loopIndex * totalMeasures * beatsPerMeasure
  const measureOffset = (event.measure - 1) * beatsPerMeasure
  const beatOffset = event.beat - 1

  return (loopOffsetBeats + measureOffset + beatOffset) * beatDuration
}

/**
 * Generate all expected event timestamps for a full exercise (including loops).
 * Returns array of { eventIndex (in original events), timestamp (seconds) }
 */
export function generateExpectedTimestamps(
  exercise: ExerciseDefinition
): Array<{ eventIndex: number; timestamp: number }> {
  const results: Array<{ eventIndex: number; timestamp: number }> = []

  for (let loop = 0; loop < exercise.loopCount; loop++) {
    for (let i = 0; i < exercise.events.length; i++) {
      const event = exercise.events[i]
      const timestamp = beatToTimestamp(
        event,
        exercise.bpm,
        exercise.timeSignature,
        loop,
        exercise.measures
      )
      results.push({ eventIndex: results.length, timestamp })
    }
  }

  return results.sort((a, b) => a.timestamp - b.timestamp)
}

/**
 * Compute total exercise duration in seconds (including all loops).
 */
export function getExerciseDuration(exercise: ExerciseDefinition): number {
  const beatsPerMeasure = exercise.timeSignature[0]
  const totalBeats = exercise.measures * beatsPerMeasure * exercise.loopCount
  return (totalBeats * 60) / exercise.bpm
}

/**
 * Compute count-in duration in seconds (4 beats).
 */
export function getCountInDuration(bpm: number): number {
  return (4 * 60) / bpm
}

/**
 * Convert VexFlow duration value from beat duration.
 * 1 beat = quarter note (q), 0.5 = eighth (8), 0.25 = sixteenth (16), 2 = half (h), 4 = whole (w)
 */
export function beatDurationToVexDuration(duration: number): string {
  if (duration >= 4) return 'w'
  if (duration >= 2) return 'h'
  if (duration >= 1) return 'q'
  if (duration >= 0.5) return '8'
  if (duration >= 0.25) return '16'
  return '32'
}

/**
 * Group exercise events by measure for VexFlow rendering.
 */
export function groupEventsByMeasure(
  events: ExerciseEvent[],
  measures: number
): Map<number, ExerciseEvent[]> {
  const grouped = new Map<number, ExerciseEvent[]>()
  for (let m = 1; m <= measures; m++) {
    grouped.set(m, [])
  }
  for (const event of events) {
    const measureEvents = grouped.get(event.measure)
    if (measureEvents) {
      measureEvents.push(event)
    }
  }
  // Sort events within each measure by beat
  for (const [, measureEvents] of grouped) {
    measureEvents.sort((a, b) => a.beat - b.beat)
  }
  return grouped
}

/**
 * Get letter grade from score percentage.
 */
export function getLetterGrade(score: number): string {
  if (score >= 95) return 'A+'
  if (score >= 90) return 'A'
  if (score >= 85) return 'B+'
  if (score >= 80) return 'B'
  if (score >= 75) return 'C+'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

/**
 * Get instrument display name.
 */
export function getInstrumentLabel(instrument: string): string {
  const labels: Record<string, string> = {
    conga: 'Congas',
    timbale: 'Timbales',
    bongo: 'Bongos',
    clave: 'Clave',
    cowbell: 'Cowbell',
    guiro: 'Guiro',
  }
  return labels[instrument] || instrument
}

/**
 * Get difficulty color for badges.
 */
export function getDifficultyColor(difficulty: string): string {
  switch (difficulty) {
    case 'beginner': return 'text-green-500'
    case 'intermediate': return 'text-yellow-500'
    case 'advanced': return 'text-red-500'
    default: return 'text-muted-foreground'
  }
}
