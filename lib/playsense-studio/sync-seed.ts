// PlaySense Studio — sync seed math.
//
// "Seeds" are the initial set of waypoints the waveform editor lays down before
// the admin drags markers to fine-tune. Two ways to seed:
//   • Tempo + offset: a constant BPM and a start offset, honoring per-measure
//     tempo changes embedded in the score. (Was the "Tempo + offset" mode.)
//   • Tap: video timestamps captured by tapping each measure downbeat in order.
//     (Was the "Tap-along" mode.)
//
// Both produce the canonical Waypoint shape consumed by WaypointTimeMap and
// score_time_waypoints. They are pure so they can be unit-tested and reused by
// the editor's seed controls.

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

/**
 * Lay the score's measures evenly across the WHOLE audio so they always span the
 * entire video, regardless of the score's notated tempo. Each measure downbeat
 * is placed in proportion to its cumulative quarter-note position, with the tail
 * landing exactly at `totalDurationSeconds`.
 *
 * Unlike buildWaypoints (fixed BPM from t=0), this ignores per-measure tempo
 * changes so the fit is a clean linear stretch — the admin can still drag
 * individual markers afterward to bend the timeline.
 */
export function buildFitWaypoints(
  score: ScoreDocument,
  totalDurationSeconds: number
): Waypoint[] {
  const track = score.tracks[0];
  if (!track || track.measures.length === 0 || totalDurationSeconds <= 0) return [];

  // Cumulative QN at each measure downbeat, honoring time-signature changes.
  const positions: Array<{ qn: number; measureNumber: number }> = [];
  let cumulativeQN = 0;
  let timeSignature = score.initialTimeSignature;
  for (const measure of track.measures) {
    if (measure.timeSignature) timeSignature = measure.timeSignature;
    positions.push({ qn: cumulativeQN, measureNumber: measure.number });
    cumulativeQN += measureLengthInQN(timeSignature);
  }
  const totalQN = cumulativeQN;
  if (totalQN <= 0) return [];

  const out: Waypoint[] = positions.map((p) => ({
    musicalPositionQN: p.qn,
    videoTimeSeconds: (p.qn / totalQN) * totalDurationSeconds,
    measureNumber: p.measureNumber,
    beatInMeasure: 1,
  }));

  // Tail boundary at the end of the last measure (== full duration).
  out.push({
    musicalPositionQN: totalQN,
    videoTimeSeconds: totalDurationSeconds,
    measureNumber: null,
    beatInMeasure: null,
  });

  return out;
}

/**
 * Map tap timestamps to measure-downbeat waypoints. `tapTimes[i]` is the video
 * time (seconds) of the (i+1)th measure's downbeat, tapped in order from bar 1.
 * The position past the last measure is the tail boundary (measureNumber null).
 */
export function buildTapSeed(score: ScoreDocument, tapTimes: number[]): Waypoint[] {
  const track = score.tracks[0];
  if (!track || track.measures.length === 0) return [];

  // Cumulative QN at each measure downbeat, then one tail boundary.
  const positions: Array<{ qn: number; measureNumber: number | null }> = [];
  let cumulative = 0;
  let timeSignature = score.initialTimeSignature;
  for (const measure of track.measures) {
    if (measure.timeSignature) timeSignature = measure.timeSignature;
    positions.push({ qn: cumulative, measureNumber: measure.number });
    cumulative += measureLengthInQN(timeSignature);
  }
  positions.push({ qn: cumulative, measureNumber: null });

  const out: Waypoint[] = [];
  const count = Math.min(tapTimes.length, positions.length);
  for (let i = 0; i < count; i++) {
    out.push({
      musicalPositionQN: positions[i].qn,
      videoTimeSeconds: tapTimes[i],
      measureNumber: positions[i].measureNumber,
      beatInMeasure: positions[i].measureNumber === null ? null : 1,
    });
  }
  return out;
}
