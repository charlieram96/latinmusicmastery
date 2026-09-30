import { describe, expect, it } from 'vitest'
import type { CatalogCourse } from '../catalog'
import { filterCourses, initialInstrument, sortCourses } from '../explore-filter'

const course = (over: Partial<CatalogCourse>): CatalogCourse => ({
  id: 'x', title: 'T', instrument: 'Conga', styleSlug: null, styleName: null,
  countrySlug: null, countryCode: null, fundamentals: false, teacherId: null, ...over,
})

const COURSES = [
  course({ id: 'a', instrument: 'Conga', styleName: 'Son Cubano', styleSlug: 'son-cubano', countrySlug: 'cuba', title: 'Son Cubano Conga' }),
  course({ id: 'b', instrument: 'Timbal', styleName: 'Danzón', styleSlug: 'danzon', countrySlug: 'cuba', title: 'Danzón Timbal' }),
  course({ id: 'c', instrument: 'Conga', styleName: 'Bomba', styleSlug: 'bomba', countrySlug: 'puerto-rico', title: 'Bomba Conga' }),
  course({ id: 'd', instrument: 'Minor Percussion', fundamentals: true, title: 'Minor Percussion Fundamentals' }),
]
const label = (k: string) => (k === 'Timbal' ? 'Timbales' : k)
const ids = (f: Parameters<typeof filterCourses>[1]) => filterCourses(COURSES, f, label).map(c => c.id)

describe('filterCourses', () => {
  it('returns everything with no filter', () => {
    expect(ids({ instrument: 'all', country: 'all', q: '' })).toEqual(['a', 'b', 'c', 'd'])
  })
  it('filters by instrument', () => {
    expect(ids({ instrument: 'Conga', country: 'all', q: '' })).toEqual(['a', 'c'])
  })
  it('filters by country and drops courses with no country', () => {
    expect(ids({ instrument: 'all', country: 'cuba', q: '' })).toEqual(['a', 'b'])
  })
  it('combines instrument and country', () => {
    expect(ids({ instrument: 'Conga', country: 'puerto-rico', q: '' })).toEqual(['c'])
  })
  it('searches style and instrument without caring about case or accents', () => {
    expect(ids({ instrument: 'all', country: 'all', q: 'DANZON' })).toEqual(['b'])
    expect(ids({ instrument: 'all', country: 'all', q: 'bomba conga' })).toEqual(['c'])
  })
  it('searches the localized instrument label', () => {
    expect(ids({ instrument: 'all', country: 'all', q: 'timbales' })).toEqual(['b'])
  })
  it('ignores surrounding whitespace in the query', () => {
    expect(ids({ instrument: 'all', country: 'all', q: '  fundamentals ' })).toEqual(['d'])
  })
})

describe('initialInstrument', () => {
  const keys = ['Conga', 'Minor Percussion']
  it('keeps an exact key', () => expect(initialInstrument('Minor Percussion', keys)).toBe('Minor Percussion'))
  it('matches case-insensitively', () => expect(initialInstrument('minor percussion', keys)).toBe('Minor Percussion'))
  it('falls back to all for unknown or missing values', () => {
    expect(initialInstrument('Kazoo', keys)).toBe('all')
    expect(initialInstrument(undefined, keys)).toBe('all')
    expect(initialInstrument('', keys)).toBe('all')
  })
})

describe('sortCourses', () => {
  it('orders by style order, then instrument order, unknowns last', () => {
    const out = sortCourses([
      course({ id: '1', styleSlug: 'timba', instrument: 'Piano' }),
      course({ id: '2', styleSlug: 'son', instrument: 'Piano' }),
      course({ id: '3', styleSlug: 'son', instrument: 'Timbal' }),
      course({ id: '4', styleSlug: 'other', instrument: 'Timbal' }),
      course({ id: '5', styleSlug: 'son', instrument: 'Kazoo' }),
    ], ['son', 'timba'], ['Timbal', 'Piano'])
    expect(out.map(c => c.id)).toEqual(['3', '2', '5', '1', '4'])
  })
})
