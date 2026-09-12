import { describe, expect, it } from 'vitest'
import { adminStudioBackHref } from '../admin-nav'

describe('adminStudioBackHref', () => {
  it('returns the course overview page when the class item belongs to a course', () => {
    expect(adminStudioBackHref('abc-123')).toBe('/admin/courses/abc-123')
  })
  it('falls back to the courses list when the course is unknown', () => {
    expect(adminStudioBackHref(null)).toBe('/admin/courses')
    expect(adminStudioBackHref(undefined)).toBe('/admin/courses')
    expect(adminStudioBackHref('')).toBe('/admin/courses')
  })
})
