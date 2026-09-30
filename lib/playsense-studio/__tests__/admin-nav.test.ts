import { describe, expect, it } from 'vitest'
import { adminStudioBackHref } from '../admin-nav'

describe('adminStudioBackHref', () => {
  it('returns the course overview page when only the course is known', () => {
    expect(adminStudioBackHref('abc-123')).toBe('/admin/courses/abc-123')
    expect(adminStudioBackHref({ courseId: 'abc-123' })).toBe('/admin/courses/abc-123')
  })
  it('opens the owning lesson and selects the item when both are known', () => {
    expect(adminStudioBackHref({ courseId: 'c1', classId: 'cls-9', itemId: 'it-4' })).toBe(
      '/admin/courses/c1?class=cls-9&item=it-4'
    )
  })
  it('opens the lesson without an item selection when the item is unknown', () => {
    expect(adminStudioBackHref({ courseId: 'c1', classId: 'cls-9' })).toBe(
      '/admin/courses/c1?class=cls-9'
    )
  })
  it('ignores an item id when the lesson is unknown', () => {
    expect(adminStudioBackHref({ courseId: 'c1', itemId: 'it-4' })).toBe('/admin/courses/c1')
  })
  it('falls back to the courses list when the course is unknown', () => {
    expect(adminStudioBackHref(null)).toBe('/admin/courses')
    expect(adminStudioBackHref(undefined)).toBe('/admin/courses')
    expect(adminStudioBackHref('')).toBe('/admin/courses')
    expect(adminStudioBackHref({ courseId: null, classId: 'cls-9', itemId: 'it-4' })).toBe('/admin/courses')
  })
})

it('links to the exact published student item without preview flags', async () => {
  const { studentHrefFromAdmin } = await import('../admin-nav')
  expect(studentHrefFromAdmin('/admin/courses/course?class=lesson&item=exercise')).toBe('/dashboard/course/course/class/lesson?itemId=exercise')
  expect(studentHrefFromAdmin('/admin/courses')).toBeUndefined()
  expect(studentHrefFromAdmin(undefined)).toBeUndefined()
})
