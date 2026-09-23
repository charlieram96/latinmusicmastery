import type { ExerciseDefinition, ExerciseEvent, Instrument, Technique } from './types'
import { beatToTimestamp, getExerciseDuration } from './exercise-utils'

/** 5 staff lines (aesthetic only — evenly spaced in staff region) */
export const STAFF_LINE_KEYS = ['d/5', 'e/5', 'f/5', 'g/5', 'a/5'] as const

/** Ledger line below the staff */
export const LEDGER_LINE_KEYS = ['c/5'] as const

/** Default VexFlow-style key per technique (used for staff-line alignment reference) */
export const DEFAULT_VEX_KEY: Record<Technique, string> = {
  open: 'e/5',
  slap: 'f/5',
  mute: 'd/5',
  bass: 'c/5',
  touch: 'e/5',
  heel: 'c/5',
  tip: 'c/5',
  rim: 'g/5',
  shell: 'g/5',
  bell: 'a/5',
}

/** Techniques available per instrument — mirrors admin pattern grid */
export const INSTRUMENT_TECHNIQUES: Record<Instrument, Technique[]> = {
  conga: ['open', 'slap', 'mute', 'bass', 'touch', 'heel', 'tip'],
  timbale: ['open', 'rim', 'mute', 'shell', 'bell'],
  bongo: ['open', 'slap', 'mute', 'rim', 'heel', 'tip'],
  clave: ['open'],
  cowbell: ['open', 'mute', 'bell'],
  guiro: ['open', 'mute'],
  guitar: ['open'],
  bass: ['open'],
  piano: ['open'],
  tres: ['open'],
  cuatro: ['open'],
  trumpet: ['open'],
  saxophone: ['open'],
  flute: ['open'],
  violin: ['open'],
}

export interface LaneConfig {
  technique: Technique
  label: string
  color: string
}

/** Build ordered lane configuration for an instrument */
export function buildLaneConfig(exercise: ExerciseDefinition): LaneConfig[] {
  const techniques = INSTRUMENT_TECHNIQUES[exercise.instrument] || ['open']
  return techniques.map((t) => ({
    technique: t,
    label: getTechniqueLabel(t),
    color: getTechniqueColor(t),
  }))
}

/** Abbreviated technique labels */
export function getTechniqueLabel(technique: Technique): string {
  const labels: Record<Technique, string> = {
    open: 'O',
    slap: 'S',
    mute: 'M',
    bass: 'B',
    touch: 'T',
    heel: 'H',
    tip: 'Ti',
    rim: 'R',
    shell: 'Sh',
    bell: 'Be',
  }
  return labels[technique] || technique
}

/** Subtle lane tint colors for visual distinction */
export function getTechniqueColor(technique: Technique): string {
  const colors: Record<Technique, string> = {
    open: 'hsl(30, 60%, 55%)',
    slap: 'hsl(0, 55%, 55%)',
    mute: 'hsl(200, 40%, 50%)',
    bass: 'hsl(260, 40%, 55%)',
    touch: 'hsl(160, 40%, 45%)',
    heel: 'hsl(45, 50%, 50%)',
    tip: 'hsl(320, 40%, 55%)',
    rim: 'hsl(15, 50%, 55%)',
    shell: 'hsl(180, 35%, 50%)',
    bell: 'hsl(50, 60%, 50%)',
  }
  return colors[technique] || 'hsl(30, 20%, 50%)'
}

/**
 * Compute normalized 0-1 time position for an event within the exercise.
 * Accounts for loops via loopIndex.
 */
export function eventToNormalizedTime(
  event: ExerciseEvent,
  exercise: ExerciseDefinition,
  loopIndex: number = 0
): number {
  const timestamp = beatToTimestamp(
    event,
    exercise.bpm,
    exercise.timeSignature,
    loopIndex,
    exercise.measures,
    exercise.swing,
    exercise.grid
  )
  const duration = getExerciseDuration(exercise)
  return duration > 0 ? timestamp / duration : 0
}
