import { describe, expect, it } from 'vitest';
import { detectHits } from '../onset-detect';

const SR = 8000;

/** Silence (plus optional noise) with decaying 330 Hz bursts starting exactly at `onsets`. */
function render(durationS: number, onsets: number[], opts: { amp?: number[]; noise?: number; decayS?: number } = {}) {
  const out = new Float32Array(Math.round(durationS * SR));
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  if (opts.noise) for (let i = 0; i < out.length; i++) out[i] = rand() * opts.noise;
  const decay = opts.decayS ?? 0.08;
  onsets.forEach((t, k) => {
    const a = opts.amp?.[k] ?? 0.8;
    const start = Math.round(t * SR);
    for (let i = start; i < Math.min(out.length, start + Math.round(0.6 * SR)); i++) {
      const s = (i - start) / SR;
      out[i] += a * Math.exp(-s / decay) * Math.sin(2 * Math.PI * 330 * s);
    }
  });
  return out;
}

const near = (hits: number[], t: number) => hits.some((h) => Math.abs(h - t) <= 0.006);

describe('detectHits', () => {
  it('finds each onset within 6 ms and nothing else', () => {
    const onsets = [0.5, 1.0, 1.37, 2.0, 2.6];
    const hits = detectHits(render(3.2, onsets, { noise: 0.001 }), SR);
    expect(hits).toHaveLength(onsets.length);
    for (const t of onsets) expect(near(hits, t)).toBe(true);
  });
  it('finds dense sixteenths at 120 bpm (125 ms apart)', () => {
    const onsets = Array.from({ length: 16 }, (_, i) => 0.25 + i * 0.125);
    const hits = detectHits(render(2.6, onsets, { noise: 0.001, decayS: 0.03 }), SR);
    for (const t of onsets) expect(near(hits, t)).toBe(true);
    expect(hits.length).toBe(onsets.length);
  });
  it('finds quiet notes among loud ones', () => {
    const onsets = [0.4, 0.9, 1.4, 1.9];
    const hits = detectHits(render(2.5, onsets, { amp: [1, 0.12, 0.8, 0.2], noise: 0.001 }), SR);
    for (const t of onsets) expect(near(hits, t)).toBe(true);
  });
  it('returns nothing for silence or steady noise', () => {
    expect(detectHits(new Float32Array(SR * 2), SR)).toEqual([]);
    expect(detectHits(render(2, [], { noise: 0.05 }), SR).length).toBeLessThanOrEqual(1);
  });
  it('is sorted and never reports two hits closer than the minimum gap', () => {
    const hits = detectHits(render(3, [0.5, 0.52, 1.5], { noise: 0.001 }), SR);
    for (let i = 1; i < hits.length; i++) expect(hits[i] - hits[i - 1]).toBeGreaterThanOrEqual(0.04);
  });
  it('handles ten minutes quickly', () => {
    const samples = render(600, [], { noise: 0.01 });
    const start = performance.now();
    detectHits(samples, SR);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(3000);
  });
});
