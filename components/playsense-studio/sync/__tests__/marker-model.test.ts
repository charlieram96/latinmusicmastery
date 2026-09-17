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
  reconcileMarkers,
  enforceMonotonic,
  markerSpan,
  rangesOverlap,
  freeCorridor,
  EPS,
  NUDGE_EPS,
  gridTime,
  noteTime,
  nudgeDelta,
  setNoteTime,
  setNoteDelta,
  clearNudge,
  clampNudges,
  noteTicks,
  nudgeList,
  countNudges,
  syncOnsets,
  copyMeasureSpans,
  paceSpan,
  spliceMeasureSpans,
  withNudges,
  type MarkerState,
  type MeasureSpan,
  type TimeRange,
} from '../marker-model';
import { buildWaypoints } from '@/lib/playsense-studio/sync-seed';
import { collectOnsets } from '@/lib/playsense-studio/note-onsets';
import { CONGA_TUMBAO_FIXTURE, GUITAR_LICK_FIXTURE } from '@/lib/playsense-studio/score-fixtures';
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

// ---------------------------------------------------------------------------
// reconcileMarkers — re-derive markers after a score-structure change while
// preserving dragged anchor times.
// ---------------------------------------------------------------------------

/** Build a simple N-measure score; per-measure optional time signature. */
function makeScore(specs: Array<{ ts?: [number, number] }>, tempo = 120): ScoreDocument {
  return {
    schemaVersion: 1,
    title: 'x',
    sourceFormat: 'native',
    initialTempo: tempo,
    initialTimeSignature: [4, 4],
    initialKeyFifths: 0,
    tracks: [
      {
        index: 0,
        instrument: 'staff',
        displayName: 'S',
        tuning: null,
        stringMultiplicity: 1,
        channel: null,
        defaultView: 'staff',
        measures: specs.map((s, i) => ({
          number: i + 1,
          timeSignature: s.ts,
          voices: [{ number: 1, events: [{ kind: 'rest', durationQN: s.ts ? (s.ts[0] * 4) / s.ts[1] : 4 }] }],
        })),
      },
    ],
  };
}

function seedScore(score: ScoreDocument): MarkerState {
  const track = score.tracks[0];
  return seedMarkerState(track, score, buildWaypoints(score, score.initialTempo, 0));
}

const downbeatTimes = (s: MarkerState) => s.measures.map((m) => m.beats[0].videoTimeSeconds);

