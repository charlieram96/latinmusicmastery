import { describe, expect, it } from 'vitest'
import { FAMILIES, familyCounts, teacherFamilies } from '../teacher-families'

describe('teacherFamilies', () => {
  it('maps percussion seats to perc', () => {
    for (const k of ['Timbal', 'Conga', 'Minor Percussion', 'Drums']) expect(teacherFamilies([k])).toEqual(['perc'])
  })
  it('puts a multi-instrumentalist in every family, in family order, once each', () => {
    expect(teacherFamilies(['Violin', 'Piano'])).toEqual(['keys', 'strings'])
    expect(teacherFamilies(['Timbal', 'Minor Percussion'])).toEqual(['perc'])
    expect(teacherFamilies(['Saxophone', 'Piano'])).toEqual(['keys', 'horns'])
  })
  it('maps the single-seat families', () => {
    expect(teacherFamilies(['Bass'])).toEqual(['bass'])
    expect(teacherFamilies(['Voice'])).toEqual(['voice'])
    expect(teacherFamilies(['Trumpet'])).toEqual(['horns'])
    expect(teacherFamilies(['Tres', 'Guitar'])).toEqual(['strings'])
  })
  it('returns nothing for unknown or missing seats', () => {
    expect(teacherFamilies([])).toEqual([])
    expect(teacherFamilies(['Kazoo'])).toEqual([])
  })
  it('lists six families', () => {
    expect(FAMILIES.map(f => f.key)).toEqual(['perc', 'keys', 'bass', 'strings', 'horns', 'voice'])
  })
})

describe('familyCounts', () => {
  it('counts each teacher once per family and totals everyone', () => {
    const counts = familyCounts([{ seatKeys: ['Piano', 'Violin'] }, { seatKeys: ['Piano'] }, { seatKeys: ['Conga'] }, { seatKeys: [] }])
    expect(counts).toEqual({ all: 4, perc: 1, keys: 2, bass: 0, strings: 1, horns: 0, voice: 0 })
  })
})
