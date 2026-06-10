// PlaySense Studio — waveform sync editor marker model (pure, no DOM).
//
// The editor shows one draggable marker per measure downbeat, and (when a
// measure is expanded) one per beat. A marker's MUSICAL position (QN) is fixed
// by the score and never changes; only its VIDEO time is editable by dragging.
// Because QN ordering is fixed, keeping video time strictly increasing along
// the QN axis is a clamping problem with a clean invariant — see clampMarkerTime.
//
// MarkerState <-> Waypoint[] is the bridge to the rest of the system:
//   • seedMarkerState: tempo/tap seed (or a previously-published map) -> markers
//   • markerStateToWaypoints: markers -> the waypoints publishTimeMap persists
//
// Everything here is pure and unit-tested; the React/canvas layer owns no math.

import {
  beatLengthInQN,
  trackDurationQN,
  walkMeasures,
} from '@/lib/playsense-studio/time-mapping';
import { buildWaypoints } from '@/lib/playsense-studio/sync-seed';
import {
  WaypointTimeMap,
  type Waypoint,
} from '@/components/playsense-studio/shared/time-map/time-map';
import type { ScoreDocument, Track } from '@/components/playsense-studio/shared/score-model/types';

/**
 * Minimum gap (seconds) kept between adjacent markers' video times. Comfortably
 * above float noise in DOUBLE PRECISION yet far below perceptible sync error.
 */
export const EPS = 1e-3;

export interface BeatMarker {
  /** 1-based; 1 = downbeat. */
  beatInMeasure: number;
  /** Quarter notes from start of piece. Fixed by the score. */
  musicalPositionQN: number;
  /** Video time (seconds). The only editable field. */
  videoTimeSeconds: number;
  /** True once the admin explicitly placed/dragged this beat. */
  edited: boolean;
}

export interface MeasureMarker {
  /** 1-based measure number. */
  measureNumber: number;
  /** Beats per measure = time-signature numerator in effect at this measure. */
  beatsInMeasure: number;
  /** QN of this measure's downbeat. */
  downbeatQN: number;
  /** beats[0] is the downbeat (beatInMeasure = 1). */
  beats: BeatMarker[];
  /** UI: whether per-beat handles are shown for this measure. */
  expanded: boolean;
}

export interface MarkerState {
  /** Sorted by measureNumber, contiguous from the score. */
  measures: MeasureMarker[];
  /** QN at the end of the last measure — an upper boundary marker. */
  tailQN: number;
  /** Video time of the tail boundary. */
  tailVideoTimeSeconds: number;
}

/** Identifies a single marker. Downbeat = beatInMeasure 1. */
export interface MarkerRef {
  measureNumber: number;
  beatInMeasure: number;
}

export interface OrderedMarker {
  /** null for the tail boundary. */
  ref: MarkerRef | null;
  qn: number;
  videoTimeSeconds: number;
}

const QN_MATCH_TOLERANCE = 1e-6;

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

/**
 * Build a MarkerState from seed waypoints. The seed can be a tempo/tap grid
 * (downbeats only) or a previously-published map (downbeats + edited beats).
 * Every beat's video time is interpolated through the seed; a beat that has an
 * explicit non-downbeat waypoint in the seed is snapped exactly and flagged
 * `edited` so it round-trips.
 */
export function seedMarkerState(
  track: Track,
  score: ScoreDocument,
  seedWaypoints: Waypoint[]
): MarkerState {
  const seedMap = new WaypointTimeMap('seed', 'tempo', seedWaypoints);

  // Index seed waypoints by QN for exact-match snapping.
  const byQN = seedWaypoints
    .slice()
    .sort((a, b) => a.musicalPositionQN - b.musicalPositionQN);
  const lookup = (qn: number): Waypoint | undefined =>
    byQN.find((w) => Math.abs(w.musicalPositionQN - qn) < QN_MATCH_TOLERANCE);

  const measures: MeasureMarker[] = [];
  for (const { measure, state } of walkMeasures(track, score)) {
    const beatsInMeasure = state.timeSignature[0];
    const beatQN = beatLengthInQN(state.timeSignature);
    const downbeatQN = state.cumulativeQN;

    const beats: BeatMarker[] = [];
    for (let b = 1; b <= beatsInMeasure; b++) {
      const qn = downbeatQN + (b - 1) * beatQN;
      const match = lookup(qn);
      const isNonDownbeatMatch = match !== undefined && b !== 1;
      beats.push({
        beatInMeasure: b,
        musicalPositionQN: qn,
        videoTimeSeconds: match ? match.videoTimeSeconds : seedMap.toVideoTime(qn),
        edited: isNonDownbeatMatch,
      });
    }

    measures.push({
      measureNumber: measure.number,
      beatsInMeasure,
      downbeatQN,
      beats,
      expanded: false,
    });
  }

  const tailQN = trackDurationQN(track, score);
  return {
    measures,
    tailQN,
    tailVideoTimeSeconds: seedMap.toVideoTime(tailQN),
  };
}