describe('reconcileMarkers', () => {
  it('is an identity no-op when the score structure is unchanged', () => {
    const state = seededGuitar();
    const next = reconcileMarkers(state, GUITAR_TRACK, GUITAR);
    expect(next).toEqual(state);
  });

  it('preserves existing downbeat times and interpolates an appended measure', () => {
    const two = makeScore([{}, {}]); // bars at t=0, 2; tail t=4
    const prev = seedScore(two);
    const three = makeScore([{}, {}, {}]);
    const next = reconcileMarkers(prev, three.tracks[0], three);
    expect(next.measures).toHaveLength(3);
    expect(downbeatTimes(next)[0]).toBeCloseTo(0, 6);
    expect(downbeatTimes(next)[1]).toBeCloseTo(2, 6);
    // bar 3 interpolates between bar 2 (qn4@2) and the preserved tail (qn12@4): t=3
    expect(downbeatTimes(next)[2]).toBeCloseTo(3, 6);
    expect(next.tailVideoTimeSeconds).toBeCloseTo(4, 6);
    const wps = markerStateToWaypoints(next, { includeBeats: 'downbeats-only' });
    expect(() => new WaypointTimeMap('t', 'drag', wps)).not.toThrow();
  });

  it('drops the last measure and stays monotonic on delete-from-end', () => {
    const three = makeScore([{}, {}, {}]); // downbeats 0,2,4; tail 6
    const prev = seedScore(three);
    const two = makeScore([{}, {}]);
    const next = reconcileMarkers(prev, two.tracks[0], two);
    expect(next.measures).toHaveLength(2);
    expect(downbeatTimes(next)).toEqual([expect.closeTo(0, 6), expect.closeTo(2, 6)]);
    expect(next.tailVideoTimeSeconds).toBeCloseTo(6, 6); // preserved old tail
    const wps = markerStateToWaypoints(next, { includeBeats: 'downbeats-only' });
    expect(() => new WaypointTimeMap('t', 'drag', wps)).not.toThrow();
  });

  it('keeps measure count and monotonicity on a middle delete (identity shift accepted)', () => {
    const three = makeScore([{}, {}, {}]);
    const prev = seedScore(three);
    const two = makeScore([{}, {}]); // simulates "delete bar 2" then renumber to 1,2
    const next = reconcileMarkers(prev, two.tracks[0], two);
    expect(next.measures).toHaveLength(2);
    const times = downbeatTimes(next);
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1]);
    const wps = markerStateToWaypoints(next, { includeBeats: 'downbeats-only' });
    expect(() => new WaypointTimeMap('t', 'drag', wps)).not.toThrow();
  });

  it('preserves an edited non-downbeat beat and re-flags it', () => {
    const state = seededGuitar();
    state.measures[0].beats[1].edited = true;
    state.measures[0].beats[1].videoTimeSeconds = 0.7;
    // Append a measure (structure change) and reconcile.
    const three = makeScore([{}, {}, {}]);
    const next = reconcileMarkers(state, three.tracks[0], three);
    expect(next.measures[0].beats[1].edited).toBe(true);
    expect(next.measures[0].beats[1].videoTimeSeconds).toBeCloseTo(0.7, 6);
  });

  it('recomputes downstream QN positions when an upstream time signature changes', () => {
    const prev = seedScore(makeScore([{}, {}, {}])); // all 4/4: downbeats qn 0,4,8
    // bar1 -> 6/8 (3 QN); bar2 returns to 4/4; bar3 inherits 4/4.
    const changed = makeScore([{ ts: [6, 8] }, { ts: [4, 4] }, {}]);
    const next = reconcileMarkers(prev, changed.tracks[0], changed);
    expect(next.measures).toHaveLength(3);
    expect(next.measures[0].beatsInMeasure).toBe(6); // 6/8 -> 6 beats
    expect(next.measures[1].downbeatQN).toBeCloseTo(3, 6); // bar 2 now starts at qn 3
    expect(next.measures[2].downbeatQN).toBeCloseTo(7, 6); // bar 3 at qn 7 (3 + 4)
  });

  it('collapses to a single measure (downbeat + tail) when deleted to one', () => {
    const prev = seedScore(makeScore([{}, {}]));
    const one = makeScore([{}]);
    const next = reconcileMarkers(prev, one.tracks[0], one);
    expect(next.measures).toHaveLength(1);
    expect(next.measures[0].beats[0].videoTimeSeconds).toBeCloseTo(0, 6);
    expect(next.tailVideoTimeSeconds).toBeGreaterThan(0);
  });

  it('falls back to a fresh tempo grid when fewer than two anchors survive', () => {
    const empty: MarkerState = { measures: [], tailQN: 0, tailVideoTimeSeconds: 0 };
    const next = reconcileMarkers(empty, GUITAR_TRACK, GUITAR);
    expect(next.measures).toHaveLength(2);
    expect(next.measures[0].beats[0].videoTimeSeconds).toBeCloseTo(0, 6);
  });
});

describe('section overlap math', () => {
  const range = (startSeconds: number, endSeconds: number): TimeRange => ({ startSeconds, endSeconds });

  it('markerSpan covers first downbeat through tail', () => {
    const state = seededGuitar(); // 2 bars of 4/4 @120 -> 0..4s
    const span = markerSpan(state);
    expect(span.startSeconds).toBeCloseTo(0, 6);
    expect(span.endSeconds).toBeCloseTo(4, 6);
  });

  it('markerSpan includes an edited (shifted) first downbeat', () => {
    const state = setMarkerTime(seededGuitar(), { measureNumber: 1, beatInMeasure: 1 }, -2);
    const span = markerSpan(state);
    expect(span.startSeconds).toBeCloseTo(-2, 6);
  });

  it('rangesOverlap detects intersection and ignores mere touching', () => {
    expect(rangesOverlap(range(0, 4), range(3, 6))).toBe(true);
    expect(rangesOverlap(range(0, 4), range(4, 6))).toBe(false);
    expect(rangesOverlap(range(4, 6), range(0, 4))).toBe(false);
    expect(rangesOverlap(range(1, 2), range(0, 5))).toBe(true);
  });

  it('freeCorridor is unbounded with no siblings', () => {
    expect(freeCorridor(range(2, 6), [])).toEqual({ lo: -Infinity, hi: Infinity });
  });

  it('freeCorridor walls off the nearest sibling on each side', () => {
    const corridor = freeCorridor(range(10, 14), [range(0, 4), range(5, 8), range(20, 25), range(16, 18)]);
    expect(corridor.lo).toBe(8);
    expect(corridor.hi).toBe(16);
  });

  it('freeCorridor ignores a sibling that already intersects the span (legacy data)', () => {
    const corridor = freeCorridor(range(10, 14), [range(12, 20), range(0, 4)]);
    expect(corridor.lo).toBe(4);
    expect(corridor.hi).toBe(Infinity);
  });
});

