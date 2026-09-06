/**
 * Streak math over calendar-day keys ("YYYY-MM-DD").
 * Pure: no DOM, no React. Runs under vitest's node environment.
 */

/** Formats an ISO timestamp as a YYYY-MM-DD key in the given IANA time zone. */
export function toLocalDateKey(iso: string, timeZone = 'UTC'): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** Adds `days` (may be negative) to a YYYY-MM-DD key using UTC arithmetic. */
export function shiftDateKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const t = Date.UTC(y, m - 1, d + days)
  return new Date(t).toISOString().slice(0, 10)
}

/**
 * Current streak: consecutive days ending today or yesterday (yesterday keeps the
 * streak alive so it does not reset before the learner has practiced today).
 * Best streak: the longest run of consecutive days anywhere in the history.
 */
export function computeStreaks(dateKeys: string[], todayKey: string): { current: number; best: number } {
  const unique = Array.from(new Set(dateKeys.filter(Boolean))).sort()
  if (unique.length === 0) return { current: 0, best: 0 }

  // Best run over the sorted, de-duplicated keys.
  let best = 1
  let run = 1
  for (let i = 1; i < unique.length; i++) {
    if (shiftDateKey(unique[i - 1], 1) === unique[i]) {
      run++
      best = Math.max(best, run)
    } else {
      run = 1
    }
  }

  // Current run must end today or yesterday.
  const set = new Set(unique)
  const yesterday = shiftDateKey(todayKey, -1)
  let cursor: string | null = set.has(todayKey) ? todayKey : set.has(yesterday) ? yesterday : null
  let current = 0
  while (cursor && set.has(cursor)) {
    current++
    cursor = shiftDateKey(cursor, -1)
  }

  return { current, best: Math.max(best, current) }
}
