// PlaySense Studio — timeline view math shared by the waveform and the staff:
// fit a time range into the viewport, keep the playhead in view while it
// plays, and pick the point a zoom button should anchor on. Pure: SyncPanel
// owns the pps/scrollLeft state and calls these.

export interface TimelineBounds {
  minPps: number;
  maxPps: number;
  /** The whole timeline's length in seconds. */
  contentSeconds: number;
}

const clampNum = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function clampScrollLeft(scrollLeft: number, pps: number, viewportWidth: number, contentSeconds: number): number {
  return clampNum(scrollLeft, 0, Math.max(0, contentSeconds * pps - viewportWidth));
}

/** pps and scrollLeft that show [start, end] with `padFrac` of its span either side. */
export function fitRangeView(
  startSeconds: number,
  endSeconds: number,
  viewportWidth: number,
  b: TimelineBounds,
  padFrac = 0.04,
): { pps: number; scrollLeft: number } | null {
  if (!(viewportWidth > 0) || !(endSeconds > startSeconds)) return null;
  const span = endSeconds - startSeconds;
  const pad = span * padFrac;
  const pps = clampNum(viewportWidth / (span + 2 * pad), b.minPps, b.maxPps);
  return { pps, scrollLeft: clampScrollLeft((startSeconds - pad) * pps, pps, viewportWidth, b.contentSeconds) };
}

/**
 * While playing (or after a seek): when t leaves the band [edge, 1 - edge] of
 * the viewport, page so it lands at `land` of the width. Null = no change.
 */
export function followScroll(
  tSeconds: number,
  pps: number,
  scrollLeft: number,
  viewportWidth: number,
  b: TimelineBounds,
  opts: { edge?: number; land?: number } = {},
): number | null {
  if (!(viewportWidth > 0)) return null;
  const edge = opts.edge ?? 0.1;
  const land = opts.land ?? 0.25;
  const x = tSeconds * pps - scrollLeft;
  if (x >= viewportWidth * edge && x <= viewportWidth * (1 - edge)) return null;
  const next = clampScrollLeft(tSeconds * pps - viewportWidth * land, pps, viewportWidth, b.contentSeconds);
  return Math.abs(next - scrollLeft) < 0.5 ? null : next;
}

/** A zoom button's anchor: the playhead when it's on screen, else the centre. */
export function anchorPxFor(tSeconds: number, pps: number, scrollLeft: number, viewportWidth: number): number {
  const x = tSeconds * pps - scrollLeft;
  return x >= 0 && x <= viewportWidth ? x : viewportWidth / 2;
}
