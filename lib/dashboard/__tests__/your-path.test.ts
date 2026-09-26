import { describe, expect, it } from 'vitest'
import { yourPathFor, type YourPathSectionRow } from '../your-path'

/** A class with `n` video items; ids are `${id}-i${k}`. */
const cls = (id: string, order: number, n = 2, type = 'VIDEO') => ({
  id,
  title: `Title ${id}`,
  order_index: order,
  items: Array.from({ length: n }, (_, k) => ({ id: `${id}-i${k}`, order_index: k, item_type: type, video_duration_seconds: 300 })),
})
const section = (id: string, order: number, classes: ReturnType<typeof cls>[]): YourPathSectionRow => ({
  id,
  title: `Module ${id}`,
  order_index: order,
  classes,
})
const doneAll = (...classIds: string[]) => new Set(classIds.flatMap((c) => [`${c}-i0`, `${c}-i1`]))

// Module A: a1..a10, module B: b1..b3
const A = Array.from({ length: 10 }, (_, i) => cls(`a${i + 1}`, i))
const B = Array.from({ length: 3 }, (_, i) => cls(`b${i + 1}`, i))
const course = { id: 'c1', slug: 'son-timbal', course_sections: [section('A', 0, A), section('B', 1, B)] }

const ids = (items: { kind: string; id: string }[]) => items.map((i) => (i.kind === 'gap' ? 'gap' : i.id))

describe('yourPathFor', () => {
  it('slices 2 done + current + 3 next, then a gap and the module checkpoint', () => {
    const path = yourPathFor(course, doneAll('a1', 'a2', 'a3', 'a4'), 'a5')!
    expect(ids(path.items)).toEqual(['a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'gap', 'checkpoint-A'])
    expect(path.items.find((i) => i.kind === 'gap')).toMatchObject({ count: 2 })
    expect(path.moduleNumber).toBe(1)
    expect(path.moduleTitle).toBe('Module A')
    expect(path.courseHref).toBe('/dashboard/course/son-timbal')
  })

  it('phones keep 5 slots and still hint skipped lessons: 1 before, current, 1 after, gap, checkpoint', () => {
    const path = yourPathFor(course, doneAll('a1', 'a2', 'a3', 'a4'), 'a5')!
    expect(ids(path.phoneItems)).toEqual(['a4', 'a5', 'a6', 'gap', 'checkpoint-A'])
    expect(path.phoneItems.find((i) => i.kind === 'gap')).toMatchObject({ count: 4 })
  })

  it('phones show 2 after the current lesson when nothing is skipped', () => {
    const path = yourPathFor(course, doneAll('a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'), 'a8')!
    expect(ids(path.phoneItems)).toEqual(['a7', 'a8', 'a9', 'a10', 'checkpoint-A'])
  })

  it('names the module that holds the current lesson', () => {
    const done = doneAll(...A.map((c) => c.id), 'b1')
    const path = yourPathFor(course, done, 'b2')!
    expect(path.moduleNumber).toBe(2)
    expect(path.moduleTitle).toBe('Module B')
    expect(path.items[path.items.length - 1]).toMatchObject({ kind: 'checkpoint', id: 'checkpoint-B' })
  })

  it('orders sections and classes by order_index', () => {
    const shuffled = {
      ...course,
      course_sections: [section('B', 1, [...B].reverse()), section('A', 0, [...A].reverse())],
    }
    const path = yourPathFor(shuffled, new Set(), null)!
    expect(ids(path.items).slice(0, 4)).toEqual(['a1', 'a2', 'a3', 'a4'])
    expect(path.items[0]).toMatchObject({ state: 'current', number: 1 })
    expect(path.moduleTitle).toBe('Module A')
  })

  it('finished course anchors on the last lesson with nothing current', () => {
    const path = yourPathFor(course, doneAll(...A.map((c) => c.id), ...B.map((c) => c.id)), 'b3')!
    expect(path.items.some((i) => i.kind !== 'gap' && i.state === 'current')).toBe(false)
    expect(ids(path.items)).toEqual(['b1', 'b2', 'b3', 'checkpoint-B'])
    expect(path.moduleNumber).toBe(2)
  })

  it('returns null for a course without lessons', () => {
    expect(yourPathFor({ id: 'c', slug: null, course_sections: [section('A', 0, [])] }, new Set(), null)).toBeNull()
    expect(yourPathFor({ id: 'c', slug: null, course_sections: null }, new Set(), null)).toBeNull()
  })

  it('carries lesson types and falls back to the id for hrefs', () => {
    const c = { id: 'c9', slug: null, course_sections: [section('A', 0, [cls('x', 0, 1, 'EXERCISE')])] }
    const path = yourPathFor(c, new Set(), 'x')!
    expect(path.items[0]).toMatchObject({ kind: 'lesson', types: ['play'], href: '/dashboard/course/c9/class/x', minutes: null })
    expect(path.courseHref).toBe('/dashboard/course/c9')
  })
  it('keeps 5 phone slots when the current lesson is the first one and a gap follows', () => {
    const path = yourPathFor(course, new Set(), null)!
    // nothing before a1, so the wide phone slice (a1, a2, a3, gap, checkpoint) already fits
    expect(ids(path.phoneItems)).toEqual(['a1', 'a2', 'a3', 'gap', 'checkpoint-A'])
  })
})
