// Flex Time (spec §7): a monotonic piecewise-linear warp between MEDIA time
// (seconds in the video file) and TIMELINE time (where bars, notes and
// waypoints live). Identity when empty, so unflexed lessons behave exactly as
// before.
//
// Identity edges. Outside its outermost points the map carries the outermost
// point's offset (dst - src), so the map is only identity there when the
// outermost points are themselves identity. Every path keeps that true:
// - addFlexAtHit pins an identity anchor at the span edge (span.start/end
//   +/- EDGE_INSET) on any side where the new point has no point or neighbour
//   hit to lean on;
// - moveFlexPoint refuses to drag the first or last point when it is an
//   anchor, and removeFlexPoint refuses to remove it individually;
// - removeFlexPoint clears to [] once no real (non-anchor) point remains;
// - readFlex normalizes stored data: a non-identity first point gets an
//   identity anchor prepended at min(src, dst) - EDGE_PAD, and a non-identity
//   last point one appended at max(src, dst) + EDGE_PAD, so the list stays
//   strictly monotonic in both src and dst. Identity outer points are left
//   alone, so already-valid data reads back unchanged.
export interface FlexPoint { src: number; dst: number; anchor: boolean }
export const FLEX_RATE_MIN = 0.5;
export const FLEX_RATE_MAX = 2;
const EPS = 1e-3;
/** How far inside the span edge addFlexAtHit pins its identity edge anchor. */
const EDGE_INSET = 0.01;
/** How far beyond a non-identity outer point readFlex adds its identity anchor. */
const EDGE_PAD = 0.05;
const isIdentityPoint = (q: FlexPoint) => Math.abs(q.src - q.dst) < 1e-9;

export function readFlex(params: unknown): FlexPoint[] {
  const raw = (params as { flex?: unknown } | null)?.flex;
  if (!Array.isArray(raw)) return [];
  const pts = raw
    .filter((q): q is FlexPoint =>
      !!q && Number.isFinite((q as FlexPoint).src) && Number.isFinite((q as FlexPoint).dst))
    .map((q) => ({ src: q.src, dst: q.dst, anchor: !!q.anchor }))
    .sort((a, b) => a.src - b.src);
  const out: FlexPoint[] = [];
  for (const q of pts) {
    const last = out[out.length - 1];
    if (!last || (q.src > last.src + EPS / 10 && q.dst > last.dst + EPS / 10)) out.push(q);
  }
  if (!out.length) return out;
  const first = out[0];
  if (!isIdentityPoint(first)) {
    const t = Math.min(first.src, first.dst) - EDGE_PAD;
    out.unshift({ src: t, dst: t, anchor: true });
  }
  const tail = out[out.length - 1];
  if (!isIdentityPoint(tail)) {
    const t = Math.max(tail.src, tail.dst) + EDGE_PAD;
    out.push({ src: t, dst: t, anchor: true });
  }
  return out;
}

function interp(x: number, xs: number[], ys: number[]): number {
  if (!xs.length || x <= xs[0]) return x - (xs[0] ?? x) + (ys[0] ?? x);
  if (x >= xs[xs.length - 1]) return x - xs[xs.length - 1] + ys[ys.length - 1];
  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }
  const f = (x - xs[lo]) / (xs[hi] - xs[lo]);
  return ys[lo] + f * (ys[hi] - ys[lo]);
}

