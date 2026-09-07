import { describe, expect, it } from 'vitest'
import { computeStreaks, toLocalDateKey } from '../streak'

describe('toLocalDateKey', () => {
  it('formats an ISO timestamp as YYYY-MM-DD in the given time zone', () => {
    expect(toLocalDateKey('2026-09-05T23:30:00.000Z', 'UTC')).toBe('2026-09-05')
    // 23:30Z on the 5th is already the 6th in Madrid (UTC+2 in September).
    expect(toLocalDateKey('2026-09-05T23:30:00.000Z', 'Europe/Madrid')).toBe('2026-09-06')
    // and still the 5th in New York (UTC-4).
    expect(toLocalDateKey('2026-09-05T23:30:00.000Z', 'America/New_York')).toBe('2026-09-05')
  })
})

describe('computeStreaks', () => {
  it('returns zeros when there is no activity', () => {
    expect(computeStreaks([], '2026-09-05')).toEqual({ current: 0, best: 0 })
  })

  it('counts consecutive days ending today', () => {
    const keys = ['2026-09-05', '2026-09-04', '2026-09-03']
    expect(computeStreaks(keys, '2026-09-05')).toEqual({ current: 3, best: 3 })
  })

  it('keeps the streak alive when the last practice was yesterday', () => {
    const keys = ['2026-09-04', '2026-09-03']
    expect(computeStreaks(keys, '2026-09-05')).toEqual({ current: 2, best: 2 })
  })

  it('breaks the current streak after a gap of two days but keeps the best', () => {
    const keys = ['2026-09-02', '2026-09-01', '2026-08-31', '2026-08-30']
    expect(computeStreaks(keys, '2026-09-05')).toEqual({ current: 0, best: 4 })
  })

  it('collapses duplicate days and unsorted input', () => {
    const keys = ['2026-09-05', '2026-09-05', '2026-09-03', '2026-09-04', '2026-09-04']
    expect(computeStreaks(keys, '2026-09-05')).toEqual({ current: 3, best: 3 })
  })

  it('finds the best run anywhere in history', () => {
    const keys = [
      '2026-09-05',
      // gap
      '2026-08-20', '2026-08-19', '2026-08-18', '2026-08-17', '2026-08-16',
      // gap
      '2026-08-01',
    ]
    expect(computeStreaks(keys, '2026-09-05')).toEqual({ current: 1, best: 5 })
  })

  it('handles month boundaries', () => {
    const keys = ['2026-09-01', '2026-08-31', '2026-08-30']
    expect(computeStreaks(keys, '2026-09-01')).toEqual({ current: 3, best: 3 })
  })
})
