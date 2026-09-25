// "Auto-place bars" (spec §7): fit one steady tempo to the score's note onsets
// against the detected hits (widening the window as the fit firms up), lay
// every bar on that line, then let each bar settle onto the hit under its first
// attacked note. Pure: SyncPanel tweens to the result and keeps the old markers
// for one-step undo.
import { freeCorridor, type MarkerState, type TimeRange } from '@/components/playsense-studio/sync/marker-model';
import { nearestHit } from './hits';

const SETTLE_S = 0.09;
/** Final-acceptance thresholds (spec §7 fix round 1): a one-to-one match
 *  ratio and an RMS-residual ceiling tight enough that noise can't pass. */
const MIN_MATCH_RATIO = 0.7;
const MAX_RMS_S = 0.04;

interface Onset { qn: number }

/** For each `predicted` time (qn-ordered), the nearest not-yet-used hit
 *  within `tol`, else null. Each hit is consumed at most once, so a hit that
 *  happens to sit near several onsets can't be double-counted as if it
 *  matched all of them — the many-to-one gate that noise reliably passed. */
function matchOneToOne(predicted: number[], hits: number[], tol: number): Array<number | null> {
  const used = new Array<boolean>(hits.length).fill(false);
  return predicted.map((p) => {
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let j = 0; j < hits.length; j++) {
      if (used[j]) continue;
      const d = Math.abs(hits[j] - p);
      if (d <= tol && d < bestDist) {
        bestDist = d;
        bestIdx = j;
      }
    }
    if (bestIdx === -1) return null;
    used[bestIdx] = true;
    return hits[bestIdx];
  });
}

