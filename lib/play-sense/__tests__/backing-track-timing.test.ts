import { describe, expect, it } from 'vitest';
import { beatToTimestamp } from '@/lib/play-sense/exercise-utils';
import type { ExerciseEvent } from '@/lib/play-sense/types';
import {
  timelineToEngineSeconds,
  type TimelineToEngine,
} from '@/lib/play-sense/backing-track-timing';

/** A map whose musical position advances `qnPerSecond` per timeline second. */
const linearMap = (qnPerSecond: number, originSeconds = 0): TimelineToEngine => ({
  toMusicalPosition: (videoTimeSeconds) => (videoTimeSeconds - originSeconds) * qnPerSecond,
});

const downbeat = (measure: number): ExerciseEvent =>
  ({ measure, beat: 1 } as unknown as ExerciseEvent);

describe('timelineToEngineSeconds', () => {
  it('matches beatToTimestamp for a 4/4 downbeat', () => {
    // 100bpm 4/4: bar 2 downbeat is 4 QN in.
    const engine = timelineToEngineSeconds(4, linearMap(1), { bpm: 100, timeSignature: [4, 4] });
    expect(engine).toBeCloseTo(2.4, 10);
    expect(engine).toBeCloseTo(beatToTimestamp(downbeat(2), 100, [4, 4]), 10);
  });

  it('matches beatToTimestamp for a compound meter, where QN and beat differ', () => {
    // 120bpm 6/8: a measure is 3 QN, and a beat is an eighth (0.5 QN).
    const engine = timelineToEngineSeconds(3, linearMap(1), { bpm: 120, timeSignature: [6, 8] });
    expect(engine).toBeCloseTo(3, 10);
    expect(engine).toBeCloseTo(beatToTimestamp(downbeat(2), 120, [6, 8]), 10);
  });

  it('is the identity at 60bpm in 4/4, where one second is one quarter note', () => {
    for (const t of [0, 1.5, 12.25]) {
      expect(timelineToEngineSeconds(t, linearMap(1), { bpm: 60, timeSignature: [4, 4] })).toBeCloseTo(t, 10);
    }
  });

  it('scales with a stretched map', () => {
    // Timeline runs at half musical speed, so 8s of video is 4 QN.
    expect(
      timelineToEngineSeconds(8, linearMap(0.5), { bpm: 60, timeSignature: [4, 4] })
    ).toBeCloseTo(4, 10);
  });

  it('returns a negative time for a clip placed before beat one', () => {
    // The scheduler handles this by advancing into the buffer; it must not clamp here.
    expect(
      timelineToEngineSeconds(-2, linearMap(1), { bpm: 60, timeSignature: [4, 4] })
    ).toBeCloseTo(-2, 10);
  });

  it('honours a map whose origin is not at timeline zero', () => {
    // The score starts 10s into the video, so a clip there is at engine zero.
    expect(
      timelineToEngineSeconds(10, linearMap(1, 10), { bpm: 60, timeSignature: [4, 4] })
    ).toBeCloseTo(0, 10);
  });

  describe('with no time map', () => {
    it('treats the timeline as the score grid itself', () => {
      expect(timelineToEngineSeconds(7, null, { bpm: 60, timeSignature: [4, 4] })).toBeCloseTo(7, 10);
    });

    it('subtracts the media origin', () => {
      expect(
        timelineToEngineSeconds(7, null, { bpm: 60, timeSignature: [4, 4] }, 2)
      ).toBeCloseTo(5, 10);
    });
  });

  it('never returns a non-finite value', () => {
    const grid = { bpm: 100, timeSignature: [4, 4] as [number, number] };
    expect(timelineToEngineSeconds(NaN, linearMap(1), grid)).toBe(0);
    expect(timelineToEngineSeconds(5, linearMap(1), { ...grid, bpm: 0 })).toBe(0);
    expect(timelineToEngineSeconds(5, { toMusicalPosition: () => NaN }, grid)).toBe(0);
  });
});

describe('timelineToEngineSeconds with a tempo change', () => {
  it('uses the grid when the exercise has one', async () => {
    const { timelineToEngineSeconds } = await import('../backing-track-timing')
    const grid = { measureStartSec: [0, 2, 4, 6], measureStartQN: [0, 4, 8, 11], secPerQN: [0.5, 0.5, 60 / 90], beatQN: [1, 1, 0.5] }
    const map = { toMusicalPosition: (s: number) => s } // pretend video seconds == qn
    // 9.5 qn is 1.5 qn into bar 3 (♩=90): 4 s + 1.5 × 0.667 s = 5 s
    expect(timelineToEngineSeconds(9.5, map, { bpm: 120, timeSignature: [4, 4], grid })).toBeCloseTo(5, 9)
    // before the start: extrapolate with bar 1's tempo
    expect(timelineToEngineSeconds(-2, map, { bpm: 120, timeSignature: [4, 4], grid })).toBeCloseTo(-1, 9)
  })
})