// ---------------------------------------------------------------------------
// Per-note timing nudges — a delta on top of the anchor grid, keyed by onset.
// ---------------------------------------------------------------------------

const CONGA = CONGA_TUMBAO_FIXTURE;
const CONGA_TRACK = CONGA.tracks[0];

/** 100 BPM: 1 QN = 0.6 s. Downbeats at 0 and 2.4, tail at 4.8. */
function seededConga(): MarkerState {
  return seedMarkerState(CONGA_TRACK, CONGA, buildWaypoints(CONGA, 100, 0));
}

/** N bars of 4/4, four quarter notes each (so every beat is an onset). */
function makeNoteScore(bars: number, options: { halves?: number[] } = {}): ScoreDocument {
  return {
    schemaVersion: 1,
    title: 'n',
    sourceFormat: 'native',
    initialTempo: 120,
    initialTimeSignature: [4, 4],
    initialKeyFifths: 0,
    tracks: [
      {
        index: 0,
        instrument: 'staff',
        displayName: 'S',
        tuning: null,
        stringMultiplicity: 1,
        channel: null,
        defaultView: 'staff',
        measures: Array.from({ length: bars }, (_, i) => ({
          number: i + 1,
          voices: [
            {
              number: 1,
              events: options.halves?.includes(i + 1)
                ? [{ kind: 'note' as const, midi: 60, durationQN: 2 }, { kind: 'note' as const, midi: 62, durationQN: 2 }]
                : [1, 2, 3, 4].map(() => ({ kind: 'note' as const, midi: 60, durationQN: 1 })),
            },
          ],
        })),
      },
    ],
  };
}

const tickTimes = (s: MarkerState) => noteTicks(s).map((t) => t.videoTimeSeconds);

describe('note nudges — seeding', () => {
  it('records each measure\'s onsets and starts with no nudges', () => {
    const state = seededGuitar();
    expect(state.measures[0].onsetQNs).toEqual([0, 1, 2, 3]);
    expect(state.measures[1].onsetQNs).toEqual([4, 5, 6, 7]);
    expect(state.measures.every((m) => m.nudges.length === 0)).toBe(true);
    expect(countNudges(state)).toBe(0);
  });

  it('draws every onset tick at its grid time', () => {
    const state = seededConga();
    expect(tickTimes(state).slice(0, 6)).toEqual([0, 0.6, 0.9, 1.2, 1.8, 2.1].map((t) => expect.closeTo(t, 9)));
    expect(noteTicks(state).every((t) => !t.nudged)).toBe(true);
  });
});

