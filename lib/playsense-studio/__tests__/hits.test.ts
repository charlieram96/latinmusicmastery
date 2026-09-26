import { describe, expect, it } from 'vitest';
import type { MarkerState } from '@/components/playsense-studio/sync/marker-model';
import { barFlags, firstAttackTime, flagText, nearestHit, snapBarTime, snapSectionShift } from '../hits';

/** Bars of 4 QN starting at `starts` (seconds), with first onsets `firstOnsetQN[i]` (absolute qn). */
function state(starts: number[], tail: number, firstOnsetQN: (number | null)[]): MarkerState {
  return {
    measures: starts.map((s, i) => {
      const end = i + 1 < starts.length ? starts[i + 1] : tail;
      return {
        measureNumber: i + 1, beatsInMeasure: 4, downbeatQN: i * 4, expanded: false, nudges: [],
        onsetQNs: firstOnsetQN[i] == null ? [] : [firstOnsetQN[i]!],
        beats: [0, 1, 2, 3].map((b) => ({
          beatInMeasure: b + 1, musicalPositionQN: i * 4 + b, videoTimeSeconds: s + ((end - s) * b) / 4, edited: false,
        })),
      };
    }),
    tailQN: starts.length * 4,
    tailVideoTimeSeconds: tail,
  } as unknown as MarkerState;
}

describe('hits helpers', () => {
  it('finds the nearest hit within tolerance', () => {
    expect(nearestHit([1, 2, 3], 2.05, 0.1)).toBe(2);
    expect(nearestHit([1, 2, 3], 2.5, 0.1)).toBeNull();
    expect(nearestHit([], 1, 1)).toBeNull();
    expect(nearestHit([1, 1.2], 1.1, 0.2)).toBe(1);
  });
  it('first attack time follows the bar mapping', () => {
    const s = state([0, 2], 4, [1, null]);
    expect(firstAttackTime(s, 0)).toBeCloseTo(0.5);
    expect(firstAttackTime(s, 1)).toBeNull();
  });
  it('snaps the bar line or the first note, whichever is closer, only within tolerance', () => {
    expect(snapBarTime(1.03, null, [1.0], 0.05)).toEqual({ time: 1.0, snapped: true });
    expect(snapBarTime(1.03, 0.25, [1.3], 0.05)).toEqual({ time: 1.05, snapped: true });
    expect(snapBarTime(1.03, 0.25, [1.0, 1.3], 0.05).time).toBeCloseTo(1.05);
    expect(snapBarTime(1.2, 0.25, [1.0], 0.05)).toEqual({ time: 1.2, snapped: false });
  });
  it('tolerance is whatever seconds the caller computed from pixels', () => {
    const pps = 40;
    expect(snapBarTime(1.15, null, [1.0], 8 / pps).snapped).toBe(true);
    expect(snapBarTime(1.15, null, [1.0], 8 / 400).snapped).toBe(false);
  });
  it('snaps a section shift so its first note lands on a hit', () => {
    expect(snapSectionShift(2.0, 0.48, [2.5], 0.05)).toBeCloseTo(0.5);
    expect(snapSectionShift(2.0, 0.3, [2.5], 0.05)).toBeCloseTo(0.3);
  });
  it('flags a missing hit, an off first note, and a tempo outlier', () => {
    // Bars start 0,2,4,6,8.4 (the last bar is slower); the first onsets are on each downbeat.
    const s = state([0, 2, 4, 6], 8.4, [0, 4, 8, 12]);
    const hits = [0.0, 2.05, 6.0];
    const flags = barFlags(s, hits);
    expect(flags.get(1)).toBeUndefined();
    expect(flags.get(2)).toEqual({ kind: 'off', ms: 50 });
    expect(flags.get(3)).toEqual({ kind: 'no-hit' });
    expect(flags.get(4)).toEqual({ kind: 'tempo', pct: 20 });
    expect(barFlags(s, []).size).toBe(0);
  });
  it('measures tempo against the true median: the mean of the middle two for an even count', () => {
    // Seconds per QN: 0.5, 0.5, 0.6, 0.55. Median 0.525, not the upper middle 0.55.
    const s = state([0, 2, 4, 6.4], 8.6, [0, 4, 8, 12]);
    const flags = barFlags(s, [0, 2, 4, 6.4]);
    expect(flags.get(1)).toBeUndefined(); // 4.8% under 0.525 (it would be 9% under 0.55)
    expect(flags.get(2)).toBeUndefined();
    expect(flags.get(3)).toEqual({ kind: 'tempo', pct: 14 });
    expect(flags.get(4)).toBeUndefined();
  });
  it('still flags the tempo of a bar with no onsets', () => {
    const s = state([0, 2, 4, 6], 8.4, [0, 4, 8, null]);
    const flags = barFlags(s, [0, 2, 4]);
    expect(flags.get(4)).toEqual({ kind: 'tempo', pct: 20 });
    expect([1, 2, 3].map((n) => flags.get(n))).toEqual([undefined, undefined, undefined]);
  });
  it('judges a nudged first note by its effective time', () => {
    const s = state([0, 2, 4, 6], 8, [0, 4, 8, 12]);
    (s.measures[1] as unknown as { nudges: unknown[] }).nudges = [{ qn: 4, deltaSeconds: 0.05 }];
    expect(barFlags(s, [0, 2.05, 4, 6]).get(2)).toBeUndefined();
    expect(barFlags(s, [0, 2.0, 4, 6]).get(2)).toEqual({ kind: 'off', ms: 50 });
  });
  it('words each flag', () => {
    expect(flagText({ kind: 'no-hit' })).toBe('No hit near the first note');
    expect(flagText({ kind: 'off', ms: 42 })).toBe('First note 42 ms off the recording');
    expect(flagText({ kind: 'tempo', pct: 7 })).toBe('Tempo 7% off the other bars');
  });
});
