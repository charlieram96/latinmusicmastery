// "Auto-place bars" (spec §7): fit one steady tempo to the score's note onsets
// against the detected hits (widening the window as the fit firms up), lay
// every bar on that line, then let each bar settle onto the hit under its first
// attacked note. Pure: SyncPanel tweens to the result and keeps the old markers
// for one-step undo.
import type { MarkerState } from '@/components/playsense-studio/sync/marker-model';
import { nearestHit } from './hits';

const SETTLE_S = 0.09;

interface Onset { qn: number }

export function autoPlaceBars(
  state: MarkerState,
  allHits: number[],
  window: { start: number; end: number }
): { state: MarkerState; matched: number; settled: number } | null {
  const hits = allHits.filter((h) => h >= window.start && h <= window.end);
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
  {
    const tol0 = Math.min(0.12, 0.3 * b);
    const probe = onsets.slice(0, 8);
    let bestA = a;
    let bestCount = -1;
    for (const h of hits) {
      if (Math.abs(h - a) > 2) continue;
      const count = probe.filter((o) => nearestHit(hits, h + b * (o.qn - qn0), tol0) !== null).length;
      if (count > bestCount) { bestCount = count; bestA = h; }
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
  if (b <= 0 || matched < 4 || matched < onsets.length / 2) return null;

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
