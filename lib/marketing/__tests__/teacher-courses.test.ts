import { describe, expect, it } from 'vitest'
import { isUuid, mergeTeacherCourses } from '../teacher-courses'

describe('isUuid', () => {
  it('accepts canonical uuids in any case', () => {
    expect(isUuid('280c5395-bddd-42de-84ca-a6d304f6eb7e')).toBe(true)
    expect(isUuid('280C5395-BDDD-42DE-84CA-A6D304F6EB7E')).toBe(true)
  })
  it('rejects everything else', () => {
    for (const v of ['', 'patricio', '280c5395bddd42de84caa6d304f6eb7e', '280c5395-bddd-42de-84ca-a6d304f6eb7e ', "x' or 1=1"]) expect(isUuid(v)).toBe(false)
  })
})

describe('mergeTeacherCourses', () => {
  it('dedupes by id and sorts by order_index then title', () => {
    const a = [{ id: '1', order_index: 3, title: 'C' }, { id: '2', order_index: 1, title: 'B' }]
    const b = [{ id: '2', order_index: 1, title: 'B' }, { id: '3', order_index: 1, title: 'A' }, { id: '4', order_index: null, title: 'Z' }]
    expect(mergeTeacherCourses(a, b).map(c => c.id)).toEqual(['3', '2', '1', '4'])
  })
  it('tolerates null inputs', () => {
    expect(mergeTeacherCourses(null, undefined)).toEqual([])
  })
})
