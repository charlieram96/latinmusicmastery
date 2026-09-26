// Pure helper that turns SyncPanel's live marker state into the timing patch
// a draft (or eventually a publish) needs. Kept out of sync-panel.tsx so a
// node test can exercise it without loading that file's VexFlow tree.
import {
  countNudges,
  enforceMonotonic,
  markerStateToWaypoints,
  nudgeList,
  type MarkerState,
} from '@/components/playsense-studio/sync/marker-model';
import type { FlexPoint } from '@/lib/playsense-studio/flex';
import type { StudioTiming } from './timing';

export function timingPatchFromMarkers(
  markers: MarkerState,
  opts: { pps: number; peaksCached: boolean; flex: FlexPoint[] }
): Pick<StudioTiming, 'method' | 'params' | 'waypoints'> | null {
  const waypoints = enforceMonotonic(markerStateToWaypoints(markers, { includeBeats: 'edited-beats' }));
  if (waypoints.length < 2) return null;
  const editedBeats = markers.measures.flatMap((m) => m.beats
    .filter((b) => b.edited && b.beatInMeasure !== 1)
    .map((b) => ({ measure: m.measureNumber, beat: b.beatInMeasure })));
  return {
    method: 'drag',
    params: {
      editedBeats,
      nudges: nudgeList(markers),
      nudgedNotes: countNudges(markers),
      pps: opts.pps,
      peaksCached: opts.peaksCached,
      version: 1,
      ...(opts.flex.length ? { flex: opts.flex } : {}),
    },
    waypoints,
  };
}