// ---------------------------------------------------------------------------
// Serialization to waypoints
// ---------------------------------------------------------------------------

export type IncludeBeats = 'downbeats-only' | 'edited-beats' | 'all-expanded';

/**
 * Flatten markers into publishable waypoints. Every measure downbeat plus the
 * tail boundary are always included; non-downbeat beats are included per
 * `includeBeats`. Result is QN-sorted and passed through enforceMonotonic so it
 * can never trip the server's strict-increase check.
 */
export function markerStateToWaypoints(
  state: MarkerState,
  opts: { includeBeats: IncludeBeats }
): Waypoint[] {
  const out: Waypoint[] = [];

  for (const m of state.measures) {
    for (const beat of m.beats) {
      const isDownbeat = beat.beatInMeasure === 1;
      const include =
        isDownbeat ||
        (opts.includeBeats === 'edited-beats' && beat.edited) ||
        (opts.includeBeats === 'all-expanded' && m.expanded);
      if (!include) continue;
      out.push({
        musicalPositionQN: beat.musicalPositionQN,
        videoTimeSeconds: beat.videoTimeSeconds,
        measureNumber: m.measureNumber,
        beatInMeasure: beat.beatInMeasure,
      });
    }
  }

  out.push({
    musicalPositionQN: state.tailQN,
    videoTimeSeconds: state.tailVideoTimeSeconds,
    measureNumber: null,
    beatInMeasure: null,
  });

  out.sort((a, b) => a.musicalPositionQN - b.musicalPositionQN);
  return enforceMonotonic(out);
}

// ---------------------------------------------------------------------------
// Ordering, clamping, shifting
// ---------------------------------------------------------------------------

/**
 * The markers the canvas draws and a single drag clamps against: downbeats,
 * beats of expanded measures, and the tail. QN-sorted. (Collapsed unedited
 * beats are not visible, so they don't constrain a single drag.)
 */
export function orderedMarkers(state: MarkerState): OrderedMarker[] {
  const out: OrderedMarker[] = [];
  for (const m of state.measures) {
    for (const beat of m.beats) {
      if (beat.beatInMeasure === 1 || m.expanded) {
        out.push({
          ref: { measureNumber: m.measureNumber, beatInMeasure: beat.beatInMeasure },
          qn: beat.musicalPositionQN,
          videoTimeSeconds: beat.videoTimeSeconds,
        });
      }
    }
  }
  out.push({ ref: null, qn: state.tailQN, videoTimeSeconds: state.tailVideoTimeSeconds });
  out.sort((a, b) => a.qn - b.qn);
  return out;
}

/** True when this beat is authoritative (a downbeat or an edited beat). */
function isAnchorBeat(beat: BeatMarker): boolean {
  return beat.beatInMeasure === 1 || beat.edited;
}

/**
 * The authoritative markers: downbeats + edited beats + tail, QN-sorted. These
 * are the monotonicity constraint set, the basis for re-deriving unedited beats,
 * and (in edited-beats mode) exactly what gets published.
 */
function anchorMarkers(state: MarkerState): OrderedMarker[] {
  const out: OrderedMarker[] = [];
  for (const m of state.measures) {
    for (const beat of m.beats) {
      if (isAnchorBeat(beat)) {
        out.push({
          ref: { measureNumber: m.measureNumber, beatInMeasure: beat.beatInMeasure },
          qn: beat.musicalPositionQN,
          videoTimeSeconds: beat.videoTimeSeconds,
        });
      }
    }
  }
  out.push({ ref: null, qn: state.tailQN, videoTimeSeconds: state.tailVideoTimeSeconds });
  out.sort((a, b) => a.qn - b.qn);
  return out;
}

