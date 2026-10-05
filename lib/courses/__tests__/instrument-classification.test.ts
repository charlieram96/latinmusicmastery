import { describe, expect, it } from 'vitest'
import { courseInstrumentClassifications, matchesCourseInstrument, selectedCourseInstrument } from '../instrument-classification'

describe('course classification independent from teacher specialties', () => {
  it('puts a theoretical course only in its selected tab', () => {
    expect(courseInstrumentClassifications('Theoretical')).toEqual(['Theoretical'])
    expect(matchesCourseInstrument('Theoretical', 'Theoretical')).toBe(true)
    expect(matchesCourseInstrument('Theoretical', 'Piano')).toBe(false)
    expect(matchesCourseInstrument('Theoretical', 'Saxophone')).toBe(false)
  })
  it('never expands a teacher specialty list into course classifications', () => {
    const teacherSpecialties = 'Saxophone, Piano, Ewi ,Theoretical'
    expect(courseInstrumentClassifications(teacherSpecialties)).toEqual([])
    expect(selectedCourseInstrument(teacherSpecialties)).toBe(null)
    expect(matchesCourseInstrument(teacherSpecialties, 'Piano')).toBe(false)
  })
  it('normalizes one translated selection and rejects automatic assignment', () => {
    expect(selectedCourseInstrument('Teórico')).toBe('Theoretical')
    expect(selectedCourseInstrument('Práctico')).toBe('Practical')
    expect(selectedCourseInstrument('Piano')).toBe('Piano')
    expect(selectedCourseInstrument(null)).toBe(null)
    expect(selectedCourseInstrument('auto')).toBe(null)
  })
})