export function autoPlaceBars(
  state: MarkerState,
  allHits: number[],
  window: { start: number; end: number }
): { state: MarkerState; matched: number; settled: number } | null {
  const hits = allHits.filter((h) => h >= window.start && h <= window.end).sort((x, y) => x - y);
  const onsets: Onset[] = state.measures.flatMap((m) => m.onsetQNs.map((qn) => ({ qn })));
  if (onsets.length < 4 || hits.length < 4 || state.measures.length === 0) return null;

  // Start from the current markers: time = a + b * (qn - qn0).
  const qn0 = onsets[0].qn;
  const first = state.measures[0];
  const last = state.measures[state.measures.length - 1];
  const spanQN = state.tailQN - first.downbeatQN;
  let b = spanQN > 0 ? (state.tailVideoTimeSeconds - first.beats[0].videoTimeSeconds) / spanQN : 0.5;
  let a = first.beats[0].videoTimeSeconds + (qn0 - first.downbeatQN) * b;

  // Coarse offset search: the markers may start well away from the playing
  // (further than the fit tolerance), so first try putting the first onset on
  // each hit within ±2 s and keep the offset that lines up the most onsets.
  // Scored over up to 32 onsets (8 bars) rather than 8, so a short-lived
  // coincidence doesn't look as good as the real alignment.
  //
  // A PERFECT tie (every probed onset matches) is a genuine ambiguity — most
  // often a steady count-in click continuing the very same tempo grid as the
  // real playing, so it lines up exactly as many onsets as the true downbeat.
  // Those ties go to the candidate NEAREST the markers' current position, not
  // the earliest hit — otherwise a count-in reliably wins (it's first in
  // ascending order) and drags an already-correct bar a whole count-in early.
  // A merely-highest (imperfect) tie means the coarse tempo estimate itself is
  // still off — e.g. wrong start AND wrong tempo together — and every
  // candidate aliases the same way against it; here "nearest" carries no real
  // signal (proximity to a wrong `a` is coincidental), so the earliest match
  // is kept, same as before, and the growing-window fit below does the real
  // work of finding the true tempo.
  {
    const seedA = a;
    const tol0 = Math.min(0.12, 0.3 * b);
    const probe = onsets.slice(0, Math.min(32, onsets.length));
    let bestA = a;
    let bestCount = -1;
    let bestDist = Infinity;
    for (const h of hits) {
      if (Math.abs(h - seedA) > 2) continue;
      const count = probe.filter((o) => nearestHit(hits, h + b * (o.qn - qn0), tol0) !== null).length;
      const dist = Math.abs(h - seedA);
      const isPerfect = count === probe.length;
      const better = count > bestCount || (count === bestCount && isPerfect && dist < bestDist);
      if (better) {
        bestCount = count;
        bestDist = dist;
        bestA = h;
      }
    }
    a = bestA;
  }

  let matched = 0;
  for (let n = Math.min(8, onsets.length); ; n = Math.min(onsets.length, n * 2)) {
    const tol = Math.min(0.12, 0.3 * b);
    const pairs: Array<[number, number]> = [];
    for (const o of onsets.slice(0, n)) {
      const h = nearestHit(hits, a + b * (o.qn - qn0), tol);
      if (h !== null) pairs.push([o.qn - qn0, h]);
    }
    if (pairs.length >= 3) {
      const mx = pairs.reduce((s, p) => s + p[0], 0) / pairs.length;
      const my = pairs.reduce((s, p) => s + p[1], 0) / pairs.length;
      const sxx = pairs.reduce((s, p) => s + (p[0] - mx) ** 2, 0);
      if (sxx > 0) {
        b = pairs.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / sxx;
        a = my - b * mx;
      }
    }
    matched = pairs.length;
    if (n === onsets.length) break;
  }
  if (b <= 0) return null;

  // Final acceptance gate: a clean ONE-TO-ONE match against the fitted line
  // (each hit used at most once), unlike the many-to-one matching above, which
  // is only good enough to steer the iterative fit — noise easily has SOME
  // hit near many different onsets, but not one each. At least 70% of the
  // onsets must land their own hit, and the matched pairs' RMS residual
  // against the line must be tight: real playing lines up far better than
  // 40 ms RMS against a correct fit; noise essentially never does.
  {
    const finalTol = Math.min(0.12, 0.3 * b);
    const predicted = onsets.map((o) => a + b * (o.qn - qn0));
    const finalMatches = matchOneToOne(predicted, hits, finalTol);
    let matchCount = 0;
    let sumSq = 0;
    finalMatches.forEach((h, i) => {
      if (h === null) return;
      matchCount++;
      sumSq += (h - predicted[i]) ** 2;
    });
    matched = matchCount;
    if (matched < MIN_MATCH_RATIO * onsets.length) return null;
    if (Math.sqrt(sumSq / matched) > MAX_RMS_S) return null;
  }

  const at = (qn: number) => a + b * (qn - qn0);
  // Lay the downbeats, then settle each onto the hit under its first note.
  const downs = state.measures.map((m) => at(m.downbeatQN));
  let settled = 0;
  state.measures.forEach((m, i) => {
    if (!m.onsetQNs.length) return;
    const predicted = at(m.onsetQNs[0]);
    const h = nearestHit(hits, predicted, SETTLE_S);
    if (h === null) return;
    const next = downs[i] + (h - predicted);
    const prevOk = i === 0 || next > downs[i - 1] + 0.01;
    const nextOk = i === downs.length - 1 || next < at(state.measures[i + 1].downbeatQN) - 0.01;
    if (prevOk && nextOk) { downs[i] = next; if (Math.abs(h - predicted) > 1e-6) settled++; }
  });
  let tail = downs[downs.length - 1] + (state.tailQN - last.downbeatQN) * b;

  // Keep every BAR inside the window — that's the hard constraint. The tail is
  // softer: a trim-out landing just past the natural tail (e.g. right after the
  // last note's hit) is a false failure, not a real one, so it's clamped to the
  // window end instead (floored 0.05 s past the last downbeat) rather than
  // failing the whole placement.
  const lo = window.start;
  const hi = window.end;
  if (downs.some((d) => d < lo || d > hi)) return null;
  const minTail = downs[downs.length - 1] + 0.05;
  tail = Math.max(minTail, Math.min(tail, hi));

  const measures = state.measures.map((m, i) => {
    const start = downs[i];
    const end = i + 1 < downs.length ? downs[i + 1] : tail;
    const endQN = i + 1 < state.measures.length ? state.measures[i + 1].downbeatQN : state.tailQN;
    const secPerQN = (end - start) / (endQN - m.downbeatQN);
    return {
      ...m,
      beats: m.beats.map((bt) => ({ ...bt, videoTimeSeconds: start + (bt.musicalPositionQN - m.downbeatQN) * secPerQN, edited: false })),
    };
  });
  return { state: { ...state, measures, tailVideoTimeSeconds: tail }, matched, settled };
}

/**
 * Narrows a trim window to the free corridor around `span` (the section's own
 * current footprint), so Auto-place never places a bar over a sibling
 * section. `freeCorridor` returns ±Infinity on a side with no neighbour there
 * (or when a neighbour already overlaps `span`), so Math.max/min leave that
 * side of `window` untouched.
 */
export function windowWithinCorridor(
  window: { start: number; end: number },
  span: TimeRange,
  siblingRanges: TimeRange[]
): { start: number; end: number } {
  const corridor = freeCorridor(span, siblingRanges);
  return {
    start: Math.max(window.start, corridor.lo),
    end: Math.min(window.end, corridor.hi),
  };
}

export function lerpMarkers(a: MarkerState, b: MarkerState, t: number): MarkerState {
  if (t >= 1) return b;
  if (a.measures.length !== b.measures.length) return b;
  const k = Math.max(0, t);
  const mix = (x: number, y: number) => x + (y - x) * k;
  const measures = b.measures.map((mb, i) => {
    const ma = a.measures[i];
    if (!ma || ma.beats.length !== mb.beats.length) return mb;
    return { ...mb, beats: mb.beats.map((bb, j) => ({ ...bb, videoTimeSeconds: mix(ma.beats[j].videoTimeSeconds, bb.videoTimeSeconds) })) };
  });
  return { ...b, measures, tailVideoTimeSeconds: mix(a.tailVideoTimeSeconds, b.tailVideoTimeSeconds) };
}