describe('note nudges — setNoteTime', () => {
  it('moves only the nudged note; every other tick and every beat stays put', () => {
    const before = seededConga();
    const after = setNoteTime(before, 1.5, 0.93);
    expect(after).not.toBe(before);
    expect(nudgeDelta(after, 1.5)).toBeCloseTo(0.03, 9);
    expect(noteTime(after, 1.5)).toBeCloseTo(0.93, 9);
    expect(gridTime(after, 1.5)).toBeCloseTo(0.9, 9);

    const beforeTicks = noteTicks(before);
    const afterTicks = noteTicks(after);
    expect(afterTicks).toHaveLength(beforeTicks.length);
    for (let i = 0; i < beforeTicks.length; i++) {
      if (beforeTicks[i].qn === 1.5) {
        expect(afterTicks[i].nudged).toBe(true);
      } else {
        expect(afterTicks[i].videoTimeSeconds).toBeCloseTo(beforeTicks[i].videoTimeSeconds, 12);
        expect(afterTicks[i].nudged).toBe(false);
      }
    }
    expect(after.measures.map((m) => m.beats)).toEqual(before.measures.map((m) => m.beats));
    expect(markerSpan(after)).toEqual(markerSpan(before));
  });

  it('drops the nudge when the note returns to (or within NUDGE_EPS of) the grid', () => {
    const nudged = setNoteTime(seededConga(), 1.5, 0.93);
    expect(countNudges(nudged)).toBe(1);
    expect(countNudges(setNoteTime(nudged, 1.5, 0.9))).toBe(0);
    expect(countNudges(setNoteTime(nudged, 1.5, 0.9 + NUDGE_EPS / 2))).toBe(0);
    expect(countNudges(clearNudge(nudged, 1.5))).toBe(0);
    expect(countNudges(setNoteDelta(nudged, 1.5, 0.02))).toBe(1);
    expect(nudgeDelta(setNoteDelta(nudged, 1.5, 0.02), 1.5)).toBeCloseTo(0.02, 9);
  });

  it('clamps against the neighbouring onsets', () => {
    const state = seededConga();
    // qn 1.5 sits between onsets 1 (0.6 s) and 2 (1.2 s).
    expect(noteTime(setNoteTime(state, 1.5, 0.1), 1.5)).toBeCloseTo(0.6 + EPS, 9);
    expect(noteTime(setNoteTime(state, 1.5, 5), 1.5)).toBeCloseTo(1.2 - EPS, 9);
  });

  it('a downbeat note clamps against the previous bar\'s last onset and its own next onset', () => {
    const state = seededConga();
    // qn 4 = downbeat of bar 2 (2.4 s); previous onset 3.5 (2.1 s), next 5 (3.0 s).
    expect(noteTime(setNoteTime(state, 4, 0), 4)).toBeCloseTo(2.1 + EPS, 9);
    expect(noteTime(setNoteTime(state, 4, 9), 4)).toBeCloseTo(3.0 - EPS, 9);
    // The marker itself (the grid) does not move.
    expect(setNoteTime(state, 4, 2.45).measures[1].beats[0].videoTimeSeconds).toBeCloseTo(2.4, 9);
  });

  it('the last onset clamps below the tail', () => {
    const state = seededConga();
    expect(noteTime(setNoteTime(state, 7.5, 9), 7.5)).toBeCloseTo(4.8 - EPS, 9);
  });

  it('ignores a position that is not an onset', () => {
    const state = seededConga();
    expect(setNoteTime(state, 0.5, 0.4)).toBe(state); // a rest
    expect(setNoteTime(state, 99, 0.4)).toBe(state);
  });
});

