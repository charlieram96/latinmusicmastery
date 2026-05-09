// Compás TimeMap — the abstraction between musical position and video time.
//
// All four sync methods (tempo, tap, drag, midi) materialize into the same
// dense waypoint format in score_time_waypoints. The player only ever
// consumes WaypointTimeMap, which linear-interpolates between adjacent
// waypoints. This eliminates an if/else per sync method everywhere except
// the four authoring tools.

export type MusicalPositionQN = number;
export type VideoTimeSec = number;
export type SyncMethod = 'tempo' | 'tap' | 'drag' | 'midi';

export interface Waypoint {
  musicalPositionQN: MusicalPositionQN;
  videoTimeSeconds: VideoTimeSec;
  /** Denormalized for "jump to measure 17" without recomputing. */
  measureNumber: number | null;
  beatInMeasure: number | null;
}

export interface TimeMap {
  readonly id: string;
  readonly method: SyncMethod;

  toVideoTime(qn: MusicalPositionQN): VideoTimeSec;
  toMusicalPosition(t: VideoTimeSec): MusicalPositionQN;
  locate(t: VideoTimeSec): { measure: number; beat: number };

  readonly totalQN: number;
  readonly videoStart: VideoTimeSec;
  readonly videoEnd: VideoTimeSec;
}

/**
 * The single runtime implementation backing every sync method.
 *
 * Edge handling:
 *   - Before the first waypoint: extrapolate using the first interval's slope.
 *   - After the last waypoint: extrapolate using the last interval's slope.
 *   - A WaypointTimeMap requires ≥2 waypoints to construct.
 */
export class WaypointTimeMap implements TimeMap {
  readonly id: string;
  readonly method: SyncMethod;

  /** Sorted ascending by musicalPositionQN; both arrays share index ordering. */
  private readonly waypoints: readonly Waypoint[];

  constructor(id: string, method: SyncMethod, waypoints: readonly Waypoint[]) {
    if (waypoints.length < 2) {
      throw new Error(
        `WaypointTimeMap requires at least 2 waypoints (got ${waypoints.length}).`
      );
    }

    const sorted = [...waypoints].sort(
      (a, b) => a.musicalPositionQN - b.musicalPositionQN
    );

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].musicalPositionQN === sorted[i - 1].musicalPositionQN) {
        throw new Error(
          `WaypointTimeMap waypoints have duplicate musical positions at qn=${sorted[i].musicalPositionQN}.`
        );
      }
      if (sorted[i].videoTimeSeconds <= sorted[i - 1].videoTimeSeconds) {
        throw new Error(
          `WaypointTimeMap waypoints must have strictly increasing video time (qn=${sorted[i].musicalPositionQN}).`
        );
      }
    }

    this.id = id;
    this.method = method;
    this.waypoints = sorted;
  }

  get totalQN(): number {
    return (
      this.waypoints[this.waypoints.length - 1].musicalPositionQN -
      this.waypoints[0].musicalPositionQN
    );
  }

  get videoStart(): VideoTimeSec {
    return this.waypoints[0].videoTimeSeconds;
  }

  get videoEnd(): VideoTimeSec {
    return this.waypoints[this.waypoints.length - 1].videoTimeSeconds;
  }

  toVideoTime(qn: MusicalPositionQN): VideoTimeSec {
    const wp = this.waypoints;

    if (qn <= wp[0].musicalPositionQN) {
      return interpolate(qn, wp[0], wp[1], 'qn-to-time');
    }
    if (qn >= wp[wp.length - 1].musicalPositionQN) {
      return interpolate(qn, wp[wp.length - 2], wp[wp.length - 1], 'qn-to-time');
    }

    const i = bisectByQN(wp, qn);
    return interpolate(qn, wp[i], wp[i + 1], 'qn-to-time');
  }

  toMusicalPosition(t: VideoTimeSec): MusicalPositionQN {
    const wp = this.waypoints;

    if (t <= wp[0].videoTimeSeconds) {
      return interpolate(t, wp[0], wp[1], 'time-to-qn');
    }
    if (t >= wp[wp.length - 1].videoTimeSeconds) {
      return interpolate(t, wp[wp.length - 2], wp[wp.length - 1], 'time-to-qn');
    }

    const i = bisectByVideoTime(wp, t);
    return interpolate(t, wp[i], wp[i + 1], 'time-to-qn');
  }

  locate(t: VideoTimeSec): { measure: number; beat: number } {
    const wp = this.waypoints;

    if (t <= wp[0].videoTimeSeconds) {
      return measureBeatOf(wp[0]);
    }
    if (t >= wp[wp.length - 1].videoTimeSeconds) {
      return measureBeatOf(wp[wp.length - 1]);
    }

    const i = bisectByVideoTime(wp, t);
    // Snap to the nearer of the two surrounding waypoints — measure/beat
    // is denormalized, not interpolated, so picking the closest is the right
    // semantics for "which measure/beat is currently sounding".
    const left = wp[i];
    const right = wp[i + 1];
    return Math.abs(t - left.videoTimeSeconds) <= Math.abs(right.videoTimeSeconds - t)
      ? measureBeatOf(left)
      : measureBeatOf(right);
  }
}

function interpolate(
  x: number,
  a: Waypoint,
  b: Waypoint,
  direction: 'qn-to-time' | 'time-to-qn'
): number {
  if (direction === 'qn-to-time') {
    const slope =
      (b.videoTimeSeconds - a.videoTimeSeconds) /
      (b.musicalPositionQN - a.musicalPositionQN);
    return a.videoTimeSeconds + (x - a.musicalPositionQN) * slope;
  }
  const slope =
    (b.musicalPositionQN - a.musicalPositionQN) /
    (b.videoTimeSeconds - a.videoTimeSeconds);
  return a.musicalPositionQN + (x - a.videoTimeSeconds) * slope;
}

function bisectByQN(wp: readonly Waypoint[], qn: number): number {
  let lo = 0;
  let hi = wp.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >>> 1;
    if (wp[mid].musicalPositionQN <= qn) lo = mid;
    else hi = mid;
  }
  return lo;
}

function bisectByVideoTime(wp: readonly Waypoint[], t: number): number {
  let lo = 0;
  let hi = wp.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >>> 1;
    if (wp[mid].videoTimeSeconds <= t) lo = mid;
    else hi = mid;
  }
  return lo;
}

function measureBeatOf(wp: Waypoint): { measure: number; beat: number } {
  return {
    measure: wp.measureNumber ?? 0,
    beat: wp.beatInMeasure ?? 0,
  };
}
