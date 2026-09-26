// Pure helpers that tie detected hits (lib/playsense-studio/onset-detect.ts)
// to the sync markers: snapping a dragged bar or section, and flagging bars
// whose first note or tempo doesn't match the recording (spec §7).
import {
  anchorTimeMap,
  type MarkerRef,
  type MarkerState,
  type MeasureMarker,
} from '@/components/playsense-studio/sync/marker-model';
import type { WaypointTimeMap } from '@/components/playsense-studio/shared/time-map/time-map';

export const SNAP_PX = 8;
const NO_HIT_S = 0.09;
const OFF_S = 0.03;
const TEMPO_TOLERANCE = 0.05;

export type BarFlag = { kind: 'no-hit' } | { kind: 'off'; ms: number } | { kind: 'tempo'; pct: number };

export function nearestHit(hits: number[], t: number, tol: number): number | null {
  if (!hits.length) return null;
  let lo = 0;
  let hi = hits.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (hits[mid] < t) lo = mid + 1;
    else hi = mid;
  }
  let best: number | null = null;
  // Track the winning distance directly instead of recomputing it from `best`,
  // and require a margin (not a bare `<`) before displacing it: `t - hits[lo-1]`
  // and `hits[lo] - t` are two independent subtractions, so a genuine tie
  // (equal distance either side) can land ~1 ULP apart and must not flip the
  // result to the later hit. Ties keep the earlier hit (lo - 1 before lo).
  const TIE_EPS = 1e-9;
  let bestDist = Infinity;
  for (const i of [lo - 1, lo]) {
    if (i < 0 || i >= hits.length) continue;
    const d = Math.abs(hits[i] - t);
    if (d <= tol && d < bestDist - TIE_EPS) {
      best = hits[i];
      bestDist = d;
    }
  }
  return best;
}

/** Effective time (grid + nudge, as noteTime) of a bar's first attacked note,
 *  or null for a bar without onsets. */
export function firstAttackTime(state: MarkerState, measureIndex: number): number | null {
  return firstAttackOn(state, anchorTimeMap(state), measureIndex);
}

/** firstAttackTime on an already-built grid, so a pass over every bar builds
 *  the anchor map once instead of once per bar. */
function firstAttackOn(state: MarkerState, grid: WaypointTimeMap | null, measureIndex: number): number | null {
  const m = state.measures[measureIndex];
  if (!m || !m.onsetQNs.length) return null;
  const qn = m.onsetQNs[0];
  return (grid ? grid.toVideoTime(qn) : state.tailVideoTimeSeconds) + nudgeIn(m, qn);
}

/** The nudge on one of this bar's onsets, 0 when none (nudgeDelta, without the bar lookup). */
function nudgeIn(m: MeasureMarker, qn: number): number {
  return m.nudges.find((n) => Math.abs(n.qn - qn) < 1e-6)?.deltaSeconds ?? 0;
}

export function snapBarTime(
  proposed: number,
  firstNoteOffset: number | null,
  hits: number[],
  tol: number
): { time: number; snapped: boolean } {
  let best: { time: number; dist: number } | null = null;
  const line = nearestHit(hits, proposed, tol);
  if (line !== null) best = { time: line, dist: Math.abs(line - proposed) };
  if (firstNoteOffset !== null) {
    const note = nearestHit(hits, proposed + firstNoteOffset, tol);
    if (note !== null) {
      const dist = Math.abs(note - (proposed + firstNoteOffset));
      if (!best || dist < best.dist) best = { time: note - firstNoteOffset, dist };
    }
  }
  return best ? { time: best.time, snapped: true } : { time: proposed, snapped: false };
}

/**
 * Where a dragged marker snaps, before any clamp: a downbeat snaps its bar
 * line or its first attacked note onto a hit, whichever is closer; an expanded
 * beat handle snaps only its own line. The caller clamps the result against
 * its neighbours and the corridor afterwards, so a snap never breaks a clamp.
 *
 * The first-note offset is measured on the markers as they are. A ripple
 * drag moves the whole bar, so the note keeps that offset exactly; a single
 * drag moves only the downbeat and re-spreads the bar, so there the snapped
 * note is approximate (off by however much its offset stretches).
 */
export function snapMarkerDrag(
  state: MarkerState,
  ref: MarkerRef,
  proposed: number,
  hits: number[],
  tol: number
): number {
  if (!hits.length) return proposed;
  const mi = state.measures.findIndex((m) => m.measureNumber === ref.measureNumber);
  const first = ref.beatInMeasure === 1 && mi >= 0 ? firstAttackTime(state, mi) : null;
  const offset = first !== null ? first - state.measures[mi].beats[0].videoTimeSeconds : null;
  return snapBarTime(proposed, offset, hits, tol).time;
}

export function snapSectionShift(firstNoteTime: number, delta: number, hits: number[], tol: number): number {
  const hit = nearestHit(hits, firstNoteTime + delta, tol);
  return hit === null ? delta : hit - firstNoteTime;
}

export function barFlags(state: MarkerState, hits: number[]): Map<number, BarFlag> {
  const out = new Map<number, BarFlag>();
  if (!hits.length) return out;
  const ms = state.measures;
  const spq = ms.map((m, i) => {
    const start = m.beats[0].videoTimeSeconds;
    const next = ms[i + 1];
    const end = next ? next.beats[0].videoTimeSeconds : state.tailVideoTimeSeconds;
    const qn = (next ? next.downbeatQN : state.tailQN) - m.downbeatQN;
    return qn > 0 ? (end - start) / qn : NaN;
  });
  const median = medianOf(spq.filter(Number.isFinite));
  const grid = anchorTimeMap(state);
  ms.forEach((m, i) => {
    const t = firstAttackOn(state, grid, i);
    if (t !== null) {
      const h = nearestHit(hits, t, NO_HIT_S);
      if (h === null) { out.set(m.measureNumber, { kind: 'no-hit' }); return; }
      const off = Math.abs(h - t);
      if (off > OFF_S) { out.set(m.measureNumber, { kind: 'off', ms: Math.round(off * 1000) }); return; }
    }
    if (Number.isFinite(median) && Number.isFinite(spq[i])) {
      const dev = Math.abs(spq[i] / median - 1);
      if (dev > TEMPO_TOLERANCE) out.set(m.measureNumber, { kind: 'tempo', pct: Math.round(dev * 100) });
    }
  });
  return out;
}

/** The true median: the mean of the two middle values for an even count. */
function medianOf(values: number[]): number {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function flagText(flag: BarFlag): string {
  if (flag.kind === 'no-hit') return 'No hit near the first note';
  if (flag.kind === 'off') return `First note ${flag.ms} ms off the recording`;
  return `Tempo ${flag.pct}% off the other bars`;
}
