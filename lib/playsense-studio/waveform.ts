// PlaySense Studio — waveform peaks math (pure, no DOM / Web Audio).
//
// Turns a mono PCM channel into a compact min/max peaks summary the sync editor
// draws behind its measure markers. Kept free of AudioContext so it runs in the
// node test environment; the browser decode that produces the Float32Array
// lives in waveform-decode.ts.
//
// Layout: peaks are quantized to int8 [-127, 127] and stored interleaved
// [min0, max0, min1, max1, ...]. Detail scales with duration, capped at 600k
// buckets to bound memory/cache size. Values are normalized by the channel's global
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
  /** Detected hits in seconds (sorted); absent in caches older than Studio rework P4a. */
  hits?: number[];
}

const QUANT = 127;

/** Hard ceiling on serialized peaks, whatever the resolution asked for. */
const MAX_BUCKETS = 600_000;

/**
 * Bucket count for a given horizontal resolution. Separated out because the
 * main waveform and the thin backing-track lanes want very different densities:
 * a 240px canvas zoomed to 600 px/s needs every bucket it can get, while a 28px
 * lane body is a smooth envelope long before that — and paying 600/s there
 * would mean ~1.2MB of cached JSON per track instead of ~120KB.
 */
export function bucketCountFor(durationSeconds: number, bucketsPerSecond: number): number {
  if (!Number.isFinite(durationSeconds) || !Number.isFinite(bucketsPerSecond)) return 1;
  return Math.max(1, Math.min(MAX_BUCKETS, Math.ceil(durationSeconds * bucketsPerSecond)));
}

/** Match the editor's maximum 600 pixels/second, with bounded cache size. */
export function waveformBucketCount(durationSeconds: number): number {
  return bucketCountFor(durationSeconds, 600);
}

/**
 * Bucket a mono channel into evenly spaced min/max peaks. Fractional sample
 * boundaries distribute rounding across the recording. Values are normalized by the global peak
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

  const data = new Array<number>(bucketCount * 2);

  for (let b = 0; b < bucketCount; b++) {
    const start = Math.floor(b * length / bucketCount);
    const end = Math.floor((b + 1) * length / bucketCount);

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
  if (p.hits !== undefined) {
    if (!Array.isArray(p.hits) || !p.hits.every((h) => typeof h === 'number' && Number.isFinite(h))) {
      throw new Error('WaveformPeaks: invalid hits');
    }
    for (let i = 1; i < p.hits.length; i++) {
      if ((p.hits[i] as number) < (p.hits[i - 1] as number)) throw new Error('WaveformPeaks: hits not sorted');
    }
  }

  return {
    version: 1,
    durationSeconds: p.durationSeconds,
    bucketCount: p.bucketCount,
    sampleRate: p.sampleRate,
    data: p.data as number[],
    ...(p.hits !== undefined ? { hits: p.hits as number[] } : {}),
  };
}
