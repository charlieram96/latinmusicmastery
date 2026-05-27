import { describe, expect, it } from 'vitest';
import {
  computePeaks,
  serializePeaks,
  deserializePeaks,
  bucketMinMax,
} from '../waveform';

function sine(samples: number, cyclesPerBuffer: number, amplitude = 1): Float32Array {
  const out = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    out[i] = amplitude * Math.sin((2 * Math.PI * cyclesPerBuffer * i) / samples);
  }
  return out;
}

describe('computePeaks', () => {
  it('produces exactly targetBuckets buckets and 2 values per bucket', () => {
    const peaks = computePeaks(sine(16000, 200), 8000, 2, 8000);
    expect(peaks.bucketCount).toBe(8000);
    expect(peaks.data).toHaveLength(16000);
    expect(peaks.durationSeconds).toBe(2);
    expect(peaks.sampleRate).toBe(8000);
    expect(peaks.version).toBe(1);
  });

  it('keeps min <= max in every bucket', () => {
    const peaks = computePeaks(sine(16000, 200), 8000, 2, 4000);
    for (let i = 0; i < peaks.bucketCount; i++) {
      const { min, max } = bucketMinMax(peaks, i);
      expect(min).toBeLessThanOrEqual(max);
    }
  });

  it('renders silence as all zeros', () => {
    const peaks = computePeaks(new Float32Array(8000), 8000, 1, 1000);
    expect(peaks.data.every((v) => v === 0)).toBe(true);
    const { min, max } = bucketMinMax(peaks, 0);
    expect(min).toBe(0);
    expect(max).toBe(0);
  });

  it('normalizes so a full-scale signal spans about [-1, 1]', () => {
    const peaks = computePeaks(sine(16000, 400, 1), 8000, 2, 2000);
    let globalMin = Infinity;
    let globalMax = -Infinity;
    for (let i = 0; i < peaks.bucketCount; i++) {
      const { min, max } = bucketMinMax(peaks, i);
      globalMin = Math.min(globalMin, min);
      globalMax = Math.max(globalMax, max);
    }
    expect(globalMax).toBeCloseTo(1, 1);
    expect(globalMin).toBeCloseTo(-1, 1);
  });

  it('normalizes a quiet signal up to full height too', () => {
    const peaks = computePeaks(sine(16000, 400, 0.05), 8000, 2, 2000);
    let globalMax = -Infinity;
    for (let i = 0; i < peaks.bucketCount; i++) {
      globalMax = Math.max(globalMax, bucketMinMax(peaks, i).max);
    }
    expect(globalMax).toBeCloseTo(1, 1);
  });

  it('handles an empty channel without throwing', () => {
    const peaks = computePeaks(new Float32Array(0), 8000, 0, 8000);
    expect(peaks.bucketCount).toBe(0);
    expect(peaks.data).toHaveLength(0);
  });
});

describe('serialize / deserialize', () => {
  it('round-trips losslessly', () => {
    const peaks = computePeaks(sine(16000, 200), 8000, 2, 2000);
    const restored = deserializePeaks(serializePeaks(peaks));
    expect(restored).toEqual(peaks);
  });

  it('rejects an unsupported version', () => {
    const bad = JSON.stringify({ version: 99, durationSeconds: 1, bucketCount: 0, sampleRate: 8000, data: [] });
    expect(() => deserializePeaks(bad)).toThrow();
  });

  it('rejects malformed payloads', () => {
    expect(() => deserializePeaks('not json')).toThrow();
    expect(() => deserializePeaks(JSON.stringify({ version: 1 }))).toThrow();
  });
});
