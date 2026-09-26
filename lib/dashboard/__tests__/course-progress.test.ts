import { describe, expect, it } from 'vitest'
import {
  classHref,
  classIsDone,
  completedItemIds,
  courseCompletion,
  courseHref,
  currentClassIndexFor,
  moduleIndexForClass,
  orderedClasses,
} from '../course-progress'

const cls = (id: string, order: number, items: string[]) => ({
  id,
  title: `Lesson ${id}`,
  order_index: order,
  items: items.map((i) => ({ id: i })),
})

const sections = [
  { order_index: 2, classes: [cls('c3', 1, ['i5']), cls('c4', 2, [])] },
  { order_index: 1, classes: [cls('c2', 2, ['i3', 'i4']), cls('c1', 1, ['i1', 'i2'])] },
]

describe('orderedClasses', () => {
  it('flattens sections and classes by order_index', () => {
    expect(orderedClasses(sections).map((c) => c.id)).toEqual(['c1', 'c2', 'c3', 'c4'])
  })
  it('tolerates missing sections and classes', () => {
    expect(orderedClasses(null)).toEqual([])
    expect(orderedClasses([{ order_index: 0, classes: null }])).toEqual([])
  })
})

describe('classIsDone', () => {
  it('needs every item complete and at least one item', () => {
    const done = new Set(['i1', 'i2'])
    expect(classIsDone(cls('a', 0, ['i1', 'i2']), done)).toBe(true)
    expect(classIsDone(cls('b', 0, ['i1', 'i9']), done)).toBe(false)
    expect(classIsDone(cls('c', 0, []), done)).toBe(false)
  })
})

describe('currentClassIndexFor', () => {
  const classes = orderedClasses(sections)
  it('is null with no progress', () => {
    expect(currentClassIndexFor(classes, [], new Set())).toBeNull()
  })
  it('points at the class with the latest progress row when it is unfinished', () => {
    const progress = [
      { class_item_id: 'i1', completed: true, updated_at: '2026-09-01T10:00:00Z' },
      { class_item_id: 'i3', completed: false, updated_at: '2026-09-02T10:00:00Z' },
    ]
    expect(currentClassIndexFor(classes, progress, completedItemIds(progress))).toBe(1)
  })
  it('moves to the next unfinished class when the latest one is done', () => {
    const progress = [
      { class_item_id: 'i1', completed: true, updated_at: '2026-09-01T10:00:00Z' },
      { class_item_id: 'i2', completed: true, updated_at: '2026-09-02T10:00:00Z' },
    ]
    expect(currentClassIndexFor(classes, progress, completedItemIds(progress))).toBe(1)
  })
  it('is null when every class with items is done', () => {
    const progress = ['i1', 'i2', 'i3', 'i4', 'i5'].map((id, n) => ({
      class_item_id: id,
      completed: true,
      updated_at: `2026-09-0${n + 1}T10:00:00Z`,
    }))
    // c4 has no items yet: it never blocks (the course page's nextClassId skips it too).
    expect(currentClassIndexFor(classes, progress, completedItemIds(progress))).toBeNull()
    const withoutEmpty = classes.slice(0, 3)
    expect(currentClassIndexFor(withoutEmpty, progress, completedItemIds(progress))).toBeNull()
  })
  it('skips a lesson with no items when moving on from a finished one', () => {
    const cs = [cls('a', 0, ['a1']), cls('e', 1, []), cls('b', 2, ['b1'])]
    const progress = [{ class_item_id: 'a1', completed: true, updated_at: '2026-09-01T10:00:00Z' }]
    expect(currentClassIndexFor(cs, progress, completedItemIds(progress))).toBe(2)
  })
})

describe('moduleIndexForClass', () => {
  it('maps an ordered class index back to its 1-based section', () => {
    expect(moduleIndexForClass(sections, 0)).toBe(1)
    expect(moduleIndexForClass(sections, 1)).toBe(1)
    expect(moduleIndexForClass(sections, 2)).toBe(2)
    expect(moduleIndexForClass(sections, 9)).toBeNull()
  })
})

describe('courseCompletion', () => {
  const classes = orderedClasses(sections)
  it('reports not started with no completions', () => {
    expect(courseCompletion(classes, new Set())).toEqual({
      totalItems: 5,
      doneItems: 0,
      totalClasses: 4,
      doneClasses: 0,
      pct: 0,
      status: 'not-started',
    })
  })
  it('rounds the percentage and counts whole classes', () => {
    const result = courseCompletion(classes, new Set(['i1', 'i2', 'i3']))
    expect(result.pct).toBe(60)
    expect(result.doneClasses).toBe(1)
    expect(result.status).toBe('in-progress')
  })
  it('is completed when every item is done', () => {
    expect(courseCompletion(classes, new Set(['i1', 'i2', 'i3', 'i4', 'i5'])).status).toBe('completed')
  })
})

describe('hrefs', () => {
  it('prefers the slug and falls back to the id', () => {
    expect(courseHref({ slug: 'son-timbal', id: 'x' })).toBe('/dashboard/course/son-timbal')
    expect(courseHref({ slug: null, id: 'x' })).toBe('/dashboard/course/x')
    expect(classHref({ slug: 'son-timbal', id: 'x' }, 'c1')).toBe('/dashboard/course/son-timbal/class/c1')
  })
})