export class FlexMap {
  readonly points: FlexPoint[];
  readonly isIdentity: boolean;
  private readonly srcs: number[];
  private readonly dsts: number[];
  constructor(points: FlexPoint[]) {
    this.points = points;
    this.srcs = points.map((q) => q.src);
    this.dsts = points.map((q) => q.dst);
    this.isIdentity = points.every(isIdentityPoint);
  }
  toTimeline(media: number): number { return this.points.length ? interp(media, this.srcs, this.dsts) : media; }
  toMedia(timeline: number): number { return this.points.length ? interp(timeline, this.dsts, this.srcs) : timeline; }
  /** Segment index containing a MEDIA time: -1 before the first point, points.length-1 after the last. */
  segmentAtMedia(media: number): number {
    const s = this.srcs;
    if (!s.length || media < s[0]) return -1;
    if (media >= s[s.length - 1]) return s.length - 1;
    let lo = 0;
    let hi = s.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (s[mid] <= media) lo = mid;
      else hi = mid;
    }
    return lo;
  }
  /** Media seconds per timeline second at a media time (1 outside the points), clamped to [FLEX_RATE_MIN, FLEX_RATE_MAX]. */
  rateAtMedia(media: number): number {
    const i = this.segmentAtMedia(media);
    if (i < 0 || i >= this.points.length - 1) return 1;
    const a = this.points[i];
    const b = this.points[i + 1];
    const r = (b.src - a.src) / (b.dst - a.dst);
    return Math.min(FLEX_RATE_MAX, Math.max(FLEX_RATE_MIN, r));
  }
}

const inSpan = (x: number, span: { start: number; end: number }) => x > span.start + EPS && x < span.end - EPS;

export function flexWithin(points: FlexPoint[], span: { start: number; end: number }): FlexPoint[] {
  return points.filter((q) => inSpan(q.src, span) && inSpan(q.dst, span));
}

export function addFlexAtHit(points: FlexPoint[], hitMedia: number, hitsMedia: number[], span: { start: number; end: number }): FlexPoint[] {
  if (!inSpan(hitMedia, span)) return points;
  const map = new FlexMap(points);
  const existing = points.findIndex((q) => Math.abs(q.src - hitMedia) < EPS);
  let out = points.slice();
  if (existing >= 0) {
    out[existing] = { ...out[existing], anchor: false };
  } else {
    out.push({ src: hitMedia, dst: map.toTimeline(hitMedia), anchor: false });
  }
  const sorted = hitsMedia.filter((h) => inSpan(h, span)).sort((a, b) => a - b);
  const idx = sorted.findIndex((h) => Math.abs(h - hitMedia) < EPS);
  if (idx >= 0) {
    // hitMedia is a real hit: pin its neighbours as anchors. When it isn't
    // (idx -1), sorted[idx + 1] would otherwise alias sorted[0] and add a
    // bogus anchor, so skip the loop entirely.
    for (const n of [sorted[idx - 1], sorted[idx + 1]]) {
      if (n === undefined || out.some((q) => Math.abs(q.src - n) < EPS)) continue;
      out.push({ src: n, dst: map.toTimeline(n), anchor: true });
    }
  }
  // Identity edges: on a side with no point at all (no existing point and no
  // neighbour hit pinned), pin an identity anchor just inside the span edge so
  // the map stays identity beyond the outermost point once this one is moved.
  // Where the map has no point on a side it is already identity there.
  const lowEdge = span.start + EDGE_INSET;
  const highEdge = span.end - EDGE_INSET;
  if (!out.some((q) => q.src < hitMedia - EPS / 10) && hitMedia > lowEdge + EPS) {
    out.push({ src: lowEdge, dst: lowEdge, anchor: true });
  }
  if (!out.some((q) => q.src > hitMedia + EPS / 10) && hitMedia < highEdge - EPS) {
    out.push({ src: highEdge, dst: highEdge, anchor: true });
  }
  out = out.sort((a, b) => a.src - b.src);
  return out;
}

const isOuterAnchor = (points: FlexPoint[], index: number) =>
  (index === 0 || index === points.length - 1) && points[index].anchor;

export function moveFlexPoint(points: FlexPoint[], index: number, dst: number, span: { start: number; end: number }): FlexPoint[] {
  if (index < 0 || index >= points.length) return points;
  if (isOuterAnchor(points, index)) return points; // identity edges stay put
  const lo = Math.max(span.start, index > 0 ? points[index - 1].dst : -Infinity) + EPS;
  const hi = Math.min(span.end, index < points.length - 1 ? points[index + 1].dst : Infinity) - EPS;
  if (lo > hi) return points; // neighbours are closer than 2*EPS: no room to move within
  const out = points.slice();
  out[index] = { ...out[index], dst: Math.min(hi, Math.max(lo, dst)) };
  return out;
}

