import { describe, expect, it } from 'vitest'
import {
  COURSE_FIELDS,
  INSTRUMENT_FIELDS,
  TEACHER_FIELDS,
  localizeCourse,
  localizeRow,
  localizeRows,
  localizeTeacher,
  localizeTeachers,
  pick,
} from '@/lib/i18n/localize'

const bioEn = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] }
const bioEs = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hola' }] }] }

function teacher(overrides: Record<string, unknown> = {}) {
  return {
    id: 't1',
    name: 'Leo',
    instrument: 'Percussion, Timbal',
    instrument_es: null,
    bio: bioEn,
    bio_es: null,
    ...overrides,
  }
}

describe('pick / localizeRow', () => {
  it('picks the Spanish value only when locale is es and it is non-empty', () => {
    expect(pick('es', 'a', 'b')).toBe('b')
    expect(pick('es', 'a', '  ')).toBe('a')
    expect(pick('en', 'a', 'b')).toBe('a')
  })

  it('overlays _es fields in place', () => {
    const row = { title: 'Bass', title_es: 'Bajo', description: 'x', description_es: null }
    localizeRow(row, 'es', COURSE_FIELDS)
    expect(row.title).toBe('Bajo')
    expect(row.description).toBe('x')
  })
})

describe('localizeTeacher', () => {
  it('does nothing for the en locale', () => {
    const t = teacher({ bio_es: bioEs, instrument_es: 'Percusión, Timbal' })
    localizeTeacher(t, 'en')
    expect(t.bio).toBe(bioEn)
    expect(t.instrument).toBe('Percussion, Timbal')
  })

  it('uses bio_es and instrument_es when present', () => {
    const t = teacher({ bio_es: bioEs, instrument_es: 'Percusión y timbal' })
    localizeTeacher(t, 'es')
    expect(t.bio).toBe(bioEs)
    expect(t.instrument).toBe('Percusión y timbal')
  })

  it('keeps the English bio when bio_es is empty', () => {
    const t = teacher()
    localizeTeacher(t, 'es')
    expect(t.bio).toBe(bioEn)
  })

  it('falls back to a token-translated instrument label when instrument_es is empty', () => {
    const t = teacher()
    localizeTeacher(t, 'es')
    expect(t.instrument).toBe('Percusión, Timbal')
  })

  it('tolerates null and undefined', () => {
    expect(localizeTeacher(null, 'es')).toBeNull()
    expect(localizeTeacher(undefined, 'es')).toBeUndefined()
    expect(localizeTeachers(null, 'es')).toEqual([])
  })

  it('localizes arrays of teachers', () => {
    const rows = [teacher({ instrument: 'Bass' }), teacher({ instrument: 'Violin' })]
    localizeTeachers(rows, 'es')
    expect(rows.map((r) => r.instrument)).toEqual(['Bajo', 'Violín'])
  })

  it('exposes the teacher field list', () => {
    expect(TEACHER_FIELDS).toEqual(['bio', 'instrument'])
  })
})

describe('localizeCourse', () => {
  it('localizes the joined teacher along with the course', () => {
    const course = {
      title: 'Timba Timbal',
      title_es: 'Timba en el Timbal',
      description: 'en',
      description_es: 'es',
      teacher: teacher({ bio_es: bioEs }),
    }
    localizeCourse(course, 'es')
    expect(course.title).toBe('Timba en el Timbal')
    expect(course.teacher.bio).toBe(bioEs)
    expect(course.teacher.instrument).toBe('Percusión, Timbal')
  })

  it('leaves everything alone for en', () => {
    const course = { title: 'A', title_es: 'B', teacher: teacher({ bio_es: bioEs }) }
    localizeCourse(course, 'en')
    expect(course.title).toBe('A')
    expect(course.teacher.bio).toBe(bioEn)
  })
})

describe('instrument rows', () => {
  it('overlays name_es/description_es on instruments table rows', () => {
    const rows = [
      { name: 'Drums', name_es: 'Batería', description: 'd', description_es: 'dd' },
      { name: 'Piano', name_es: null, description: 'p', description_es: null },
    ]
    localizeRows(rows, 'es', INSTRUMENT_FIELDS)
    expect(rows[0].name).toBe('Batería')
    expect(rows[0].description).toBe('dd')
    expect(rows[1].name).toBe('Piano')
  })
})
