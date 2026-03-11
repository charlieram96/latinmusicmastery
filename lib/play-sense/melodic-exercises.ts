import type { ExerciseDefinition, ExerciseEvent } from './types'

// Helper to build a melodic event
function note(
  measure: number,
  beat: number,
  midi: number,
  noteName: string,
  vexKey: string,
  duration: number = 1,
  hand: 'R' | 'L' = 'R',
  accent: boolean = false,
): ExerciseEvent {
  return {
    measure,
    beat,
    instrument: 'piano', // overridden per exercise
    technique: 'open',
    hand,
    duration,
    vexKey,
    accent,
    expectedPitch: midi,
    expectedNoteName: noteName,
  }
}

// ─── Piano Exercises ───────────────────────────────────────────

const basicSalsaMontuno: ExerciseDefinition = {
  id: 'piano-salsa-montuno-basic',
  title: 'Basic Salsa Montuno',
  description: 'Classic anticipated montuno pattern in C major — the foundation of salsa piano.',
  instrument: 'piano',
  bpm: 160,
  timeSignature: [4, 4],
  swing: 0,
  difficulty: 'beginner',
  measures: 2,
  loopCount: 2,
  events: [
    // Measure 1: C-E on beat 1, G on the "and" of 2, C5 on beat 3, G on the "and" of 4
    note(1, 1, 60, 'C4', 'c/4', 0.5),
    note(1, 1.5, 64, 'E4', 'e/4', 0.5),
    note(1, 2.5, 67, 'G4', 'g/4', 0.5),
    note(1, 3, 72, 'C5', 'c/5', 0.5),
    note(1, 4.5, 67, 'G4', 'g/4', 0.5),
    // Measure 2: E on beat 1, C on the "and" of 2, E on beat 3, G on the "and" of 4
    note(2, 1, 64, 'E4', 'e/4', 0.5),
    note(2, 2.5, 60, 'C4', 'c/4', 0.5),
    note(2, 3, 64, 'E4', 'e/4', 0.5),
    note(2, 4.5, 67, 'G4', 'g/4', 0.5),
  ],
}

const guajeoPattern: ExerciseDefinition = {
  id: 'piano-guajeo',
  title: 'Guajeo Pattern',
  description: 'Eighth-note arpeggiated son montuno guajeo in C major.',
  instrument: 'piano',
  bpm: 140,
  timeSignature: [4, 4],
  swing: 0,
  difficulty: 'beginner',
  measures: 2,
  loopCount: 2,
  events: [
    // Measure 1: steady eighth-note arpeggio C-E-G-C-G-E-C-E
    note(1, 1, 60, 'C4', 'c/4', 0.5),
    note(1, 1.5, 64, 'E4', 'e/4', 0.5),
    note(1, 2, 67, 'G4', 'g/4', 0.5),
    note(1, 2.5, 72, 'C5', 'c/5', 0.5),
    note(1, 3, 67, 'G4', 'g/4', 0.5),
    note(1, 3.5, 64, 'E4', 'e/4', 0.5),
    note(1, 4, 60, 'C4', 'c/4', 0.5),
    note(1, 4.5, 64, 'E4', 'e/4', 0.5),
    // Measure 2: mirror — G-E-C-E-G-C-G-E
    note(2, 1, 67, 'G4', 'g/4', 0.5),
    note(2, 1.5, 64, 'E4', 'e/4', 0.5),
    note(2, 2, 60, 'C4', 'c/4', 0.5),
    note(2, 2.5, 64, 'E4', 'e/4', 0.5),
    note(2, 3, 67, 'G4', 'g/4', 0.5),
    note(2, 3.5, 72, 'C5', 'c/5', 0.5),
    note(2, 4, 67, 'G4', 'g/4', 0.5),
    note(2, 4.5, 64, 'E4', 'e/4', 0.5),
  ],
}

