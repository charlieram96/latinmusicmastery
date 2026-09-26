// Property test for the identity-edge invariant (Flex Time, spec §7): whatever
// sequence of edits runs, the map stays strictly monotonic and is EXACTLY the
// identity outside its outermost points, so a flex edit can never shift the
// rest of the video. Seeded, so a failure reproduces.
import { describe, expect, it } from 'vitest';
import { FlexMap, addFlexAtHit, moveFlexPoint, quantizePlan, removeFlexPoint, resetFlexRange, type FlexPoint } from '../flex';

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const span = { start: 10, end: 40 };

function check(points: FlexPoint[], where: string) {
  for (let i = 1; i < points.length; i++) {
    if (!(points[i].src > points[i - 1].src && points[i].dst > points[i - 1].dst)) {
      throw new Error(`${where}: not strictly increasing at ${i}: ${JSON.stringify(points)}`);
    }
  }
  const m = new FlexMap(points);
  const lo = points.length ? Math.min(points[0].src, points[0].dst) : 25;
  const hi = points.length ? Math.max(points[points.length - 1].src, points[points.length - 1].dst) : 25;
  for (const x of [lo - 7.3, lo - 1, lo - 0.001, 0, hi + 0.001, hi + 1, hi + 13.7, 100]) {
    if (x >= lo && x <= hi) continue;
    if (m.toTimeline(x) !== x || m.toMedia(x) !== x) {
      throw new Error(`${where}: not identity at ${x} (${m.toTimeline(x)}, ${m.toMedia(x)}): ${JSON.stringify(points)}`);
    }
  }
}

describe('flex identity edges (property)', () => {
  it('500 seeded sequences of 25 edits keep the map monotonic and identity outside its points', () => {
    const rand = mulberry32(0x5eed);
    for (let seq = 0; seq < 500; seq++) {
      const hits = [10.004, 10.009, 39.991, 39.996];
      for (let i = 0; i < 30; i++) hits.push(10 + rand() * 30);
      hits.sort((a, b) => a - b);
      let pts: FlexPoint[] = [];
      for (let step = 0; step < 25; step++) {
        const op = Math.floor(rand() * 5);
        const where = `seq ${seq} step ${step} op ${op}`;
        if (op === 0) {
          pts = addFlexAtHit(pts, hits[Math.floor(rand() * hits.length)], hits, span);
        } else if (op === 1 && pts.length) {
          const i = Math.floor(rand() * pts.length);
          pts = moveFlexPoint(pts, i, pts[i].dst + (rand() - 0.5) * 0.8, span);
        } else if (op === 2 && pts.length) {
          pts = removeFlexPoint(pts, Math.floor(rand() * pts.length));
        } else if (op === 3) {
          const a = 10 + rand() * 30;
          const b = a + rand() * (40 - a);
          pts = resetFlexRange(pts, { start: a, end: b });
        } else if (op === 4) {
          const a = 10 + rand() * 25;
          const b = Math.min(40, a + 1 + rand() * 8);
          const notes: number[] = [];
          for (let t = a; t <= b; t += 0.5) notes.push(t + (rand() - 0.5) * 0.1);
          pts = quantizePlan({ points: pts, notesTimeline: notes, hitsMedia: hits, beatSeconds: 0.5, range: { start: a, end: b }, strength: rand() }).points;
        }
        check(pts, where);
      }
    }
  });

  it('regression: resetting a range that holds the left edge keeps identity outside', () => {
    const s = { start: 10, end: 40 };
    let pts = addFlexAtHit([], 12, [10.004, 11.5, 12, 12.5, 20, 30], s);
    pts = moveFlexPoint(pts, 1, 12.3, s);
    pts = resetFlexRange(pts, { start: 10, end: 12.2 });
    const m = new FlexMap(pts);
    expect(m.toTimeline(5)).toBe(5);
    check(pts, 'reset');
  });

  it('regression: a hit within the edge inset still leaves identity outside once moved', () => {
    const s = { start: 10, end: 40 };
    const hits = [10.004, 11.5, 12, 20];
    let pts = addFlexAtHit([], 10.004, hits, s);
    const i = pts.findIndex((q) => q.src === 10.004);
    pts = moveFlexPoint(pts, i, 10.2, s);
    expect(new FlexMap(pts).toTimeline(5)).toBe(5);
    check(pts, 'inset');
  });
});