describe('note nudges — waypoints', () => {
  it('emits nothing extra when no note is nudged', () => {
    const state = seededConga();
    expect(markerStateToWaypoints(state, { includeBeats: 'edited-beats' })).toHaveLength(3);
  });

  it('pins every onset of a nudged bar so neighbours keep their grid time exactly', () => {
    const state = setNoteTime(seededConga(), 1.5, 0.93);
    const wps = markerStateToWaypoints(state, { includeBeats: 'edited-beats' });
    const onsetRows = wps.filter((w) => w.measureNumber !== null && w.beatInMeasure === null);
    expect(onsetRows.map((w) => w.musicalPositionQN)).toEqual([1, 1.5, 2, 3, 3.5]);
    expect(onsetRows.every((w) => w.measureNumber === 1)).toBe(true);
    expect(wps).toHaveLength(8);

    const map = new WaypointTimeMap('t', 'drag', wps);
    expect(map.toVideoTime(1.5)).toBeCloseTo(0.93, 12);
    expect(map.toVideoTime(1)).toBeCloseTo(0.6, 12);
    expect(map.toVideoTime(2)).toBeCloseTo(1.2, 12);
    expect(map.toVideoTime(5)).toBeCloseTo(3.0, 12);

    expect(markerStateToWaypoints(state, { includeBeats: 'edited-beats', includeNudges: false })).toHaveLength(3);
  });

  it('a nudged downbeat moves its own row and pins both adjacent bars', () => {
    const state = setNoteTime(seededConga(), 4, 2.45);
    const wps = markerStateToWaypoints(state, { includeBeats: 'edited-beats' });
    const db2 = wps.find((w) => w.measureNumber === 2 && w.beatInMeasure === 1)!;
    expect(db2.videoTimeSeconds).toBeCloseTo(2.45, 12);
    const onsetRows = wps.filter((w) => w.measureNumber !== null && w.beatInMeasure === null);
    expect(onsetRows.map((w) => w.musicalPositionQN)).toEqual([1, 1.5, 2, 3, 3.5, 5, 5.5, 6, 7, 7.5]);
    const qns = wps.map((w) => w.musicalPositionQN);
    expect(new Set(qns).size).toBe(qns.length);
    const map = new WaypointTimeMap('t', 'drag', wps);
    expect(map.toVideoTime(3.5)).toBeCloseTo(2.1, 12);
    expect(map.toVideoTime(5)).toBeCloseTo(3.0, 12);
  });

  it('never duplicates a qn when a nudged onset sits on an edited beat', () => {
    const edited = setMarkerTime(seededGuitar(), { measureNumber: 1, beatInMeasure: 2 }, 0.55);
    const state = setNoteTime(edited, 1, 0.57);
    expect(state.measures[0].beats[1].videoTimeSeconds).toBeCloseTo(0.55, 9);
    expect(nudgeDelta(state, 1)).toBeCloseTo(0.02, 9);
    const wps = markerStateToWaypoints(state, { includeBeats: 'edited-beats' });
    const rows = wps.filter((w) => w.musicalPositionQN === 1);
    expect(rows).toHaveLength(1);
    expect(rows[0].beatInMeasure).toBe(2);
    expect(rows[0].videoTimeSeconds).toBeCloseTo(0.57, 12);
    expect(() => new WaypointTimeMap('t', 'drag', wps)).not.toThrow();
  });

  it('round-trips through waypoints + the nudge list', () => {
    const state = setNoteTime(setNoteTime(seededConga(), 1.5, 0.93), 4, 2.45);
    const wps = markerStateToWaypoints(state, { includeBeats: 'edited-beats' });
    const nudges = nudgeList(state);
    expect(nudges).toEqual([
      { qn: 1.5, deltaSeconds: expect.closeTo(0.03, 9) },
      { qn: 4, deltaSeconds: expect.closeTo(0.05, 9) },
    ]);

    const again = seedMarkerState(CONGA_TRACK, CONGA, wps, nudges);
    expect(again.measures[1].beats[0].videoTimeSeconds).toBeCloseTo(2.4, 9);
    expect(again.measures.every((m) => m.beats.every((b) => b.beatInMeasure === 1 || !b.edited))).toBe(true);
    expect(nudgeList(again).map((n) => n.qn)).toEqual([1.5, 4]);
    expect(nudgeDelta(again, 1.5)).toBeCloseTo(0.03, 9);
    expect(nudgeDelta(again, 4)).toBeCloseTo(0.05, 9);
    for (const [a, b] of tickTimes(again).map((t, i) => [t, tickTimes(state)[i]])) {
      expect(a).toBeCloseTo(b, 9);
    }
    const wps2 = markerStateToWaypoints(again, { includeBeats: 'edited-beats' });
    expect(wps2.map((w) => w.musicalPositionQN)).toEqual(wps.map((w) => w.musicalPositionQN));
    for (let i = 0; i < wps.length; i++) {
      expect(wps2[i].videoTimeSeconds).toBeCloseTo(wps[i].videoTimeSeconds, 9);
    }
  });

  it('drops invalid or stale nudges on seed', () => {
    const state = seedMarkerState(CONGA_TRACK, CONGA, buildWaypoints(CONGA, 100, 0), [
      { qn: 0.5, deltaSeconds: 0.02 }, // a rest
      { qn: 1.5, deltaSeconds: Number.NaN },
      { qn: 2, deltaSeconds: NUDGE_EPS / 10 },
      { qn: 3, deltaSeconds: 0.02 },
    ]);
    expect(nudgeList(state)).toEqual([{ qn: 3, deltaSeconds: 0.02 }]);
  });
});

