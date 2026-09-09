import type { ExerciseDefinition, ExerciseEvent, HitGrade } from '@/lib/play-sense/types'
import { getInstrumentCategory } from '@/lib/play-sense/types'
import { generateExpectedTimestamps } from '@/lib/play-sense/exercise-utils'
import { PLAYSENSE_MAPPINGS } from '@/lib/play-sense/playsense-mappings'
import { isBlackKey, noteNameToMidi } from '../glass-highway/LaneLayout'

export const RUNWAY_WIDTH = 10
export const HIT_Z = 3.6
export const FAR_Z = -37
export const APPROACH_SECONDS = 3.5

export interface StageLane { id: string; label: string; x: number; width: number; black: boolean; midi?: number }
export interface StageNote { index: number; time: number; duration: number; lane: number; accent: boolean }
export interface VisualResult { eventIndex: number; grade: HitGrade }
export interface StageFrame {
  elapsed: number
  showNotes: boolean
  playing: boolean
  results: readonly VisualResult[]
  /** Changes for a new attempt; pause alone does not reset judgments. */
  attempt: number
  combo: number
}

const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']
const pitch = (e: ExerciseEvent) => e.expectedPitch ?? (e.expectedNoteName ? noteNameToMidi(e.expectedNoteName) : null)

export function createStageModel(exercise: ExerciseDefinition): { lanes: StageLane[]; notes: StageNote[] } {
  let lanes: StageLane[]
  let laneForEvent: (e: ExerciseEvent) => number
  if (exercise.instrument === 'piano') {
    const pitches = exercise.events.map(pitch).filter((p): p is number => p != null)
    const min = Math.max(21, Math.floor((Math.min(...pitches, 60) - 2) / 12) * 12)
    const max = Math.min(108, Math.ceil((Math.max(...pitches, 72) + 2) / 12) * 12)
    const keys = Array.from({ length: max - min + 1 }, (_, i) => min + i)
    const whiteCount = keys.filter(n => !isBlackKey(n)).length
    const whiteWidth = RUNWAY_WIDTH / whiteCount
    let whites = 0
    lanes = keys.map(midi => {
      const black = isBlackKey(midi)
      const x = (whites + (black ? 0 : 0.5)) * whiteWidth - RUNWAY_WIDTH / 2
      if (!black) whites++
      return { id: String(midi), midi, black, x, width: whiteWidth * (black ? 0.58 : 0.92), label: `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}` }
    })
    laneForEvent = e => Math.max(0, Math.min(lanes.length - 1, (pitch(e) ?? 60) - min))
  } else {
    const mapped = PLAYSENSE_MAPPINGS[exercise.instrument]
    const pitched = getInstrumentCategory(exercise.instrument) === 'pitched'
    const id = (e: ExerciseEvent) => pitched ? String(pitch(e) ?? e.expectedNoteName ?? 'note') : e.surface || e.technique
    const ids = mapped ? Object.values(mapped.piezoMap) : [...new Set(exercise.events.map(id))]
    if (pitched) ids.sort((a, b) => Number(a) - Number(b))
    if (!ids.length) ids.push('note')
    lanes = ids.map((key, i) => ({
      id: key, black: false, x: (i + 0.5) * RUNWAY_WIDTH / ids.length - RUNWAY_WIDTH / 2,
      width: RUNWAY_WIDTH / ids.length * 0.7,
      label: pitched && Number.isFinite(Number(key)) ? `${NAMES[Number(key) % 12]}${Math.floor(Number(key) / 12) - 1}` : key,
    }))
    laneForEvent = e => Math.max(0, ids.indexOf(id(e)))
  }
  const notes = generateExpectedTimestamps(exercise).map(expected => {
    const source = exercise.events[expected.eventIndex % exercise.events.length]
    return { index: expected.eventIndex, time: expected.timestamp, duration: expected.expectedDurationSec ?? 0,
      lane: laneForEvent(source), accent: source.accent }
  })
  return { lanes, notes }
}

export function firstVisibleNote(notes: readonly StageNote[], time: number): number {
  let lo = 0, hi = notes.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (notes[mid].time < time) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** Compare by identity AND grade: a late correction can leave array length unchanged. */
export function changedJudgments(results: readonly VisualResult[], previous: Map<number, HitGrade>): VisualResult[] {
  const changed: VisualResult[] = []
  for (const result of results) {
    if (previous.get(result.eventIndex) !== result.grade) {
      previous.set(result.eventIndex, result.grade)
      changed.push(result)
    }
  }
  return changed
}
