import { describe, expect, it } from 'vitest'
import { buildCatalog, teacherSeatKeys, type CatalogInput } from '../catalog'

const input = (): CatalogInput => ({
  countries: [
    { id: 'cu', name: 'Cuba', slug: 'cuba' },
    { id: 'co', name: 'Colombia', slug: 'colombia' },
  ],
  styles: [
    { id: 's-son', name: 'Son Cubano', slug: 'son-cubano', country_id: 'cu' },
    { id: 's-timba', name: 'Timba', slug: 'timba', country_id: 'cu' },
    { id: 's-cumbia', name: 'Cumbia', slug: 'cumbia', country_id: 'co' },
    { id: 's-orphan', name: 'Orphan', slug: 'orphan', country_id: null },
  ],
  courses: [
    { id: 'c1', title: 'Timbal Fundamentals', instrument: 'Timbal', musical_style_id: null, is_fundamentals: true, is_published: true, teacher_id: null },
    { id: 'c2', title: 'Son Cubano Timbal', instrument: 'Timbal', musical_style_id: 's-son', is_fundamentals: false, is_published: true, teacher_id: 't-pat' },
    { id: 'c3', title: 'Timba Timbal', instrument: 'Timbal', musical_style_id: 's-timba', is_fundamentals: false, is_published: false, teacher_id: null },
    { id: 'c4', title: 'Son Cubano Conga', instrument: 'Conga', musical_style_id: 's-son', is_fundamentals: false, is_published: true, teacher_id: null },
    { id: 'c5', title: 'Cumbia - Coming Soon', instrument: 'Various', musical_style_id: 's-cumbia', is_fundamentals: false, is_published: false, teacher_id: null },
  ],
  teachers: [
    { id: 't-pat', name: 'Patricio "el chino" Diaz', instrument: 'Timbal', image_url: 'https://x/p.jpg', specialties: ['Son', 'Songo'] },
    { id: 't-alex', name: 'Alexander Carriera', instrument: 'Percussion, Timbal', image_url: null, specialties: null },
  ],
  instrumentCount: 12,
})

describe('buildCatalog', () => {
  it('lists only published courses, with fundamentals split out per instrument', () => {
    const cat = buildCatalog(input())
    expect(cat.courses.map(c => c.id)).toEqual(['c1', 'c2', 'c4'])
    const timbal = cat.instruments.find(i => i.key === 'Timbal')!
    expect(timbal.fundamentals?.id).toBe('c1')
    expect(timbal.courses.map(c => c.id)).toEqual(['c2'])
    expect(timbal.total).toBe(2)
  })

  it('never creates an instrument for Various or null', () => {
    const cat = buildCatalog(input())
    expect(cat.instruments.map(i => i.key)).toEqual(['Timbal', 'Conga'])
  })

  it('attaches style and country to each course', () => {
    const c2 = buildCatalog(input()).courses.find(c => c.id === 'c2')!
    expect(c2).toMatchObject({ styleSlug: 'son-cubano', styleName: 'Son Cubano', countrySlug: 'cuba', countryCode: 'CU', fundamentals: false, teacherId: 't-pat' })
  })

  it('marks a style live only when it has a published course, live styles first', () => {
    const cuba = buildCatalog(input()).countries.find(c => c.slug === 'cuba')!
    expect(cuba.styles).toEqual([
      { slug: 'son-cubano', name: 'Son Cubano', live: true, courseCount: 2 },
      { slug: 'timba', name: 'Timba', live: false, courseCount: 0 },
    ])
    expect(cuba.code).toBe('CU')
    expect(cuba.geo).toContain('La Habana')
  })

  it('counts from the data, not constants', () => {
    expect(buildCatalog(input()).counts).toEqual({ courses: 3, maestros: 2, instruments: 12, styles: 3, countries: 2 })
  })

  it('maps teachers onto instruments through their free-text instrument', () => {
    const cat = buildCatalog(input())
    expect(cat.instruments.find(i => i.key === 'Timbal')!.teacherIds).toEqual(['t-pat', 't-alex'])
    expect(cat.teachers.find(t => t.id === 't-alex')!.seatKeys).toEqual(['Minor Percussion', 'Timbal'])
  })
})

describe('teacherSeatKeys', () => {
  it.each([
    ['Percussion, Timbal', ['Minor Percussion', 'Timbal']],
    ['Congas', ['Conga']],
    ['Minor Percussion', ['Minor Percussion']],
    ['Piano Acordeon', ['Piano']],
    ['Guitar and Tres', ['Guitar', 'Tres']],
    ['Master Vocalist', ['Voice']],
    ['Saxophone, Piano, Ewi', ['Saxophone', 'Piano']],
    ['Piano, Violin', ['Piano', 'Violin']],
    ['Trumpet', ['Trumpet']],
    ['Bass', ['Bass']],
    ['', []],
    [null, []],
  ])('%s → %j', (text, keys) => {
    expect(teacherSeatKeys(text as string | null)).toEqual(keys)
  })
})
