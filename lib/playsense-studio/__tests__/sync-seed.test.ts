import { describe, expect, it } from 'vitest';
import { buildWaypoints } from '../sync-seed';
import { GUITAR_LICK_FIXTURE, SON_MONTUNO_FIXTURE } from '../score-fixtures';
import { WaypointTimeMap } from '@/components/playsense-studio/shared/time-map/time-map';

describe('buildWaypoints (tempo + offset seed)', () => {
  it('emits one waypoint per measure downbeat plus a tail boundary', () => {
    // GUITAR_LICK is 4/4, 2 measures. At 120 BPM a measure is 2.0s.
    const wps = buildWaypoints(GUITAR_LICK_FIXTURE, 120, 0);
    expect(wps).toHaveLength(3);

    expect(wps[0]).toMatchObject({ musicalPositionQN: 0, measureNumber: 1, beatInMeasure: 1 });
    expect(wps[0].videoTimeSeconds).toBeCloseTo(0, 6);

    expect(wps[1]).toMatchObject({ musicalPositionQN: 4, measureNumber: 2, beatInMeasure: 1 });
    expect(wps[1].videoTimeSeconds).toBeCloseTo(2, 6);

    // tail boundary — past the final downbeat, no measure number
    expect(wps[2].musicalPositionQN).toBe(8);
    expect(wps[2].videoTimeSeconds).toBeCloseTo(4, 6);
    expect(wps[2].measureNumber).toBeNull();
  });

  it('shifts every waypoint by the start offset', () => {
    const wps = buildWaypoints(GUITAR_LICK_FIXTURE, 120, 1.5);
    expect(wps[0].videoTimeSeconds).toBeCloseTo(1.5, 6);
    expect(wps[1].videoTimeSeconds).toBeCloseTo(3.5, 6);
    expect(wps[2].videoTimeSeconds).toBeCloseTo(5.5, 6);
  });

  it('honors per-measure tempo changes (SON_MONTUNO: 96 -> 110 at bar 3)', () => {
    // Bars 1-2 at 96 BPM (2.5s each), bars 3-4 at 110 BPM (~2.1818s each).
    const wps = buildWaypoints(SON_MONTUNO_FIXTURE, 96, 0);
    expect(wps).toHaveLength(5); // 4 measures + tail

    expect(wps[2].musicalPositionQN).toBe(8); // bar 3 downbeat
    expect(wps[2].videoTimeSeconds).toBeCloseTo(5.0, 6);

    expect(wps[3].musicalPositionQN).toBe(12); // bar 4 downbeat
    expect(wps[3].videoTimeSeconds).toBeCloseTo(5.0 + (4 * 60) / 110, 6);

    expect(wps[4].musicalPositionQN).toBe(16); // tail
    expect(wps[4].videoTimeSeconds).toBeCloseTo(5.0 + (8 * 60) / 110, 6);
  });

  it('produces a strictly-increasing set that constructs a WaypointTimeMap', () => {
    const wps = buildWaypoints(SON_MONTUNO_FIXTURE, 96, 0.25);
    expect(() => new WaypointTimeMap('t', 'tempo', wps)).not.toThrow();
  });
});
