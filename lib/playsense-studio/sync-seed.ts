// PlaySense Studio — sync seed math.
//
// `buildWaypoints` lays down the initial set of waypoints the waveform editor
// uses before the admin drags markers to fine-tune. Given a BPM and a start
// offset (the video playhead at import time), it emits one waypoint per measure
// downbeat, honoring per-measure tempo changes embedded in the score.
//
// It produces the canonical Waypoint shape consumed by WaypointTimeMap and
// score_time_waypoints. Pure, so it can be unit-tested and reused by the editor.

import { measureLengthInQN, qnToMs } from '@/lib/playsense-studio/time-mapping';
import type { Waypoint } from '@/components/playsense-studio/shared/time-map/time-map';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

/**
 * Walk the first track's measures and emit one waypoint per measure downbeat,
 * plus a tail boundary at the end of the last measure. `globalBpm` sets the
 * tempo for the opening; per-measure `tempoChange` overrides bend the timeline
 * the same way the score's own tempo map does. `offsetSeconds` shifts the whole
 * set so bar 1's downbeat lands at the right point in the video.
 */
export function buildWaypoints(
  score: ScoreDocument,
  globalBpm: number,
  offsetSeconds: number
): Waypoint[] {
  const track = score.tracks[0];
  if (!track || track.measures.length === 0) return [];

  const out: Waypoint[] = [];
  let cumulativeQN = 0;
  let cumulativeMs = offsetSeconds * 1000;
  let timeSignature = score.initialTimeSignature;
  let bpm = globalBpm;
  let firstMeasure = true;

  for (const measure of track.measures) {
    if (measure.timeSignature) timeSignature = measure.timeSignature;
    if (measure.tempoChange !== undefined) bpm = measure.tempoChange;
    else if (firstMeasure) bpm = globalBpm;
    firstMeasure = false;

    out.push({
      musicalPositionQN: cumulativeQN,
      videoTimeSeconds: cumulativeMs / 1000,
      measureNumber: measure.number,
      beatInMeasure: 1,
    });

    const measureQN = measureLengthInQN(timeSignature);
    cumulativeQN += measureQN;
    cumulativeMs += qnToMs(measureQN, bpm);
  }

  // Tail boundary at the end of the last measure so there is always an upper
  // bound past the final downbeat.
  out.push({
    musicalPositionQN: cumulativeQN,
    videoTimeSeconds: cumulativeMs / 1000,
    measureNumber: null,
    beatInMeasure: null,
  });

  // Drop any non-increasing video time (e.g. bpm = 0 sneaking through) — the
  // player and publish path both require strictly-increasing video time.
  return out.filter(
    (w, i, arr) => i === 0 || w.videoTimeSeconds > arr[i - 1].videoTimeSeconds
  );
}
