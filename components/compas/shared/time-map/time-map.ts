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
 * Implementation lands in M1.
 *
 * Edge handling:
 *   - Before the first waypoint: extrapolate using the first interval's slope.
 *   - After the last waypoint: extrapolate using the last interval's slope.
 *   - A TimeMap requires ≥2 waypoints to construct.
 */
