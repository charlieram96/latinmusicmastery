import type { ExerciseDefinition } from './types'
import { beatToTimestamp, getExerciseDuration } from './exercise-utils'

export const CASCARA_COACHING_ID = 'f7fee0dd-66bb-4e08-9af0-e38febfa415b'
export type CoachingCue = { kind: 'title' | 'count' | 'tip' | 'final' | 'done'; key: string; text: string; detail: string; number?: number }

/** Source-time cues: tempo changes, pause and seeking never accumulate timer drift. */
export function cascaraCue(exercise: ExerciseDefinition, seconds: number, state: string, es: boolean): CoachingCue | null {
  const title = es ? 'Ritmo básico de la cáscara' : 'Basic cáscara rhythm'
  const hand = es ? 'SON CUBANO · MANO DERECHA' : 'CUBAN SON · RIGHT HAND'
  if (state === 'selecting' || (seconds >= 0 && seconds < 3)) return { kind: 'title', key: 'title', text: title, detail: hand }
  const beat = exercise.grid ? exercise.grid.beatQN[0] * exercise.grid.secPerQN[0] : 60 / exercise.bpm
  if (!(beat > 0) || !Number.isFinite(seconds)) return null
  if (state === 'countdown' && seconds < 0) {
    // Count UP with the teacher's musical count, repeating for each count-in bar.
    const beats = exercise.timeSignature[0]
    const number = ((Math.floor(seconds / beat + 0.0001) % beats) + beats) % beats + 1
    return { kind: 'count', key: `count-${Math.floor(seconds / beat)}`, text: es ? 'PREPÁRATE' : 'GET READY', detail: hand, number }
  }
  if (seconds < 0) return null
  const duration = getExerciseDuration(exercise)
  const lastEvent = exercise.events.at(-1)
  // This exercise closes on a final downbeat, after the last two-bar pattern.
  const finish = lastEvent ? beatToTimestamp(lastEvent, exercise.bpm, exercise.timeSignature, exercise.loopCount - 1, exercise.measures, exercise.swing, exercise.grid) : duration
  if (seconds >= finish && seconds < duration + 0.4) return { kind: 'done', key: 'done', text: es ? '¡Bien hecho!' : 'Well done!', detail: es ? 'EJERCICIO COMPLETADO' : 'EXERCISE COMPLETE' }
  const finalStart = Math.max(3, finish - 8 * beat)
  if (seconds >= finalStart && seconds < finish) return { kind: 'final', key: 'final', text: es ? 'Última ronda' : 'Final round', detail: es ? 'MANTÉN EL PULSO HASTA EL FINAL' : 'KEEP THE PULSE TO THE END' }
  const tips = es
    ? ['Escucha bien el tiempo', 'Mantén el pulso', 'Relaja la mano derecha', 'Presta atención al sonido', 'Sigue con precisión']
    : ['Listen to the beat', 'Keep a steady pulse', 'Relax your right hand', 'Focus on the sound', 'Stay precise']
  const spacing = (finalStart - 5) / tips.length
  if (spacing < 2) return null
  const index = Math.floor((seconds - 5) / spacing)
  if (index >= 0 && index < tips.length && seconds - (5 + index * spacing) < Math.min(2.7, spacing - 0.5)) {
    return { kind: 'tip', key: `tip-${index}`, text: tips[index], detail: hand }
  }
  return null
}

/** Four performed bars, including written repeats already expanded by the score importer. */
export function cascaraNotation(exercise: ExerciseDefinition) {
  const beat = exercise.grid ? exercise.grid.beatQN[0] * exercise.grid.secPerQN[0] : 60 / exercise.bpm
  const starts = exercise.grid?.measureStartSec ?? Array.from({ length: 5 }, (_, i) => i * exercise.timeSignature[0] * beat)
  const end = starts[4]
  // This single-hand lesson uses every authored stroke. The importer assigns
  // alternating game hands automatically; those are not authored sticking.
  const notes = exercise.events.flatMap((event, index) => event.measure <= 4 ? [{
    ...event, id: index,
    seconds: beatToTimestamp(event, exercise.bpm, exercise.timeSignature, 0, exercise.measures, exercise.swing, exercise.grid),
  }] : [])
  return { notes, end, beat }
}
