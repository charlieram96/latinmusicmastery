import { describe, expect, it } from 'vitest';
import {
  WaypointTimeMap,
  type Waypoint,
} from '../time-map/time-map';

function wp(qn: number, t: number, measure?: number, beat?: number): Waypoint {
  return {
    musicalPositionQN: qn,
    videoTimeSeconds: t,
    measureNumber: measure ?? null,
    beatInMeasure: beat ?? null,
  };
}

describe('WaypointTimeMap construction', () => {
  it('rejects fewer than 2 waypoints', () => {
    expect(() => new WaypointTimeMap('id', 'tap', [])).toThrow();
    expect(() => new WaypointTimeMap('id', 'tap', [wp(0, 0)])).toThrow();
  });

  it('rejects duplicate musical positions', () => {
    expect(
      () => new WaypointTimeMap('id', 'tap', [wp(0, 0), wp(0, 1), wp(2, 2)])
    ).toThrow();
  });

  it('rejects non-strictly-increasing video time', () => {
    expect(
      () => new WaypointTimeMap('id', 'tap', [wp(0, 0), wp(1, 0), wp(2, 1)])
    ).toThrow();
    expect(
      () => new WaypointTimeMap('id', 'tap', [wp(0, 1), wp(1, 0.5)])
    ).toThrow();
  });

  it('sorts unsorted input', () => {
    const m = new WaypointTimeMap('id', 'tap', [wp(4, 2), wp(0, 0), wp(2, 1)]);
    expect(m.totalQN).toBe(4);
    expect(m.videoStart).toBe(0);
    expect(m.videoEnd).toBe(2);
  });
});

describe('WaypointTimeMap interpolation', () => {
  // Linear: 4 QN over 2 seconds, so 1 QN = 0.5 sec
  const linear = new WaypointTimeMap('linear', 'tempo', [wp(0, 0), wp(4, 2)]);

  it('toVideoTime maps endpoints', () => {
    expect(linear.toVideoTime(0)).toBe(0);
    expect(linear.toVideoTime(4)).toBe(2);
  });

  it('toVideoTime interpolates the midpoint', () => {
    expect(linear.toVideoTime(2)).toBe(1);
  });

  it('toMusicalPosition is the inverse', () => {
    expect(linear.toMusicalPosition(0)).toBe(0);
    expect(linear.toMusicalPosition(2)).toBe(4);
    expect(linear.toMusicalPosition(1)).toBe(2);
  });

  it('extrapolates before the first waypoint using the first slope', () => {
    expect(linear.toVideoTime(-2)).toBe(-1);
    expect(linear.toMusicalPosition(-1)).toBe(-2);
  });

  it('extrapolates after the last waypoint using the last slope', () => {
    expect(linear.toVideoTime(8)).toBe(4);
    expect(linear.toMusicalPosition(4)).toBe(8);
  });
});

describe('WaypointTimeMap with tempo change (piecewise linear)', () => {
  // Bar 1-2 at 120 BPM (1 QN = 0.5 sec), bar 3+ at 60 BPM (1 QN = 1 sec)
  // Waypoints: qn=0→t=0, qn=8→t=4, qn=12→t=8
  const piecewise = new WaypointTimeMap('piecewise', 'tap', [
    wp(0, 0, 1, 1),
    wp(8, 4, 3, 1),
    wp(12, 8, 4, 1),
  ]);

  it('honors slow segment after tempo change', () => {
    expect(piecewise.toVideoTime(8)).toBe(4);
    expect(piecewise.toVideoTime(10)).toBe(6); // halfway through second segment
    expect(piecewise.toVideoTime(12)).toBe(8);
  });

  it('honors fast segment before tempo change', () => {
    expect(piecewise.toVideoTime(0)).toBe(0);
    expect(piecewise.toVideoTime(4)).toBe(2);
    expect(piecewise.toVideoTime(8)).toBe(4);
  });
});

describe('WaypointTimeMap.locate', () => {
  const m = new WaypointTimeMap('m', 'drag', [
    wp(0, 0, 1, 1),
    wp(4, 2, 2, 1),
    wp(8, 4, 3, 1),
  ]);

  it('returns the first waypoint at or before videoStart', () => {
    expect(m.locate(0)).toEqual({ measure: 1, beat: 1 });
    expect(m.locate(-5)).toEqual({ measure: 1, beat: 1 });
  });

  it('returns the last waypoint at or after videoEnd', () => {
    expect(m.locate(4)).toEqual({ measure: 3, beat: 1 });
    expect(m.locate(9)).toEqual({ measure: 3, beat: 1 });
  });

  it('snaps to nearer side mid-segment', () => {
    expect(m.locate(0.5)).toEqual({ measure: 1, beat: 1 });
    expect(m.locate(1.5)).toEqual({ measure: 2, beat: 1 });
    expect(m.locate(2.5)).toEqual({ measure: 2, beat: 1 });
    expect(m.locate(3.5)).toEqual({ measure: 3, beat: 1 });
  });
});
