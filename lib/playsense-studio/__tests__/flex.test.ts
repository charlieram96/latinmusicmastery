import { describe, expect, it } from 'vitest';
import { FlexMap, addFlexAtHit, moveFlexPoint, quantizePlan, readFlex, removeFlexPoint, resetFlexRange } from '../flex';

const p = (src: number, dst: number, anchor = false) => ({ src, dst, anchor });
const span = { start: 0, end: 100 };

describe('FlexMap', () => {
  it('is the identity with no points', () => {
    const m = new FlexMap([]);
    expect(m.isIdentity).toBe(true);
    expect(m.toTimeline(12.3)).toBe(12.3);
    expect(m.toMedia(12.3)).toBe(12.3);
    expect(m.rateAtMedia(5)).toBe(1);
  });
  it('maps piecewise-linearly and inverts', () => {
    const m = new FlexMap([p(10, 10, true), p(12, 12.5), p(14, 14, true)]);
    expect(m.toTimeline(11)).toBeCloseTo(11.25);
    expect(m.toMedia(11.25)).toBeCloseTo(11);
    expect(m.toTimeline(13)).toBeCloseTo(13.25);
    expect(m.toTimeline(5)).toBe(5);   // outside: identity
    expect(m.toTimeline(20)).toBe(20);
    for (const t of [9, 10.3, 11.9, 12.5, 13.7, 15]) expect(m.toMedia(m.toTimeline(t))).toBeCloseTo(t, 9);
  });
  it('reports the media rate per segment, clamped', () => {
    const m = new FlexMap([p(10, 10), p(12, 12.5), p(14, 14)]);
    expect(m.rateAtMedia(11)).toBeCloseTo(2 / 2.5); // slower
    expect(m.rateAtMedia(13)).toBeCloseTo(2 / 1.5); // faster
    expect(m.rateAtMedia(20)).toBe(1);
    expect(new FlexMap([p(0, 0), p(1, 5)]).rateAtMedia(0.5)).toBe(0.5); // clamped
  });
  it('reads params defensively', () => {
    expect(readFlex({ flex: [p(2, 2), { src: 'x' }, p(1, 1), p(3, 2.5)] })).toEqual([p(1, 1), p(2, 2), p(3, 2.5), p(3.05, 3.05, true)]); // + identity tail
    expect(readFlex({ flex: [p(1, 1), p(2, 0.5)] })).toEqual([p(1, 1)]); // non-monotonic dst dropped
    expect(readFlex(null)).toEqual([]);
  });
});

