import { z } from 'zod';
import { readFlex, type FlexPoint } from '@/lib/playsense-studio/flex';

const waypointSchema = z.object({
  musicalPositionQN: z.number(),
  videoTimeSeconds: z.number(),
  measureNumber: z.number().nullable(),
  beatInMeasure: z.number().nullable(),
});

/** Studio rework P5: bar 1 placement + count-in/pre-roll for a graded owner
 *  (EXERCISE, JAM_SESSION). Optional — only graded owners ever set it. */
const playSchema = z.object({
  bar1Seconds: z.number().nullable(),
  countInBars: z.union([z.literal(1), z.literal(2)]),
  preroll: z.boolean(),
});

export const studioTimingSchema = z.object({
  method: z.enum(['tempo', 'tap', 'drag', 'midi']),
  params: z.record(z.string(), z.unknown()),
  waypoints: z.array(waypointSchema),
  anchor: z.object({ seconds: z.number(), qn: z.number().nullable() }).nullable(),
  play: playSchema.optional(),
});

export type StudioTiming = z.infer<typeof studioTimingSchema>;
export type StudioWaypoint = StudioTiming['waypoints'][number];
export type StudioAnchor = NonNullable<StudioTiming['anchor']>;
export type StudioPlay = NonNullable<StudioTiming['play']>;
export type StudioNudge = { qn: number; deltaSeconds: number };

/** A song, or an owner never synced: no waypoints, no anchor. */
export const EMPTY_TIMING: StudioTiming = { method: 'drag', params: {}, waypoints: [], anchor: null };

/** params.nudges, defensively: anything malformed is dropped. */
export function readNudges(params: unknown): StudioNudge[] {
  const raw = (params as { nudges?: unknown } | null)?.nudges;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (n): n is StudioNudge =>
      !!n && typeof n.qn === 'number' && Number.isFinite(n.qn) &&
      typeof n.deltaSeconds === 'number' && Number.isFinite(n.deltaSeconds)
  );
}

const METHODS = ['tempo', 'tap', 'drag', 'midi'] as const;

/** Seed a draft timing from the live map (as the Studio loads it) and anchor. */
export function timingFromLive(
  map: {
    method: string;
    params?: Record<string, unknown> | null;
    waypoints: StudioWaypoint[];
    nudges?: StudioNudge[];
  } | null,
  anchor: StudioAnchor | null
): StudioTiming {
  if (!map) return { ...EMPTY_TIMING, anchor };
  const params: Record<string, unknown> = { ...(map.params ?? {}) };
  if (map.nudges && !('nudges' in params)) params.nudges = map.nudges;
  const method = (METHODS as readonly string[]).includes(map.method)
    ? (map.method as StudioTiming['method'])
    : 'drag';
  return { method, params, waypoints: map.waypoints.map((w) => ({ ...w })), anchor };
}

/** The map shape SyncPanel seeds its markers from; null when not synced. */
export function timingToTimeMap(t: StudioTiming): {
  id: string;
  method: string;
  waypoints: StudioWaypoint[];
  nudges: StudioNudge[];
  flex: FlexPoint[];
} | null {
  if (t.waypoints.length < 2) return null;
  return { id: 'draft', method: t.method, waypoints: t.waypoints, nudges: readNudges(t.params), flex: readFlex(t.params) };
}
