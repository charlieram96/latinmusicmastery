import { describe, expect, it } from 'vitest';
import {
  CLIP_EPS,
  MIN_CLIP_SECONDS,
  clipLength,
  clipTimelineRange,
  clampToTrim,
  moveClip,
  normalizeClip,
  normalizeMediaTrim,
  setTrimIn,
  setTrimOut,
  snapToNearest,
  trimClipIn,
  trimClipOut,
  trimRange,
  type Clip,
  type ClipBounds,
} from '@/lib/playsense-studio/clip-model';

const known: ClipBounds = { sourceDurationSeconds: 30 };
const unknown: ClipBounds = { sourceDurationSeconds: null };

const clip = (over: Partial<Clip> = {}): Clip => ({
  timelineStartSeconds: 10,
  trimInSeconds: 1,
  trimOutSeconds: 9,
  ...over,
});

describe('clip geometry', () => {
  it('an untrimmed clip spans the whole source', () => {
    const c = clip({ timelineStartSeconds: 5, trimInSeconds: 0, trimOutSeconds: null });
    expect(clipLength(c, known)).toBe(30);
    expect(clipTimelineRange(c, known)).toEqual({ startSeconds: 5, endSeconds: 35 });
  });

  it('a trimmed clip spans only the trimmed window', () => {
    const c = clip({ timelineStartSeconds: 10, trimInSeconds: 2, trimOutSeconds: 5 });
    expect(clipLength(c, known)).toBe(3);
    expect(clipTimelineRange(c, known)).toEqual({ startSeconds: 10, endSeconds: 13 });
  });

  it('is degenerate (not NaN) when neither trimOut nor source duration is known', () => {
    const c = clip({ timelineStartSeconds: 7, trimInSeconds: 0, trimOutSeconds: null });
    expect(clipLength(c, unknown)).toBe(0);
    expect(clipTimelineRange(c, unknown)).toEqual({ startSeconds: 7, endSeconds: 7 });
  });
});

describe('moveClip', () => {
  it('moves the clip without touching its trims', () => {
    const c = moveClip(clip(), known, 4.2);
    expect(c.timelineStartSeconds).toBeCloseTo(4.2, 10);
    expect(c.trimInSeconds).toBe(1);
    expect(c.trimOutSeconds).toBe(9);
  });

  it('clamps a negative position to zero', () => {
    expect(moveClip(clip(), known, -3).timelineStartSeconds).toBe(0);
  });

  it('ignores a non-finite position so an off-screen drag cannot corrupt state', () => {
    expect(moveClip(clip(), known, NaN)).toEqual(clip());
    expect(moveClip(clip(), known, Infinity)).toEqual(clip());
  });

  it('never changes the clip length', () => {
    const before = clipLength(clip(), known);
    for (const t of [0, 4.2, 99, -12]) {
      expect(clipLength(moveClip(clip(), known, t), known)).toBeCloseTo(before, 10);
    }
  });
});

describe('trimClipIn', () => {
  it('drags the in-edge right, moving trimIn and timelineStart together', () => {
    const c = trimClipIn(clip(), known, 12);
    expect(c.trimInSeconds).toBe(3);
    expect(c.timelineStartSeconds).toBe(12);
    expect(c.trimOutSeconds).toBe(9);
    expect(clipLength(c, known)).toBe(6);
  });

  it('pins trimIn at the source start and moves no further left', () => {
    const c = trimClipIn(clip(), known, 5);
    expect(c.trimInSeconds).toBe(0);
    expect(c.timelineStartSeconds).toBe(9);
  });

  it('stops MIN_CLIP_SECONDS short of trimOut', () => {
    const c = trimClipIn(clip(), known, 20);
    expect(c.trimInSeconds).toBeCloseTo(9 - MIN_CLIP_SECONDS, 10);
    expect(clipLength(c, known)).toBeCloseTo(MIN_CLIP_SECONDS, 10);
  });

  it('pins timelineStart at zero and applies the same clamped delta to trimIn', () => {
    const c = trimClipIn(clip({ timelineStartSeconds: 2, trimInSeconds: 5, trimOutSeconds: 20 }), known, -3);
    expect(c.timelineStartSeconds).toBe(0);
    expect(c.trimInSeconds).toBe(3);
  });

  it('still trims and still clamps at zero when the source duration is unknown', () => {
    const c = trimClipIn(clip({ trimOutSeconds: null }), unknown, 5);
    expect(c.trimInSeconds).toBe(0);
    expect(c.timelineStartSeconds).toBe(9);
  });
});

