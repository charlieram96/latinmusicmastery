/**
 * Instruments, tunings and courses for the tuner.
 * A course is one pad on screen: a single string, or a doubled pair
 * (unison or octave) on tres and cuatro. Courses are listed low → high.
 */
import { centsBetween, midiToHz, nameToMidi } from './note-math'

export type InstrumentId = 'guitar' | 'bass' | 'tres' | 'cuatro' | 'ukulele' | 'violin' | 'chromatic'

export interface Tuning {
  id: string
  /** i18n key under dashboard.pages.tuner.tunings */
  nameKey: string
  courses: string[][]
}

export interface Instrument {
  id: InstrumentId
  /** i18n key under dashboard.pages.tuner.instruments */
  nameKey: string
  tunings: Tuning[]
}

/** Auto mode only highlights a pad when the pitch is within this many cents. */
export const AUTO_HIGHLIGHT_CENTS = 75

export const TUNER_INSTRUMENTS: Instrument[] = [
  {
    id: 'guitar',
    nameKey: 'guitar',
    tunings: [
      { id: 'standard', nameKey: 'guitar.standard', courses: [['E2'], ['A2'], ['D3'], ['G3'], ['B3'], ['E4']] },
      { id: 'dropd', nameKey: 'guitar.dropD', courses: [['D2'], ['A2'], ['D3'], ['G3'], ['B3'], ['E4']] },
      { id: 'half', nameKey: 'guitar.halfDown', courses: [['D#2'], ['G#2'], ['C#3'], ['F#3'], ['A#3'], ['D#4']] },
      { id: 'dadgad', nameKey: 'guitar.dadgad', courses: [['D2'], ['A2'], ['D3'], ['G3'], ['A3'], ['D4']] },
      { id: 'openg', nameKey: 'guitar.openG', courses: [['D2'], ['G2'], ['D3'], ['G3'], ['B3'], ['D4']] },
    ],
  },
  {
    id: 'bass',
    nameKey: 'bass',
    tunings: [
      { id: 'standard', nameKey: 'bass.standard', courses: [['E1'], ['A1'], ['D2'], ['G2']] },
      { id: 'five', nameKey: 'bass.five', courses: [['B0'], ['E1'], ['A1'], ['D2'], ['G2']] },
      { id: 'dropd', nameKey: 'bass.dropD', courses: [['D1'], ['A1'], ['D2'], ['G2']] },
    ],
  },
  {
    id: 'tres',
    nameKey: 'tres',
    tunings: [
      { id: 'do', nameKey: 'tres.do', courses: [['G3', 'G4'], ['C4', 'C4'], ['E4', 'E4']] },
      { id: 're', nameKey: 'tres.re', courses: [['A3', 'A4'], ['D4', 'D4'], ['F#4', 'F#4']] },
    ],
  },
  {
    id: 'cuatro',
    nameKey: 'cuatro',
    tunings: [
      { id: 'pr', nameKey: 'cuatro.pr', courses: [['B2', 'B3'], ['E3', 'E4'], ['A3', 'A3'], ['D4', 'D4'], ['G4', 'G4']] },
    ],
  },
  {
    id: 'ukulele',
    nameKey: 'ukulele',
    tunings: [
      { id: 'std', nameKey: 'ukulele.standard', courses: [['G4'], ['C4'], ['E4'], ['A4']] },
      { id: 'lowg', nameKey: 'ukulele.lowG', courses: [['G3'], ['C4'], ['E4'], ['A4']] },
    ],
  },
  {
    id: 'violin',
    nameKey: 'violin',
    tunings: [{ id: 'std', nameKey: 'violin.standard', courses: [['G3'], ['D4'], ['A4'], ['E5']] }],
  },
  {
    id: 'chromatic',
    nameKey: 'chromatic',
    tunings: [{ id: 'any', nameKey: 'chromatic.any', courses: [] }],
  },
]

export function getInstrument(id: InstrumentId): Instrument {
  return TUNER_INSTRUMENTS.find((i) => i.id === id) ?? TUNER_INSTRUMENTS[0]
}

/** The tuning with `tuningId`, or the instrument's first tuning. */
export function getTuning(inst: Instrument, tuningId: string): Tuning {
  return inst.tunings.find((t) => t.id === tuningId) ?? inst.tunings[0]
}

export function courseMidis(t: Tuning): number[][] {
  return t.courses.map((c) => c.map(nameToMidi))
}

/** Unique target notes of a tuning, ascending. */
export function targetMidis(t: Tuning): number[] {
  return [...new Set(courseMidis(t).flat())].sort((a, b) => a - b)
}

/** Index of the course whose nearest note is closest (in cents) to `hz`, or -1. */
export function nearestCourse(courses: number[][], hz: number, a4: number): number {
  let best = -1
  let bestAbs = Infinity
  courses.forEach((course, i) => {
    for (const m of course) {
      const abs = Math.abs(centsBetween(hz, midiToHz(m, a4)))
      if (abs < bestAbs) {
        bestAbs = abs
        best = i
      }
    }
  })
  return best
}

/** The note of a course to measure against: the nearer one for octave courses. */
export function courseTargetMidi(course: number[], hz: number | null, a4: number): number {
  if (course.length === 1 || hz == null) return course[0]
  return course.reduce((acc, m) =>
    Math.abs(centsBetween(hz, midiToHz(m, a4))) < Math.abs(centsBetween(hz, midiToHz(acc, a4))) ? m : acc
  )
}
