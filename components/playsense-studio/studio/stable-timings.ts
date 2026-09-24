// PlaySense Studio — keeps the per-bar timing list value-stable. Markers change
// on every beat, nudge or section drag frame, but only bar-line moves change a
// bar's start or end; reusing the previous array for the rest keeps the strip's
// items (and so its staff) from redrawing on drags that can't move a bar.

export interface BarTiming {
  measureNumber: number;
  startVideoTimeSeconds: number;
  endVideoTimeSeconds: number;
}

/** `prev` by identity when every entry's number, start and end match `next`; otherwise `next`. */
export function stableTimings<T extends BarTiming>(prev: T[] | null, next: T[]): T[] {
  if (!prev || prev.length !== next.length) return next;
  for (let i = 0; i < next.length; i++) {
    const a = prev[i];
    const b = next[i];
    if (a.measureNumber !== b.measureNumber || a.startVideoTimeSeconds !== b.startVideoTimeSeconds || a.endVideoTimeSeconds !== b.endVideoTimeSeconds) return next;
  }
  return prev;
}
