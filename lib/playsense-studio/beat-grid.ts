// PlaySense Studio — beat grids in MEDIA time (pure, no DOM).
//
// A section's click track is defined by ONE anchor (a video second known to
// land on a beat) plus the section score's tempo. That pair defines an infinite
// beat grid; this module materialises the part of it you need.
//
// Two rules carry the whole design:
//
//   1. Beat positions live in MEDIA time and are derived from the UNROUNDED
//      score tempo. Playback rate belongs in the media -> AudioContext
//      conversion and nowhere else -- the same discipline clip-schedule.ts
//      states for clips. (chronometer-control computes a ROUNDED
//      `baseBpm * playbackRate`, which is fine for a free-running click and
//      poison for a phase-locked one.)
//
//   2. Every beat is `anchor + k * period`, never `previous + period`.
//      Accumulation both drifts and, more importantly, cannot be recomputed
//      from state -- which is exactly what re-anchoring after a seek needs.

/** Float slack for landing exactly on a beat boundary. */
const EPS = 1e-9;

/** Beats closer together than this are the same beat (abutting sections). */
const DEFAULT_MIN_GAP_SECONDS = 0.05;

/**
 * Beat media-times in the inclusive window [fromSeconds, toSeconds].
 *
 * The anchor may sit anywhere — before, inside, or after the window, and may be
 * negative. The grid extends infinitely in both directions, so `k` is signed
 * and back-extrapolation is not a special case.
 *
 * Returns [] rather than throwing for unusable input; a click that goes quiet
 * is recoverable, one that throws inside a scheduler tick is not.
 */
export function beatGridFromAnchor(
  anchorSeconds: number,
  bpm: number,
  fromSeconds: number,
  toSeconds: number
): number[] {
  if (!Number.isFinite(anchorSeconds) || !Number.isFinite(bpm) || bpm <= 0) return [];
  if (!Number.isFinite(fromSeconds) || !Number.isFinite(toSeconds)) return [];
  if (toSeconds < fromSeconds) return [];

  const period = 60 / bpm;
  if (!Number.isFinite(period) || period <= 0) return [];

  // Signed indices. Never `%`: JS modulo keeps the sign of the dividend, so a
  // negative anchor would land a beat off.
  const first = Math.ceil((fromSeconds - anchorSeconds) / period - EPS);
  const last = Math.floor((toSeconds - anchorSeconds) / period + EPS);
  if (last < first) return [];

  const out: number[] = [];
  for (let k = first; k <= last; k++) out.push(anchorSeconds + k * period);
  return out;
}

/**
 * One sorted, de-duplicated grid for a whole video.
 *
 * Merging up front means the scheduler never hears the word "section": its only
 * state is an index into a monotone array. Crossing a boundary stops being an
 * event, and gaps simply contain no beats. It also removes the flam where two
 * sections abut — section N's final downbeat and section N+1's first beat are
 * the same instant, since both are derived from the same waypoints.
 */
export function mergeBeatGrids(
  grids: readonly (readonly number[])[],
  minGapSeconds: number = DEFAULT_MIN_GAP_SECONDS
): number[] {
  const all: number[] = [];
  for (const grid of grids) {
    for (const t of grid) if (Number.isFinite(t)) all.push(t);
  }
  all.sort((a, b) => a - b);

  const out: number[] = [];
  for (const t of all) {
    if (out.length === 0 || t - out[out.length - 1] > minGapSeconds) out.push(t);
  }
  return out;
}

/**
 * Index of the first beat at or after `seconds` — a lower bound, so the
 * scheduler can resume after a seek without scanning. Returns `grid.length`
 * when every beat is in the past.
 */
export function firstIndexAtOrAfter(grid: readonly number[], seconds: number): number {
  let lo = 0;
  let hi = grid.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (grid[mid] < seconds - EPS) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
