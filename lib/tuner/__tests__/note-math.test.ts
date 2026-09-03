import { describe, it, expect } from 'vitest'
import {
  midiToHz,
  hzToMidiFloat,
  centsBetween,
  nameToMidi,
  noteParts,
  noteLabel,
  verdictFor,
  formatCents,
} from '../note-math'

describe('note-math', () => {
  it('maps A4 and E2 at 440 and 442', () => {
    expect(midiToHz(69)).toBeCloseTo(440, 6)
    expect(midiToHz(40)).toBeCloseTo(82.4069, 3)
    expect(midiToHz(69, 442)).toBe(442)
  })

  it('round-trips hz to midi', () => {
    expect(hzToMidiFloat(440)).toBeCloseTo(69, 9)
    expect(hzToMidiFloat(261.6256)).toBeCloseTo(60, 3)
  })

  it('computes signed cents', () => {
    expect(centsBetween(440, 440)).toBe(0)
    expect(centsBetween(443, 440)).toBeCloseTo(11.8, 1)
    expect(centsBetween(437, 440)).toBeLessThan(0)
  })

  it('parses note names with sharps, flats and low octaves', () => {
    expect(nameToMidi('E2')).toBe(40)
    expect(nameToMidi('F#4')).toBe(66)
    expect(nameToMidi('Bb3')).toBe(58)
    expect(nameToMidi('B0')).toBe(23)
    expect(() => nameToMidi('H2')).toThrow()
  })

  it('splits parts in letters and solfège', () => {
    expect(noteParts(66, 'letters')).toEqual({ base: 'F', acc: '♯', oct: 4, pc: 6 })
    expect(noteParts(67, 'solfege')).toEqual({ base: 'Sol', acc: '', oct: 4, pc: 7 })
    expect(noteLabel(40, 'solfege')).toBe('Mi2')
    expect(noteLabel(61, 'letters')).toBe('C♯4')
  })

  it('classifies verdicts and formats cents', () => {
    expect(verdictFor(2.9, 3)).toBe('ok')
    expect(verdictFor(-8, 3)).toBe('warn')
    expect(verdictFor(30, 3)).toBe('bad')
    expect(formatCents(12.4)).toBe('+12')
    expect(formatCents(-2.6)).toBe('−3')
    expect(formatCents(0.2)).toBe('0')
  })
})
