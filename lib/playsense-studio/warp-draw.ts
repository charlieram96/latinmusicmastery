// Flex Time (spec §7): drawing the waveform through the warp. The canvas lays
// pixel columns out in TIMELINE time, while the peaks are indexed by MEDIA
// time, so each column reads the media span its timeline span maps to.
import type { FlexMap } from './flex';

/** Pure: the media [start, end] a timeline column [timelineStart, timelineEnd] covers. Pass-through with no points. */
export function mediaForColumn(map: FlexMap, timelineStart: number, timelineEnd: number): [number, number] {
  if (!map.points.length) return [timelineStart, timelineEnd];
  return [map.toMedia(timelineStart), map.toMedia(timelineEnd)];
}
