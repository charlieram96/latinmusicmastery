// "Auto-place bars" (spec §7): fit one steady tempo to the score's note onsets
// against the detected hits (widening the window as the fit firms up), lay
// every bar on that line, then let each bar settle onto the hit under its first
// attacked note. Pure: SyncPanel tweens to the result and keeps the old markers
// for one-step undo.
import { EPS, freeCorridor, type MarkerState, type TimeRange } from '@/components/playsense-studio/sync/marker-model';
import { nearestHit } from './hits';

const SETTLE_S = 0.09;
/** Final-acceptance thresholds (spec §7 fix round 1): a one-to-one match
 *  ratio and an RMS-residual ceiling tight enough that noise can't pass. */
const MIN_MATCH_RATIO = 0.7;
const MAX_RMS_S = 0.04;
/** Fix round 3: also this share of the onsets within TIGHT_S of their hit. */
const MIN_TIGHT_RATIO = 0.7;

/** Auto-place is a LOCAL refinement: the markers decide which beat is which,
 *  and only the fine offset and the tempo move. Offset candidates are hits
 *  within half a beat of where the markers put the notes in the first
 *  OPENING_SEED_QN quarter notes (not just the first note, so a missed first
 *  hit still leaves candidates). */
const OPENING_SEED_QN = 3;
/** A refined line must stay within half a beat of the markers, measured at
 *  the middle of the first OPENING_CHECK_ONSETS onsets. */
const OPENING_CHECK_ONSETS = 8;
/** Each fit window is re-fitted at these tightening tolerances. Loose enough
 *  for a sloppy note, tight enough to drop a line tilted across the notes. */
const POLISH_TOLS_S = [0.06, 0.04, 0.04];
/** The anchored opening fit: slopes within this fraction of the markers'
 *  tempo, scored by onsets within ANCHOR_TOL_S of a hit. */
const SLOPE_RANGE = 0.1;
const ANCHOR_TOL_S = 0.02;
/** Candidates rank first by onsets matched within this (the bar flag's "more
 *  than 30 ms off" line), then by the gate's wide count, then by RMS. Among
 *  dense extra hits the wide 0.12 s tolerance matches nearly every onset on
 *  any line, so the wide count alone can prefer a loose line (40 ms RMS)
 *  with one more match over the tight line through the played notes. */
const TIGHT_S = 0.03;

