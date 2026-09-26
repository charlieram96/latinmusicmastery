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
    expect(readFlex({ flex: [p(2, 2), { src: 'x' }, p(1, 1), p(3, 2.5)] })).toEqual([p(1, 1), p(2, 2), p(3, 2.5)]);
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
    expect(moveFlexPoint([p(10, 10)], 0, 0.001, { start: 5, end: 20 })[0].dst).toBeGreaterThan(5);
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
    expect(r.largestMs).toBe(100);
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
});
