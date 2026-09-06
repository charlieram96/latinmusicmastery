/**
 * Pure helpers for the My Progress page: weekly practice buckets, per-course
 * roll-ups and the data contract the view renders. No DOM, no React.
 */
import { shiftDateKey } from './streak'
import type { CalendarCell } from './practice-calendar'

export interface CompletionEntry {
  /** YYYY-MM-DD local day the item was completed. */
  dateKey: string
  minutes: number
}

export interface WeekBucket {
  /** Sunday, YYYY-MM-DD. */
  start: string
  /** Saturday, YYYY-MM-DD. */
  end: string
  minutes: number
  count: number
  isCurrent: boolean
}

/** 0 = Sunday … 6 = Saturday, computed in UTC from the key (keys are already local days). */
function weekdayOf(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** The Sunday that starts the week holding `key`. */
export function weekStartKey(key: string): string {
  return shiftDateKey(key, -weekdayOf(key))
}

/**
 * Sunday-first weekly totals ending with the current week, oldest first.
 * Minutes are summed as given and rounded once per bucket.
 */
export function weeklyBuckets(entries: CompletionEntry[], todayKey: string, weeks = 12): WeekBucket[] {
  const currentStart = weekStartKey(todayKey)
  const buckets: WeekBucket[] = Array.from({ length: weeks }, (_, i) => {
    const start = shiftDateKey(currentStart, -7 * (weeks - 1 - i))
    return { start, end: shiftDateKey(start, 6), minutes: 0, count: 0, isCurrent: i === weeks - 1 }
  })
  const first = buckets[0].start
  for (const e of entries) {
    if (!e.dateKey || e.dateKey < first || e.dateKey > buckets[weeks - 1].end) continue
    const bucket = buckets.find((b) => e.dateKey >= b.start && e.dateKey <= b.end)
    if (!bucket) continue
    bucket.minutes += e.minutes
    bucket.count += 1
  }
  for (const b of buckets) b.minutes = Math.round(b.minutes)
  return buckets
}

export interface CourseActivityRow {
  courseId: string
  title: string
  slug: string | null
  completed: boolean
  minutes: number
  /** YYYY-MM-DD of the last touch, or null. */
  dateKey: string | null
}

export interface CourseBreakdown {
  id: string
  title: string
  href: string
  completed: number
  minutes: number
  lastKey: string | null
}

/** One row per course, most recently touched first, then by title. */
export function byCourse(rows: CourseActivityRow[]): CourseBreakdown[] {
  const map = new Map<string, CourseBreakdown>()
  for (const r of rows) {
    const cur = map.get(r.courseId) ?? {
      id: r.courseId,
      title: r.title,
      href: `/dashboard/course/${r.slug || r.courseId}`,
      completed: 0,
      minutes: 0,
      lastKey: null,
    }
    if (r.completed) {
      cur.completed += 1
      cur.minutes += r.minutes
    }
    if (r.dateKey && (!cur.lastKey || r.dateKey > cur.lastKey)) cur.lastKey = r.dateKey
    map.set(r.courseId, cur)
  }
  return [...map.values()]
    .map((c) => ({ ...c, minutes: Math.round(c.minutes) }))
    .sort((a, b) => (b.lastKey ?? '').localeCompare(a.lastKey ?? '') || a.title.localeCompare(b.title))
}

/** 75 → { h: 1, m: 15 }; 40 → { h: 0, m: 40 }. */
export function splitMinutes(total: number): { h: number; m: number } {
  const whole = Math.max(0, Math.round(total))
  return { h: Math.floor(whole / 60), m: whole % 60 }
}

export interface ProgressActivity {
  id: string
  title: string
  lessonTitle: string | null
  courseTitle: string | null
  href: string | null
  completed: boolean
  /** ISO timestamp of the last update. */
  at: string
}

/** Everything the My Progress view renders. */
export interface ProgressData {
  streak: number
  bestStreak: number
  completedItems: number
  startedItems: number
  totalMinutes: number
  weekMinutes: number
  /** Whole percent, or null when there are no exercise attempts. */
  accuracy: number | null
  correct: number
  attempts: number
  weeks: WeekBucket[]
  calendar: CalendarCell[]
  weekDone: number
  weekGoal: number
  courses: CourseBreakdown[]
  recent: ProgressActivity[]
}
