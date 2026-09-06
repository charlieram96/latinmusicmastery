import { toLocalDateKey } from './streak'

/**
 * Calendar days for streaks and the practice calendar are computed on the
 * server, which does not know the learner's time zone. Most learners are in
 * the eastern Americas, so that is the default; override with
 * NEXT_PUBLIC_DASHBOARD_TZ. A per-user setting can replace this later.
 */
export const DASHBOARD_TIME_ZONE = process.env.NEXT_PUBLIC_DASHBOARD_TZ || 'America/New_York'

export function dateKeyFor(iso: string): string {
  return toLocalDateKey(iso, DASHBOARD_TIME_ZONE)
}

export function todayKey(now: Date = new Date()): string {
  return toLocalDateKey(now.toISOString(), DASHBOARD_TIME_ZONE)
}
