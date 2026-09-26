import { describe, expect, it } from 'vitest'
import { railLessons } from '../lesson-rail'

const cls = (id: string, done: number, total: number, extra: Partial<{ is_free: boolean; items: { item_type: string; video_duration_seconds: number | null }[] }> = {}) =>
  ({ id, title: `Lesson ${id}`, totalItems: total, completedItems: done, is_free: false, items: [{ item_type: 'VIDEO', video_duration_seconds: 480 }], ...extra })
const sections = [
  { id: 'm1', title: 'Welcome', classes: [cls('a', 1, 1)] },
  { id: 'm2', title: 'Montuno', classes: [cls('b', 1, 1), cls('c', 0, 2, { items: [{ item_type: 'EXERCISE', video_duration_seconds: null }] }), cls('d', 0, 1, { is_free: true })] },
]

describe('railLessons', () => {
  it('lists only the current lesson’s module, with states, kinds and minutes', () => {
    const { lessons, moduleIndex } = railLessons('course', sections, 'c', true)
    expect(moduleIndex).toBe(1)
    expect(lessons.map(l => [l.id, l.state, l.kind, l.minutes, l.number])).toEqual([
      ['b', 'done', 'video', 8, 1], ['c', 'current', 'play', null, 2], ['d', 'upcoming', 'video', 8, 3],
    ])
    expect(lessons[1].href).toBe('/dashboard/course/course/class/c')
  })

  it('marks lessons behind the paywall for students without access, except free ones', () => {
    const { lessons } = railLessons('course', sections, 'c', false)
    expect(lessons.map(l => l.paywalled)).toEqual([true, true, false])
  })

  it('returns nothing for a lesson that is not in the course', () => {
    expect(railLessons('course', sections, 'zzz', true)).toEqual({ lessons: [], moduleIndex: -1 })
  })
})
