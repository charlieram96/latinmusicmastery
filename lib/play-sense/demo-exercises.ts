import type { ExerciseDefinition, ExerciseEvent, Instrument } from './types'

/** Synthetic phrases for visual previews; these are never published practice exercises. */
export function makeDemoExercise(instrument: Instrument): ExerciseDefinition {
  const events: ExerciseEvent[] = []
  const congaSurfaces = ['tumba', 'quinto', 'conga', 'tumba', 'quinto', 'conga', 'conga', 'quinto']
  const pitches = [60, 64, 67, 72, 67, 64, 62, 65]
  for (let measure = 1; measure <= 4; measure++) for (let i = 0; i < 8; i++) {
    events.push({ instrument, measure, beat: 1 + i * .5, technique: i % 3 === 1 ? 'slap' : 'open', hand: i % 2 ? 'L' : 'R',
      duration: instrument === 'piano' ? (i % 4 === 0 ? .8 : .4) : .5, vexKey: 'c/4', accent: i % 4 === 0,
      surface: instrument === 'piano' ? undefined : instrument === 'timbale' ? ['cascara', 'campana', 'macho', 'hembra', 'cascara', 'jamblock', 'cencerro', 'macho'][i] : congaSurfaces[i],
      expectedPitch: instrument === 'piano' ? pitches[(i + (measure % 2 === 0 ? 2 : 0)) % 8] : undefined,
    })
  }
  return { id: `preview-${instrument}`, title: instrument === 'piano' ? 'Montuno en Do' : instrument === 'timbale' ? 'Cáscara con Campana' : 'Tumbao Esencial',
    description: 'Practice phrase', instrument, bpm: 100, timeSignature: [4, 4], swing: 0, difficulty: 'beginner', measures: 4, loopCount: 4, events }
}
