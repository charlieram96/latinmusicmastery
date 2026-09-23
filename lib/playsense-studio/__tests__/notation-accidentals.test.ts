import { describe, expect, it } from 'vitest'
import { createAccidentalMemory, keyAlter, keySignatureName, spellMidi, vexKey } from '../notation/accidentals'

describe('spellMidi', () => {
  it('prefers explicit spelling, then the hint, then the key', () => {
    expect(spellMidi(70, { spelling: { step: 'A', alter: 1 }, spellingHint: 'Bb', keyFifths: 0 })).toEqual({ step: 'A', alter: 1, octave: 4 })
    expect(spellMidi(70, { spellingHint: 'Bb', keyFifths: 2 })).toEqual({ step: 'B', alter: -1, octave: 4 })
    expect(spellMidi(70, { keyFifths: -1 })).toMatchObject({ step: 'B', alter: -1, octave: 4 })
    expect(spellMidi(70, { keyFifths: 2 })).toMatchObject({ step: 'A', alter: 1, octave: 4 })
  })
  it('handles octave crossings and double accidentals', () => {
    expect(spellMidi(60, { spelling: { step: 'B', alter: 1 }, keyFifths: 0 })).toEqual({ step: 'B', alter: 1, octave: 3 })   // B#3 = C4
    expect(spellMidi(59, { spelling: { step: 'C', alter: -1 }, keyFifths: 0 })).toEqual({ step: 'C', alter: -1, octave: 4 })  // Cb4 = B3
    expect(spellMidi(79, { spelling: { step: 'F', alter: 2 }, keyFifths: 0 })).toEqual({ step: 'F', alter: 2, octave: 5 })
    expect(spellMidi(64, { spelling: { step: 'E', alter: 0, showAccidental: 'always' }, keyFifths: 0 })).toEqual({ step: 'E', alter: 0, octave: 4, showAccidental: 'always' })
  })
})

describe('keys and signatures', () => {
  it('builds VexFlow keys', () => {
    expect(vexKey({ step: 'B', alter: -1, octave: 4 })).toBe('bb/4')
    expect(vexKey({ step: 'F', alter: 2, octave: 5 })).toBe('f##/5')
    expect(vexKey({ step: 'C', alter: 0, octave: 4 })).toBe('c/4')
  })
  it('knows the key signature', () => {
    expect(keyAlter('B', -1)).toBe(-1)
    expect(keyAlter('F', 2)).toBe(1)
    expect(keyAlter('C', 2)).toBe(1)
    expect(keyAlter('G', 2)).toBe(0)
    expect(keySignatureName(0)).toBe('C')
    expect(keySignatureName(-2)).toBe('Bb')
    expect(keySignatureName(3)).toBe('A')
  })
})

describe('createAccidentalMemory', () => {
  it('shows nothing the key signature already implies, and a natural when it is cancelled', () => {
    const m = createAccidentalMemory(-1) // F major
    expect(m.code({ step: 'B', alter: -1, octave: 4 })).toBeNull()
    expect(m.code({ step: 'B', alter: 0, octave: 4 })).toBe('n')
    expect(m.code({ step: 'B', alter: 0, octave: 4 })).toBeNull()      // remembered within the bar
    expect(m.code({ step: 'B', alter: 0, octave: 5 })).toBe('n')       // other octave is separate
  })
  it('remembers accidentals within the bar and forces courtesy ones', () => {
    const m = createAccidentalMemory(0)
    expect(m.code({ step: 'E', alter: -1, octave: 5 })).toBe('b')
    expect(m.code({ step: 'E', alter: -1, octave: 5 })).toBeNull()
    expect(m.code({ step: 'E', alter: 0, octave: 5 })).toBe('n')
    expect(m.code({ step: 'F', alter: 2, octave: 5 })).toBe('##')
    expect(m.code({ step: 'D', alter: -2, octave: 4 })).toBe('bb')
    expect(m.code({ step: 'A', alter: 0, octave: 4, showAccidental: 'always' })).toBe('n')
  })
  it('does not repeat the accidental on a note tied from the same pitch', () => {
    const m = createAccidentalMemory(0)
    expect(m.code({ step: 'F', alter: 1, octave: 4 }, { tiedFromSame: true })).toBeNull()
    expect(m.code({ step: 'F', alter: 1, octave: 4 })).toBeNull()      // and it is remembered
  })
})
