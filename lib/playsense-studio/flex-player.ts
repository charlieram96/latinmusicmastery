// Flex Time (spec §7): pure MEDIA <-> TIMELINE helpers the student player
// wires straight into the existing cursor/seek/loop/click plumbing. Kept
// separate from playsense-studio-player.tsx so they're trivial to unit test
// without a video element, React, or a TimeMap.
import type { FlexMap } from './flex';

/** clock.currentSeconds (MEDIA) -> the TIMELINE second the notation lives at.
 *  A pass-through with an identity map (unflexed lessons). */
export function timelineOf(map: FlexMap, media: number): number {
  return map.toTimeline(media);
}

/** A musical position (QN), via the TimeMap's own TIMELINE-second waypoints,
 *  -> the MEDIA second to actually seek the video element to. */
export function mediaSeekFor(
  map: FlexMap,
  timeMap: { toVideoTime(qn: number): number },
  qn: number
): number {
  return map.toMedia(timeMap.toVideoTime(qn));
}

/** Click-track beat times authored on the TIMELINE (the notated, constant
 *  tempo) -> MEDIA seconds to actually schedule against the (possibly
 *  stretched) recording, so the click follows the flexed video. */
export function clickTimesInMedia(map: FlexMap, beatTimesTimeline: number[]): number[] {
  return beatTimesTimeline.map((t) => map.toMedia(t));
}
