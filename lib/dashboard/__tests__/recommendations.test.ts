import { describe, expect, it } from 'vitest'
import { filterRecommended, isNew, reasonFor, type RecContext, type RecCourse } from '../recommendations'

const NOW = '2026-09-05T12:00:00.000Z'

const ctx: RecContext = {
  instruments: ['Timbal'],
  teacherIds: ['t-patricio'],
  enrolledTitlesByTeacherId: { 't-patricio': 'Son Cubano Timbal' },
  now: NOW,
}

const course = (over: Partial<RecCourse>): RecCourse => ({
  id: 'c1',
  instrument: null,
  teacherId: null,
  teacherName: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  difficulty: null,
  ...over,
})

describe('isNew', () => {
  it('is new within 30 days, not after, and never without a date', () => {
    expect(isNew('2026-08-20T00:00:00.000Z', NOW)).toBe(true)
    expect(isNew('2026-07-01T00:00:00.000Z', NOW)).toBe(false)
    expect(isNew(null, NOW)).toBe(false)
  })
})

describe('reasonFor', () => {
  it('prefers a matching instrument', () => {
    const c = course({ instrument: 'Timbal', teacherId: 't-patricio', createdAt: NOW })
    expect(reasonFor(c, ctx)).toEqual({ kind: 'instrument', instrument: 'Timbal' })
  })

  it('then a teacher the learner already studies with', () => {
    const c = course({ instrument: 'Bass', teacherId: 't-patricio', teacherName: 'Patricio Díaz', createdAt: NOW })
    expect(reasonFor(c, ctx)).toEqual({ kind: 'teacher', teacher: 'Patricio Díaz', course: 'Son Cubano Timbal' })
  })

  it('then recency', () => {
    const c = course({ instrument: 'Bass', teacherId: 't-other', createdAt: '2026-08-30T00:00:00.000Z' })
    expect(reasonFor(c, ctx)).toEqual({ kind: 'new' })
  })

  it('and finally popularity', () => {
    const c = course({ instrument: 'Bass', teacherId: 't-other' })
    expect(reasonFor(c, ctx)).toEqual({ kind: 'popular' })
  })

  it('matches instruments case-insensitively', () => {
    const c = course({ instrument: 'timbal' })
    expect(reasonFor(c, ctx)).toEqual({ kind: 'instrument', instrument: 'timbal' })
  })
})

describe('filterRecommended', () => {
  const list = [
    course({ id: 'a', instrument: 'Timbal' }),
    course({ id: 'b', teacherId: 't-patricio', teacherName: 'Patricio Díaz' }),
    course({ id: 'c', createdAt: '2026-09-01T00:00:00.000Z' }),
    course({ id: 'd' }),
  ]
  const ids = (xs: RecCourse[]) => xs.map((x) => x.id)

  it('returns everything for "all"', () => {
    expect(ids(filterRecommended(list, 'all', ctx))).toEqual(['a', 'b', 'c', 'd'])
  })
  it('filters by the learner’s instruments', () => {
    expect(ids(filterRecommended(list, 'instrument', ctx))).toEqual(['a'])
  })
  it('filters by the learner’s teachers', () => {
    expect(ids(filterRecommended(list, 'teachers', ctx))).toEqual(['b'])
  })
  it('filters by recency', () => {
    expect(ids(filterRecommended(list, 'new', ctx))).toEqual(['c'])
  })
})
