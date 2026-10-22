import { get } from '@tonaljs/note'

/** Scientific pitch notation, A4 = 440 Hz, 12-tone equal temperament.
 * Preserve spelling: enharmonic notes can sound alike but have different staff positions.
 * Reference: https://tonaljs.github.io/tonal/docs/basics/notes
 */
export function lessonNote(name: string) {
  const normalized = name.replaceAll('𝄫', 'bb').replaceAll('𝄪', '##').replaceAll('♭', 'b').replaceAll('♯', '#').replaceAll('♮', '').replace(/n(?=-?\d+$)/,'')
  const note = get(normalized)
  if (note.empty || note.midi === null || note.freq === null) throw new Error(`Invalid lesson note (octave required): ${name}`)
  return { name: note.name, midi: note.midi, frequency: note.freq }
}

export const TREBLE_LINES = ['E4', 'G4', 'B4', 'D5', 'F5'].map(lessonNote)
export const TREBLE_SPACES = ['F4', 'A4', 'C5', 'E5'].map(lessonNote)
export const C_MAJOR_OCTAVE = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'].map(lessonNote)

export function staffLessonNotes(step: number) {
  if (step === 1) return TREBLE_LINES
  if (step === 2) return TREBLE_SPACES
  throw new Error(`No sound sequence for lesson step ${step}`)
}
