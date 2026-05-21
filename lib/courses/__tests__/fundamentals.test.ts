import { describe, it, expect } from 'vitest'
import { validateCourseKind } from '@/lib/courses/fundamentals'

describe('validateCourseKind', () => {
  it('accepts a genre course with a style', () => {
    expect(
      validateCourseKind({ isFundamentals: false, musicalStyleId: 'style-1', instrument: 'Piano' })
    ).toEqual({ ok: true })
  })

  it('rejects a genre course without a style', () => {
    expect(
      validateCourseKind({ isFundamentals: false, musicalStyleId: null, instrument: 'Piano' })
    ).toEqual({ ok: false, error: 'A genre course must have a musical style.' })
  })

  it('accepts a fundamentals course with an instrument and no style', () => {
    expect(
      validateCourseKind({ isFundamentals: true, musicalStyleId: null, instrument: 'Piano' })
    ).toEqual({ ok: true })
  })

  it('rejects a fundamentals course that has a style', () => {
    expect(
      validateCourseKind({ isFundamentals: true, musicalStyleId: 'style-1', instrument: 'Piano' })
    ).toEqual({ ok: false, error: 'A fundamentals course cannot have a genre.' })
  })

  it('rejects a fundamentals course without an instrument', () => {
    expect(
      validateCourseKind({ isFundamentals: true, musicalStyleId: null, instrument: null })
    ).toEqual({ ok: false, error: 'A fundamentals course must have an instrument.' })
  })
})
