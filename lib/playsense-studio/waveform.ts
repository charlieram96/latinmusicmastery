// PlaySense Studio — waveform peaks math (pure, no DOM / Web Audio).
//
// Turns a mono PCM channel into a compact min/max peaks summary the sync editor
// draws behind its measure markers. Kept free of AudioContext so it runs in the
// node test environment; the browser decode that produces the Float32Array
// lives in waveform-decode.ts.
//
// Layout: peaks are quantized to int8 [-127, 127] and stored interleaved
// [min0, max0, min1, max1, ...]. ~8000 buckets * 2 = 16000 ints ≈ 50–70 KB of
// JSON, which gzips to a few KB. Values are normalized by the channel's global
// peak so quiet recordings still render at full height.

export interface WaveformPeaks {
  version: 1;
  /** Source media duration in seconds. */
  durationSeconds: number;
  /** Number of buckets (== data.length / 2). */
  bucketCount: number;
  /** Sample rate the peaks were computed at (provenance/debug). */
  sampleRate: number;
  /** Interleaved min/max per bucket, int8 [-127, 127]. length = bucketCount * 2. */
  data: number[];
}

const QUANT = 127;

/**
 * Bucket a mono channel into min/max peaks. The first `targetBuckets - 1`
 * buckets each span `floor(channel.length / targetBuckets)` samples; the final
 * bucket absorbs the remainder. Values are normalized by the global peak
 * magnitude before quantizing.
 */
export function computePeaks(
  channel: Float32Array,
  sampleRate: number,
  durationSeconds: number,
  targetBuckets = 8000
): WaveformPeaks {
  const length = channel.length;
  if (length === 0) {
    return { version: 1, durationSeconds, bucketCount: 0, sampleRate, data: [] };
  }

  const bucketCount = Math.min(targetBuckets, length);

  // Global peak magnitude for normalization.
  let peak = 0;
  for (let i = 0; i < length; i++) {
    const a = Math.abs(channel[i]);
    if (a > peak) peak = a;
  }
  const norm = peak > 0 ? 1 / peak : 0;

  const windowSize = Math.floor(length / bucketCount);
  const data = new Array<number>(bucketCount * 2);

  for (let b = 0; b < bucketCount; b++) {
    const start = b * windowSize;
    const end = b === bucketCount - 1 ? length : start + windowSize;

    let min = Infinity;
    let max = -Infinity;
    for (let i = start; i < end; i++) {
      const v = channel[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (!Number.isFinite(min)) {
      min = 0;
      max = 0;
    }

    data[b * 2] = quantize(min * norm);
    data[b * 2 + 1] = quantize(max * norm);
  }

  return { version: 1, durationSeconds, bucketCount, sampleRate, data };
}

function quantize(value: number): number {
  // `+ 0` collapses -0 to 0 so JSON round-trips are lossless (JSON has no -0).
  const q = Math.round(value * QUANT) + 0;
  return Math.max(-QUANT, Math.min(QUANT, q));
}

/** Decode a bucket's quantized min/max back into floats in [-1, 1]. */
export function bucketMinMax(peaks: WaveformPeaks, index: number): { min: number; max: number } {
  return {
    min: peaks.data[index * 2] / QUANT,
    max: peaks.data[index * 2 + 1] / QUANT,
  };
}

export function serializePeaks(peaks: WaveformPeaks): string {
  return JSON.stringify(peaks);
}

/** Parse + validate a peaks payload. Throws on bad JSON, version, or shape. */
export function deserializePeaks(json: string): WaveformPeaks {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('WaveformPeaks: invalid JSON');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('WaveformPeaks: payload is not an object');
  }
  const p = parsed as Record<string, unknown>;
  if (p.version !== 1) {
    throw new Error(`WaveformPeaks: unsupported version ${String(p.version)}`);
  }
  if (
    typeof p.durationSeconds !== 'number' ||
    typeof p.bucketCount !== 'number' ||
    typeof p.sampleRate !== 'number' ||
    !Array.isArray(p.data)
  ) {
    throw new Error('WaveformPeaks: malformed payload');
  }
  if (p.data.length !== p.bucketCount * 2) {
    throw new Error('WaveformPeaks: data length does not match bucketCount');
  }

  return {
    version: 1,
    durationSeconds: p.durationSeconds,
    bucketCount: p.bucketCount,
    sampleRate: p.sampleRate,
    data: p.data as number[],
  };
}
