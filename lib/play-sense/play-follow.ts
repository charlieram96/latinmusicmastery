// The student play-along follows the exercise engine clock (Studio rework P5).
// Engine time e is seconds from bar 1 of the grid (negative during the
// count-in); the media shows bar 1 at `bar1` seconds. Pure: the game's rAF loop
// asks where the video should be and how fast it should run, then applies it.

export interface PlayMedia { bar1: number; trimIn: number; trimOut: number | null; countInSeconds: number; preroll: boolean; loopSeconds: number }

/** Beyond this much drift the element hard-seeks instead of rate-trimming. */
const SEEK_DRIFT_SECONDS = 0.5
/** Rate correction per second of drift, and its bounds (±3 %). */
const RATE_GAIN = 0.5
const MIN_TRIM = 0.97
const MAX_TRIM = 1.03

/** Media time the video should show at engine time e (e < 0 during the count-in). null = hold paused. */
export function expectedMediaTime(m: PlayMedia, e: number): { media: number; playing: boolean } {
  if (e < 0) {
    // Without pre-roll the video waits on bar 1 until the count-in ends.
    if (!m.preroll) return { media: m.bar1, playing: false }
    // With pre-roll it runs from bar 1 − count-in, but never before trim-in:
    // when the clamp cuts some pre-roll off, it holds there and starts late,
    // once the clock reaches the clamped point. Before the count-in starts
    // (the preview's demo clock runs longer) it holds at its first frame.
    const from = Math.max(m.trimIn, m.bar1 - m.countInSeconds)
    const at = m.bar1 + e
    return at >= from ? { media: at, playing: true } : { media: from, playing: false }
  }
  const within = m.loopSeconds > 0 ? e % m.loopSeconds : e
  let media = Math.max(m.bar1 + within, m.trimIn)
  if (m.trimOut !== null) media = Math.min(media, m.trimOut)
  return { media, playing: true }
}

/** Rate for the element: userSpeed × clamp(1 + (expected − actual) × 0.5, 0.97, 1.03); returns { rate, seekTo } where seekTo is set when |drift| > 0.5 s. */
export function followRate(expected: number, actual: number, userSpeed: number): { rate: number; seekTo: number | null } {
  const drift = expected - actual
  // A hard seek lands on the expected time, so there is nothing left to trim:
  // run at the plain speed (no rate spike across a loop wrap).
  if (Math.abs(drift) > SEEK_DRIFT_SECONDS) return { rate: userSpeed, seekTo: expected }
  const trim = Math.min(MAX_TRIM, Math.max(MIN_TRIM, 1 + drift * RATE_GAIN))
  return { rate: userSpeed * trim, seekTo: null }
}
