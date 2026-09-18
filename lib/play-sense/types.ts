// Percussion instruments
export type PercussionInstrument = 'conga' | 'timbale' | 'bongo' | 'clave' | 'cowbell' | 'guiro'
// Melodic / pitched instruments
export type PitchedInstrument = 'guitar' | 'bass' | 'piano' | 'tres' | 'cuatro' | 'trumpet' | 'saxophone' | 'flute' | 'violin'
export type Instrument = PercussionInstrument | PitchedInstrument

export type Technique = 'open' | 'slap' | 'mute' | 'bass' | 'touch' | 'rim' | 'shell' | 'bell' | 'tip' | 'heel'
export type Hand = 'R' | 'L'
export type Difficulty = 'beginner' | 'intermediate' | 'advanced'
export type HitGrade = 'perfect' | 'good' | 'ok' | 'miss'
export type TimingFeedback = 'early' | 'on_time' | 'late'
export type InstrumentCategory = 'percussion' | 'pitched'

/** Classify an instrument as percussion or pitched */
export function getInstrumentCategory(instrument: Instrument): InstrumentCategory {
  const percussion: Instrument[] = ['conga', 'timbale', 'bongo', 'clave', 'cowbell', 'guiro']
  return percussion.includes(instrument) ? 'percussion' : 'pitched'
}

export interface ExerciseEvent {
  /** Beat position: 1-based, supports decimals for subdivisions (1, 1.5, 2, 2.25...) */
  beat: number
  /** Which measure (1-based) */
  measure: number
  /** Instrument producing this event */
  instrument: Instrument
  /** Technique — scored for percussion when technique scoring is enabled */
  technique: Technique
  /** Which hand (for notation stem direction and technique analysis) */
  hand: Hand
  /** Duration in beats — scored for pitched instruments (sustain) */
  duration: number
  /** VexFlow note key for staff position */
  vexKey: string
  /** Whether this is an accent (louder expected) */
  accent: boolean
  /** Expected pitch as MIDI note number (pitched instruments only) */
  expectedPitch?: number
  /** Expected note name for display (e.g. 'C4', 'Eb3') */
  expectedNoteName?: string
  /** Expected drum surface for PlaySense scoring (e.g. 'quinto', 'macho') */
  surface?: string
  /**
   * Chord group id (pitched instruments only). All notes of one strummed chord
   * share the same id so the scorer can grade them as a set. Single notes are
   * undefined. Stays one event per note — only grading collapses the group.
   */
  chordId?: string
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
  /** Detected pitch in Hz (pitched instruments only) */
  detectedPitch?: number | null
  /** Whether the detected pitch matched the expected note */
  pitchCorrect?: boolean | null
  /** Cents offset from expected pitch (-50 to +50) */
  pitchCents?: number | null
  /** Whether the detected technique matched (percussion) */
  techniqueCorrect?: boolean | null
  /** Duration held in beats (pitched instruments) */
  durationHeld?: number | null
  /** Whether the correct drum surface was hit (PlaySense mode) */
  surfaceCorrect?: boolean | null
  /** Which drum surface was actually hit (PlaySense mode) */
  detectedSurface?: string | null
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
  /** Pitch accuracy percentage for pitched instruments (null if not applicable) */
  pitchAccuracy: number | null
}

export interface AttemptData extends AttemptStats {
  exerciseId: string
  events: EventResult[]
}

export type SessionState = 'idle' | 'selecting' | 'calibrating' | 'countdown' | 'playing' | 'paused' | 'results'

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
  /** Detected frequency in Hz at onset (pitched instruments) */
  frequency?: number | null
  /** Detected MIDI note number at onset */
  midiNote?: number | null
  /** Which drum surface was hit — set by PlaySense BLE device only */
  surface?: string | null
  /**
   * 12-bin pitch-class chroma vector (normalized to max) computed from a short
   * post-onset window. Set only for chordal instruments; used for chord scoring.
   */
  chroma?: number[] | null
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

/**
 * Pitch tolerance in cents per difficulty. A detected note within this many
 * cents of the expected pitch counts as correct, so a slightly flat/sharp
 * player is not zeroed out. 100 cents = one semitone.
 */
export const PITCH_TOLERANCE_CENTS: Record<Difficulty, number> = {
  beginner: 80,
  intermediate: 55,
  advanced: 35,
}

/**
 * When true, pitch is matched by pitch-class (ignoring octave) so common
 * octave-detection errors don't zero an otherwise-correct note.
 */
export const PITCH_OCTAVE_AGNOSTIC: Record<Difficulty, boolean> = {
  beginner: true,
  intermediate: true,
  advanced: false,
}

/**
 * Fraction of a chord's distinct pitch classes that must be present (in the
 * detected chroma) for the chord to count as a hit. Presence-only: extra/wrong
 * notes are not penalized.
 */
export const CHORD_PRESENCE_RATIO: Record<Difficulty, number> = {
  beginner: 0.66,
  intermediate: 0.8,
  advanced: 1.0,
}

/** A chroma bin counts as "present" when its energy is at least this fraction of the chroma max. */
export const CHROMA_PRESENCE_THRESHOLD = 0.35

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