describe('note nudges — riding the grid', () => {
  it('keeps its delta when a downbeat, a ripple drag, or the tail moves', () => {
    const state = setNoteTime(seededConga(), 1.5, 0.93);
    const moved = setMarkerTime(state, { measureNumber: 2, beatInMeasure: 1 }, 3.0);
    expect(nudgeDelta(moved, 1.5)).toBeCloseTo(0.03, 9);
    expect(gridTime(moved, 1.5)).toBeCloseTo(1.125, 9);
    expect(noteTime(moved, 1.5)).toBeCloseTo(1.155, 9);

    const shifted = shiftMarkersFrom(state, { measureNumber: 1, beatInMeasure: 1 }, 1);
    expect(nudgeDelta(shifted, 1.5)).toBeCloseTo(0.03, 9);
    expect(noteTime(shifted, 1.5)).toBeCloseTo(1.93, 9);

    const last = setNoteTime(seededConga(), 7.5, 4.55);
    const tailMoved = setTailTime(last, 6);
    expect(nudgeDelta(tailMoved, 7.5)).toBeCloseTo(0.05, 9);
    expect(noteTime(tailMoved, 7.5)).toBeCloseTo(gridTime(tailMoved, 7.5) + 0.05, 9);
  });

  it('re-clamps when a bar is squeezed and stays strictly increasing', () => {
    const state = setNoteTime(seededConga(), 1.5, 1.15);
    expect(nudgeDelta(state, 1.5)).toBeCloseTo(0.25, 9);
    const squeezed = setMarkerTime(state, { measureNumber: 2, beatInMeasure: 1 }, 0.8);
    // grid(1.5) = 0.3, grid(2) = 0.4 → the nudge can reach at most 0.4 − EPS.
    expect(noteTime(squeezed, 1.5)).toBeCloseTo(0.4 - EPS, 9);
    expect(nudgeDelta(squeezed, 1.5)).toBeCloseTo(0.1 - EPS, 9);
    const times = tickTimes(squeezed);
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1]);
    const wps = markerStateToWaypoints(squeezed, { includeBeats: 'edited-beats' });
    for (let i = 1; i < wps.length; i++) {
      expect(wps[i].videoTimeSeconds - wps[i - 1].videoTimeSeconds).toBeGreaterThanOrEqual(EPS - 1e-12);
    }
    expect(clampNudges(squeezed)).toBe(squeezed);
  });
});

describe('note nudges — reconcile and syncOnsets', () => {
  const two = makeNoteScore(2);
  const seedNotes = (score: ScoreDocument) =>
    seedMarkerState(score.tracks[0], score, buildWaypoints(score, score.initialTempo, 0));

  it('survives an appended measure and dies with a deleted one', () => {
    const state = setNoteTime(seedNotes(two), 5, 2.53);
    const three = reconcileMarkers(state, makeNoteScore(3).tracks[0], makeNoteScore(3));
    expect(nudgeList(three)).toEqual([{ qn: 5, deltaSeconds: expect.closeTo(0.03, 9) }]);
    const one = reconcileMarkers(state, makeNoteScore(1).tracks[0], makeNoteScore(1));
    expect(countNudges(one)).toBe(0);
  });

  it('follows its bar when an upstream time signature shifts the qn axis', () => {
    const state = setNoteTime(seedNotes(two), 5, 2.53);
    const score = makeNoteScore(2);
    score.tracks[0].measures[0] = {
      ...score.tracks[0].measures[0],
      timeSignature: [3, 4],
      voices: [{ number: 1, events: [1, 2, 3].map(() => ({ kind: 'note', midi: 60, durationQN: 1 })) }],
    };
    const next = reconcileMarkers(state, score.tracks[0], score);
    // Bar 2 now starts at qn 3, so "beat 2 of bar 2" is qn 4.
    expect(nudgeList(next).map((n) => n.qn)).toEqual([4]);
  });

  it('syncOnsets is a no-op by reference when the onsets did not change', () => {
    const state = setNoteTime(seedNotes(two), 5, 2.53);
    expect(syncOnsets(state, collectOnsets(two))).toBe(state);
  });

  it('syncOnsets prunes a nudge whose onset disappeared and refreshes the onset list', () => {
    const state = setNoteTime(seedNotes(two), 5, 2.53);
    const halves = makeNoteScore(2, { halves: [2] });
    const next = syncOnsets(state, collectOnsets(halves));
    expect(next).not.toBe(state);
    expect(next.measures[1].onsetQNs).toEqual([4, 6]);
    expect(countNudges(next)).toBe(0);
    expect(next.measures[0]).toBe(state.measures[0]);
  });
});

