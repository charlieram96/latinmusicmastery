// PlaySense Studio — moving a metronome anchor with the music.
//
// A section's anchor is stored twice: the video second that PLAYS, and the
// musical position it MEANT. When an admin re-drags the sync and republishes,
// the seconds are recomputed from the musical position so the click stays glued
// to the notation instead of silently sliding against it.
//
// Why this is write-time rather than read-time (unlike 040's backing-track
// placement): publishTimeMap DELETES the superseded map and its waypoints, so
// by the time anything reads, the old map is gone and there is nothing left to
// compare against. The rebase has to happen during the publish, before the
// delete.
//
// Deliberately NOT WaypointTimeMap: that class requires >= 2 waypoints and
// THROWS otherwise. Nothing here may ever be able to fail a publish, so every
// function returns null instead.

export interface AnchorWaypoint {
  musicalPositionQN: number;
  videoTimeSeconds: number;
}

export interface StoredAnchor {
  anchorSeconds: number | null;
  anchorQn: number | null;
}

/** Sorted copy, or null when there is no slope to interpolate along. */
function usable(waypoints: readonly AnchorWaypoint[]): AnchorWaypoint[] | null {
  const clean = waypoints.filter(
    (w) => Number.isFinite(w.musicalPositionQN) && Number.isFinite(w.videoTimeSeconds)
  );
  if (clean.length < 2) return null;
  return [...clean].sort((a, b) => a.musicalPositionQN - b.musicalPositionQN);
}

/**
 * Linear interpolation between the bracketing pair, extrapolating past either
 * end using that end's slope — matching WaypointTimeMap's documented edge
 * handling, so the anchor and the player agree.
 */
function interpolate(
  xs: readonly number[],
  ys: readonly number[],
  x: number
): number | null {
  if (!Number.isFinite(x)) return null;
  const n = xs.length;

  let i = 0;
  if (x <= xs[0]) i = 0;
  else if (x >= xs[n - 1]) i = n - 2;
  else {
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] <= x) lo = mid;
      else hi = mid;
    }
    i = lo;
  }

  const span = xs[i + 1] - xs[i];
  if (!(Math.abs(span) > 0)) return null;
  const t = (x - xs[i]) / span;
  const out = ys[i] + t * (ys[i + 1] - ys[i]);
  return Number.isFinite(out) ? out : null;
}

/** Musical position -> video seconds. null when the map can't answer. */
export function qnToSeconds(
  waypoints: readonly AnchorWaypoint[],
  qn: number
): number | null {
  const sorted = usable(waypoints);
  if (!sorted) return null;
  return interpolate(
    sorted.map((w) => w.musicalPositionQN),
    sorted.map((w) => w.videoTimeSeconds),
    qn
  );
}

/** Video seconds -> musical position. null when the map can't answer. */
export function secondsToQn(
  waypoints: readonly AnchorWaypoint[],
  seconds: number
): number | null {
  const sorted = usable(waypoints);
  if (!sorted) return null;
  return interpolate(
    sorted.map((w) => w.videoTimeSeconds),
    sorted.map((w) => w.musicalPositionQN),
    seconds
  );
}

/**
 * The anchor as it should be stored after a publish, or null to leave the
 * stored values exactly as they are.
 *
 * Null is returned for every case we cannot improve on — no anchor, or a new
 * map too short to interpolate along — because the caller's contract is that a
 * rebase can never fail a publish.
 */
export function rebaseAnchor(
  current: StoredAnchor,
  newWaypoints: readonly AnchorWaypoint[]
): { anchorSeconds: number; anchorQn: number } | null {
  if (current.anchorSeconds == null && current.anchorQn == null) return null;
  if (!usable(newWaypoints)) return null;

  // Knows what it meant: move the seconds to match.
  if (current.anchorQn != null) {
    const seconds = qnToSeconds(newWaypoints, current.anchorQn);
    if (seconds == null) return null;
    return { anchorSeconds: seconds, anchorQn: current.anchorQn };
  }

  // Hand-placed before any map existed: keep the admin's seconds exactly, and
  // adopt a musical position so the NEXT publish can rebase properly.
  if (current.anchorSeconds == null) return null;
  const qn = secondsToQn(newWaypoints, current.anchorSeconds);
  if (qn == null) return null;
  return { anchorSeconds: current.anchorSeconds, anchorQn: qn };
}
