// Flex Time (spec §7): a monotonic piecewise-linear warp between MEDIA time
// (seconds in the video file) and TIMELINE time (where bars, notes and
// waypoints live). Identity when empty, so unflexed lessons behave exactly as
// before.
//
// Identity edges. Outside its outermost points the map carries the outermost
// point's offset (dst - src), so it is identity there only when the outermost
// points are themselves identity; FlexMap then returns the input exactly.
// One helper guarantees it: normalizeEdges prepends an identity anchor at
// min(src, dst) - EDGE_PAD when the first point isn't identity, and appends
// one at max(src, dst) + EDGE_PAD when the last isn't, which keeps src and dst
// strictly increasing. readFlex (on load) and every edit function (add, move,
// remove, resetFlexRange, quantizePlan) end with it, so the invariant holds
// for any edit sequence (flex-property.test.ts checks it). Beyond that:
// - addFlexAtHit also pins identity anchors just inside the span edges
//   (EDGE_INSET) on a side with no point, so edges usually sit in the span;
// - the outermost anchors can't be dragged or removed on their own;
// - remove and reset drop anchors that no longer border a real (non-anchor)
//   point, and return [] once only anchors remain.
// A normalized anchor can land up to EDGE_PAD outside the section span (a real
// point within the inset of an edge, or legacy data); the map is identity
// there, so it means the same in both domains.
export interface FlexPoint { src: number; dst: number; anchor: boolean }
export const FLEX_RATE_MIN = 0.5;
export const FLEX_RATE_MAX = 2;
const EPS = 1e-3;
/** How far inside the span edge addFlexAtHit pins its identity edge anchor. */
const EDGE_INSET = 0.01;
/** How far beyond a non-identity outer point normalizeEdges adds its identity anchor. */
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
  return normalizeEdges(out);
}

/** Keep the map identity outside its points: an identity anchor just beyond a
 *  non-identity first or last point (see the header). Idempotent. */
export function normalizeEdges(points: FlexPoint[]): FlexPoint[] {
  if (!points.length) return points;
  let out = points;
  const first = out[0];
  if (!isIdentityPoint(first)) {
    const t = Math.min(first.src, first.dst) - EDGE_PAD;
    out = [{ src: t, dst: t, anchor: true }, ...out];
  }
  const tail = out[out.length - 1];
  if (!isIdentityPoint(tail)) {
    const t = Math.max(tail.src, tail.dst) + EDGE_PAD;
    out = [...out, { src: t, dst: t, anchor: true }];
  }
  return out;
}

/** Drop anchors that no longer border a real point; [] when only anchors are
 *  left; then normalize the edges. */
function tidy(points: FlexPoint[]): FlexPoint[] {
  const swept = points.filter((q, i) => !q.anchor || (points[i - 1] && !points[i - 1].anchor) || (points[i + 1] && !points[i + 1].anchor));
  if (!swept.some((q) => !q.anchor)) return [];
  return normalizeEdges(swept);
}

/** x shifted by an outer point's offset: exactly x when that point is identity. */
function offsetBy(x: number, from: number, to: number): number {
  const off = to - from;
  return Math.abs(off) < 1e-9 ? x : x + off;
}

function interp(x: number, xs: number[], ys: number[]): number {
  if (!xs.length) return x;
  if (x <= xs[0]) return offsetBy(x, xs[0], ys[0]);
  if (x >= xs[xs.length - 1]) return offsetBy(x, xs[xs.length - 1], ys[ys.length - 1]);
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
  return normalizeEdges(out);
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
  return normalizeEdges(out);
}

export function removeFlexPoint(points: FlexPoint[], index: number): FlexPoint[] {
  if (index < 0 || index >= points.length) return points;
  if (isOuterAnchor(points, index)) return points; // identity edges aren't removed on their own
  return tidy(points.filter((_, i) => i !== index));
}

export function resetFlexRange(points: FlexPoint[], range: { start: number; end: number }): FlexPoint[] {
  return tidy(points.filter((q) => q.dst < range.start - EPS || q.dst > range.end + EPS));
}

export function quantizePlan(input: {
  points: FlexPoint[]; notesTimeline: number[]; hitsMedia: number[]; beatSeconds: number;
  range: { start: number; end: number }; strength: number; toleranceSeconds?: number;
}): { points: FlexPoint[]; moved: number; largestMs: number } {
  const { range, strength } = input;
  const current = new FlexMap(input.points);
  if (strength <= 0) return {points: input.points, moved: 0, largestMs: 0};
  const tol = input.toleranceSeconds ?? input.beatSeconds / 3;
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
    candidates.push({ src: h.media, dst, diffMs: Math.round(Math.abs(dst - h.t) * 1000) });
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

  const read = readFlex({ flex: [...fixed, ...moves] }); // normalizes the edges
  const points = read.some((q) => !q.anchor) ? read : [];
  const largestMs = diffs.reduce((m, d) => Math.max(m, d), 0);
  return { points, moved: moves.length, largestMs };
}

/** Pin the nearest bar boundaries on each side without changing the current
 * warp. Subsequent Single moves cannot alter audio outside that local span.
 * A point on a shared barline necessarily borders two measures. */
export function protectFlexMeasure(points: FlexPoint[], source: number, boundaries: number[]): FlexPoint[] {
  const point=points.find(p=>Math.abs(p.src-source)<1e-9);
  if(!point)return points;
  const map=new FlexMap(points);
  const sorted=[...boundaries].filter(Number.isFinite).sort((a,b)=>a-b);
  const left=sorted.filter(t=>t<point.dst-EPS).at(-1);
  const right=sorted.find(t=>t>point.dst+EPS);
  const out=points.slice();
  for(const dst of [left,right]) {
    if(dst===undefined)continue;
    const src=map.toMedia(dst);
    if(out.some(p=>Math.abs(p.src-src)<EPS))continue;
    out.push({src,dst,anchor:true});
  }
  return normalizeEdges(out.sort((a,b)=>a.src-b.src));
}
