import { describe, expect, it } from 'vitest';
import { autoAlign, onHitCount } from '../auto-align';

describe('autoAlign', () => {
  it('puts every onset on a hit', () => {
    expect(autoAlign([0, 0.5, 1, 1.5], [3.2, 3.7, 4.2, 4.7], 3.0)).toBeCloseTo(3.2, 9);
  });

  it('gives null when nothing lines up with at least 3 onsets (noise only)', () => {
    // Irregular hits: no single shift lands 3 of the evenly spaced onsets on them.
    expect(autoAlign([0, 0.5, 1, 1.5], [3.11, 3.93, 4.87, 6.4], 3.0)).toBeNull();
    expect(autoAlign([0, 0.5, 1, 1.5], [], 3.0)).toBeNull();
  });

  it('only searches hits within ±2 s of the current placement', () => {
    // The perfect match at 10.0 is far from current 3.0; nothing near it matches.
    expect(autoAlign([0, 0.5, 1, 1.5], [10, 10.5, 11, 11.5], 3.0)).toBeNull();
  });

  it('breaks a tie toward the current bar 1', () => {
    // Hits every 0.5 s: shifting by any multiple of 0.5 matches equally well
    // (4 onsets each within the window) — the one nearest current wins.
    const hits = Array.from({ length: 20 }, (_, i) => 1 + i * 0.5);
    expect(autoAlign([0, 0.5, 1, 1.5], hits, 4.1)).toBeCloseTo(4.0, 9);
  });

  it('matches one to one: two onsets never share a hit', () => {
    // Onsets 10 ms apart, one hit: only one of them can match, so no shift
    // reaches 3 matches with these 3 hits spread for the other onsets.
    expect(autoAlign([0, 0.01, 0.02], [5, 7, 9], 5)).toBeNull();
  });
});

describe('onHitCount', () => {
  it('counts onsets within 30 ms of a hit, one to one', () => {
    expect(onHitCount([0, 0.5, 1, 1.5], [3.2, 3.72, 4.25, 4.7], 3.2)).toEqual({ k: 3, n: 4 });
    expect(onHitCount([0, 0.01], [2], 2)).toEqual({ k: 1, n: 2 });
    expect(onHitCount([0, 0.5], [], 2)).toEqual({ k: 0, n: 2 });
    expect(onHitCount([], [1, 2], 0)).toEqual({ k: 0, n: 0 });
  });
});
