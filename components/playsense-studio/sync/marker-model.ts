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
// Per-note NUDGES sit on top of that grid. A nudge is a delta (seconds) on one
// note onset: effective time = grid time + delta, where the grid is the
// interpolation through the anchors (downbeats + edited beats + tail). Moving a
// note changes only its delta; moving an anchor moves the grid and the deltas
// ride along. Nudges are keyed by onset qn — the time map is one function of
// qn shared by every track, so two tracks hitting the same onset share it.
// The nudge list is persisted on the time map (params.nudges); the waypoints
// are the MATERIALIZED effective map the player consumes, so a nudged bar
// emits a waypoint for every one of its onsets (otherwise the linear
// interpolation would bend the neighbours' times).
//
// Everything here is pure and unit-tested; the React/canvas layer owns no math.

import {
  beatLengthInQN,
  trackDurationQN,
  walkMeasures,
} from '@/lib/playsense-studio/time-mapping';
import { buildWaypoints } from '@/lib/playsense-studio/sync-seed';
import { collectOnsets, type OnsetIndex } from '@/lib/playsense-studio/note-onsets';
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

/** Below this (0.1 ms) a delta is "not nudged" and the entry is removed. */
export const NUDGE_EPS = 1e-4;

export interface NoteNudge {
  /** Onset identity: quarter notes from the start of the piece. */
  qn: number;
  /** Seconds added to the grid time. |delta| >= NUDGE_EPS, else the entry is absent. */
  deltaSeconds: number;
}

export interface NoteTick {
  measureNumber: number;
  qn: number;
  /** Effective time: grid + delta. */
  videoTimeSeconds: number;
  nudged: boolean;
}

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
  /** Distinct note/chord onset qns in this bar across ALL tracks, sorted; rests excluded. */
  onsetQNs: number[];
  /** Per-note timing nudges, sorted by qn. Every qn is one of onsetQNs. */
  nudges: NoteNudge[];
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
  seedWaypoints: Waypoint[],
  nudges: readonly NoteNudge[] = []
): MarkerState {
  const onsets = collectOnsets(score);
  const validNudges = sanitizeNudges(nudges, onsets);

  // Only anchor-class rows (integer beats + the tail) build the grid. Onset
  // rows — (measureNumber, null) — are the materialized effect of nudges and
  // are re-derived, never read. A nudged anchor was stored at grid + delta, so
  // its grid time is recovered by subtracting the delta.
  let anchorSeed = seedWaypoints.filter((w) => !isOnsetRow(w));
  if (validNudges.length) {
    anchorSeed = enforceMonotonic(
      anchorSeed.map((w) => {
        const n = validNudges.find((x) => Math.abs(x.qn - w.musicalPositionQN) < QN_MATCH_TOLERANCE);
        return n ? { ...w, videoTimeSeconds: w.videoTimeSeconds - n.deltaSeconds } : w;
      })
    );
  }
  const seedMap = new WaypointTimeMap('seed', 'tempo', anchorSeed);

  // Index seed waypoints by QN for exact-match snapping.
  const byQN = anchorSeed
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

    const onsetQNs = onsets.get(measure.number) ?? [];
    measures.push({
      measureNumber: measure.number,
      beatsInMeasure,
      downbeatQN,
      beats,
      expanded: false,
      onsetQNs,
      nudges: validNudges.filter((n) => onsetQNs.some((q) => Math.abs(q - n.qn) < QN_MATCH_TOLERANCE)),
    });
  }

  const tailQN = trackDurationQN(track, score);
  const state: MarkerState = {
    measures,
    tailQN,
    tailVideoTimeSeconds: seedMap.toVideoTime(tailQN),
  };
  return validNudges.length ? clampNudges(state) : state;
}

/** A materialized onset row: measure known, no beat. Never read back as an anchor. */
function isOnsetRow(w: Waypoint): boolean {
  return w.measureNumber !== null && w.beatInMeasure === null;
}