/**
 * Clamp `proposed` into the open interval (prev + EPS, next - EPS) so a single
 * drag can never reach or cross its neighbors. First marker has no lower bound,
 * last has no upper bound.
 */
export function clampMarkerTime(
  ordered: Array<{ videoTimeSeconds: number }>,
  index: number,
  proposed: number
): number {
  const lo = index > 0 ? ordered[index - 1].videoTimeSeconds + EPS : -Infinity;
  const hi = index < ordered.length - 1 ? ordered[index + 1].videoTimeSeconds - EPS : Infinity;
  return Math.min(Math.max(proposed, lo), hi);
}

/** Apply a transform to a single beat identified by ref. Returns a new state. */
function mapBeat(
  state: MarkerState,
  ref: MarkerRef,
  fn: (beat: BeatMarker) => BeatMarker
): MarkerState {
  return {
    ...state,
    measures: state.measures.map((m) =>
      m.measureNumber !== ref.measureNumber
        ? m
        : {
            ...m,
            beats: m.beats.map((beat) =>
              beat.beatInMeasure === ref.beatInMeasure ? fn(beat) : beat
            ),
          }
    ),
  };
}

/**
 * Re-derive every unedited, non-downbeat beat by interpolating through the
 * anchor markers. Anchors (downbeats + edited beats + tail) are left untouched.
 * Called after any anchor moves so collapsed/unedited beats stay visually sane
 * and never cross an anchor.
 */
export function reinterpolateUnedited(state: MarkerState): MarkerState {
  const anchors = anchorMarkers(state);
  if (anchors.length < 2) return state;

  const anchorWaypoints: Waypoint[] = enforceMonotonic(
    anchors.map((a) => ({
      musicalPositionQN: a.qn,
      videoTimeSeconds: a.videoTimeSeconds,
      measureNumber: a.ref?.measureNumber ?? null,
      beatInMeasure: a.ref?.beatInMeasure ?? null,
    }))
  );
  const map = new WaypointTimeMap('reinterp', 'drag', anchorWaypoints);

  return {
    ...state,
    measures: state.measures.map((m) => ({
      ...m,
      beats: m.beats.map((beat) =>
        isAnchorBeat(beat)
          ? beat
          : { ...beat, videoTimeSeconds: map.toVideoTime(beat.musicalPositionQN) }
      ),
    })),
  };
}

/**
 * Move a single marker to `proposedTime`. The time is clamped against adjacent
 * visible markers, the beat is flagged `edited` if it isn't a downbeat (so it
 * becomes an anchor), and unedited beats are re-derived. Returns a new state.
 */
export function setMarkerTime(
  state: MarkerState,
  ref: MarkerRef,
  proposedTime: number
): MarkerState {
  const visible = orderedMarkers(state);
  const index = visible.findIndex(
    (o) =>
      o.ref !== null &&
      o.ref.measureNumber === ref.measureNumber &&
      o.ref.beatInMeasure === ref.beatInMeasure
  );
  const clamped = index === -1 ? proposedTime : clampMarkerTime(visible, index, proposedTime);

  const moved = mapBeat(state, ref, (beat) => ({
    ...beat,
    videoTimeSeconds: clamped,
    edited: beat.beatInMeasure !== 1 ? true : beat.edited,
  }));
  return reinterpolateUnedited(moved);
}

/**
 * Move the tail boundary (end of the last measure) to `proposedTime`, clamped
 * above the last real anchor. Unedited beats in the final measure re-derive.
 */
export function setTailTime(state: MarkerState, proposedTime: number): MarkerState {
  const anchors = anchorMarkers(state);
  const prev = anchors[anchors.length - 2];
  const lo = prev ? prev.videoTimeSeconds + EPS : -Infinity;
  const clamped = Math.max(proposedTime, lo);
  return reinterpolateUnedited({ ...state, tailVideoTimeSeconds: clamped });
}

/**
 * "Drag all": shift the marker at `ref` and every later anchor (by QN) by
 * `delta` seconds, leaving earlier markers fixed; unedited beats are re-derived
 * afterward. On a left shift, the delta is seam-clamped so the grabbed marker
 * stays > its preceding anchor. Only the grabbed non-downbeat beat is flagged
 * `edited` (bulk-shifted beats are not, to keep the published set small).
 */
