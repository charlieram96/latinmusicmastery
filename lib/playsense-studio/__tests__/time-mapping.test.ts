import { describe, expect, it } from 'vitest';
import {
  beatLengthInQN,
  measureBeatToMs,
  measureBeatToQN,
  measureLengthInQN,
  qnToMs,
  qnToTrackMs,
  trackDurationMs,
  trackDurationQN,
} from '../time-mapping';
import {
  CONGA_TUMBAO_FIXTURE,
  GUITAR_LICK_FIXTURE,
  SON_MONTUNO_FIXTURE,
} from '../score-fixtures';

describe('time-mapping primitives', () => {
  it('measureLengthInQN: 4/4 = 4 QN, 6/8 = 3 QN, 3/2 = 6 QN', () => {
    expect(measureLengthInQN([4, 4])).toBe(4);
    expect(measureLengthInQN([6, 8])).toBe(3);
    expect(measureLengthInQN([3, 2])).toBe(6);
  });

  it('beatLengthInQN: 4/4 beat = 1 QN, 6/8 beat = 0.5 QN, 3/2 beat = 2 QN', () => {
    expect(beatLengthInQN([4, 4])).toBe(1);
    expect(beatLengthInQN([6, 8])).toBe(0.5);
    expect(beatLengthInQN([3, 2])).toBe(2);
  });

  it('qnToMs at 120 BPM: 1 QN = 500 ms, 4 QN = 2000 ms', () => {
    expect(qnToMs(1, 120)).toBe(500);
    expect(qnToMs(4, 120)).toBe(2000);
  });

  it('qnToMs at 60 BPM: 1 QN = 1000 ms', () => {
    expect(qnToMs(1, 60)).toBe(1000);
  });
});

describe('measureBeatToMs (the M1 plan demo)', () => {
  // GUITAR_LICK_FIXTURE is 4/4 at 120 BPM, two measures.

  it('beat 1 of measure 1 = 0 ms', () => {
    const track = GUITAR_LICK_FIXTURE.tracks[0];
    expect(measureBeatToMs(track, GUITAR_LICK_FIXTURE, 1, 1)).toBe(0);
  });

  it('beat 1 of measure 2 = 2000 ms', () => {
    const track = GUITAR_LICK_FIXTURE.tracks[0];
    expect(measureBeatToMs(track, GUITAR_LICK_FIXTURE, 2, 1)).toBe(2000);
  });

  // The headline demo: "beat 4 of measure 2 at 120 BPM = 3500 ms"
  // (one measure of 4 quarters = 2000 ms; three more quarters into m2 = +1500 ms)
  it('beat 4 of measure 2 = 3500 ms', () => {
    const track = GUITAR_LICK_FIXTURE.tracks[0];
    expect(measureBeatToMs(track, GUITAR_LICK_FIXTURE, 2, 4)).toBe(3500);
  });

  it('returns null for missing measure', () => {
    const track = GUITAR_LICK_FIXTURE.tracks[0];
    expect(measureBeatToMs(track, GUITAR_LICK_FIXTURE, 99, 1)).toBeNull();
  });
});

describe('measureBeatToQN', () => {
  it('beat 1 of measure 1 = 0 QN', () => {
    const track = GUITAR_LICK_FIXTURE.tracks[0];
    expect(measureBeatToQN(track, GUITAR_LICK_FIXTURE, 1, 1)).toBe(0);
  });

  it('beat 4 of measure 2 = 7 QN', () => {
    const track = GUITAR_LICK_FIXTURE.tracks[0];
    expect(measureBeatToQN(track, GUITAR_LICK_FIXTURE, 2, 4)).toBe(7);
  });
});

describe('track durations', () => {
  it('GUITAR_LICK_FIXTURE = 8 QN, 4000 ms', () => {
    const track = GUITAR_LICK_FIXTURE.tracks[0];
    expect(trackDurationQN(track, GUITAR_LICK_FIXTURE)).toBe(8);
    expect(trackDurationMs(track, GUITAR_LICK_FIXTURE)).toBe(4000);
  });

  it('CONGA_TUMBAO_FIXTURE = 8 QN, 4800 ms (2 bars × 4 beats × 600 ms at 100 BPM)', () => {
    const track = CONGA_TUMBAO_FIXTURE.tracks[0];
    expect(trackDurationQN(track, CONGA_TUMBAO_FIXTURE)).toBe(8);
    expect(trackDurationMs(track, CONGA_TUMBAO_FIXTURE)).toBe(4800);
  });

  it('SON_MONTUNO_FIXTURE: tempo change at bar 3 (96 → 110 BPM)', () => {
    const track = SON_MONTUNO_FIXTURE.tracks[0];
    // Bars 1-2 at 96 BPM: 8 QN × (60000/96) = 5000 ms
    // Bars 3-4 at 110 BPM: 8 QN × (60000/110) ≈ 4363.636 ms
    // Total ≈ 9363.636 ms
    expect(trackDurationQN(track, SON_MONTUNO_FIXTURE)).toBe(16);
    expect(trackDurationMs(track, SON_MONTUNO_FIXTURE)).toBeCloseTo(9363.636, 2);
  });
});

describe('qnToTrackMs with tempo changes', () => {
  it('SON_MONTUNO: qn=0 → 0 ms', () => {
    const track = SON_MONTUNO_FIXTURE.tracks[0];
    expect(qnToTrackMs(track, SON_MONTUNO_FIXTURE, 0)).toBe(0);
  });

  it('SON_MONTUNO: qn=8 (start of bar 3) → 5000 ms (right at the tempo change)', () => {
    const track = SON_MONTUNO_FIXTURE.tracks[0];
    expect(qnToTrackMs(track, SON_MONTUNO_FIXTURE, 8)).toBe(5000);
  });

  it('SON_MONTUNO: qn=12 (start of bar 4) → 5000 + 4 × 60000/110 ms', () => {
    const track = SON_MONTUNO_FIXTURE.tracks[0];
    const expected = 5000 + (4 * 60_000) / 110;
    expect(qnToTrackMs(track, SON_MONTUNO_FIXTURE, 12)).toBeCloseTo(expected, 6);
  });

  it('SON_MONTUNO: qn=16 (end of piece) matches trackDurationMs', () => {
    const track = SON_MONTUNO_FIXTURE.tracks[0];
    const total = trackDurationMs(track, SON_MONTUNO_FIXTURE);
    expect(qnToTrackMs(track, SON_MONTUNO_FIXTURE, 16)).toBeCloseTo(total, 6);
  });

  it('extrapolates past the end at the final tempo', () => {
    const track = SON_MONTUNO_FIXTURE.tracks[0];
    const total = trackDurationMs(track, SON_MONTUNO_FIXTURE);
    // 4 QN past end at 110 BPM = 4 × 60000/110 ≈ 2181.818 ms
    const expected = total + (4 * 60_000) / 110;
    expect(qnToTrackMs(track, SON_MONTUNO_FIXTURE, 20)).toBeCloseTo(expected, 6);
  });

  it('handles negative qn by extrapolating before zero at initialTempo', () => {
    const track = GUITAR_LICK_FIXTURE.tracks[0];
    // -1 QN at 120 BPM = -500 ms
    expect(qnToTrackMs(track, GUITAR_LICK_FIXTURE, -1)).toBe(-500);
  });
});
