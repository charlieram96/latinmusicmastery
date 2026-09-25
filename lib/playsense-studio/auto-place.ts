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

/** Candidate offsets are the hits within this many seconds of the markers'
 *  current first-onset time. */
const SEARCH_S = 2;
/** Floor on the residual sigma used to tell equal-count fits apart, so
 *  jitter-free (synthetic) hits don't make every tiny residual look loose. */
const TIE_SIGMA_FLOOR_S = 0.002;

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

/** The growing-window least-squares fit: time = a + b * x, x = qn - qn0.
 *  Starts on the first 8 onsets and doubles the window each pass, matching
 *  each onset to its nearest hit (many-to-one is fine here: this only steers). */
function refineFit(xs: number[], hits: number[], a0: number, b0: number): { a: number; b: number } {
  let a = a0;
  let b = b0;
  for (let n = Math.min(8, xs.length); ; n = Math.min(xs.length, n * 2)) {
    const tol = fitTol(b);
    let count = 0;
    let sx = 0;
    let sy = 0;
    const px: number[] = [];
    const py: number[] = [];
    for (let k = 0; k < n; k++) {
      const h = nearestHit(hits, a + b * xs[k], tol);
      if (h === null) continue;
      px.push(xs[k]);
      py.push(h);
      sx += xs[k];
      sy += h;
      count++;
    }
    if (count >= 3) {
      const mx = sx / count;
      const my = sy / count;
      let sxx = 0;
      let sxy = 0;
      for (let k = 0; k < count; k++) {
        sxx += (px[k] - mx) ** 2;
        sxy += (px[k] - mx) * (py[k] - my);
      }
      if (sxx > 0 && sxy > 0) {
        b = sxy / sxx;
        a = my - b * mx;
      }
    }
    if (n === xs.length) break;
  }
  return { a, b };
}

interface Fit { a: number; b: number; count: number; rms: number; residuals: number[]; dist: number }

/** One-to-one matched count, the matched pairs' absolute residuals and their
 *  RMS, for a fitted line over every onset. */
function scoreFit(xs: number[], hits: number[], a: number, b: number): Omit<Fit, 'a' | 'b' | 'dist'> {
  const predicted = xs.map((x) => a + b * x);
  const matches = matchOneToOne(predicted, hits, fitTol(b));
  const residuals: number[] = [];
  let sumSq = 0;
  matches.forEach((h, i) => {
    if (h === null) return;
    const r = Math.abs(h - predicted[i]);
    residuals.push(r);
    sumSq += r * r;
  });
  const count = residuals.length;
  return { count, residuals, rms: count ? Math.sqrt(sumSq / count) : Infinity };
}

/**
 * Picks the refined fit. The most one-to-one matches wins. Among equal counts
 * the fit nearest the current offset wins: a steady count-in continuing the
 * same tempo grid lines up exactly as many onsets as the true downbeat, and
 * only the markers know which one the user meant. RMS decides after that.
 *
 * One refinement: an equal-count fit is only a true tie when its matches are
 * as tight as the others'. Two readings a beat apart share every hit but the
 * ones at the ends, so when one of them needs an extra LOOSE match (a residual
 * over 3 sigma, sigma being the tightest tied fit's RMS, floored at 2 ms) to
 * reach the same count, that match is a stray noise hit rather than a played
 * note, and the fit drops out before the nearest-offset rule. Without this,
 * noise landing just past the last note lets a beat-shifted reading tie the
 * truth and win on proximity. A sloppy note shared by every reading counts
 * against all of them equally, so it changes nothing.
 */
function pickFit(fits: Fit[]): Fit | null {
  if (!fits.length) return null;
  const top = Math.max(...fits.map((f) => f.count));
  const tied = fits.filter((f) => f.count === top);
  const sigma = Math.max(Math.min(...tied.map((f) => f.rms)), TIE_SIGMA_FLOOR_S);
  const loose = (f: Fit) => f.residuals.filter((r) => r > 3 * sigma).length;
  const fewest = Math.min(...tied.map(loose));
  const close = tied.filter((f) => loose(f) === fewest);
  return close.reduce((best, f) =>
    f.dist < best.dist - 1e-6 || (Math.abs(f.dist - best.dist) <= 1e-6 && f.rms < best.rms) ? f : best
  );
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

  // Offset search. The markers may start well away from the playing (further
  // than the fit tolerance), so seed the fit at every hit within ±2 s of the
  // current first-onset time (and at the current offset itself), refine each
  // with the growing-window fit, and score the refined line over ALL onsets.
  const seeds = [a0];
  for (let i = lowerBound(hits, a0 - SEARCH_S); i < hits.length && hits[i] <= a0 + SEARCH_S; i++) seeds.push(hits[i]);
  const fits: Fit[] = [];
  for (const seed of seeds) {
    const { a, b } = refineFit(xs, hits, seed, b0);
    if (!(b > 0)) continue;
    fits.push({ a, b, ...scoreFit(xs, hits, a, b), dist: Math.abs(a - a0) });
  }
  const best = pickFit(fits);
  if (!best) return null;
  const { a, b } = best;
  const matched = best.count;

  // Final acceptance gate: at least 70% of the onsets land their own hit, and
  // the matched pairs sit tight on the line. Real playing lines up far better
  // than 40 ms RMS against a correct fit; noise essentially never does.
  if (matched < MIN_MATCH_RATIO * onsetQNs.length || best.rms > MAX_RMS_S) return null;

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