export function shiftMarkersFrom(
  state: MarkerState,
  ref: MarkerRef,
  delta: number
): MarkerState {
  // The grabbed non-downbeat becomes an anchor before we compute the shift.
  const working =
    ref.beatInMeasure === 1
      ? state
      : mapBeat(state, ref, (beat) => ({ ...beat, edited: true }));

  const anchors = anchorMarkers(working);
  const refIndex = anchors.findIndex(
    (o) =>
      o.ref !== null &&
      o.ref.measureNumber === ref.measureNumber &&
      o.ref.beatInMeasure === ref.beatInMeasure
  );
  if (refIndex === -1) return state;

  const refOldTime = anchors[refIndex].videoTimeSeconds;
  const refQN = anchors[refIndex].qn;

  // Seam clamp on left shift: keep the grabbed marker above its preceding anchor.
  let appliedDelta = delta;
  if (delta < 0 && refIndex > 0) {
    const minDelta = anchors[refIndex - 1].videoTimeSeconds + EPS - refOldTime;
    appliedDelta = Math.max(delta, minDelta);
  }

  const shiftAtOrAfter = (qn: number) => qn >= refQN - QN_MATCH_TOLERANCE;

  const shifted: MarkerState = {
    ...working,
    measures: working.measures.map((m) => ({
      ...m,
      beats: m.beats.map((beat) =>
        isAnchorBeat(beat) && shiftAtOrAfter(beat.musicalPositionQN)
          ? { ...beat, videoTimeSeconds: beat.videoTimeSeconds + appliedDelta }
          : beat
      ),
    })),
    tailVideoTimeSeconds: shiftAtOrAfter(working.tailQN)
      ? working.tailVideoTimeSeconds + appliedDelta
      : working.tailVideoTimeSeconds,
  };

  return reinterpolateUnedited(shifted);
}

/**
 * Pre-publish backstop: QN-sort, then force each video time to be at least
 * EPS past its predecessor. Idempotent. The UI clamps live; this guarantees the
 * array handed to publishTimeMap can never fail the strict-increase check.
 */
export function enforceMonotonic(waypoints: Waypoint[]): Waypoint[] {
  const sorted = waypoints
    .slice()
    .sort((a, b) => a.musicalPositionQN - b.musicalPositionQN)
    .map((w) => ({ ...w }));
  for (let i = 1; i < sorted.length; i++) {
    const min = sorted[i - 1].videoTimeSeconds + EPS;
    if (sorted[i].videoTimeSeconds < min) sorted[i].videoTimeSeconds = min;
  }
  return sorted;
}

// ---------------------------------------------------------------------------
// Section overlap (sibling scored sections may not share video time)
// ---------------------------------------------------------------------------

export interface TimeRange {
  startSeconds: number;
  endSeconds: number;
}

/** Current video-time footprint of the marker state: first downbeat → tail. */
export function markerSpan(state: MarkerState): TimeRange {
  const first = state.measures[0]?.beats[0]?.videoTimeSeconds ?? state.tailVideoTimeSeconds;
  return {
    startSeconds: first,
    endSeconds: Math.max(state.tailVideoTimeSeconds, first),
  };
}

export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return a.startSeconds < b.endSeconds && a.endSeconds > b.startSeconds;
}

/**
 * The open corridor `span` may move within without entering a blocked range:
 * `lo` = max end of blocked ranges entirely at/left of the span (else -Infinity),
 * `hi` = min start of blocked ranges entirely at/right of it (else +Infinity).
 * Blocked ranges that ALREADY intersect the span (legacy overlapping data) are
 * ignored so the admin can always drag their way OUT of a pre-existing overlap.
 */
export function freeCorridor(span: TimeRange, blocked: TimeRange[]): { lo: number; hi: number } {
  let lo = -Infinity;
  let hi = Infinity;
  for (const r of blocked) {
    if (rangesOverlap(span, r)) continue;
    if (r.endSeconds <= span.startSeconds) lo = Math.max(lo, r.endSeconds);
    else if (r.startSeconds >= span.endSeconds) hi = Math.min(hi, r.startSeconds);
  }
  return { lo, hi };
}

