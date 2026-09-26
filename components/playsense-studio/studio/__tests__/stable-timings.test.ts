import { describe, expect, it } from 'vitest';
import { stableTimings } from '../stable-timings';

const t = (measureNumber: number, start: number, end: number) => ({ measureNumber, startVideoTimeSeconds: start, endVideoTimeSeconds: end });

describe('stableTimings', () => {
  it('hands back the previous array when every bar’s number, start and end are unchanged', () => {
    const prev = [t(1, 0, 2), t(2, 2, 4)];
    const next = [t(1, 0, 2), t(2, 2, 4)];
    expect(stableTimings(prev, next)).toBe(prev);
  });

  it('hands back the new array when a bar moved, was renumbered, or the count changed', () => {
    const prev = [t(1, 0, 2), t(2, 2, 4)];
    for (const next of [
      [t(1, 0, 2.1), t(2, 2.1, 4)],
      [t(1, 0, 2), t(2, 2, 4.5)],
      [t(1, 0, 2), t(3, 2, 4)],
      [t(1, 0, 2)],
      [t(1, 0, 2), t(2, 2, 4), t(3, 4, 6)],
    ]) expect(stableTimings(prev, next)).toBe(next);
  });

  it('hands back the new array when there was none before', () => {
    const next = [t(1, 0, 2)];
    expect(stableTimings(null, next)).toBe(next);
  });

  it('treats a flag change as a change', () => {
    const a: { measureNumber: number; startVideoTimeSeconds: number; endVideoTimeSeconds: number; flag: string | null }[] =
      [{ measureNumber: 1, startVideoTimeSeconds: 0, endVideoTimeSeconds: 2, flag: null }];
    const b: typeof a = [{ measureNumber: 1, startVideoTimeSeconds: 0, endVideoTimeSeconds: 2, flag: 'No hit near the first note' }];
    expect(stableTimings(a, b)).toBe(b);
    expect(stableTimings(b, [{ ...b[0] }])).toBe(b);
  });
});