describe('flex edits', () => {
  it('adds a point at a hit and pins its neighbours as anchors', () => {
    const pts = addFlexAtHit([], 12, [10, 12, 14, 16], span);
    expect(pts).toEqual([p(10, 10, true), p(12, 12), p(14, 14, true)]);
    // a second add next to it reuses the existing anchor and turns it into a real point
    expect(addFlexAtHit(pts, 14, [10, 12, 14, 16], span)).toEqual([p(10, 10, true), p(12, 12), p(14, 14), p(16, 16, true)]);
  });
  it('moves a point within its neighbours and the span', () => {
    const pts = [p(10, 10, true), p(12, 12), p(14, 14, true)];
    expect(moveFlexPoint(pts, 1, 12.4, span)[1].dst).toBeCloseTo(12.4);
    expect(moveFlexPoint(pts, 1, 20, span)[1].dst).toBeLessThan(14);
    expect(moveFlexPoint(pts, 1, 1, span)[1].dst).toBeGreaterThan(10);
    const lone = moveFlexPoint([p(10, 10)], 0, 0.001, { start: 5, end: 20 });
    expect(lone.find((q) => !q.anchor)!.dst).toBeGreaterThan(5);
    expect(lone[0]).toEqual(p(lone[0].src, lone[0].src, true)); // an identity edge was added
  });
  it('removes a point and orphaned anchors', () => {
    const pts = [p(10, 10, true), p(12, 12), p(14, 14, true)];
    expect(removeFlexPoint(pts, 1)).toEqual([]);
    const two = [p(10, 10, true), p(12, 12), p(14, 14), p(16, 16, true)];
    expect(removeFlexPoint(two, 1)).toEqual([p(10, 10, true), p(14, 14), p(16, 16, true)]);
  });
  it('quantizes toward the notes by strength, with anchors at the range edges', () => {
    const notes = [10, 10.5, 11, 11.5];
    const hits = [10.04, 10.52, 10.95, 11.6];
    const r = quantizePlan({ points: [], notesTimeline: notes, hitsMedia: hits, beatSeconds: 0.5, range: { start: 9.9, end: 11.9 }, strength: 0.7 });
    expect(r.moved).toBe(4);
    expect(r.largestMs).toBe(70);
    const m = new FlexMap(r.points);
    expect(m.toTimeline(10.04)).toBeCloseTo(10.04 + 0.7 * (10 - 10.04), 6);
    expect(r.points[0]).toEqual(p(9.9, 9.9, true));
    expect(r.points[r.points.length - 1]).toEqual(p(11.9, 11.9, true));
    expect(resetFlexRange(r.points, { start: 9.9, end: 11.9 })).toEqual([]);
  });
  it('quantize ignores notes with no hit within a third of a beat, and never matches a hit twice', () => {
    const r = quantizePlan({ points: [], notesTimeline: [10, 10.1], hitsMedia: [10.05, 12], beatSeconds: 0.5, range: { start: 9.9, end: 10.5 }, strength: 1 });
    expect(r.moved).toBe(1);
  });
  it('regression: moved matches the surviving non-anchor points, even when a match would cross another', () => {
    const r = quantizePlan({ points: [], notesTimeline: [0.8, 0.85], hitsMedia: [0.5, 0.9], beatSeconds: 1.05, range: { start: 0, end: 1.2 }, strength: 1 });
    expect(r.moved).toBe(r.points.filter((q) => !q.anchor).length);
  });
  it('adds a point with only identity edge anchors when the hit is not in hitsMedia', () => {
    const pts = addFlexAtHit([], 13, [10, 12, 14, 16], span);
    expect(pts).toEqual([p(0.01, 0.01, true), p(13, 13), p(99.99, 99.99, true)]);
  });
  it('moveFlexPoint returns the points unchanged when neighbours are too close, or the index is out of range', () => {
    const tight = [p(0, 10, true), p(1, 10.0007), p(2, 10.0015, true)];
    expect(moveFlexPoint(tight, 1, 10.001, { start: 0, end: 100 })).toBe(tight);
    const pts = [p(10, 10, true), p(12, 12), p(14, 14, true)];
    expect(moveFlexPoint(pts, 5, 13, span)).toBe(pts);
    expect(moveFlexPoint(pts, -1, 13, span)).toBe(pts);
  });
  it('removeFlexPoint returns the points unchanged for an out-of-range index', () => {
    const pts = [p(10, 10, true), p(12, 12), p(14, 14, true)];
    expect(removeFlexPoint(pts, 5)).toBe(pts);
    expect(removeFlexPoint(pts, -1)).toBe(pts);
  });

  it('identity edges: an unpaired outer point leaves the map identity outside the points', () => {
    // 16 is the last hit: no right neighbour, so the right edge gets an identity anchor.
    const pts = addFlexAtHit([], 16, [10, 12, 14, 16], span);
    expect(pts).toEqual([p(14, 14, true), p(16, 16), p(99.99, 99.99, true)]);
    const moved = moveFlexPoint(pts, 1, 16.3, span);
    const m = new FlexMap(moved);
    expect(m.toTimeline(5)).toBe(5);
    expect(m.toTimeline(99.995)).toBeCloseTo(99.995, 9);
    expect(m.toTimeline(150)).toBe(150);
    // a lone point with no hits at all gets both edges
    const lone = moveFlexPoint(addFlexAtHit([], 50, [], span), 1, 50.4, span);
    const lm = new FlexMap(lone);
    expect(lm.toTimeline(0)).toBe(0);
    expect(lm.toTimeline(120)).toBe(120);
    expect(lm.toTimeline(50)).toBeCloseTo(50.4);
  });
  it('identity edges: the outer anchors cannot be dragged or removed on their own', () => {
    const pts = [p(10, 10, true), p(12, 12.3), p(14, 14, true)];
    expect(moveFlexPoint(pts, 0, 10.5, span)).toBe(pts);
    expect(moveFlexPoint(pts, 2, 13.5, span)).toBe(pts);
    expect(removeFlexPoint(pts, 0)).toBe(pts);
    expect(removeFlexPoint(pts, 2)).toBe(pts);
  });
  it('identity edges: removing the last real point clears to []', () => {
    const pts = addFlexAtHit([], 50, [], span);
    expect(removeFlexPoint(pts, 1)).toEqual([]);
    const withInner = [p(0.01, 0.01, true), p(10, 10, true), p(12, 12.2), p(14, 14, true), p(99.99, 99.99, true)];
    expect(removeFlexPoint(withInner, 2)).toEqual([]);
  });
  it('identity edges: removing an inner point drops its orphaned anchors and stays identity outside', () => {
    const pts = [p(0.01, 0.01, true), p(12, 12.2), p(20, 20, true), p(30, 30.4), p(99.99, 99.99, true)];
    const out = removeFlexPoint(pts, 1);
    expect(out).toEqual([p(20, 20, true), p(30, 30.4), p(99.99, 99.99, true)]);
    const m = new FlexMap(out);
    expect(m.toTimeline(0)).toBe(0);
    expect(m.toTimeline(150)).toBe(150);
  });
  it('identity edges: a normalized load of a lone non-identity point stays identity outside it', () => {
    const pts = readFlex({ flex: [p(10, 10.08)] });
    expect(pts).toEqual([p(9.95, 9.95, true), p(10, 10.08), p(10.13, 10.13, true)]);
    const m = new FlexMap(pts);
    expect(m.toTimeline(20)).toBe(20);
    expect(m.toTimeline(0)).toBe(0);
    expect(m.toTimeline(10)).toBeCloseTo(10.08);
    // identity outer points read back unchanged
    expect(readFlex({ flex: [p(9, 9, true), p(10, 10.08), p(11, 11, true)] })).toEqual([p(9, 9, true), p(10, 10.08), p(11, 11, true)]);
  });
});


it('zero strength preserves existing Flex exactly and reports no movement',()=>{
 const points=[{src:0,dst:0,anchor:true},{src:1,dst:1.1,anchor:false},{src:2,dst:2,anchor:true}];
 const result=quantizePlan({points,notesTimeline:[1],hitsMedia:[1],beatSeconds:.5,range:{start:0,end:2},strength:0});
 expect(result).toEqual({points,moved:0,largestMs:0});
});

it('quantizes fine and triplet grids without matching an earlier grid cell',()=>{
 for(const denominator of [4,8,16,32,64,96]) for(const triplet of [1,2/3]) {
  const step=.5*4/denominator*triplet;
  const hit=step*3+.002;
  const result=quantizePlan({points:[],notesTimeline:Array.from({length:12},(_,i)=>i*step),hitsMedia:[hit],beatSeconds:.5,toleranceSeconds:step/2,range:{start:0,end:12*step},strength:1});
  expect(new FlexMap(result.points).toTimeline(hit)).toBeCloseTo(step*3,6);
 }
});