const sonMontunoTumbao: ExerciseDefinition = {
  id: 'piano-son-montuno-tumbao',
  title: 'Son Montuno Tumbao',
  description: 'Syncopated montuno with "and-of-4" anticipation in C minor.',
  instrument: 'piano',
  bpm: 180,
  timeSignature: [4, 4],
  swing: 0,
  difficulty: 'intermediate',
  measures: 2,
  loopCount: 2,
  events: [
    // Measure 1: syncopated C minor pattern
    note(1, 1, 60, 'C4', 'c/4', 0.5),
    note(1, 1.5, 63, 'Eb4', 'e/4', 0.5),
    note(1, 2.5, 67, 'G4', 'g/4', 0.5),
    note(1, 3, 72, 'C5', 'c/5', 0.5, 'R', true),
    note(1, 4, 70, 'Bb4', 'b/4', 0.5),
    note(1, 4.5, 67, 'G4', 'g/4', 0.5), // "and-of-4" anticipation
    // Measure 2
    note(2, 1, 63, 'Eb4', 'e/4', 0.5),
    note(2, 1.5, 60, 'C4', 'c/4', 0.5),
    note(2, 2.5, 63, 'Eb4', 'e/4', 0.5),
    note(2, 3, 67, 'G4', 'g/4', 0.5, 'R', true),
    note(2, 4, 65, 'F4', 'f/4', 0.5),
    note(2, 4.5, 63, 'Eb4', 'e/4', 0.5),
  ],
}

// ─── Violin Exercises ──────────────────────────────────────────

function violinNote(
  measure: number,
  beat: number,
  midi: number,
  noteName: string,
  vexKey: string,
  duration: number = 1,
  hand: 'R' | 'L' = 'R',
  accent: boolean = false,
): ExerciseEvent {
  return {
    measure,
    beat,
    instrument: 'violin',
    technique: 'open',
    hand,
    duration,
    vexKey,
    accent,
    expectedPitch: midi,
    expectedNoteName: noteName,
  }
}

const gMajorScaleLatin: ExerciseDefinition = {
  id: 'violin-g-major-scale',
  title: 'G Major Scale - Latin Style',
  description: 'G3 through G4 as quarter notes with a Latin feel.',
  instrument: 'violin',
  bpm: 100,
  timeSignature: [4, 4],
  swing: 0,
  difficulty: 'beginner',
  measures: 2,
  loopCount: 2,
  events: [
    // Measure 1: G3 A3 B3 C4
    violinNote(1, 1, 55, 'G3', 'g/3', 1),
    violinNote(1, 2, 57, 'A3', 'a/3', 1),
    violinNote(1, 3, 59, 'B3', 'b/3', 1),
    violinNote(1, 4, 60, 'C4', 'c/4', 1),
    // Measure 2: D4 E4 F#4 G4
    violinNote(2, 1, 62, 'D4', 'd/4', 1),
    violinNote(2, 2, 64, 'E4', 'e/4', 1),
    violinNote(2, 3, 66, 'F#4', 'f/4', 1),
    violinNote(2, 4, 67, 'G4', 'g/4', 1),
  ],
}

const sonCubanoMelody: ExerciseDefinition = {
  id: 'violin-son-cubano-melody',
  title: 'Son Cubano Melody',
  description: 'Simple melodic line using G, A, B, D in the style of Son Cubano.',
  instrument: 'violin',
  bpm: 120,
  timeSignature: [4, 4],
  swing: 0,
  difficulty: 'beginner',
  measures: 2,
  loopCount: 2,
  events: [
    // Measure 1: G-A-B-D melodic phrase
    violinNote(1, 1, 55, 'G3', 'g/3', 1),
    violinNote(1, 2, 57, 'A3', 'a/3', 0.5),
    violinNote(1, 2.5, 59, 'B3', 'b/3', 0.5),
    violinNote(1, 3, 62, 'D4', 'd/4', 1, 'R', true),
    violinNote(1, 4, 59, 'B3', 'b/3', 1),
    // Measure 2: descending response
    violinNote(2, 1, 57, 'A3', 'a/3', 1),
    violinNote(2, 2, 55, 'G3', 'g/3', 0.5),
    violinNote(2, 2.5, 57, 'A3', 'a/3', 0.5),
    violinNote(2, 3, 59, 'B3', 'b/3', 1),
    violinNote(2, 4, 55, 'G3', 'g/3', 1),
  ],
}

