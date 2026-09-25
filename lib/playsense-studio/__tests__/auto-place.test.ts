import { describe, expect, it } from 'vitest';
import type { MarkerState } from '@/components/playsense-studio/sync/marker-model';
import { autoPlaceBars, lerpMarkers } from '../auto-place';

/** N bars of 4 QN laid at `spb` seconds per beat from `start`, onsets on every beat. */
function laid(n: number, start: number, spb: number): MarkerState {
  return {
    measures: Array.from({ length: n }, (_, i) => ({
      measureNumber: i + 1, beatsInMeasure: 4, downbeatQN: i * 4, expanded: false, nudges: [],
      onsetQNs: [i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 3],
      beats: [0, 1, 2, 3].map((b) => ({ beatInMeasure: b + 1, musicalPositionQN: i * 4 + b, videoTimeSeconds: start + (i * 4 + b) * spb, edited: b === 2 })),
    })),
    tailQN: n * 4,
    tailVideoTimeSeconds: start + n * 4 * spb,
  } as unknown as MarkerState;
}
const downbeats = (s: MarkerState) => s.measures.map((m) => m.beats[0].videoTimeSeconds);

describe('autoPlaceBars', () => {
  it('fits a steady tempo to the hits even when the markers start far off', () => {
    const truth = laid(8, 2.0, 0.5); // 120 bpm starting at 2.0 s
    const hits = truth.measures.flatMap((m) => m.beats.map((b) => b.videoTimeSeconds));
    const start = laid(8, 2.3, 0.47); // wrong start and tempo
    const res = autoPlaceBars(start, hits, { start: 0, end: 60 })!;
    expect(res).not.toBeNull();
    downbeats(res.state).forEach((t, i) => expect(t).toBeCloseTo(downbeats(truth)[i], 2));
    expect(res.state.tailVideoTimeSeconds).toBeCloseTo(truth.tailVideoTimeSeconds, 2);
    expect(res.state.measures[0].beats[2].edited).toBe(false);
  });
  it('settles each bar onto the hit under its first note', () => {
    const truth = laid(6, 1.0, 0.5);
    const hits = truth.measures.flatMap((m) => m.beats.map((b) => b.videoTimeSeconds));
    hits[8] += 0.04; // bar 3's downbeat was played 40 ms late
    const res = autoPlaceBars(laid(6, 1.0, 0.5), hits, { start: 0, end: 60 })!;
    expect(res.state.measures[2].beats[0].videoTimeSeconds).toBeCloseTo(truth.measures[2].beats[0].videoTimeSeconds + 0.04, 3);
    expect(res.settled).toBeGreaterThanOrEqual(1);
  });
  it('gives up without moving anything when too few hits match', () => {
    expect(autoPlaceBars(laid(4, 0, 0.5), [0.1, 7.3], { start: 0, end: 60 })).toBeNull();
    expect(autoPlaceBars(laid(4, 0, 0.5), [], { start: 0, end: 60 })).toBeNull();
  });
  it('ignores hits outside the trim window and never places a bar outside it', () => {
    const truth = laid(4, 5.0, 0.5);
    const inside = truth.measures.flatMap((m) => m.beats.map((b) => b.videoTimeSeconds));
    const res = autoPlaceBars(laid(4, 5.2, 0.5), [0.5, 1.0, 1.5, ...inside], { start: 4, end: 20 })!;
    expect(downbeats(res.state)[0]).toBeCloseTo(5.0, 2);
    expect(Math.min(...downbeats(res.state))).toBeGreaterThanOrEqual(4);
    expect(res.state.tailVideoTimeSeconds).toBeLessThanOrEqual(20);
  });
  it('keeps note nudges', () => {
    const s = laid(4, 0, 0.5);
    (s.measures[1] as unknown as { nudges: unknown[] }).nudges = [{ qn: 5, deltaSeconds: 0.02 }];
    const hits = laid(4, 0, 0.5).measures.flatMap((m) => m.beats.map((b) => b.videoTimeSeconds));
    expect(autoPlaceBars(s, hits, { start: 0, end: 60 })!.state.measures[1].nudges).toEqual([{ qn: 5, deltaSeconds: 0.02 }]);
  });
  it('clamps the tail to the trim end instead of failing when it lands just past it', () => {
    const truth = laid(8, 0, 0.5); // 8 bars; natural tail sits at 16.0 s
    const hits = truth.measures.flatMap((m) => m.beats.map((b) => b.videoTimeSeconds));
    const lastHit = hits[hits.length - 1]; // 15.5
    const window = { start: 0, end: lastHit + 0.2 }; // 15.7 — short of the natural 16.0 tail
    const res = autoPlaceBars(laid(8, 0, 0.5), hits, window)!;
    expect(res).not.toBeNull();
    expect(res.state.tailVideoTimeSeconds).toBeLessThanOrEqual(window.end);
  });
});

describe('lerpMarkers', () => {
  it('interpolates every beat and the tail', () => {
    const a = laid(2, 0, 0.5);
    const b = laid(2, 1, 0.5);
    const mid = lerpMarkers(a, b, 0.5);
    expect(mid.measures[1].beats[3].videoTimeSeconds).toBeCloseTo((a.measures[1].beats[3].videoTimeSeconds + b.measures[1].beats[3].videoTimeSeconds) / 2);
    expect(mid.tailVideoTimeSeconds).toBeCloseTo((a.tailVideoTimeSeconds + b.tailVideoTimeSeconds) / 2);
    expect(lerpMarkers(a, b, 1)).toBe(b);
  });
});
