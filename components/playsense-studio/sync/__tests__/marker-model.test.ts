import { describe, expect, it } from 'vitest';
import {
  seedMarkerState,
  markerStateToWaypoints,
  orderedMarkers,
  clampMarkerTime,
  shiftMarkersFrom,
  setMarkerTime,
  setTailTime,
  reinterpolateUnedited,
  enforceMonotonic,
  EPS,
  type MarkerState,
} from '../marker-model';
import { buildWaypoints } from '@/lib/playsense-studio/sync-seed';
import { GUITAR_LICK_FIXTURE } from '@/lib/playsense-studio/score-fixtures';
import { WaypointTimeMap, type Waypoint } from '@/components/playsense-studio/shared/time-map/time-map';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

const GUITAR = GUITAR_LICK_FIXTURE;
const GUITAR_TRACK = GUITAR.tracks[0];

function seededGuitar(): MarkerState {
  return seedMarkerState(GUITAR_TRACK, GUITAR, buildWaypoints(GUITAR, 120, 0));
}

// A 2-bar score whose second bar switches to 6/8, to exercise per-measure beat counts.
const MIXED_METER: ScoreDocument = {
  schemaVersion: 1,
  title: 'Mixed meter',
  sourceFormat: 'native',
  initialTempo: 120,
  initialTimeSignature: [4, 4],
  initialKeyFifths: 0,
  tracks: [
    {
      index: 0,
      instrument: 'staff',
      displayName: 'Staff',
      tuning: null,
      stringMultiplicity: 1,
      channel: null,
      defaultView: 'staff',
      measures: [
        { number: 1, voices: [{ number: 1, events: [{ kind: 'rest', durationQN: 4 }] }] },
        { number: 2, timeSignature: [6, 8], voices: [{ number: 1, events: [{ kind: 'rest', durationQN: 3 }] }] },
      ],
    },
  ],
};

describe('seedMarkerState', () => {
  it('builds one measure marker per bar with one beat marker per beat', () => {
    const state = seededGuitar();
    expect(state.measures).toHaveLength(2);
    expect(state.measures[0].beatsInMeasure).toBe(4);
    expect(state.measures[0].beats).toHaveLength(4);
    expect(state.measures[0].measureNumber).toBe(1);
    expect(state.measures.every((m) => m.beats.every((b) => !b.edited))).toBe(true);
  });

  it('places downbeats and interpolates intermediate beats from the seed', () => {
    const state = seededGuitar();
    // At 120 BPM, 1 QN = 0.5s.
    const m1 = state.measures[0];
    expect(m1.beats[0]).toMatchObject({ beatInMeasure: 1, musicalPositionQN: 0 });
    expect(m1.beats[0].videoTimeSeconds).toBeCloseTo(0, 6);
    expect(m1.beats[1].musicalPositionQN).toBe(1);
    expect(m1.beats[1].videoTimeSeconds).toBeCloseTo(0.5, 6); // interpolated, not in seed
    expect(m1.beats[3].videoTimeSeconds).toBeCloseTo(1.5, 6);

    expect(state.measures[1].beats[0]).toMatchObject({ musicalPositionQN: 4 });
    expect(state.measures[1].beats[0].videoTimeSeconds).toBeCloseTo(2.0, 6);

    expect(state.tailQN).toBe(8);
    expect(state.tailVideoTimeSeconds).toBeCloseTo(4.0, 6);
  });

  it('reads beat count per measure from the time signature in effect (4/4 then 6/8)', () => {
    const track = MIXED_METER.tracks[0];
    const state = seedMarkerState(track, MIXED_METER, buildWaypoints(MIXED_METER, 120, 0));
    expect(state.measures[0].beatsInMeasure).toBe(4);
    expect(state.measures[0].beats).toHaveLength(4);
    expect(state.measures[1].beatsInMeasure).toBe(6);
    expect(state.measures[1].beats).toHaveLength(6);
    // 6/8 beats are an eighth (0.5 QN) apart, starting at the bar's downbeat QN (4).
    expect(state.measures[1].beats[1].musicalPositionQN).toBeCloseTo(4.5, 6);
  });
});