/** Index of the first hit >= t (hits sorted ascending). */
function lowerBound(hits: number[], t: number): number {
  let lo = 0;
  let hi = hits.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (hits[mid] < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** For each `predicted` time (in order), the nearest not-yet-used hit within
 *  `tol`, else null. Each hit is consumed at most once, so a hit that happens
 *  to sit near several onsets can't be counted as if it matched all of them
 *  (the many-to-one gate that noise reliably passed). Binary search plus a
 *  short scan past used hits keeps it O(n log h) on long, dense recordings. */
function matchOneToOne(predicted: number[], hits: number[], tol: number): Array<number | null> {
  const used = new Uint8Array(hits.length);
  return predicted.map((p) => {
    const i = lowerBound(hits, p);
    let best = -1;
    for (let j = i - 1; j >= 0 && p - hits[j] <= tol; j--) {
      if (!used[j]) { best = j; break; }
    }
    for (let j = i; j < hits.length && hits[j] - p <= tol; j++) {
      if (used[j]) continue;
      if (best === -1 || hits[j] - p < p - hits[best]) best = j;
      break;
    }
    if (best === -1) return null;
    used[best] = 1;
    return hits[best];
  });
}

const fitTol = (b: number) => Math.min(0.12, 0.3 * b);

/** Least-squares line through the one-to-one matches of `xs` within `tol`,
 *  or null with fewer than 3 matches or a non-positive slope. */
function fitMatches(xs: number[], hits: number[], a: number, b: number, tol: number): { a: number; b: number } | null {
  const matches = matchOneToOne(xs.map((x) => a + b * x), hits, tol);
  const px: number[] = [];
  const py: number[] = [];
  matches.forEach((h, k) => {
    if (h === null) return;
    px.push(xs[k]);
    py.push(h);
  });
  const count = px.length;
  if (count < 3) return null;
  const mx = px.reduce((sum, x) => sum + x, 0) / count;
  const my = py.reduce((sum, y) => sum + y, 0) / count;
  let sxx = 0;
  let sxy = 0;
  for (let k = 0; k < count; k++) {
    sxx += (px[k] - mx) ** 2;
    sxy += (px[k] - mx) * (py[k] - my);
  }
  if (sxx === 0) return { a: a + my - (a + b * mx), b }; // one distinct position: shift only
  if (sxy <= 0) return null;
  const nb = sxy / sxx;
  return { a: my - nb * mx, b: nb };
}

/** Tempo from the seed: the seed hit is taken as right, so only the slope is
 *  unknown. Try the slope through every hit near an opening onset (within
 *  ±SLOPE_RANGE of the markers' tempo) and keep the one that puts the most
 *  opening onsets within ANCHOR_TOL_S of a hit, then refit on those. Dense
 *  extra hits drag a plain least-squares fit of the opening off by a percent
 *  or two, which is a whole beat by the end of a long section. */
function anchoredOpening(
  xs: number[],
  hits: number[],
  anchor: { x: number; t: number },
  b0: number
): { a: number; b: number } | null {
  const win = xs.slice(0, Math.min(8, xs.length));
  const tol = fitTol(b0);
  let bestB = b0;
  let bestCount = -1;
  let bestSse = Infinity;
  const consider = (b: number) => {
    const a = anchor.t - b * anchor.x;
    const matches = matchOneToOne(win.map((x) => a + b * x), hits, ANCHOR_TOL_S);
    let count = 0;
    let sse = 0;
    matches.forEach((h, k) => {
      if (h === null) return;
      count++;
      sse += (h - (a + b * win[k])) ** 2;
    });
    if (count > bestCount || (count === bestCount && sse < bestSse)) {
      bestB = b;
      bestCount = count;
      bestSse = sse;
    }
  };
  consider(b0);
  for (const x of win) {
    if (x === anchor.x) continue;
    const p = anchor.t + b0 * (x - anchor.x);
    for (let i = lowerBound(hits, p - tol); i < hits.length && hits[i] <= p + tol; i++) {
      const b = (hits[i] - anchor.t) / (x - anchor.x);
      if (Math.abs(b / b0 - 1) <= SLOPE_RANGE) consider(b);
    }
  }
  const a = anchor.t - bestB * anchor.x;
  return fitMatches(win, hits, a, bestB, ANCHOR_TOL_S) ?? { a, b: bestB };
}

/** The growing-window least-squares fit: time = a + b * x, x = qn - qn0.
 *  Starts on the first 8 onsets (from `anchoredOpening` when the seed is a
 *  hit) and doubles the window each pass. Matching is one-to-one (each hit
 *  used once), so dense extra hits can't all pile onto the line, and each
 *  window's fit is trimmed at tightening tolerances (POLISH_TOLS_S): with the
 *  wide fit tolerance alone, a line tilted across the played notes can match
 *  them all loosely (tens of ms RMS) and outscore the tight line through
 *  them. A window with fewer than 3 matches ends the candidate (null):
 *  carrying an unfitted line into a wider window is how a fit used to lock on
 *  a whole beat away. */
function refineFit(
  xs: number[],
  hits: number[],
  a0: number,
  b0: number,
  anchor: { x: number; t: number } | null
): { a: number; b: number } | null {
  let line: { a: number; b: number } | null = anchor ? anchoredOpening(xs, hits, anchor, b0) : { a: a0, b: b0 };
  if (!line) return null;
  for (let n = Math.min(8, xs.length); ; n = Math.min(xs.length, n * 2)) {
    const win = xs.slice(0, n);
    line = fitMatches(win, hits, line.a, line.b, fitTol(line.b));
    if (!line) return null;
    for (const tol of POLISH_TOLS_S) {
      const next = fitMatches(win, hits, line.a, line.b, Math.min(tol, fitTol(line.b)));
      if (!next) break;
      line = next;
    }
    if (n === xs.length) break;
  }
  return line;
}

interface Fit { a: number; b: number; count: number; tight: number; rms: number }

/** One-to-one matched count, how many of those sit within TIGHT_S, and the
 *  matched pairs' RMS residual for a fitted line over every onset. */
function scoreFit(xs: number[], hits: number[], a: number, b: number): Omit<Fit, 'a' | 'b'> {
  const predicted = xs.map((x) => a + b * x);
  const matches = matchOneToOne(predicted, hits, fitTol(b));
  let count = 0;
  let tight = 0;
  let sumSq = 0;
  matches.forEach((h, i) => {
    if (h === null) return;
    count++;
    if (Math.abs(h - predicted[i]) <= TIGHT_S) tight++;
    sumSq += (h - predicted[i]) ** 2;
  });
  return { count, tight, rms: count ? Math.sqrt(sumSq / count) : Infinity };
}

export function autoPlaceBars(
  state: MarkerState,
  allHits: number[],
  window: { start: number; end: number }
): { state: MarkerState; matched: number; settled: number } | null {
  const hits = allHits.filter((h) => h >= window.start && h <= window.end).sort((x, y) => x - y);
  const onsetQNs = state.measures.flatMap((m) => m.onsetQNs);
  if (onsetQNs.length < 4 || hits.length < 4 || state.measures.length === 0) return null;

  // Start from the current markers: time = a + b * (qn - qn0).
  const qn0 = onsetQNs[0];
  const xs = onsetQNs.map((qn) => qn - qn0);
  const first = state.measures[0];
  const last = state.measures[state.measures.length - 1];
  const spanQN = state.tailQN - first.downbeatQN;
  const b0 = spanQN > 0 ? (state.tailVideoTimeSeconds - first.beats[0].videoTimeSeconds) / spanQN : 0.5;
  if (!(b0 > 0)) return null;
  const a0 = first.beats[0].videoTimeSeconds + (qn0 - first.downbeatQN) * b0;

  // Local search. Seed the fit at the current offset, and at every offset
  // that puts one of the opening notes on a hit within half a beat of where
  // the markers have it. Refine each seed, drop any line that has drifted half
  // a beat or more from the markers over the opening, and keep the one with
  // the most onsets within TIGHT_S of a hit (one-to-one, over ALL onsets),
  // then the most within the wide tolerance, then the lowest RMS.
  // Whole-beat alternatives (a count-in, playing that continues past the
  // section, a stray hit past the end) are never considered: the markers
  // decide which beat is which.
  const half = 0.5 * b0;
  const seeds: Array<{ d: number; anchor: { x: number; t: number } | null }> = [{ d: 0, anchor: null }];
  for (let k = 0; k < xs.length && (k === 0 || xs[k] <= OPENING_SEED_QN); k++) {
    const p = a0 + b0 * xs[k];
    for (let i = lowerBound(hits, p - half); i < hits.length && hits[i] <= p + half; i++) {
      seeds.push({ d: hits[i] - p, anchor: { x: xs[k], t: hits[i] } });
    }
  }
  const checkN = Math.min(OPENING_CHECK_ONSETS, xs.length);
  const xm = xs.slice(0, checkN).reduce((sum, x) => sum + x, 0) / checkN;
  let best: Fit | null = null;
  for (const { d, anchor } of seeds) {
    const fit = refineFit(xs, hits, a0 + d, b0, anchor);
    if (!fit) continue;
    const { a, b } = fit;
    if (Math.abs(a + b * xm - (a0 + b0 * xm)) >= 0.5 * b) continue;
    const score = scoreFit(xs, hits, a, b);
    if (
      !best ||
      score.tight > best.tight ||
      (score.tight === best.tight && (score.count > best.count || (score.count === best.count && score.rms < best.rms)))
    ) {
      best = { a, b, ...score };
    }
  }
  if (!best) return null;
  const { a, b } = best;
  const matched = best.count;

  // Final acceptance gate: at least 70% of the onsets land their own hit, and
  // the matched pairs sit tight on the line. Real playing lines up far better
  // than 40 ms RMS against a correct fit; noise essentially never does.
  if (matched < MIN_MATCH_RATIO * onsetQNs.length || best.rms > MAX_RMS_S) return null;
  // And at least 70% of the onsets sit within TIGHT_S. Dense noise (300 hits
  // over 45 s) puts some hit within 0.12 s of 80% of any line's onsets at
  // around 40 ms RMS, right on the gate; played notes sit within a few ms.
  if (best.tight < MIN_TIGHT_RATIO * onsetQNs.length) return null;

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

  // Every BAR stays inside the window. The tail is softer: a trim-out just
  // short of the natural tail clamps it, as long as the last bar keeps at
  // least 50 ms. The last bar keeps the fitted beat spacing; beats that would
  // fall past a clamped tail are clipped just under it rather than squeezing
  // the whole bar.
  const lo = window.start;
  const hi = window.end;
  const lastDown = downs[downs.length - 1];
  if (downs.some((d) => d < lo || d > hi) || lastDown + 0.05 > hi) return null;
  const tail = Math.min(lastDown + (state.tailQN - last.downbeatQN) * b, hi);

  const measures = state.measures.map((m, i) => {
    const start = downs[i];
    if (i === downs.length - 1) {
      const times = m.beats.map((bt) => start + (bt.musicalPositionQN - m.downbeatQN) * b);
      // Clip from the end so clipped beats stay strictly increasing below the tail.
      for (let j = times.length - 1, ceiling = tail - EPS; j > 0; j--, ceiling -= EPS) {
        if (times[j] > ceiling) times[j] = ceiling;
        else break;
      }
      return { ...m, beats: m.beats.map((bt, j) => ({ ...bt, videoTimeSeconds: times[j], edited: false })) };
    }
    const end = downs[i + 1];
    const secPerQN = (end - start) / (state.measures[i + 1].downbeatQN - m.downbeatQN);
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
