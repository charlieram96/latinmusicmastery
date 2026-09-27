import { describe, expect, it } from 'vitest'
import { findTeacherByName, normalizeName, styleNameVariants, teachersForStyle } from '../style-teachers'
import { claveForStyle } from '../style-clave'
import { splitTitleAccent } from '../title-accent'

const T = (name: string, specialties: string[]) => ({ name, specialties })
const TEACHERS = [
  T('Patricio', ['Son', 'Salsa', 'Changui', 'Songo']),
  T('Frank', ['Rumba', 'Son Cubano', 'Timba', 'Cha cha cha']),
  T('Livan', ['Son', 'Bolero', 'Timba.']),
  T('Miguel', ['guaracha', 'danzón', 'Cuban salsa']),
  T('Leo', []),
]
const names = (style: string) => teachersForStyle(TEACHERS, style).map(t => t.name)

describe('normalizeName', () => {
  it('drops case, accents, spaces and punctuation', () => {
    expect(normalizeName('Cha-Cha-Chá.')).toBe('chachacha')
    expect(normalizeName(' Danzón ')).toBe('danzon')
  })
})

describe('styleNameVariants', () => {
  it('adds the name without a trailing country adjective', () => {
    expect(styleNameVariants('Son Cubano')).toEqual(['soncubano', 'son'])
    expect(styleNameVariants('Salsa Colombiana')).toEqual(['salsacolombiana', 'salsa'])
    expect(styleNameVariants('Merengue Típico')).toEqual(['merenguetipico'])
  })
  it('keeps a one-word name as is', () => {
    expect(styleNameVariants('Cubano')).toEqual(['cubano'])
  })
})

describe('teachersForStyle', () => {
  it('matches "Son Cubano" to both "Son" and "Son Cubano" specialties', () => {
    expect(names('Son Cubano')).toEqual(['Patricio', 'Frank', 'Livan'])
  })
  it('does not match a prefix ("Son" is not "Songo")', () => {
    expect(names('Songo')).toEqual(['Patricio'])
  })
  it('ignores punctuation and accents', () => {
    expect(names('Timba')).toEqual(['Frank', 'Livan'])
    expect(names('Danzón')).toEqual(['Miguel'])
    expect(names('Cha-Cha-Cha')).toEqual(['Frank'])
  })
  it('matches "Salsa Cubana" to a bare "Salsa" specialty', () => {
    expect(names('Salsa Cubana')).toEqual(['Patricio'])
  })
  it('returns nothing when nobody lists the style', () => {
    expect(names('Vallenato')).toEqual([])
  })
})

describe('findTeacherByName', () => {
  const ts = [{ name: 'Patricio "el chino" Diaz' }, { name: 'Leo Garcia' }]
  it('matches ignoring case, accents and quotes', () => {
    expect(findTeacherByName(ts, 'patricio "El Chino" Díaz')?.name).toBe('Patricio "el chino" Diaz')
  })
  it('returns null for no name or no match', () => {
    expect(findTeacherByName(ts, null)).toBeNull()
    expect(findTeacherByName(ts, 'Someone Else')).toBeNull()
  })
})

describe('claveForStyle', () => {
  it('gives son-family styles the son clave 3-2', () => {
    for (const s of ['son-cubano', 'salsa-cubana', 'mambo', 'timba', 'guaracha', 'guajira']) {
      expect(claveForStyle(s)).toEqual({ key: 'son32', hits: [0, 3, 6, 10, 12] })
    }
  })
  it('gives rumba the rumba clave 3-2', () => {
    expect(claveForStyle('rumba')).toEqual({ key: 'rumba32', hits: [0, 3, 7, 10, 12] })
  })
  it('returns null for other styles', () => {
    expect(claveForStyle('bachata')).toBeNull()
    expect(claveForStyle('bomba')).toBeNull()
  })
})

describe('splitTitleAccent', () => {
  it('sets the last word as the accent', () => {
    expect(splitTitleAccent('Son Cubano')).toEqual({ lead: 'Son', accent: 'Cubano' })
    expect(splitTitleAccent('República Dominicana')).toEqual({ lead: 'República', accent: 'Dominicana' })
  })
  it('makes a single word all accent', () => {
    expect(splitTitleAccent(' Timba ')).toEqual({ lead: '', accent: 'Timba' })
  })
})