describe('markerStateToWaypoints', () => {
  it('downbeats-only matches the tempo-seed density and is strictly increasing', () => {
    const state = seededGuitar();
    const wps = markerStateToWaypoints(state, { includeBeats: 'downbeats-only' });
    expect(wps).toHaveLength(3); // 2 downbeats + tail
    expect(wps.map((w) => w.musicalPositionQN)).toEqual([0, 4, 8]);
    expect(wps[2].measureNumber).toBeNull();
    expect(() => new WaypointTimeMap('t', 'drag', wps)).not.toThrow();
  });

  it('edited-beats includes exactly the beats the admin edited', () => {
    const state = seededGuitar();
    // Edit measure 1, beat 2.
    state.measures[0].beats[1].edited = true;
    state.measures[0].beats[1].videoTimeSeconds = 0.7;

    const wps = markerStateToWaypoints(state, { includeBeats: 'edited-beats' });
    // downbeats (qn 0,4) + edited beat (qn 1) + tail (qn 8)
    expect(wps.map((w) => w.musicalPositionQN)).toEqual([0, 1, 4, 8]);
    const edited = wps.find((w) => w.musicalPositionQN === 1);
    expect(edited).toMatchObject({ beatInMeasure: 2, measureNumber: 1, videoTimeSeconds: 0.7 });
    expect(() => new WaypointTimeMap('t', 'drag', wps)).not.toThrow();
  });

  it('all-expanded includes every beat of expanded measures only', () => {
    const state = seededGuitar();
    state.measures[0].expanded = true; // expand bar 1 only
    const wps = markerStateToWaypoints(state, { includeBeats: 'all-expanded' });
    // bar1 beats qn 0,1,2,3 + bar2 downbeat qn 4 + tail qn 8
    expect(wps.map((w) => w.musicalPositionQN)).toEqual([0, 1, 2, 3, 4, 8]);
  });
});

describe('orderedMarkers', () => {
  it('lists downbeats + expanded-measure beats + tail, sorted by QN', () => {
    const state = seededGuitar();
    state.measures[1].expanded = true;
    const ordered = orderedMarkers(state);
    expect(ordered.map((o) => o.qn)).toEqual([0, 4, 5, 6, 7, 8]);
    expect(ordered[ordered.length - 1].ref).toBeNull(); // tail
  });
});

describe('clampMarkerTime', () => {
  const ordered = [
    { qn: 0, videoTimeSeconds: 0 },
    { qn: 1, videoTimeSeconds: 1 },
    { qn: 2, videoTimeSeconds: 2 },
  ];

  it('clamps a value into the open interval between neighbors', () => {
    expect(clampMarkerTime(ordered, 1, 5)).toBeCloseTo(2 - EPS, 6); // can't reach/cross next
    expect(clampMarkerTime(ordered, 1, -5)).toBeCloseTo(0 + EPS, 6); // can't reach/cross prev
    expect(clampMarkerTime(ordered, 1, 1.3)).toBe(1.3); // in range -> unchanged
  });

  it('first marker has no lower bound, last has no upper bound', () => {
    expect(clampMarkerTime(ordered, 0, -100)).toBe(-100);
    expect(clampMarkerTime(ordered, 2, 100)).toBe(100);
    // but the first is still bounded above by its successor
    expect(clampMarkerTime(ordered, 0, 50)).toBeCloseTo(1 - EPS, 6);
  });

  it('never returns a value <= prev or >= next', () => {
    for (const proposed of [-10, 0.5, 1, 1.0009, 10]) {
      const r = clampMarkerTime(ordered, 1, proposed);
      expect(r).toBeGreaterThan(ordered[0].videoTimeSeconds);
      expect(r).toBeLessThan(ordered[2].videoTimeSeconds);
    }
  });
});

describe('shiftMarkersFrom (drag all)', () => {
  it('shifts the grabbed marker and every later one, leaving earlier ones fixed', () => {
    const state = seededGuitar(); // downbeats at t = 0, 2; tail t = 4
    const shifted = shiftMarkersFrom(state, { measureNumber: 2, beatInMeasure: 1 }, 0.5);
    expect(shifted.measures[0].beats[0].videoTimeSeconds).toBeCloseTo(0, 6); // bar1 unchanged
    expect(shifted.measures[1].beats[0].videoTimeSeconds).toBeCloseTo(2.5, 6); // bar2 +0.5
    expect(shifted.tailVideoTimeSeconds).toBeCloseTo(4.5, 6); // tail +0.5
  });

  it('marks the grabbed non-downbeat beat as edited but does not mark the bulk-shifted ones', () => {
    const state = seededGuitar();
    state.measures[0].expanded = true;
    const shifted = shiftMarkersFrom(state, { measureNumber: 1, beatInMeasure: 2 }, 0.1);
    expect(shifted.measures[0].beats[1].edited).toBe(true); // grabbed
    expect(shifted.measures[1].beats[1].edited).toBe(false); // bulk-shifted, not flagged
  });

  it('seam-clamps a left shift so it cannot cross the preceding marker', () => {
    const state = seededGuitar(); // bar1 t=0, bar2 t=2
    // Try to shift bar 2 left by 5s — would land at -3, crossing bar 1 (t=0).
    const shifted = shiftMarkersFrom(state, { measureNumber: 2, beatInMeasure: 1 }, -5);
    expect(shifted.measures[1].beats[0].videoTimeSeconds).toBeCloseTo(0 + EPS, 6);
    expect(shifted.measures[0].beats[0].videoTimeSeconds).toBeCloseTo(0, 6); // predecessor fixed
  });
});