// ---------------------------------------------------------------------------
// Measure spans — structural edits carry timing along.
// ---------------------------------------------------------------------------

describe('measure spans', () => {
  /** 4 bars of quarter notes at 120 → 2 s per bar; drag beat 2 of bar 2 and nudge beat 2 of bar 3. */
  function shaped(): { score: ScoreDocument; state: MarkerState } {
    const score = makeNoteScore(4);
    let state = seedMarkerState(score.tracks[0], score, buildWaypoints(score, 120, 0));
    state = setMarkerTime(state, { measureNumber: 2, beatInMeasure: 2 }, 2.7); // grid 2.5
    state = setNoteTime(state, 9, 4.55); // bar 3 beat 2, grid 4.5
    return { score, state };
  }
  const starts = (s: MarkerState) => s.measures.map((m) => m.beats[0].videoTimeSeconds);

  it('copyMeasureSpans reports duration, relative edited beats, and relative nudges', () => {
    const { state } = shaped();
    const spans = copyMeasureSpans(state, 1, 2);
    expect(spans).toHaveLength(2);
    expect(spans[0].lengthQN).toBe(4);
    expect(spans[0].durationSeconds).toBeCloseTo(2, 9);
    expect(spans[0].editedBeats).toEqual([{ offsetQN: 1, offsetSeconds: expect.closeTo(0.7, 9) }]);
    expect(spans[0].nudges).toEqual([]);
    expect(spans[1]).toEqual({ lengthQN: 4, durationSeconds: expect.closeTo(2, 9), editedBeats: [], nudges: [{ offsetQN: 1, deltaSeconds: expect.closeTo(0.05, 9) }] });
    // Last bar spans to the tail.
    expect(copyMeasureSpans(state, 3, 1)[0].durationSeconds).toBeCloseTo(2, 9);
  });

  it('paceSpan derives a bar from seconds per quarter note', () => {
    expect(paceSpan(0.5, [3, 4])).toEqual({ lengthQN: 3, durationSeconds: 1.5, editedBeats: [], nudges: [] });
  });

  it('inserting in the middle keeps earlier bars, shifts later bars and the tail by the inserted duration', () => {
    const { score, state } = shaped();
    const nextScore = makeNoteScore(5);
    const insert: MeasureSpan[] = [paceSpan(0.25, [4, 4])]; // a 1 s bar
    const next = spliceMeasureSpans(state, { index: 1, removeCount: 0, insert, ripple: true }, { track: nextScore.tracks[0], score: nextScore });
    expect(next.measures).toHaveLength(5);
    expect(next.measures.map((m) => m.measureNumber)).toEqual([1, 2, 3, 4, 5]);
    expect(next.measures[0]).toEqual(state.measures[0]);
    expect(starts(next)).toEqual([0, 2, 3, 5, 7].map((t) => expect.closeTo(t, 9)));
    expect(next.tailVideoTimeSeconds).toBeCloseTo(9, 9);
    expect(next.tailQN).toBe(20);
    // The dragged beat and the nudge moved with their bars (old bars 2 and 3 are now 3 and 4).
    expect(next.measures[2].beats[1]).toMatchObject({ edited: true, videoTimeSeconds: expect.closeTo(3.7, 9) });
    expect(next.measures[3].nudges).toEqual([{ qn: 13, deltaSeconds: expect.closeTo(0.05, 9) }]);
    expect(nudgeDelta(next, 13)).toBeCloseTo(0.05, 9);
    expect(noteTime(next, 13)).toBeCloseTo(5.55, 9);
    expect(() => new WaypointTimeMap('t', 'drag', markerStateToWaypoints(next, { includeBeats: 'edited-beats' }))).not.toThrow();
    void score;
  });

  it('inserting at the start moves everything; inserting at the end only moves the tail', () => {
    const { state } = shaped();
    const nextScore = makeNoteScore(5);
    const span = [paceSpan(0.25, [4, 4])];
    const atStart = spliceMeasureSpans(state, { index: 0, removeCount: 0, insert: span, ripple: true }, { track: nextScore.tracks[0], score: nextScore });
    expect(starts(atStart)).toEqual([0, 1, 3, 5, 7].map((t) => expect.closeTo(t, 9)));
    const atEnd = spliceMeasureSpans(state, { index: 4, removeCount: 0, insert: span, ripple: true }, { track: nextScore.tracks[0], score: nextScore });
    expect(starts(atEnd)).toEqual([0, 2, 4, 6, 8].map((t) => expect.closeTo(t, 9)));
    expect(atEnd.tailVideoTimeSeconds).toBeCloseTo(9, 9);
  });

  it('copy parity: spliced spans read back identically (copy and repeat)', () => {
    const { state } = shaped();
    const spans = copyMeasureSpans(state, 1, 2);
    const nextScore = makeNoteScore(6);
    const pasted = spliceMeasureSpans(state, { index: 3, removeCount: 0, insert: spans, ripple: true }, { track: nextScore.tracks[0], score: nextScore });
    const norm = (list: MeasureSpan[]) => JSON.parse(JSON.stringify(list, (_k, v) => (typeof v === 'number' ? Number(v.toFixed(9)) : v)));
    expect(norm(copyMeasureSpans(pasted, 3, 2))).toEqual(norm(spans));
    expect(pasted.measures[3].beats[1].edited).toBe(true);
    // Repeat: the source ×3 replaces the source.
    const three = [...spans, ...spans, ...spans];
    const repScore = makeNoteScore(8);
    const rep = spliceMeasureSpans(state, { index: 1, removeCount: 2, insert: three, ripple: true }, { track: repScore.tracks[0], score: repScore });
    expect(norm(copyMeasureSpans(rep, 1, 6))).toEqual(norm(three));
    expect(rep.tailVideoTimeSeconds).toBeCloseTo(16, 9);
  });

  it('deleting with ripple slides later bars earlier; without ripple the previous bar stretches', () => {
    const { state } = shaped();
    const nextScore = makeNoteScore(3);
    const ripple = spliceMeasureSpans(state, { index: 1, removeCount: 1, insert: [], ripple: true }, { track: nextScore.tracks[0], score: nextScore });
    expect(starts(ripple)).toEqual([0, 2, 4].map((t) => expect.closeTo(t, 9)));
    expect(ripple.tailVideoTimeSeconds).toBeCloseTo(6, 9);
    expect(nudgeDelta(ripple, 5)).toBeCloseTo(0.05, 9); // old bar 3's nudge rode along
    const keep = spliceMeasureSpans(state, { index: 1, removeCount: 1, insert: [], ripple: false }, { track: nextScore.tracks[0], score: nextScore });
    expect(starts(keep)).toEqual([0, 4, 6].map((t) => expect.closeTo(t, 9)));
    expect(keep.tailVideoTimeSeconds).toBeCloseTo(8, 9);
  });

  it('withNudges attaches deltas to onsets and drops the rest', () => {
    const score = makeNoteScore(2);
    const state = seedMarkerState(score.tracks[0], score, buildWaypoints(score, 120, 0));
    const next = withNudges(state, [{ qn: 5, deltaSeconds: 0.02 }, { qn: 5.5, deltaSeconds: 0.02 }]);
    expect(nudgeList(next)).toEqual([{ qn: 5, deltaSeconds: 0.02 }]);
    // A nudge on a downbeat onset survives with its delta intact.
    const db = withNudges(state, [{ qn: 4, deltaSeconds: 0.03 }]);
    expect(nudgeDelta(db, 4)).toBeCloseTo(0.03, 9);
    expect(db.measures[1].beats[0].videoTimeSeconds).toBeCloseTo(2, 9);
  });

  it('throws when the spans do not match the next score', () => {
    const { state } = shaped();
    const nextScore = makeNoteScore(5);
    expect(() => spliceMeasureSpans(state, { index: 1, removeCount: 0, insert: [], ripple: true }, { track: nextScore.tracks[0], score: nextScore })).toThrow();
  });
});
