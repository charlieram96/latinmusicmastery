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

/** Deterministic PRNG (mulberry32) so the noise tests are reproducible. */
function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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
  it('does not let a count-in shift already-correct markers a bar early', () => {
    const truth = laid(16, 5.0, 0.5); // 120 bpm, 16 bars starting at 5.0 s
    const real = truth.measures.flatMap((m) => m.beats.map((b) => b.videoTimeSeconds));
    const countIn = [3.0, 3.5, 4.0, 4.5]; // 4 clicks, same tempo, 2 s before the downbeat
    const hits = [...countIn, ...real];
    const res = autoPlaceBars(laid(16, 5.0, 0.5), hits, { start: 0, end: 60 })!;
    expect(res).not.toBeNull();
    expect(downbeats(res.state)[0]).toBeCloseTo(5.0, 2);
  });
  it('recovers the true downbeat from a count-in even when the markers are a bit off', () => {
    const truth = laid(16, 5.0, 0.5);
    const real = truth.measures.flatMap((m) => m.beats.map((b) => b.videoTimeSeconds));
    const countIn = [3.0, 3.5, 4.0, 4.5];
    const hits = [...countIn, ...real];
    const res = autoPlaceBars(laid(16, 5.1, 0.5), hits, { start: 0, end: 60 })!;
    expect(res).not.toBeNull();
    expect(downbeats(res.state)[0]).toBeCloseTo(5.0, 2);
    // The whole-bar-early regression this guards against lands at 3.0 (a full
    // 4-beat bar before the true downbeat) — make sure we're nowhere near it.
    expect(Math.abs(downbeats(res.state)[0] - 3.0)).toBeGreaterThan(1);
  });
  it('rejects noise that would otherwise pass a many-to-one gate', () => {
    const rnd = seededRandom(12345);
    const hits = Array.from({ length: 250 }, () => rnd() * 45).sort((x, y) => x - y);
    const state = laid(16, 5.0, 0.5); // no real playing among the hits at all
    expect(autoPlaceBars(state, hits, { start: 0, end: 60 })).toBeNull();
  });
  it('with a real recording buried in noise, either lands correctly or refuses — never garbage', () => {
    const truth = laid(16, 5.0, 0.5);
    const real = truth.measures.flatMap((m) => m.beats.map((b) => b.videoTimeSeconds));
    const rnd = seededRandom(999);
    const noise = Array.from({ length: 200 }, () => rnd() * 45);
    const hits = [...real, ...noise].sort((x, y) => x - y);
    const res = autoPlaceBars(laid(16, 5.3, 0.5), hits, { start: 0, end: 60 }); // 0.3 s off
    if (res === null) {
      expect(res).toBeNull();
    } else {
      downbeats(res.state).forEach((t, i) => {
        expect(Math.abs(t - downbeats(truth)[i])).toBeLessThanOrEqual(0.02);
      });
    }
  });
  it('with the tempo laid 20% too fast against real hits, either corrects or refuses — never garbage', () => {
    const truth = laid(8, 2.0, 0.5); // 120 bpm
    const hits = truth.measures.flatMap((m) => m.beats.map((b) => b.videoTimeSeconds));
    const res = autoPlaceBars(laid(8, 2.0, 0.4), hits, { start: 0, end: 60 }); // spb 20% smaller = 20% faster
    if (res === null) {
      expect(res).toBeNull();
    } else {
      downbeats(res.state).forEach((t, i) => {
        expect(Math.abs(t - downbeats(truth)[i])).toBeLessThanOrEqual(0.02);
      });
    }
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
