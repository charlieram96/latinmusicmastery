import { describe, it, expect } from 'vitest'
import { lessonNote, staffLessonNotes, C_MAJOR_OCTAVE } from '../notes'

describe('authored lesson pitches', () => {
  it('plays treble lines and spaces as different sequences, bottom to top', () => {
    expect(staffLessonNotes(1).map(n => n.midi)).toEqual([64, 67, 71, 74, 77])
    expect(staffLessonNotes(2).map(n => n.midi)).toEqual([65, 69, 72, 76])
    const frequencies = [349.22823, 440, 523.25113, 659.25511]
    staffLessonNotes(2).forEach((note, i) => expect(note.frequency).toBeCloseTo(frequencies[i], 4))
    expect(C_MAJOR_OCTAVE.map(n => n.midi)).toEqual([60,62,64,65,67,69,71,72])
  })
  it.each([
    ['C#4',61], ['Db4',61], ['F##4',67], ['Gbb4',65],
    ['B#4',72], ['Cb4',59], ['Cbb4',58], ['B##4',73],
    ['F𝄪4',67], ['G𝄫4',65], ['D♭4',61], ['C♯4',61], ['A♮4',69],
  ])('converts %s to MIDI %i without losing octave boundaries', (name, midi) => {
    expect(lessonNote(name).midi).toBe(midi)
  })
  it('keeps enharmonic spellings while matching their sound', () => {
    expect(lessonNote('F##4').name).toBe('F##4')
    expect(lessonNote('F##4').frequency).toBe(lessonNote('G4').frequency)
  })
  it('rejects missing octave and invalid notes', () => {
    for (const name of ['F', 'H4', '']) expect(() => lessonNote(name)).toThrow()
    expect(() => staffLessonNotes(0)).toThrow()
  })
})
