import { describe, expect, it } from 'vitest'
import { splitInstruments } from '../teachers'

describe('splitInstruments', () => {
  it('splits on commas, slashes and middle dots and trims', () => {
    expect(splitInstruments('Percusión, Timbal')).toEqual(['Percusión', 'Timbal'])
    expect(splitInstruments('Piano / Acordeón')).toEqual(['Piano', 'Acordeón'])
    expect(splitInstruments('Guitarra · Tres')).toEqual(['Guitarra', 'Tres'])
  })
  it('handles a single instrument and empty input', () => {
    expect(splitInstruments('Congas')).toEqual(['Congas'])
    expect(splitInstruments('')).toEqual([])
    expect(splitInstruments(null)).toEqual([])
    expect(splitInstruments(undefined)).toEqual([])
  })
})
