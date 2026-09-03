import { describe, expect, it } from 'vitest'
import { instrumentLabel } from '@/lib/i18n/instruments'

describe('instrumentLabel', () => {
  it('returns the English value untouched for the en locale', () => {
    expect(instrumentLabel('Bass', 'en')).toBe('Bass')
    expect(instrumentLabel('Minor Percussion', 'en')).toBe('Minor Percussion')
  })

  it('translates canonical instrument names to Spanish', () => {
    expect(instrumentLabel('Bass', 'es')).toBe('Bajo')
    expect(instrumentLabel('Drums', 'es')).toBe('Batería')
    expect(instrumentLabel('Guitar', 'es')).toBe('Guitarra')
    expect(instrumentLabel('Minor Percussion', 'es')).toBe('Percusión Menor')
    expect(instrumentLabel('Violin', 'es')).toBe('Violín')
    expect(instrumentLabel('Saxophone', 'es')).toBe('Saxofón')
    expect(instrumentLabel('Trumpet', 'es')).toBe('Trompeta')
    expect(instrumentLabel('Voice', 'es')).toBe('Voz')
  })

  it('keeps names that are the same in both languages', () => {
    expect(instrumentLabel('Piano', 'es')).toBe('Piano')
    expect(instrumentLabel('Timbal', 'es')).toBe('Timbal')
    expect(instrumentLabel('Tres', 'es')).toBe('Tres')
    expect(instrumentLabel('Conga', 'es')).toBe('Conga')
  })

  it('is case- and whitespace-insensitive', () => {
    expect(instrumentLabel('  bass ', 'es')).toBe('Bajo')
    expect(instrumentLabel('DRUMS', 'es')).toBe('Batería')
  })

  it('translates free-text lists token by token', () => {
    expect(instrumentLabel('Piano, Violin', 'es')).toBe('Piano, Violín')
    expect(instrumentLabel('Percussion, Timbal', 'es')).toBe('Percusión, Timbal')
    expect(instrumentLabel('Guitar and Tres', 'es')).toBe('Guitarra y Tres')
    expect(instrumentLabel('Saxophone, Piano, Ewi', 'es')).toBe('Saxofón, Piano, Ewi')
    expect(instrumentLabel('Congas', 'es')).toBe('Congas')
  })

  it('translates multi-word tokens word by word when every word is known', () => {
    expect(instrumentLabel('Piano Acordeon', 'es')).toBe('Piano Acordeón')
  })

  it('leaves unknown tokens untouched', () => {
    expect(instrumentLabel('Master Vocalist', 'es')).toBe('Master Vocalist')
    expect(instrumentLabel('Cajón', 'es')).toBe('Cajón')
  })

  it('handles empty input', () => {
    expect(instrumentLabel(null, 'es')).toBe('')
    expect(instrumentLabel(undefined, 'es')).toBe('')
    expect(instrumentLabel('', 'es')).toBe('')
  })
})
