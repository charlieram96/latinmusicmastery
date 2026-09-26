import { describe, expect, it } from 'vitest';
import { EMPTY_TIMING, readNudges, studioTimingSchema, timingFromLive, timingToTimeMap } from '../timing';

const wp = (qn: number, s: number) => ({ musicalPositionQN: qn, videoTimeSeconds: s, measureNumber: null, beatInMeasure: null });

describe('studio timing', () => {
  it('seeds from a live map, keeping params and folding in nudges', () => {
    const t = timingFromLive(
      { method: 'drag', params: { pps: 40 }, waypoints: [wp(0, 1), wp(4, 3)], nudges: [{ qn: 1, deltaSeconds: 0.02 }] },
      { seconds: 1.5, qn: 1 }
    );
    expect(t).toEqual({
      method: 'drag',
      params: { pps: 40, nudges: [{ qn: 1, deltaSeconds: 0.02 }] },
      waypoints: [wp(0, 1), wp(4, 3)],
      anchor: { seconds: 1.5, qn: 1 },
    });
  });
  it('seeds an empty timing when there is no live map', () => {
    expect(timingFromLive(null, null)).toEqual(EMPTY_TIMING);
  });
  it('turns a draft timing back into the map shape the SyncPanel seeds from', () => {
    const t = timingFromLive({ method: 'drag', params: { nudges: [{ qn: 2, deltaSeconds: -0.01 }] }, waypoints: [wp(0, 0), wp(4, 2)] }, null);
    expect(timingToTimeMap(t)).toEqual({ id: 'draft', method: 'drag', waypoints: [wp(0, 0), wp(4, 2)], nudges: [{ qn: 2, deltaSeconds: -0.01 }], flex: [] });
    expect(timingToTimeMap(EMPTY_TIMING)).toBeNull();
  });
  it('carries flex from params into the map shape', () => {
    const t = { ...EMPTY_TIMING, params: { flex: [{ src: 1, dst: 1.1, anchor: false }, { src: 2, dst: 2, anchor: true }] },
      waypoints: [wp(0, 0), wp(4, 4)] };
    expect(timingToTimeMap(t)?.flex).toEqual([{ src: 1, dst: 1.1, anchor: false }, { src: 2, dst: 2, anchor: true }]);
  });
  it('drops malformed nudges and rejects malformed timing', () => {
    expect(readNudges({ nudges: [{ qn: 1, deltaSeconds: 0.1 }, { qn: 'x' }] })).toEqual([{ qn: 1, deltaSeconds: 0.1 }]);
    expect(studioTimingSchema.safeParse({ method: 'drag', params: {}, waypoints: [{ musicalPositionQN: 'a' }], anchor: null }).success).toBe(false);
    expect(studioTimingSchema.safeParse(EMPTY_TIMING).success).toBe(true);
  });
});
