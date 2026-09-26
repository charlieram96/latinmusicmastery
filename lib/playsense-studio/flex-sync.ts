// Flex Time (spec §7): pure MEDIA <-> TIMELINE conversions the admin SyncPanel
// uses. The clock, trim and loop live in MEDIA time (the video element); the
// canvas, markers and notes live in TIMELINE time. Every helper is an exact
// pass-through with an identity map, so unflexed sections behave as before.
import { clampToTrim, type MediaTrim } from './clip-model';
import type { FlexMap } from './flex';

/** A seek request in TIMELINE seconds -> the MEDIA second to seek to: convert,
 *  then clamp to the trim (which is MEDIA) when there is one. */
export function seekMediaFor(
  map: FlexMap,
  timelineSeconds: number,
  trim: MediaTrim | null,
  durationSeconds: number | null
): number {
  const media = map.toMedia(timelineSeconds);
  return trim ? clampToTrim(media, trim, durationSeconds) : media;
}

/** The stored (MEDIA) trim -> where the canvas draws its grips (TIMELINE). */
export function trimInTimeline(map: FlexMap, trim: MediaTrim | null): { in: number | undefined; out: number | null } {
  if (!trim) return { in: undefined, out: null };
  return {
    in: map.toTimeline(trim.trimInSeconds),
    out: trim.trimOutSeconds != null ? map.toTimeline(trim.trimOutSeconds) : null,
  };
}

/** A trim grip dragged to a TIMELINE second -> the MEDIA second to store. */
export function trimDragToMedia(map: FlexMap, timelineSeconds: number): number {
  return map.toMedia(timelineSeconds);
}

/** When the flex changes under a running loop, keep the loop on the same
 *  TIMELINE span (the same bars): read its MEDIA ends through the old map and
 *  write them back through the new one. */
export function remapMediaLoop(
  prev: FlexMap,
  next: FlexMap,
  loopA: number,
  loopB: number
): { a: number; b: number } {
  return { a: next.toMedia(prev.toTimeline(loopA)), b: next.toMedia(prev.toTimeline(loopB)) };
}