// ---------------------------------------------------------------------------
// Reconciliation with score edits
// ---------------------------------------------------------------------------

/**
 * A string that changes only when the score's MEASURE STRUCTURE changes — i.e.
 * anything that moves a downbeat/beat QN position or the timeline math: the
 * initial time signature + tempo, and each measure's number, time-signature
 * override, and tempo change. Note edits (pitch/duration/add/delete event) do
 * NOT change it, because a measure's QN length comes from its time signature,
 * not its events. The unified studio uses this to decide when to reconcile the
 * sync markers against a freshly-edited score.
 */
export function structuralSignature(score: ScoreDocument): string {
  const track = score.tracks[0];
  if (!track) return 'empty';
  const head = `${score.initialTimeSignature[0]}/${score.initialTimeSignature[1]}@${score.initialTempo}`;
  const body = track.measures
    .map((m) => {
      const ts = m.timeSignature ? `${m.timeSignature[0]}/${m.timeSignature[1]}` : '-';
      const tc = m.tempoChange ?? '-';
      return `${m.number}:${ts}:${tc}`;
    })
    .join(',');
  return `${head}|${body}`;
}

/**
 * Re-derive the marker state for a (possibly edited) score while preserving the
 * admin's dragged anchor times. Downbeat times are preserved by measureNumber
 * and edited-beat times by (measureNumber, beatInMeasure); their QN positions
 * are RECOMPUTED from the new score (so an upstream time-signature change shifts
 * everything correctly). New measures interpolate/extrapolate through the
 * surviving anchors; deleted measures drop out.
 *
 * Known limitation: the editor renumbers measures on delete, so deleting a bar
 * in the middle reattaches later times to renumbered bars (the admin re-drags
 * those). Acceptable for v1.
 */
export function reconcileMarkers(
  prevState: MarkerState,
  track: Track,
  score: ScoreDocument
): MarkerState {
  // 1. Harvest preserved video times keyed by identity.
  const downbeatTimes = new Map<number, number>();
  const editedBeatTimes = new Map<string, number>();
  for (const m of prevState.measures) {
    for (const beat of m.beats) {
      if (beat.beatInMeasure === 1) {
        downbeatTimes.set(m.measureNumber, beat.videoTimeSeconds);
      } else if (beat.edited) {
        editedBeatTimes.set(`${m.measureNumber}:${beat.beatInMeasure}`, beat.videoTimeSeconds);
      }
    }
  }

  // 2. Build seed waypoints from the NEW score skeleton, pulling preserved
  //    times where the identity still exists.
  const seed: Waypoint[] = [];
  for (const { measure, state } of walkMeasures(track, score)) {
    const downbeatQN = state.cumulativeQN;
    const dbTime = downbeatTimes.get(measure.number);
    if (dbTime !== undefined) {
      seed.push({
        musicalPositionQN: downbeatQN,
        videoTimeSeconds: dbTime,
        measureNumber: measure.number,
        beatInMeasure: 1,
      });
    }
    const beatQN = beatLengthInQN(state.timeSignature);
    const beatsInMeasure = state.timeSignature[0];
    for (let b = 2; b <= beatsInMeasure; b++) {
      const t = editedBeatTimes.get(`${measure.number}:${b}`);
      if (t !== undefined) {
        seed.push({
          musicalPositionQN: downbeatQN + (b - 1) * beatQN,
          videoTimeSeconds: t,
          measureNumber: measure.number,
          beatInMeasure: b,
        });
      }
    }
  }

  // tail boundary, keeping the previous end time.
  const tailQN = trackDurationQN(track, score);
  seed.push({
    musicalPositionQN: tailQN,
    videoTimeSeconds: prevState.tailVideoTimeSeconds,
    measureNumber: null,
    beatInMeasure: null,
  });

  const cleaned = enforceMonotonic(seed);

  // 3. Fall back to a fresh tempo grid if too few anchors survive.
  if (cleaned.length < 2) {
    return seedMarkerState(track, score, buildWaypoints(score, score.initialTempo, 0));
  }

  // 4. Rebuild the full marker state, interpolating unedited/new beats and
  //    re-flagging preserved non-downbeat beats as edited.
  return seedMarkerState(track, score, cleaned);
}
