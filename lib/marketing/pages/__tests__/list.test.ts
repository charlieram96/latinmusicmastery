import { describe, expect, it } from 'vitest'
import { joinNames } from '../list'

describe('joinNames', () => {
  it('returns an empty string for no names', () => {
    expect(joinNames([], 'en')).toBe('')
  })
  it('returns a single name as is', () => {
    expect(joinNames(['Piano'], 'es')).toBe('Piano')
  })
  it('joins two names with the conjunction', () => {
    expect(joinNames(['Piano', 'Bass'], 'en')).toBe('Piano and Bass')
    expect(joinNames(['Piano', 'Bajo'], 'es')).toBe('Piano y Bajo')
  })
  it('uses commas and no Oxford comma for longer lists', () => {
    expect(joinNames(['Timbal', 'Conga', 'Piano'], 'en')).toBe('Timbal, Conga and Piano')
    expect(joinNames(['Timbal', 'Conga', 'Piano'], 'es')).toBe('Timbal, Conga y Piano')
  })
  it('uses "e" before a word starting with an i sound in Spanish', () => {
    expect(joinNames(['Timbal', 'Instrumentos de viento'], 'es')).toBe('Timbal e Instrumentos de viento')
    expect(joinNames(['Timbal', 'Hielo'], 'es')).toBe('Timbal y Hielo')
  })
})
