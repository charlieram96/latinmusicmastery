import { describe, expect, it } from 'vitest';
import { FlexMap } from '../flex';
import { FLEX_NOTE_HIT_WINDOW, nearestHitWithin, remapMediaLoop, seekMediaFor, trimDragToMedia, trimInTimeline } from '../flex-sync';

const p = (src: number, dst: number, anchor = false) => ({ src, dst, anchor });
const identity = new FlexMap([]);
// 10..12 media plays as 10..12.5 timeline (slower), 12..14 as 12.5..14.
const flexed = new FlexMap([p(10, 10, true), p(12, 12.5), p(14, 14, true)]);

describe('SyncPanel flex conversions', () => {
  it('seek: timeline -> media, then clamps to the trim', () => {
    expect(seekMediaFor(identity, 11, null, null)).toBe(11);
    expect(seekMediaFor(flexed, 12.5, null, null)).toBeCloseTo(12);
    expect(seekMediaFor(flexed, 11.25, null, null)).toBeCloseTo(11);
    const trim = { trimInSeconds: 11.5, trimOutSeconds: 13 };
    // 11.25 timeline is 11 media: before the trim-in, so it clamps up to 11.5 (media)
    expect(seekMediaFor(flexed, 11.25, trim, 60)).toBe(11.5);
    expect(seekMediaFor(flexed, 13.9, trim, 60)).toBe(13);
    expect(seekMediaFor(identity, 20, trim, 60)).toBe(13);
  });
  it('trim: display in timeline and drag back to media round-trip', () => {
    expect(trimInTimeline(flexed, null)).toEqual({ in: undefined, out: null });
    const trim = { trimInSeconds: 11, trimOutSeconds: 13 };
    const shown = trimInTimeline(flexed, trim);
    expect(shown.in).toBeCloseTo(11.25);
    expect(shown.out).toBeCloseTo(13.25);
    expect(trimDragToMedia(flexed, shown.in!)).toBeCloseTo(11, 9);
    expect(trimDragToMedia(flexed, shown.out!)).toBeCloseTo(13, 9);
    expect(trimInTimeline(identity, { trimInSeconds: 3, trimOutSeconds: null })).toEqual({ in: 3, out: null });
    expect(trimDragToMedia(identity, 4.2)).toBe(4.2);
  });
  it('loop: a flex edit keeps the media loop on the same timeline bars', () => {
    // The loop covers timeline 11.25..13.25 under `flexed` (media 11..13).
    const r = remapMediaLoop(flexed, identity, 11, 13);
    expect(r.a).toBeCloseTo(11.25);
    expect(r.b).toBeCloseTo(13.25);
    const back = remapMediaLoop(identity, flexed, r.a, r.b);
    expect(back.a).toBeCloseTo(11);
    expect(back.b).toBeCloseTo(13);
    expect(remapMediaLoop(identity, identity, 3, 5)).toEqual({ a: 3, b: 5 });
  });
  it('finds the nearest hit within the window, or -1', () => {
    expect(nearestHitWithin([1, 2, 3], 2.05, FLEX_NOTE_HIT_WINDOW)).toBe(1);
    expect(nearestHitWithin([1, 2, 3], 2.5, FLEX_NOTE_HIT_WINDOW)).toBe(-1);
    expect(nearestHitWithin([1, 2.08, 2.1], 2.0, FLEX_NOTE_HIT_WINDOW)).toBe(1);
    expect(nearestHitWithin([], 2, FLEX_NOTE_HIT_WINDOW)).toBe(-1);
  });
});
