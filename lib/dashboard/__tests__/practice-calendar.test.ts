import { describe, expect, it } from 'vitest'
import { buildPracticeCalendar, levelFor } from '../practice-calendar'

// 2026-09-05 is a Saturday, so the current Sun–Sat week is Aug 30 – Sep 5.
const TODAY = '2026-09-05'

describe('levelFor', () => {
  it('buckets counts into four levels', () => {
    expect(levelFor(0)).toBe(0)
    expect(levelFor(1)).toBe(1)
    expect(levelFor(2)).toBe(2)
    expect(levelFor(3)).toBe(3)
    expect(levelFor(9)).toBe(3)
  })
})

describe('buildPracticeCalendar', () => {
  it('produces weeks*7 cells ending on the Saturday of the current week', () => {
    const { cells } = buildPracticeCalendar([], TODAY, 5)
    expect(cells).toHaveLength(35)
    expect(cells[0].key).toBe('2026-08-02')
    expect(cells[34].key).toBe('2026-09-05')
  })

  it('ends on Saturday even when today is midweek, and marks future days', () => {
    // 2026-09-02 is a Wednesday.
    const { cells } = buildPracticeCalendar([], '2026-09-02', 5)
    expect(cells[34].key).toBe('2026-09-05')
    expect(cells[31].isToday).toBe(true) // Wed
    expect(cells[32].inFuture).toBe(true) // Thu
    expect(cells[34].inFuture).toBe(true) // Sat
    expect(cells[30].inFuture).toBe(false) // Tue
  })

  it('counts completions per day and assigns levels', () => {
    const keys = ['2026-09-01', '2026-09-01', '2026-09-03', '2026-09-03', '2026-09-03', '2026-08-15']
    const { cells } = buildPracticeCalendar(keys, TODAY, 5)
    const byKey = Object.fromEntries(cells.map((c) => [c.key, c]))
    expect(byKey['2026-09-01'].count).toBe(2)
    expect(byKey['2026-09-01'].level).toBe(2)
    expect(byKey['2026-09-03'].count).toBe(3)
    expect(byKey['2026-09-03'].level).toBe(3)
    expect(byKey['2026-08-15'].level).toBe(1)
    expect(byKey['2026-09-02'].count).toBe(0)
    expect(byKey['2026-09-02'].level).toBe(0)
  })

  it('flags today exactly once', () => {
    const { cells } = buildPracticeCalendar([], TODAY, 5)
    expect(cells.filter((c) => c.isToday).map((c) => c.key)).toEqual([TODAY])
  })

  it('ignores completions outside the window', () => {
    const { cells } = buildPracticeCalendar(['2026-07-01', '2026-10-01'], TODAY, 5)
    expect(cells.every((c) => c.count === 0)).toBe(true)
  })

  it('counts this week’s completions for the weekly goal', () => {
    const keys = ['2026-08-30', '2026-09-01', '2026-09-01', '2026-09-04', '2026-08-29']
    const { weekDoneCount } = buildPracticeCalendar(keys, TODAY, 5)
    expect(weekDoneCount).toBe(4) // Aug 29 is the previous week
  })
})
