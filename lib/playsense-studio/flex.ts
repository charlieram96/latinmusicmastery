// Flex Time (spec §7): a monotonic piecewise-linear warp between MEDIA time
// (seconds in the video file) and TIMELINE time (where bars, notes and
// waypoints live). Identity outside the outermost points and when empty, so
// unflexed lessons behave exactly as before.
export interface FlexPoint { src: number; dst: number; anchor: boolean }
export const FLEX_RATE_MIN = 0.5;
export const FLEX_RATE_MAX = 2;
const EPS = 1e-3;

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
    this.isIdentity = points.every((q) => Math.abs(q.src - q.dst) < 1e-9);
  }
  toTimeline(media: number): number { return this.points.length ? interp(media, this.srcs, this.dsts) : media; }
  toMedia(timeline: number): number { return this.points.length ? interp(timeline, this.dsts, this.srcs) : timeline; }
  /** Segment index containing a MEDIA time: -1 before the first point, points.length-1 after the last. */
  segmentAtMedia(media: number): number {
    const s = this.srcs;
    if (!s.length || media < s[0]) return -1;
    let i = 0;
    while (i + 1 < s.length && s[i + 1] <= media) i++;
    return i;
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
  for (const n of [sorted[idx - 1], sorted[idx + 1]]) {
    if (n === undefined || out.some((q) => Math.abs(q.src - n) < EPS)) continue;
    out.push({ src: n, dst: map.toTimeline(n), anchor: true });
  }
  out = out.sort((a, b) => a.src - b.src);
  return out;
}

export function moveFlexPoint(points: FlexPoint[], index: number, dst: number, span: { start: number; end: number }): FlexPoint[] {
  const lo = Math.max(span.start, index > 0 ? points[index - 1].dst : -Infinity) + EPS;
  const hi = Math.min(span.end, index < points.length - 1 ? points[index + 1].dst : Infinity) - EPS;
  const out = points.slice();
  out[index] = { ...out[index], dst: Math.min(hi, Math.max(lo, dst)) };
  return out;
}

export function removeFlexPoint(points: FlexPoint[], index: number): FlexPoint[] {
  const out = points.filter((_, i) => i !== index);
  // Drop anchors that no longer border a real (non-anchor) point.
  return out.filter((q, i) => !q.anchor || (out[i - 1] && !out[i - 1].anchor) || (out[i + 1] && !out[i + 1].anchor));
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
  const moves: FlexPoint[] = [];
  let largest = 0;
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
    moves.push({ src: h.media, dst, anchor: false });
    largest = Math.max(largest, Math.abs(note - h.t));
  }
  const kept = resetFlexRange(input.points, range);
  const edges = [range.start, range.end]
    .filter((t) => !kept.some((q) => Math.abs(q.dst - t) < EPS))
    .map((t) => ({ src: current.toMedia(t), dst: t, anchor: true }));
  const points = readFlex({ flex: [...kept, ...edges, ...moves] });
  return { points, moved: moves.length, largestMs: Math.round(largest * 1000) };
}