describe('setMarkerTime (single drag)', () => {
  it('moves a downbeat to the requested time and re-derives unedited beats', () => {
    const state = seededGuitar(); // bar1 t=0, bar2 t=2, tail t=4
    const next = setMarkerTime(state, { measureNumber: 2, beatInMeasure: 1 }, 1.0);
    expect(next.measures[1].beats[0].videoTimeSeconds).toBeCloseTo(1.0, 6);
    expect(next.measures[0].beats[0].videoTimeSeconds).toBeCloseTo(0, 6); // bar1 fixed
    expect(next.tailVideoTimeSeconds).toBeCloseTo(4, 6); // tail fixed
    // bar1's unedited beats re-interpolate into the new [0,1] span.
    expect(next.measures[0].beats[1].videoTimeSeconds).toBeCloseTo(0.25, 6);
  });

  it('clamps a drag so it cannot cross visible neighbors', () => {
    const state = seededGuitar();
    const next = setMarkerTime(state, { measureNumber: 2, beatInMeasure: 1 }, 100);
    // visible neighbors are bar1 downbeat (0) and tail (4); clamp below tail.
    expect(next.measures[1].beats[0].videoTimeSeconds).toBeCloseTo(4 - EPS, 6);
  });

  it('flags a dragged non-downbeat beat as edited', () => {
    const state = seededGuitar();
    state.measures[0].expanded = true;
    const next = setMarkerTime(state, { measureNumber: 1, beatInMeasure: 2 }, 0.7);
    expect(next.measures[0].beats[1].edited).toBe(true);
    expect(next.measures[0].beats[1].videoTimeSeconds).toBeCloseTo(0.7, 6);
  });
});

describe('setTailTime', () => {
  it('moves the tail and re-derives the final measure, clamped above the last anchor', () => {
    const state = seededGuitar(); // last downbeat (bar2) t=2, tail t=4
    const next = setTailTime(state, 5);
    expect(next.tailVideoTimeSeconds).toBeCloseTo(5, 6);
    // bar2 unedited beats re-interpolate into [2,5]: qn5 -> 2.75
    expect(next.measures[1].beats[1].videoTimeSeconds).toBeCloseTo(2.75, 6);

    const clampedDown = setTailTime(state, 1);
    expect(clampedDown.tailVideoTimeSeconds).toBeCloseTo(2 + EPS, 6);
  });
});

describe('reinterpolateUnedited', () => {
  it('rebuilds unedited beats from anchors but leaves edited beats and downbeats', () => {
    const state = seededGuitar();
    state.measures[0].beats[1].edited = true;
    state.measures[0].beats[1].videoTimeSeconds = 0.9; // an anchor now
    const next = reinterpolateUnedited(state);
    expect(next.measures[0].beats[1].videoTimeSeconds).toBeCloseTo(0.9, 6); // edited untouched
    expect(next.measures[0].beats[0].videoTimeSeconds).toBeCloseTo(0, 6); // downbeat untouched
    // beat 3 (qn2) re-derives from anchors (qn1@0.9 .. qn4@2.0): 0.9 + (1/3)*1.1
    expect(next.measures[0].beats[2].videoTimeSeconds).toBeCloseTo(0.9 + 1.1 / 3, 6);
  });
});

describe('enforceMonotonic', () => {
  it('repairs a non-increasing array and is idempotent', () => {
    const broken: Waypoint[] = [
      { musicalPositionQN: 0, videoTimeSeconds: 0, measureNumber: 1, beatInMeasure: 1 },
      { musicalPositionQN: 1, videoTimeSeconds: 0, measureNumber: 1, beatInMeasure: 2 }, // dup time
      { musicalPositionQN: 2, videoTimeSeconds: -1, measureNumber: 2, beatInMeasure: 1 }, // backwards
    ];
    const fixed = enforceMonotonic(broken);
    for (let i = 1; i < fixed.length; i++) {
      expect(fixed[i].videoTimeSeconds).toBeGreaterThan(fixed[i - 1].videoTimeSeconds);
    }
    expect(() => new WaypointTimeMap('t', 'drag', fixed)).not.toThrow();
    expect(enforceMonotonic(fixed)).toEqual(fixed); // idempotent
  });
});

describe('round-trip waypoints -> state -> waypoints', () => {
  it('is stable and preserves edited beats', () => {
    const state = seededGuitar();
    state.measures[0].beats[1].edited = true;
    state.measures[0].beats[1].videoTimeSeconds = 0.7;

    const wps1 = markerStateToWaypoints(state, { includeBeats: 'edited-beats' });
    const state2 = seedMarkerState(GUITAR_TRACK, GUITAR, wps1);
    // The edited (non-downbeat) beat must come back as edited.
    expect(state2.measures[0].beats[1].edited).toBe(true);
    expect(state2.measures[0].beats[1].videoTimeSeconds).toBeCloseTo(0.7, 6);

    const wps2 = markerStateToWaypoints(state2, { includeBeats: 'edited-beats' });
    expect(wps2).toEqual(wps1);
  });
});