export function removeFlexPoint(points: FlexPoint[], index: number): FlexPoint[] {
  if (index < 0 || index >= points.length) return points;
  if (isOuterAnchor(points, index)) return points; // identity edges aren't removed on their own
  const out = points.filter((_, i) => i !== index);
  if (!out.some((q) => !q.anchor)) return [];
  // Drop inner anchors that no longer border a real (non-anchor) point. The
  // outermost anchors stay: they hold the identity edges.
  const last = out.length - 1;
  return out.filter((q, i) => !q.anchor || i === 0 || i === last
    || (out[i - 1] && !out[i - 1].anchor) || (out[i + 1] && !out[i + 1].anchor));
}

export function resetFlexRange(points: FlexPoint[], range: { start: number; end: number }): FlexPoint[] {
  return points.filter((q) => q.dst < range.start - EPS || q.dst > range.end + EPS);
}

export function quantizePlan(input: {
  points: FlexPoint[]; notesTimeline: number[]; hitsMedia: number[]; beatSeconds: number;
  range: { start: number; end: number }; strength: number;
}): { points: FlexPoint[]; moved: number; largestMs: number } {
  const { range, strength } = input;
  const current = new FlexMap(input.points);
  const tol = input.beatSeconds / 3;
  const hits = input.hitsMedia.map((h) => ({ media: h, t: current.toTimeline(h) })).filter((h) => h.t > range.start && h.t < range.end);
  const used = new Set<number>();
  const candidates: { src: number; dst: number; diffMs: number }[] = [];
  for (const note of input.notesTimeline.filter((n) => n >= range.start && n <= range.end).sort((a, b) => a - b)) {
    let best = -1;
    for (let i = 0; i < hits.length; i++) {
      if (used.has(i) || Math.abs(hits[i].t - note) > tol) continue;
      if (best < 0 || Math.abs(hits[i].t - note) < Math.abs(hits[best].t - note)) best = i;
    }
    if (best < 0) continue;
    used.add(best);
    const h = hits[best];
    const dst = h.t + strength * (note - h.t);
    candidates.push({ src: h.media, dst, diffMs: Math.round(Math.abs(note - h.t) * 1000) });
  }

  const kept = resetFlexRange(input.points, range);
  const edges = [range.start, range.end]
    .filter((t) => !kept.some((q) => Math.abs(q.dst - t) < EPS))
    .map((t) => ({ src: current.toMedia(t), dst: t, anchor: true }));
  const fixed = [...kept, ...edges];
  const boundBelow = (dst: number) =>
    fixed.reduce((b, f) => (f.dst < dst - EPS / 10 && f.dst > b ? f.dst : b), -Infinity);
  const boundAbove = (dst: number) =>
    fixed.reduce((b, f) => (f.dst > dst + EPS / 10 && f.dst < b ? f.dst : b), Infinity);

  // A quantize match can land out of order (an earlier hit claimed by a
  // later note, or vice versa). Walking the candidates in src order and
  // requiring each kept move's dst to strictly clear both the previous kept
  // move and its bordering fixed points keeps the result monotonic, and
  // `moved`/`largestMs` only ever count what actually survives into `points`.
  const moves: FlexPoint[] = [];
  const diffs: number[] = [];
  let lastKeptDst = -Infinity;
  for (const c of candidates.slice().sort((a, b) => a.src - b.src)) {
    if (c.dst <= lastKeptDst + EPS / 10) continue;
    const lo = boundBelow(c.dst);
    const hi = boundAbove(c.dst);
    if (c.dst <= lo + EPS / 10 || c.dst >= hi - EPS / 10) continue;
    moves.push({ src: c.src, dst: c.dst, anchor: false });
    diffs.push(c.diffMs);
    lastKeptDst = c.dst;
  }

  const points = readFlex({ flex: [...fixed, ...moves] });
  const largestMs = diffs.reduce((m, d) => Math.max(m, d), 0);
  return { points, moved: moves.length, largestMs };
}
