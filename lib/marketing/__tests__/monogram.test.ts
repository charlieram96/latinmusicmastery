import { describe, expect, it } from 'vitest'
import { initials, monogramDataUri } from '../monogram'

const decode = (uri: string) => decodeURIComponent(uri.replace(/^data:image\/svg\+xml;charset=utf-8,/, ''))

describe('initials', () => {
  it('skips a quoted nickname', () => {
    expect(initials('Patricio "el chino" Diaz')).toBe('PD')
    expect(initials('Patricio “El Chino” Díaz')).toBe('PD')
  })
  it('uses first and last word', () => {
    expect(initials('Thommy Lowry García Rojas')).toBe('TR')
    expect(initials('frank la rosa')).toBe('FR')
  })
  it('handles one word and empty names', () => {
    expect(initials('Cher')).toBe('C')
    expect(initials('   ')).toBe('')
  })
})

describe('monogramDataUri', () => {
  it('returns an svg data uri containing the initials', () => {
    const uri = monogramDataUri('Mariela Suárez')
    expect(uri.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true)
    const svg = decode(uri)
    expect(svg).toContain('<svg')
    expect(svg).toContain('>MS</text>')
  })
  it('escapes markup characters', () => {
    const svg = decode(monogramDataUri('<b> &amp'))
    expect(svg).not.toContain('<b>')
    expect(svg).toContain('&lt;&amp;')
  })
})
