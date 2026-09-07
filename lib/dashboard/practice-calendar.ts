import { shiftDateKey } from './streak'

/** Lessons per week the dashboard treats as the goal. */
export const WEEK_GOAL = 6

export type HeatLevel = 0 | 1 | 2 | 3

export interface CalendarCell {
  /** YYYY-MM-DD */
  key: string
  count: number
  level: HeatLevel
  isToday: boolean
  inFuture: boolean
}

export interface PracticeCalendar {
  /** `weeks * 7` cells, oldest first, Sunday-first rows, ending on the Saturday of today's week. */
  cells: CalendarCell[]
  /** Completions from Sunday of the current week through today. */
  weekDoneCount: number
}

/** 0 → nothing, 1 → one lesson, 2 → two, 3 → three or more. */
export function levelFor(count: number): HeatLevel {
  if (count <= 0) return 0
  if (count === 1) return 1
  if (count === 2) return 2
  return 3
}

/** 0 = Sunday … 6 = Saturday, computed in UTC from the key (keys are already local days). */
function weekdayOf(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/**
 * Builds a heatmap of practice days.
 * @param dateKeys one YYYY-MM-DD key per completed lesson (duplicates count).
 * @param todayKey today's YYYY-MM-DD key in the learner's time zone.
 */
export function buildPracticeCalendar(dateKeys: string[], todayKey: string, weeks = 5): PracticeCalendar {
  const counts = new Map<string, number>()
  for (const k of dateKeys) {
    if (!k) continue
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }

  const saturday = shiftDateKey(todayKey, 6 - weekdayOf(todayKey))
  const sunday = shiftDateKey(todayKey, -weekdayOf(todayKey))
  const total = weeks * 7
  const start = shiftDateKey(saturday, -(total - 1))

  const cells: CalendarCell[] = []
  for (let i = 0; i < total; i++) {
    const key = shiftDateKey(start, i)
    const count = counts.get(key) ?? 0
    cells.push({ key, count, level: levelFor(count), isToday: key === todayKey, inFuture: key > todayKey })
  }

  let weekDoneCount = 0
  for (const [key, count] of counts) {
    if (key >= sunday && key <= todayKey) weekDoneCount += count
  }

  return { cells, weekDoneCount }
}