const charangaViolinPhrase: ExerciseDefinition = {
  id: 'violin-charanga-phrase',
  title: 'Charanga Violin Phrase',
  description: 'Faster eighth-note charanga passage in C major.',
  instrument: 'violin',
  bpm: 160,
  timeSignature: [4, 4],
  swing: 0,
  difficulty: 'intermediate',
  measures: 2,
  loopCount: 2,
  events: [
    // Measure 1: quick charanga figure
    violinNote(1, 1, 72, 'C5', 'c/5', 0.5, 'R', true),
    violinNote(1, 1.5, 74, 'D5', 'd/5', 0.5),
    violinNote(1, 2, 76, 'E5', 'e/5', 0.5),
    violinNote(1, 2.5, 74, 'D5', 'd/5', 0.5),
    violinNote(1, 3, 72, 'C5', 'c/5', 0.5),
    violinNote(1, 3.5, 69, 'A4', 'a/4', 0.5),
    violinNote(1, 4, 71, 'B4', 'b/4', 0.5),
    violinNote(1, 4.5, 72, 'C5', 'c/5', 0.5),
    // Measure 2: continuation & resolution
    violinNote(2, 1, 76, 'E5', 'e/5', 0.5, 'R', true),
    violinNote(2, 1.5, 74, 'D5', 'd/5', 0.5),
    violinNote(2, 2, 72, 'C5', 'c/5', 0.5),
    violinNote(2, 2.5, 71, 'B4', 'b/4', 0.5),
    violinNote(2, 3, 69, 'A4', 'a/4', 0.5),
    violinNote(2, 3.5, 71, 'B4', 'b/4', 0.5),
    violinNote(2, 4, 72, 'C5', 'c/5', 1),
  ],
}

const pianoTestSimple: ExerciseDefinition = {
  id: 'piano-test-simple',
  title: 'Piano Test - Simple Notes',
  description: 'Very slow test pattern — one note per beat across different pitches.',
  instrument: 'piano',
  bpm: 40,
  timeSignature: [4, 4],
  swing: 0,
  difficulty: 'beginner',
  measures: 8,
  loopCount: 1,
  events: [
    // Measure 1: ascending C major
    note(1, 1, 60, 'C4', 'c/4', 1),
    note(1, 2, 64, 'E4', 'e/4', 1),
    note(1, 3, 67, 'G4', 'g/4', 1),
    note(1, 4, 71, 'B4', 'b/4', 1),
    // Measure 2: up to D5 then back down
    note(2, 1, 74, 'D5', 'd/5', 1),
    note(2, 2, 72, 'C5', 'c/5', 1),
    note(2, 3, 69, 'A4', 'a/4', 1),
    note(2, 4, 65, 'F4', 'f/4', 1),
    // Measure 3: low range
    note(3, 1, 60, 'C4', 'c/4', 1),
    note(3, 2, 62, 'D4', 'd/4', 1),
    note(3, 3, 65, 'F4', 'f/4', 1),
    note(3, 4, 69, 'A4', 'a/4', 1),
    // Measure 4: chromatic touches
    note(4, 1, 61, 'Db4', 'd/4', 1),
    note(4, 2, 63, 'Eb4', 'e/4', 1),
    note(4, 3, 66, 'F#4', 'f/4', 1),
    note(4, 4, 68, 'Ab4', 'a/4', 1),
    // Measure 5: upper register
    note(5, 1, 72, 'C5', 'c/5', 1),
    note(5, 2, 74, 'D5', 'd/5', 1),
    note(5, 3, 71, 'B4', 'b/4', 1),
    note(5, 4, 67, 'G4', 'g/4', 1),
    // Measure 6: stepwise descent
    note(6, 1, 69, 'A4', 'a/4', 1),
    note(6, 2, 67, 'G4', 'g/4', 1),
    note(6, 3, 65, 'F4', 'f/4', 1),
    note(6, 4, 64, 'E4', 'e/4', 1),
    // Measure 7: wide intervals
    note(7, 1, 60, 'C4', 'c/4', 1),
    note(7, 2, 72, 'C5', 'c/5', 1),
    note(7, 3, 64, 'E4', 'e/4', 1),
    note(7, 4, 74, 'D5', 'd/5', 1),
    // Measure 8: resolve
    note(8, 1, 71, 'B4', 'b/4', 1),
    note(8, 2, 67, 'G4', 'g/4', 1),
    note(8, 3, 64, 'E4', 'e/4', 1),
    note(8, 4, 60, 'C4', 'c/4', 1),
  ],
}

export const MELODIC_EXERCISES: ExerciseDefinition[] = [
  pianoTestSimple,
  basicSalsaMontuno,
  guajeoPattern,
  sonMontunoTumbao,
  gMajorScaleLatin,
  sonCubanoMelody,
  charangaViolinPhrase,
]