/** Finite, non-trivial, on a real onset, one per qn, sorted. */
function sanitizeNudges(nudges: readonly NoteNudge[], onsets: OnsetIndex): NoteNudge[] {
  const all = [...onsets.values()].flat();
  const out: NoteNudge[] = [];
  for (const n of nudges) {
    if (!Number.isFinite(n.qn) || !Number.isFinite(n.deltaSeconds)) continue;
    if (Math.abs(n.deltaSeconds) < NUDGE_EPS) continue;
    if (!all.some((q) => Math.abs(q - n.qn) < QN_MATCH_TOLERANCE)) continue;
    if (out.some((o) => Math.abs(o.qn - n.qn) < QN_MATCH_TOLERANCE)) continue;
    out.push({ qn: n.qn, deltaSeconds: n.deltaSeconds });
  }
  return out.sort((a, b) => a.qn - b.qn);
}

// ---------------------------------------------------------------------------
// Serialization to waypoints
// ---------------------------------------------------------------------------

export type IncludeBeats = 'downbeats-only' | 'edited-beats' | 'all-expanded';

/**
 * Flatten markers into publishable waypoints. Every measure downbeat plus the
 * tail boundary are always included; non-downbeat beats are included per
 * `includeBeats`. With nudges (default on), beats emit at grid + delta and
 * every bar touched by a nudge emits all of its onsets as (measureNumber, null)
 * rows, so the published map reproduces each note's effective time exactly.
 * Result is QN-sorted and passed through enforceMonotonic so it can never trip
 * the server's strict-increase check.
 */
