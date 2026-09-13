import { describe, expect, it } from 'vitest';
import {
  scheduleClip,
  type Anchor,
  type SchedulableClip,
  type UsableRegion,
} from '@/lib/playsense-studio/clip-schedule';

// Anchor: timeline second 0 sounds at context second 100, playing forwards at 1x.
const anchor = (over: Partial<Anchor> = {}): Anchor => ({
  ctxStartSeconds: 100,
  timelineStartSeconds: 0,
  rate: 1,
  ...over,
});

const clip = (over: Partial<SchedulableClip> = {}): SchedulableClip => ({
  timelineStartSeconds: 10,
  trimInSeconds: 0,
  trimOutSeconds: null,
  sourceDurationSeconds: 30,
  ...over,
});

const OPEN: UsableRegion = { startSeconds: 0, endSeconds: Infinity };

describe('scheduleClip', () => {
  it('schedules a clip that has not started yet from its head', () => {
    const s = scheduleClip(clip(), anchor(), OPEN)!;
    expect(s.when).toBeCloseTo(110, 10); // 10s of timeline after the anchor
    expect(s.offset).toBeCloseTo(0, 10);
    expect(s.stopAt).toBeCloseTo(140, 10); // 30s long
  });

  it('starts part-way into the buffer when the playhead is already inside', () => {
    // Anchor at timeline 18: we are 8s into a clip that began at 10.
    const s = scheduleClip(clip(), anchor({ timelineStartSeconds: 18 }), OPEN)!;
    expect(s.when).toBeCloseTo(100, 10); // immediately
    expect(s.offset).toBeCloseTo(8, 10); // 8s into the source
  });

  it('schedules nothing once the playhead is past the clip', () => {
    expect(scheduleClip(clip(), anchor({ timelineStartSeconds: 45 }), OPEN)).toBeNull();
  });

  it('honours the trim window rather than the whole file', () => {
    const s = scheduleClip(clip({ trimInSeconds: 5, trimOutSeconds: 12 }), anchor(), OPEN)!;
    expect(s.offset).toBeCloseTo(5, 10);
    expect(s.when).toBeCloseTo(110, 10);
    expect(s.stopAt).toBeCloseTo(117, 10); // 7s of content
  });

  it('pushes into the buffer when the usable region starts mid-clip', () => {
    // Main track trimmed to start at timeline 14; the clip began at 10.
    const s = scheduleClip(clip(), anchor(), { startSeconds: 14, endSeconds: Infinity })!;
    expect(s.when).toBeCloseTo(114, 10);
    expect(s.offset).toBeCloseTo(4, 10);
  });

  it('stops early when the usable region ends mid-clip', () => {
    const s = scheduleClip(clip(), anchor(), { startSeconds: 0, endSeconds: 25 })!;
    expect(s.stopAt).toBeCloseTo(125, 10);
  });

  it('schedules nothing for a clip entirely outside the usable region', () => {
    expect(scheduleClip(clip(), anchor(), { startSeconds: 0, endSeconds: 5 })).toBeNull();
  });

  it('scales context times by the playback rate but not buffer offsets', () => {
    const s = scheduleClip(clip(), anchor({ rate: 0.5 }), OPEN)!;
    // 10s of timeline at half speed is 20s of wall clock.
    expect(s.when).toBeCloseTo(120, 10);
    expect(s.offset).toBeCloseTo(0, 10);
    expect(s.stopAt).toBeCloseTo(180, 10);
  });

  it('clamps a trimOut that runs past the end of the buffer', () => {
    const s = scheduleClip(clip({ trimOutSeconds: 100 }), anchor(), OPEN)!;
    expect(s.stopAt).toBeCloseTo(140, 10);
  });

  it('handles a clip positioned before timeline zero', () => {
    // Starts 4s "before" the timeline; at anchor 0 we are already 4s in.
    const s = scheduleClip(clip({ timelineStartSeconds: -4 }), anchor(), OPEN)!;
    expect(s.when).toBeCloseTo(100, 10);
    expect(s.offset).toBeCloseTo(4, 10);
  });

  it('schedules nothing for a degenerate window', () => {
    expect(scheduleClip(clip({ trimInSeconds: 5, trimOutSeconds: 5 }), anchor(), OPEN)).toBeNull();
    expect(scheduleClip(clip({ sourceDurationSeconds: 0 }), anchor(), OPEN)).toBeNull();
  });

  it('never returns a stop before its start', () => {
    for (const start of [0, 5, 10, 18, 29.99]) {
      const s = scheduleClip(clip(), anchor({ timelineStartSeconds: start }), OPEN);
      if (s) expect(s.stopAt).toBeGreaterThan(s.when);
    }
  });
});
