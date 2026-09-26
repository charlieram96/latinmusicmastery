import { describe, expect, it } from 'vitest'
import { celebrationStats } from '../lesson-celebration'

// 2026-09-25 is a Friday; the week (Sunday first) started 2026-09-20.
const today = '2026-09-25'

describe('celebrationStats', () => {
  it('extends a streak that ended yesterday with today’s first completion', () => {
    const s = celebrationStats(['2026-09-23', '2026-09-24'], today, 1)
    expect(s.streak).toEqual({ before: 2, after: 3 })
  })

  it('keeps the streak when the student already practiced today', () => {
    const s = celebrationStats(['2026-09-24', '2026-09-25'], today, 2)
    expect(s.streak).toEqual({ before: 2, after: 2 })
  })

  it('counts today as extended by this lesson when its only practice today came from this lesson (L8)', () => {
    // An earlier part of this lesson was saved today and is already in the server's keys.
    const s = celebrationStats(['2026-09-24', '2026-09-25'], today, 1, 1)
    expect(s.streak).toEqual({ before: 1, after: 2 })
    expect(s.week).toEqual({ before: 1, after: 3, goal: 6 })
    expect(s.milestones[0]).toMatchObject({ before: 1, after: 3 })
  })

  it('keeps the streak flat when other practice today came before this lesson (L8)', () => {
    const s = celebrationStats(['2026-09-24', '2026-09-25', '2026-09-25'], today, 1, 1)
    expect(s.streak).toEqual({ before: 2, after: 2 })
  })

  it('starts a new streak after a gap', () => {
    expect(celebrationStats(['2026-09-01'], today, 1).streak).toEqual({ before: 0, after: 1 })
  })

  it('counts lessons this week against the goal, like the dashboard card', () => {
    const s = celebrationStats(['2026-09-19', '2026-09-21', '2026-09-22', '2026-09-22'], today, 1)
    expect(s.week).toEqual({ before: 3, after: 4, goal: 6 })
  })

  it('reports the true count past the goal', () => {
    const keys = Array.from({ length: 6 }, () => '2026-09-21')
    expect(celebrationStats(keys, today, 2).week).toEqual({ before: 6, after: 8, goal: 6 })
  })

  it('picks the next unmet lessons and streak milestones', () => {
    const keys = [...Array.from({ length: 23 }, () => '2026-08-01'), '2026-09-24']
    const s = celebrationStats(keys, today, 1)
    expect(s.milestones.map(m => [m.key, m.before, m.after, m.requirement, m.unit])).toEqual([
      ['lessons_25', 24, 25, 25, 'lessons'],
      ['streak_3', 1, 2, 3, 'days'],
    ])
    expect(s.milestones[0].title).toBe('Rising Star')
  })

  it('drops a category once every milestone in it is met', () => {
    const keys = Array.from({ length: 120 }, () => '2026-08-01')
    expect(celebrationStats(keys, today, 1).milestones.map(m => m.key)).toEqual(['streak_3'])
  })
})