export function markerStateToWaypoints(
  state: MarkerState,
  opts: { includeBeats: IncludeBeats; includeNudges?: boolean }
): Waypoint[] {
  const out: Waypoint[] = [];
  const withNudges = opts.includeNudges !== false && hasNudges(state);
  const emittedQN: number[] = [];

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
        videoTimeSeconds:
          beat.videoTimeSeconds + (withNudges ? findDelta(m, beat.musicalPositionQN) : 0),
        measureNumber: m.measureNumber,
        beatInMeasure: beat.beatInMeasure,
      });
      emittedQN.push(beat.musicalPositionQN);
    }
  }

  if (withNudges) {
    const map = anchorTimeMap(state);
    if (map) {
      const bent = bentMeasureIndices(state);
      for (const i of bent) {
        const m = state.measures[i];
        for (const qn of m.onsetQNs) {
          if (emittedQN.some((q) => Math.abs(q - qn) < QN_MATCH_TOLERANCE)) continue;
          out.push({
            musicalPositionQN: qn,
            videoTimeSeconds: map.toVideoTime(qn) + findDelta(m, qn),
            measureNumber: m.measureNumber,
            beatInMeasure: null,
          });
          emittedQN.push(qn);
        }
      }
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
  const map = anchorTimeMap(state);
  if (!map) return state;

  return clampNudges({
    ...state,
    measures: state.measures.map((m) => ({
      ...m,
      beats: m.beats.map((beat) =>
        isAnchorBeat(beat)
          ? beat
          : { ...beat, videoTimeSeconds: map.toVideoTime(beat.musicalPositionQN) }
      ),
    })),
  });
}

/**
 * The GRID: interpolation through the anchors (downbeats + edited beats + tail).
 * Null when fewer than two anchors exist (an empty score).
 */
export function anchorTimeMap(state: MarkerState): WaypointTimeMap | null {
  const anchors = anchorMarkers(state);
  if (anchors.length < 2) return null;
  const anchorWaypoints: Waypoint[] = enforceMonotonic(
    anchors.map((a) => ({
      musicalPositionQN: a.qn,
      videoTimeSeconds: a.videoTimeSeconds,
      measureNumber: a.ref?.measureNumber ?? null,
      beatInMeasure: a.ref?.beatInMeasure ?? null,
    }))
  );
  return new WaypointTimeMap('grid', 'drag', anchorWaypoints);
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
// Per-note nudges
// ---------------------------------------------------------------------------

function findDelta(m: MeasureMarker, qn: number): number {
  const n = m.nudges.find((x) => Math.abs(x.qn - qn) < QN_MATCH_TOLERANCE);
  return n ? n.deltaSeconds : 0;
}

/** Index of the bar containing `qn`, or -1. */
function measureIndexForQN(state: MarkerState, qn: number): number {
  for (let i = state.measures.length - 1; i >= 0; i--) {
    if (qn >= state.measures[i].downbeatQN - QN_MATCH_TOLERANCE) return i;
  }
  return -1;
}

export function hasNudges(state: MarkerState): boolean {
  return state.measures.some((m) => m.nudges.length > 0);
}

export function countNudges(state: MarkerState): number {
  return state.measures.reduce((n, m) => n + m.nudges.length, 0);
}

/** Every nudge, qn-sorted — what gets persisted as params.nudges. */
export function nudgeList(state: MarkerState): NoteNudge[] {
  return state.measures.flatMap((m) => m.nudges.map((n) => ({ ...n }))).sort((a, b) => a.qn - b.qn);
}

/** The grid time of a musical position (no nudge applied). */
export function gridTime(state: MarkerState, qn: number): number {
  const map = anchorTimeMap(state);
  return map ? map.toVideoTime(qn) : state.tailVideoTimeSeconds;
}

/** The nudge on an onset, 0 when none. */
export function nudgeDelta(state: MarkerState, qn: number): number {
  const i = measureIndexForQN(state, qn);
  return i === -1 ? 0 : findDelta(state.measures[i], qn);
}

/** Effective time of a musical position: grid + nudge. */
export function noteTime(state: MarkerState, qn: number): number {
  return gridTime(state, qn) + nudgeDelta(state, qn);
}

interface TimelinePoint {
  qn: number;
  /** Grid time. */
  grid: number;
  delta: number;
  measureIndex: number;
  isOnset: boolean;
}

/**
 * Every point the effective map is made of, qn-sorted: anchors and onsets
 * (merged where they coincide). Unedited beats are derived, not points.
 */
function timelinePoints(state: MarkerState, map: WaypointTimeMap): TimelinePoint[] {
  const points: TimelinePoint[] = [];
  const push = (qn: number, grid: number, measureIndex: number, isOnset: boolean) => {
    const existing = points.find((p) => Math.abs(p.qn - qn) < QN_MATCH_TOLERANCE);
    if (existing) {
      existing.isOnset = existing.isOnset || isOnset;
      return;
    }
    const delta = measureIndex === -1 ? 0 : findDelta(state.measures[measureIndex], qn);
    points.push({ qn, grid, delta, measureIndex, isOnset });
  };
  state.measures.forEach((m, i) => {
    for (const beat of m.beats) {
      if (isAnchorBeat(beat)) push(beat.musicalPositionQN, beat.videoTimeSeconds, i, false);
    }
    for (const qn of m.onsetQNs) push(qn, map.toVideoTime(qn), i, true);
  });
  push(state.tailQN, state.tailVideoTimeSeconds, -1, false);
  return points.sort((a, b) => a.qn - b.qn);
}

/**
 * Open interval a nudged onset may occupy: its neighbours' effective times,
 * EPS away, so the materialized map stays strictly increasing.
 */
export function noteBounds(state: MarkerState, qn: number): { lo: number; hi: number } | null {
  const map = anchorTimeMap(state);
  if (!map) return null;
  const points = timelinePoints(state, map);
  const i = points.findIndex((p) => Math.abs(p.qn - qn) < QN_MATCH_TOLERANCE);
  if (i === -1) return null;
  const prev = points[i - 1];
  const next = points[i + 1];
  return {
    lo: prev ? prev.grid + prev.delta + EPS : -Infinity,
    hi: next ? next.grid + next.delta - EPS : Infinity,
  };
}

function withNudge(state: MarkerState, measureIndex: number, qn: number, delta: number): MarkerState {
  return {
    ...state,
    measures: state.measures.map((m, i) => {
      if (i !== measureIndex) return m;
      const rest = m.nudges.filter((n) => Math.abs(n.qn - qn) >= QN_MATCH_TOLERANCE);
      const nudges =
        Math.abs(delta) < NUDGE_EPS
          ? rest
          : [...rest, { qn, deltaSeconds: delta }].sort((a, b) => a.qn - b.qn);
      return { ...m, nudges };
    }),
  };
}

/**
 * Move one note to `proposedSeconds`: clamp between its neighbours, store the
 * difference from the grid as its nudge (or clear it when back on the grid).
 * Nothing else moves. Returns `state` untouched for a qn that is not an onset.
 */
export function setNoteTime(state: MarkerState, qn: number, proposedSeconds: number): MarkerState {
  const i = measureIndexForQN(state, qn);
  if (i === -1) return state;
  const m = state.measures[i];
  const onset = m.onsetQNs.find((q) => Math.abs(q - qn) < QN_MATCH_TOLERANCE);
  if (onset === undefined) return state;
  const bounds = noteBounds(state, onset);
  if (!bounds || bounds.lo > bounds.hi) return state;
  const clamped = Math.min(Math.max(proposedSeconds, bounds.lo), bounds.hi);
  return withNudge(state, i, onset, clamped - gridTime(state, onset));
}

export function setNoteDelta(state: MarkerState, qn: number, deltaSeconds: number): MarkerState {
  return setNoteTime(state, qn, gridTime(state, qn) + deltaSeconds);
}

export function clearNudge(state: MarkerState, qn: number): MarkerState {
  return setNoteDelta(state, qn, 0);
}

/**
 * One left-to-right pass re-clamping every nudge between its neighbours'
 * effective times (deltas ride along when anchors move, so spacing can
 * shrink). Returns the same reference when nothing changes.
 */
export function clampNudges(state: MarkerState): MarkerState {
  if (!hasNudges(state)) return state;
  const map = anchorTimeMap(state);
  if (!map) return state;
  const points = timelinePoints(state, map);
  let changed = false;
  const next = state.measures.map((m) => ({ ...m, nudges: m.nudges.map((n) => ({ ...n })) }));
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.delta === 0) continue;
    const prev = points[i - 1];
    const nxt = points[i + 1];
    const lo = prev ? prev.grid + prev.delta + EPS : -Infinity;
    const hi = nxt ? nxt.grid + nxt.delta - EPS : Infinity;
    const time = p.grid + p.delta;
    const clampedTime = lo <= hi ? Math.min(Math.max(time, lo), hi) : time;
    // Keep the stored delta byte-identical unless the clamp actually moved it.
    let delta = clampedTime === time ? p.delta : clampedTime - p.grid;
    if (Math.abs(delta) < NUDGE_EPS) delta = 0;
    if (delta !== p.delta) {
      changed = true;
      p.delta = delta;
      const m = next[p.measureIndex];
      m.nudges = m.nudges.filter((n) => Math.abs(n.qn - p.qn) >= QN_MATCH_TOLERANCE);
      if (delta !== 0) m.nudges.push({ qn: p.qn, deltaSeconds: delta });
      m.nudges.sort((a, b) => a.qn - b.qn);
    }
  }
  return changed ? { ...state, measures: next } : state;
}

