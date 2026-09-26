// PlaySense Studio — how far a scored section may be dragged along the video:
// never into a neighbouring section, before 0 s, or past the video's end.

export function clampSectionShift(
  span: { startSeconds: number; endSeconds: number },
  corridor: { lo: number; hi: number },
  videoDurationSeconds: number | null,
  delta: number
): number {
  const min = Math.max(corridor.lo, 0) - span.startSeconds;
  const max = Math.min(corridor.hi, videoDurationSeconds ?? Infinity) - span.endSeconds;
  return Math.max(min, Math.min(max, delta));
}
