export type Instrument = 'conga' | 'timbale' | 'bongo' | 'clave' | 'cowbell' | 'guiro'
export type Technique = 'open' | 'slap' | 'mute' | 'bass' | 'touch' | 'rim' | 'shell' | 'bell' | 'tip' | 'heel'
export type Hand = 'R' | 'L'
export type Difficulty = 'beginner' | 'intermediate' | 'advanced'
export type HitGrade = 'perfect' | 'good' | 'ok' | 'miss'
export type TimingFeedback = 'early' | 'on_time' | 'late'

export interface ExerciseEvent {
  /** Beat position: 1-based, supports decimals for subdivisions (1, 1.5, 2, 2.25...) */
  beat: number
  /** Which measure (1-based) */
  measure: number
  /** Instrument producing this event */
  instrument: Instrument
  /** Technique (MVP: ignored for scoring, stored for future classification) */
  technique: Technique
  /** Which hand (for notation stem direction and future technique analysis) */
  hand: Hand
  /** Duration in beats (for notation rendering, not scoring) */
  duration: number
  /** VexFlow note key for staff position */
  vexKey: string
  /** Whether this is an accent (louder expected) */
  accent: boolean
}

export interface ExerciseDefinition {
  id: string
  title: string
  description: string
  instrument: Instrument
  bpm: number
  timeSignature: [number, number]
  swing: number
  difficulty: Difficulty
  measures: number
  loopCount: number
  events: ExerciseEvent[]
  audioUrl?: string
}

export interface EventResult {
  eventIndex: number
  grade: HitGrade
  offsetMs: number | null
  timing: TimingFeedback | null
  onsetEnergy: number | null
}

export interface AttemptStats {
  score: number
  accuracy: number
  perfectCount: number
  goodCount: number
  okCount: number
  missCount: number
  extraHits: number
  maxCombo: number
  maxStreak: number
  avgOffsetMs: number
  tempoDriftMs: number
  durationSeconds: number
}

export interface AttemptData extends AttemptStats {
  exerciseId: string
  events: EventResult[]
}

export type SessionState = 'idle' | 'selecting' | 'calibrating' | 'countdown' | 'playing' | 'results'

export interface CalibrationData {
  latencyMs: number
  iqrMs: number
  sampleRate: number
  browser: string
  timestamp: string
  method: 'tap_along' | 'hit_on_flash'
}

export interface OnsetEvent {
  timestamp: number
  energy: number
}

export interface ToleranceWindows {
  perfect: number
  good: number
  ok: number
}

export const TOLERANCE_BY_DIFFICULTY: Record<Difficulty, ToleranceWindows> = {
  beginner: { perfect: 40, good: 70, ok: 110 },
  intermediate: { perfect: 30, good: 55, ok: 85 },
  advanced: { perfect: 20, good: 40, ok: 65 },
}

export const GRADE_POINTS: Record<HitGrade, number> = {
  perfect: 100,
  good: 70,
  ok: 40,
  miss: 0,
}

export const GRADE_COLORS: Record<HitGrade, string> = {
  perfect: '#22c55e',
  good: '#eab308',
  ok: '#f97316',
  miss: '#ef4444',
}