describe('trimClipOut', () => {
  it('drags the out-edge left, touching only trimOut', () => {
    const c = trimClipOut(clip(), known, 15);
    expect(c.trimOutSeconds).toBe(6);
    expect(c.timelineStartSeconds).toBe(10);
    expect(c.trimInSeconds).toBe(1);
  });

  it('pins the out-edge at the source duration', () => {
    expect(trimClipOut(clip(), known, 100).trimOutSeconds).toBe(30);
  });

  it('materialises a number from null when the duration is unknown', () => {
    const c = trimClipOut(clip({ timelineStartSeconds: 0, trimInSeconds: 0, trimOutSeconds: null }), unknown, 12);
    expect(c.trimOutSeconds).toBe(12);
  });

  it('stops MIN_CLIP_SECONDS past trimIn', () => {
    const c = trimClipOut(clip(), known, 10);
    expect(c.trimOutSeconds).toBeCloseTo(1 + MIN_CLIP_SECONDS, 10);
  });
});

describe('normalizeClip', () => {
  it('clamps a trimOut past the end of the source', () => {
    expect(normalizeClip(clip({ trimOutSeconds: 45 }), known).trimOutSeconds).toBe(30);
  });

  it('resets rather than yielding a zero-length clip when trimIn is past the source end', () => {
    const c = normalizeClip(clip({ trimInSeconds: 40, trimOutSeconds: null }), known);
    expect(c.trimInSeconds).toBe(0);
    expect(c.trimOutSeconds).toBe(30);
  });

  it('repairs a negative timelineStart', () => {
    expect(normalizeClip(clip({ timelineStartSeconds: -4 }), known).timelineStartSeconds).toBe(0);
  });

  it('is idempotent', () => {
    for (const bad of [
      clip({ trimOutSeconds: 45 }),
      clip({ trimInSeconds: 40, trimOutSeconds: null }),
      clip({ timelineStartSeconds: -4 }),
      clip({ trimInSeconds: 9, trimOutSeconds: 1 }),
    ]) {
      const once = normalizeClip(bad, known);
      expect(normalizeClip(once, known)).toEqual(once);
    }
  });
});

describe('media trim', () => {
  it('resolves an open-ended trim to the full duration', () => {
    expect(trimRange({ trimInSeconds: 0, trimOutSeconds: null }, 90)).toEqual({ startSeconds: 0, endSeconds: 90 });
  });

  it('honours an explicit window', () => {
    expect(trimRange({ trimInSeconds: 5, trimOutSeconds: 60 }, 90)).toEqual({ startSeconds: 5, endSeconds: 60 });
  });

  it('clamps a window that runs past the media', () => {
    expect(trimRange({ trimInSeconds: 5, trimOutSeconds: 120 }, 90)).toEqual({ startSeconds: 5, endSeconds: 90 });
  });

  it('leaves the end open when the duration is unknown', () => {
    const t = normalizeMediaTrim({ trimInSeconds: 3, trimOutSeconds: null }, null);
    expect(t.trimOutSeconds).toBeNull();
    expect(trimRange(t, null).endSeconds).toBe(Infinity);
  });

  it('keeps the in-point MIN_CLIP_SECONDS clear of the out-point', () => {
    const t = setTrimIn({ trimInSeconds: 0, trimOutSeconds: 60 }, 90, 80);
    expect(t.trimInSeconds).toBeCloseTo(60 - MIN_CLIP_SECONDS, 10);
  });

  it('keeps the out-point MIN_CLIP_SECONDS clear of the in-point', () => {
    const t = setTrimOut({ trimInSeconds: 10, trimOutSeconds: 60 }, 90, 2);
    expect(t.trimOutSeconds).toBeCloseTo(10 + MIN_CLIP_SECONDS, 10);
  });

  it('clamps a time into the usable region', () => {
    const t = { trimInSeconds: 5, trimOutSeconds: 60 };
    expect(clampToTrim(1, t, 90)).toBe(5);
    expect(clampToTrim(75, t, 90)).toBe(60);
    expect(clampToTrim(30, t, 90)).toBe(30);
  });
});

describe('snapToNearest', () => {
  it('snaps to a candidate inside the tolerance', () => {
    expect(snapToNearest(10.04, [8, 10, 12], 0.1)).toBe(10);
  });

  it('leaves a value outside the tolerance alone', () => {
    expect(snapToNearest(10.5, [8, 10, 12], 0.1)).toBe(10.5);
  });

  it('is the identity with no candidates', () => {
    expect(snapToNearest(10.5, [], 0.1)).toBe(10.5);
  });

  it('breaks ties toward the lower candidate', () => {
    expect(snapToNearest(11, [10, 12], 5)).toBe(10);
  });
});

describe('constants', () => {
  it('keeps CLIP_EPS well below MIN_CLIP_SECONDS', () => {
    expect(CLIP_EPS).toBeLessThan(MIN_CLIP_SECONDS);
  });
});
