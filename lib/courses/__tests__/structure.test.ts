import { describe, it, expect } from 'vitest'
import {
  moduleOverviewHref,
  classHref,
  classState,
  summarizeModule,
  toSidebarSections,
  formatDurationFromSeconds,
  videoDurationSeconds,
} from '@/lib/courses/structure'

const UUID = '0f8fad5b-d9cb-469f-a165-70867728950e'

describe('moduleOverviewHref', () => {
  it('builds the module route under the course segment as given (slug)', () => {
    expect(moduleOverviewHref('salsa-piano', 'sec-1')).toBe(
      '/dashboard/course/salsa-piano/module/sec-1'
    )
  })

  it('keeps a UUID course segment unchanged', () => {
    expect(moduleOverviewHref(UUID, 'sec-1')).toBe(`/dashboard/course/${UUID}/module/sec-1`)
  })
})

describe('classHref', () => {
  it('builds the lesson route under the course segment as given', () => {
    expect(classHref('salsa-piano', 'cls-1')).toBe('/dashboard/course/salsa-piano/class/cls-1')
  })
})

describe('classState', () => {
  const base = { id: 'cls-1', isFree: false, totalItems: 3, completedItems: 0 }

  it('is active when the class is the current one', () => {
    expect(classState(base, 'cls-1', true)).toBe('active')
  })

  it('is never active when there is no current class', () => {
    expect(classState(base, null, true)).toBe('available')
  })

  it('active wins over locked', () => {
    expect(classState(base, 'cls-1', false)).toBe('active')
  })

  it('is locked when the class is gated and the viewer has no access', () => {
    expect(classState(base, null, false)).toBe('locked')
  })

  it('a free class is not locked without access', () => {
    expect(classState({ ...base, isFree: true }, null, false)).toBe('available')
  })

  it('is completed when every item is done', () => {
    expect(classState({ ...base, completedItems: 3 }, null, true)).toBe('completed')
  })

  it('a class with no items is available, not completed', () => {
    expect(classState({ ...base, totalItems: 0, completedItems: 0 }, null, true)).toBe('available')
  })
})

describe('summarizeModule', () => {
  const video = (seconds: number | null) => ({ item_type: 'VIDEO', video_duration_seconds: seconds })
  const quiz = () => ({ item_type: 'QUIZ', video_duration_seconds: null })

  it('returns zeros and no next class for an empty module', () => {
    expect(summarizeModule({ classes: [] })).toEqual({
      lessonCount: 0,
      totalItems: 0,
      completedItems: 0,
      pct: 0,
      complete: false,
      durationSeconds: 0,
      nextClassId: null,
    })
  })

  it('counts lessons and items and rounds the percentage', () => {
    const summary = summarizeModule({
      classes: [
        { id: 'a', totalItems: 2, completedItems: 2, items: [] },
        { id: 'b', totalItems: 1, completedItems: 0, items: [] },
      ],
    })
    expect(summary.lessonCount).toBe(2)
    expect(summary.totalItems).toBe(3)
    expect(summary.completedItems).toBe(2)
    expect(summary.pct).toBe(67)
    expect(summary.complete).toBe(false)
  })

  it('is complete only when every item is done and there is at least one item', () => {
    expect(
      summarizeModule({ classes: [{ id: 'a', totalItems: 2, completedItems: 2, items: [] }] }).complete
    ).toBe(true)
    expect(
      summarizeModule({ classes: [{ id: 'a', totalItems: 0, completedItems: 0, items: [] }] }).complete
    ).toBe(false)
  })

  it('sums video durations only', () => {
    const summary = summarizeModule({
      classes: [
        { id: 'a', totalItems: 3, completedItems: 0, items: [video(120), quiz(), video(null)] },
        { id: 'b', totalItems: 1, completedItems: 0, items: [video(60)] },
      ],
    })
    expect(summary.durationSeconds).toBe(180)
  })

  it('points the next class at the first lesson with unfinished items', () => {
    const summary = summarizeModule({
      classes: [
        { id: 'a', totalItems: 2, completedItems: 2, items: [] },
        { id: 'b', totalItems: 2, completedItems: 1, items: [] },
        { id: 'c', totalItems: 2, completedItems: 0, items: [] },
      ],
    })
    expect(summary.nextClassId).toBe('b')
  })

  it('skips lessons with no items when picking the next class', () => {
    const summary = summarizeModule({
      classes: [
        { id: 'empty', totalItems: 0, completedItems: 0, items: [] },
        { id: 'b', totalItems: 1, completedItems: 0, items: [] },
      ],
    })
    expect(summary.nextClassId).toBe('b')
  })

  it('has no next class when the module is complete', () => {
    const summary = summarizeModule({
      classes: [{ id: 'a', totalItems: 1, completedItems: 1, items: [] }],
    })
    expect(summary.nextClassId).toBeNull()
  })
})

describe('toSidebarSections', () => {
  it('maps the enriched structure to the sidebar shape', () => {
    const result = toSidebarSections([
      {
        id: 'sec-1',
        title: 'Clave',
        description: 'All about clave',
        totalItems: 4,
        completedItems: 1,
        classes: [
          { id: 'cls-1', title: 'Son clave', totalItems: 2, completedItems: 1, is_free: true },
          { id: 'cls-2', title: 'Rumba clave', totalItems: 2, completedItems: 0, is_free: null },
        ],
      },
    ])
    expect(result).toEqual([
      {
        id: 'sec-1',
        title: 'Clave',
        description: 'All about clave',
        totalItems: 4,
        completedItems: 1,
        classes: [
          { id: 'cls-1', title: 'Son clave', totalItems: 2, completedItems: 1, isFree: true },
          { id: 'cls-2', title: 'Rumba clave', totalItems: 2, completedItems: 0, isFree: false },
        ],
      },
    ])
  })

  it('defaults a missing description to null', () => {
    const [section] = toSidebarSections([
      { id: 'sec-1', title: 'Clave', totalItems: 0, completedItems: 0, classes: [] },
    ])
    expect(section.description).toBeNull()
  })
})

describe('formatDurationFromSeconds', () => {
  it('formats zero as 0m', () => {
    expect(formatDurationFromSeconds(0)).toBe('0m')
  })

  it('rounds to the nearest minute', () => {
    expect(formatDurationFromSeconds(90)).toBe('2m')
    expect(formatDurationFromSeconds(45 * 60)).toBe('45m')
  })

  it('formats whole hours without minutes', () => {
    expect(formatDurationFromSeconds(3600)).toBe('1h')
  })

  it('formats hours and minutes', () => {
    expect(formatDurationFromSeconds(5400)).toBe('1h 30m')
  })
})

describe('videoDurationSeconds', () => {
  it('sums only VIDEO items with a duration', () => {
    expect(
      videoDurationSeconds([
        { item_type: 'VIDEO', video_duration_seconds: 30 },
        { item_type: 'QUIZ', video_duration_seconds: 99 },
        { item_type: 'VIDEO', video_duration_seconds: null },
        { item_type: 'VIDEO', video_duration_seconds: 15 },
      ])
    ).toBe(45)
  })

  it('returns 0 for no items', () => {
    expect(videoDurationSeconds([])).toBe(0)
    expect(videoDurationSeconds(undefined)).toBe(0)
  })
})
