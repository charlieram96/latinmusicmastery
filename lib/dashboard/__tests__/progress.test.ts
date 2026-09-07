import { describe, expect, it } from 'vitest'
import { byCourse, splitMinutes, weekStartKey, weeklyBuckets } from '../progress'

describe('weekStartKey', () => {
  it('returns the Sunday of the week', () => {
    expect(weekStartKey('2026-09-05')).toBe('2026-08-30') // Saturday → previous Sunday
    expect(weekStartKey('2026-08-30')).toBe('2026-08-30') // Sunday stays
    expect(weekStartKey('2026-09-02')).toBe('2026-08-30') // Wednesday
  })
})

describe('weeklyBuckets', () => {
  it('builds Sunday-to-Saturday buckets ending with the current week', () => {
    const buckets = weeklyBuckets([], '2026-09-05', 3)
    expect(buckets.map((b) => [b.start, b.end])).toEqual([
      ['2026-08-16', '2026-08-22'],
      ['2026-08-23', '2026-08-29'],
      ['2026-08-30', '2026-09-05'],
    ])
    expect(buckets.map((b) => b.isCurrent)).toEqual([false, false, true])
  })

  it('sums minutes and counts per week, ignoring entries outside the range', () => {
    const entries = [
      { dateKey: '2026-09-01', minutes: 12.4 },
      { dateKey: '2026-09-04', minutes: 7.3 },
      { dateKey: '2026-08-24', minutes: 30 },
      { dateKey: '2026-01-01', minutes: 999 },
      { dateKey: '2026-09-20', minutes: 999 },
    ]
    const [old, prev, cur] = weeklyBuckets(entries, '2026-09-05', 3)
    expect(old).toMatchObject({ minutes: 0, count: 0 })
    expect(prev).toMatchObject({ minutes: 30, count: 1 })
    expect(cur).toMatchObject({ minutes: 20, count: 2 })
  })
})

describe('byCourse', () => {
  it('rolls completed items and minutes up per course, most recent first', () => {
    const rows = [
      { courseId: 'a', title: 'Alpha', slug: 'alpha', completed: true, minutes: 10, dateKey: '2026-09-01' },
      { courseId: 'a', title: 'Alpha', slug: 'alpha', completed: false, minutes: 99, dateKey: '2026-09-03' },
      { courseId: 'b', title: 'Beta', slug: null, completed: true, minutes: 5.4, dateKey: '2026-09-04' },
    ]
    expect(byCourse(rows)).toEqual([
      { id: 'b', title: 'Beta', href: '/dashboard/course/b', completed: 1, minutes: 5, lastKey: '2026-09-04' },
      { id: 'a', title: 'Alpha', href: '/dashboard/course/alpha', completed: 1, minutes: 10, lastKey: '2026-09-03' },
    ])
  })
})

describe('splitMinutes', () => {
  it('splits into hours and minutes', () => {
    expect(splitMinutes(75)).toEqual({ h: 1, m: 15 })
    expect(splitMinutes(40)).toEqual({ h: 0, m: 40 })
    expect(splitMinutes(0)).toEqual({ h: 0, m: 0 })
    expect(splitMinutes(119.6)).toEqual({ h: 2, m: 0 })
  })
})
