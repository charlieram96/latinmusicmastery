import { describe, expect, it } from 'vitest';
import type { MarkerState } from '@/components/playsense-studio/sync/marker-model';
import { autoPlaceBars, lerpMarkers, windowWithinCorridor } from '../auto-place';

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
    // The last bar keeps the fitted spacing: no squeeze toward the clamped tail.
    const lastBar = res.state.measures[7].beats.map((b) => b.videoTimeSeconds);
    lastBar.forEach((t, j) => expect(t).toBeCloseTo(14.0 + 0.5 * j, 3));
    lastBar.forEach((t) => expect(t).toBeLessThan(res.state.tailVideoTimeSeconds));
  });
  it('clips last-bar beats that would fall past a clamped tail instead of squeezing the bar', () => {
    const truth = laid(8, 0, 0.5);
    const hits = truth.measures.flatMap((m) => m.beats.map((b) => b.videoTimeSeconds));
    const res = autoPlaceBars(laid(8, 0, 0.5), hits, { start: 0, end: 15.2 })!; // cuts into beat 4 of bar 8
    expect(res).not.toBeNull();
    expect(res.state.tailVideoTimeSeconds).toBeCloseTo(15.2, 6);
    const lastBar = res.state.measures[7].beats.map((b) => b.videoTimeSeconds);
    expect(lastBar[0]).toBeCloseTo(14.0, 3);
    expect(lastBar[1]).toBeCloseTo(14.5, 3);
    expect(lastBar[2]).toBeCloseTo(15.0, 3);
    expect(lastBar[3]).toBeLessThan(15.2);
    expect(lastBar[3]).toBeGreaterThan(15.1);
    for (let j = 1; j < 4; j++) expect(lastBar[j]).toBeGreaterThan(lastBar[j - 1]);
  });
  it('refuses when the last downbeat sits right at the trim end', () => {
    const truth = laid(8, 0, 0.5);
    const hits = truth.measures.flatMap((m) => m.beats.map((b) => b.videoTimeSeconds)).filter((h) => h <= 14.03);
    expect(autoPlaceBars(laid(8, 0, 0.5), hits, { start: 0, end: 14.03 })).toBeNull();
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

/** Playing at 120 bpm on the 5.0 s grid: beats `from`..`to` (beat 0 = 5.0 s,
 *  the section's first note), each jittered by up to ±6 ms, minus `missed`. */
function grid(rnd: () => number, from: number, to: number, missed: number[] = []): number[] {
  const out: number[] = [];
  for (let k = from; k <= to; k++) {
    const t = 5.0 + 0.5 * k + (rnd() * 2 - 1) * 0.006;
    if (!missed.includes(k)) out.push(t);
  }
  return out;
}
const scatter = (rnd: () => number, n: number) => Array.from({ length: n }, () => rnd() * 45);

/** The recording around a 16-bar section (64 beats from 5.0 s). `clean`
 *  scenarios have no noise and at most one miss, so they must be placed. */
const SCENARIOS: Array<{ name: string; clean: boolean; hits: (rnd: () => number) => number[] }> = [
  { name: 'clean', clean: true, hits: (r) => grid(r, 0, 63) },
  ...[0, 1, 5, 33, 60, 62, 63].map((k) => ({ name: `missed ${k}`, clean: true, hits: (r: () => number) => grid(r, 0, 63, [k]) })),
  { name: 'count-in', clean: true, hits: (r) => grid(r, -4, 63) },
  ...[0, 61, 63].map((k) => ({ name: `count-in, missed ${k}`, clean: true, hits: (r: () => number) => grid(r, -4, 63, [k]) })),
  { name: 'continuous playing', clean: true, hits: (r) => grid(r, -10, 73) },
  ...[0, 63].map((k) => ({ name: `continuous, missed ${k}`, clean: true, hits: (r: () => number) => grid(r, -10, 73, [k]) })),
  { name: '200 noise hits', clean: false, hits: (r) => [...grid(r, 0, 63), ...scatter(r, 200)] },
  { name: 'noise, missed 63', clean: false, hits: (r) => [...grid(r, 0, 63, [63]), ...scatter(r, 200)] },
  { name: 'dense 4/s', clean: false, hits: (r) => [...grid(r, 0, 63), ...scatter(r, 180)] },
  { name: 'dense 8/s', clean: false, hits: (r) => [...grid(r, 0, 63), ...scatter(r, 360)] },
  { name: 'dense 8/s, continuous', clean: false, hits: (r) => [...grid(r, -10, 73), ...scatter(r, 360)] },
  { name: 'dense 8/s, count-in, missed 63', clean: false, hits: (r) => [...grid(r, -4, 63, [63]), ...scatter(r, 360)] },
];
const SEEDS = [11, 23, 37, 41, 59];

describe('autoPlaceBars: a local refinement', () => {
  it('lands markers within 0.4 beat (and 2% tempo) of the truth on the truth, or refuses — never a beat off', () => {
    let placed = 0;
    let runs = 0;
    for (const sc of SCENARIOS) {
      for (const seed of SEEDS) {
        for (const beats of [-0.4, -0.2, 0, 0.2, 0.4]) {
          for (const err of [-0.02, 0, 0.02]) {
            const hits = sc.hits(seededRandom(seed));
            const res = autoPlaceBars(laid(16, 5.0 + 0.5 * beats, 0.5 * (1 + err)), hits, { start: 0, end: 60 });
            const label = `${sc.name}, seed ${seed}, ${beats} beat, spb ${err * 100}%`;
            runs++;
            if (sc.clean) expect(res, label).not.toBeNull();
            if (res === null) continue;
            placed++;
            const downs = downbeats(res.state);
            expect(Math.abs(downs[0] - 5.0), label).toBeLessThanOrEqual(0.02);
            downs.forEach((t, i) => expect(Math.abs(t - (5.0 + 2 * i)), `${label}, bar ${i + 1}`).toBeLessThan(0.1));
          }
        }
      }
    }
    // Refusing is allowed for the noisy scenarios, but not as the norm.
    expect(placed / runs).toBeGreaterThan(0.8);
  });
  it('keeps correct markers on the beat when the first note is played late', () => {
    for (const seed of SEEDS) {
      for (const late of [0.04, 0.06]) {
        const hits = grid(seededRandom(seed), 0, 63);
        hits[0] += late;
        for (const err of [-0.02, 0, 0.02]) {
          const res = autoPlaceBars(laid(16, 5.0, 0.5 * (1 + err)), hits, { start: 0, end: 60 });
          const label = `seed ${seed}, first note ${late * 1000} ms late, spb ${err * 100}%`;
          expect(res, label).not.toBeNull();
          expect(Math.abs(downbeats(res!.state)[0] - hits[0]), label).toBeLessThanOrEqual(0.02);
          expect(Math.abs(downbeats(res!.state)[1] - 7.0), label).toBeLessThanOrEqual(0.02);
        }
      }
    }
  });
  it('never moves markers 0.6-1 beat off by a whole beat: the nearest beat, or null', () => {
    for (const sc of SCENARIOS.filter((x) => ['clean', 'continuous playing', '200 noise hits', 'dense 8/s, continuous'].includes(x.name))) {
      for (const seed of SEEDS) {
        for (const beats of [-1, -0.8, -0.6, 0.6, 0.8, 1]) {
          for (const err of [-0.02, 0, 0.02]) {
            const hits = sc.hits(seededRandom(seed));
            const from = 5.0 + 0.5 * beats;
            const res = autoPlaceBars(laid(16, from, 0.5 * (1 + err)), hits, { start: 0, end: 60 });
            if (res === null) continue;
            const first = downbeats(res.state)[0];
            const label = `${sc.name}, seed ${seed}, ${beats} beat, spb ${err * 100}%`;
            // Which beat, not how precisely: with markers a whole beat early the
            // first bar has no played note, so it may settle onto a noise hit
            // up to 90 ms away.
            expect(Math.abs(first - (5.0 + 0.5 * Math.round(beats))), label).toBeLessThanOrEqual(0.1);
            expect(Math.abs(first - from), label).toBeLessThan(0.5);
          }
        }
      }
    }
  });
  it('refuses pure noise', () => {
    for (const count of [150, 250, 300]) {
      for (let seed = 1; seed <= 20; seed++) {
        const rnd = seededRandom(seed * 104729);
        const hits = scatter(rnd, count);
        for (const start of [5.0, 5.2]) {
          expect(autoPlaceBars(laid(16, start, 0.5), hits, { start: 0, end: 60 }), `count ${count} seed ${seed}`).toBeNull();
        }
      }
    }
  });
  it('places a 10-minute section against dense hits in well under 50 ms', () => {
    const rnd = seededRandom(7);
    const bars = 300; // 10 minutes at 120 bpm
    const hits: number[] = [];
    for (let k = 0; k < bars * 4; k++) {
      const t = 5.0 + 0.5 * k;
      hits.push(t + (rnd() * 2 - 1) * 0.006);
      hits.push(t + rnd() * 0.5, t + rnd() * 0.5, t + rnd() * 0.5); // ghost notes and noise: 8 hits a second
    }
    hits.sort((x, y) => x - y);
    const state = laid(bars, 5.2, 0.49);
    autoPlaceBars(state, hits, { start: 0, end: 700 }); // warm up the JIT
    // Best of 5, so a busy machine (the whole suite runs in parallel) doesn't
    // fail a per-call budget.
    let ms = Infinity;
    let res: ReturnType<typeof autoPlaceBars> = null;
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      res = autoPlaceBars(state, hits, { start: 0, end: 700 });
      ms = Math.min(ms, performance.now() - t0);
    }
    expect(res).not.toBeNull();
    expect(Math.abs(downbeats(res!.state)[0] - 5.0)).toBeLessThanOrEqual(0.02);
    expect(ms).toBeLessThan(50);
  });
});

describe('windowWithinCorridor', () => {
  const span = { startSeconds: 10, endSeconds: 20 };
  it('leaves the window alone with no siblings', () => {
    expect(windowWithinCorridor({ start: 0, end: 60 }, span, [])).toEqual({ start: 0, end: 60 });
  });
  it('narrows the end to a sibling that starts after the span', () => {
    const siblings = [{ startSeconds: 25, endSeconds: 30 }];
    expect(windowWithinCorridor({ start: 0, end: 60 }, span, siblings)).toEqual({ start: 0, end: 25 });
  });
  it('narrows the start to a sibling that ends before the span', () => {
    const siblings = [{ startSeconds: 2, endSeconds: 5 }];
    expect(windowWithinCorridor({ start: 0, end: 60 }, span, siblings)).toEqual({ start: 5, end: 60 });
  });
  it('narrows both sides with siblings on either side', () => {
    const siblings = [
      { startSeconds: 2, endSeconds: 5 },
      { startSeconds: 25, endSeconds: 30 },
    ];
    expect(windowWithinCorridor({ start: 0, end: 60 }, span, siblings)).toEqual({ start: 5, end: 25 });
  });
  it('ignores a sibling that already overlaps the span (legacy data)', () => {
    const siblings = [{ startSeconds: 15, endSeconds: 22 }];
    expect(windowWithinCorridor({ start: 0, end: 60 }, span, siblings)).toEqual({ start: 0, end: 60 });
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