/** Every onset at its effective time, time-sorted — what the waveform draws. */
export function noteTicks(state: MarkerState): NoteTick[] {
  const map = anchorTimeMap(state);
  const out: NoteTick[] = [];
  for (const m of state.measures) {
    for (const qn of m.onsetQNs) {
      const delta = findDelta(m, qn);
      out.push({
        measureNumber: m.measureNumber,
        qn,
        videoTimeSeconds: (map ? map.toVideoTime(qn) : state.tailVideoTimeSeconds) + delta,
        nudged: delta !== 0,
      });
    }
  }
  return out.sort((a, b) => a.videoTimeSeconds - b.videoTimeSeconds);
}

/**
 * Bars whose span intersects an interpolation segment bent by a nudge: the
 * segments between the anchors bracketing each nudged qn (both sides when the
 * nudge sits on an anchor). These bars must emit all their onsets.
 */
function bentMeasureIndices(state: MarkerState): number[] {
  const anchors = anchorMarkers(state).map((a) => a.qn);
  const out = new Set<number>();
  for (const m of state.measures) {
    for (const n of m.nudges) {
      let lo = -Infinity;
      let hi = Infinity;
      for (const a of anchors) {
        if (a < n.qn - QN_MATCH_TOLERANCE) lo = Math.max(lo, a);
        else if (a > n.qn + QN_MATCH_TOLERANCE) hi = Math.min(hi, a);
      }
      state.measures.forEach((mm, i) => {
        const start = mm.downbeatQN;
        const end = state.measures[i + 1]?.downbeatQN ?? state.tailQN;
        if (start < hi && end > lo) out.add(i);
      });
    }
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * Refresh each bar's onset list after a score edit (note edits do not change
 * structuralSignature, so reconcileMarkers never sees them). Nudges whose
 * onset vanished are pruned. Returns the SAME reference when nothing changed,
 * so callers can use identity to decide whether the sync is dirty.
 */
export function syncOnsets(state: MarkerState, onsets: OnsetIndex): MarkerState {
  let changed = false;
  const measures = state.measures.map((m) => {
    const fresh = onsets.get(m.measureNumber) ?? [];
    const same =
      fresh.length === m.onsetQNs.length &&
      fresh.every((q, i) => Math.abs(q - m.onsetQNs[i]) < QN_MATCH_TOLERANCE);
    const nudges = m.nudges.filter((n) => fresh.some((q) => Math.abs(q - n.qn) < QN_MATCH_TOLERANCE));
    if (same && nudges.length === m.nudges.length) return m;
    changed = true;
    return { ...m, onsetQNs: fresh, nudges };
  });
  return changed ? clampNudges({ ...state, measures }) : state;
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
  // 1. Harvest preserved video times keyed by identity. Nudges are keyed by
  //    (measure, offset into the bar) so they follow their bar when an upstream
  //    change shifts the qn axis; a nudge whose offset is no longer an onset drops.
  const downbeatTimes = new Map<number, number>();
  const editedBeatTimes = new Map<string, number>();
  const nudgesByMeasure = new Map<number, Array<{ offsetQN: number; deltaSeconds: number }>>();
  for (const m of prevState.measures) {
    if (m.nudges.length) {
      nudgesByMeasure.set(
        m.measureNumber,
        m.nudges.map((n) => ({ offsetQN: n.qn - m.downbeatQN, deltaSeconds: n.deltaSeconds }))
      );
    }
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
  const rebuilt = seedMarkerState(track, score, cleaned);
  if (nudgesByMeasure.size === 0) return rebuilt;

  // 5. Re-attach nudges whose bar survived and whose offset is still an onset.
  const nudges: NoteNudge[] = [];
  for (const m of rebuilt.measures) {
    for (const n of nudgesByMeasure.get(m.measureNumber) ?? []) {
      const qn = m.downbeatQN + n.offsetQN;
      const onset = m.onsetQNs.find((q) => Math.abs(q - qn) < QN_MATCH_TOLERANCE);
      if (onset !== undefined) nudges.push({ qn: onset, deltaSeconds: n.deltaSeconds });
    }
  }
  return nudges.length ? seedMarkerState(track, score, markerStateToWaypoints(rebuilt, { includeBeats: 'edited-beats', includeNudges: false }), nudges) : rebuilt;
}
