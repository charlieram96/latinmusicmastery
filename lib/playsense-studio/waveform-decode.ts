import { localWaveformCache } from './waveform-local-cache';
// PlaySense Studio — browser-side waveform decoding + peaks cache.
//
// BROWSER ONLY. Imports nothing from React; uses Web Audio + fetch. Must be
// dynamically imported inside a client effect so SSR never evaluates
// `AudioContext`. The pure peaks math lives in waveform.ts (node-testable);
// this module just produces the Float32Array to feed it and handles the
// Supabase storage cache.
//
// Decode into a low-rate offline context, then mix channels in place. Avoid
// duplicating the downloaded video or retaining a native-rate AudioBuffer
// alongside a second offline render. The browser still decodes the whole file.

import {
  bucketCountFor,
  computePeaks,
  deserializePeaks,
  serializePeaks,
  waveformBucketCount,
  type WaveformPeaks,
} from '@/lib/playsense-studio/waveform';
import { detectHits } from '@/lib/playsense-studio/onset-detect';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const WAVEFORM_BUCKET = 'score-waveforms';
const TARGET_SAMPLE_RATE = 8000;

/**
 * Horizontal resolution for backing-track lane peaks. The lane body is ~28px,
 * so the main waveform's 600/s buys nothing visible and costs ~10x the cached
 * JSON per track. NOTE this is a PEAKS rate only -- playback decodes the file
 * separately at its native rate.
 */
export const LANE_BUCKETS_PER_SECOND = 60;

export interface DecodeOptions {
  targetBuckets?: number;
  /** Resolution in buckets/second; ignored when targetBuckets is given. */
  bucketsPerSecond?: number;
  targetSampleRate?: number;
  /** Called with progress 0..1 during the network download. */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
  /** Detect hits from the mixdown after decode. Default true; lane peaks pass false. */
  withHits?: boolean;
}

export interface LoadPeaksOptions extends DecodeOptions {
  /** Skip the cache read and decode afresh (the result is still cached). Re-analyze
   *  passes this when the current peaks predate hits, or it would just read them back. */
  force?: boolean;
}

/**
 * Fetch a media file's bytes, decode its audio, and return compact peaks.
 * Media-agnostic despite the name: it only ever touches the audio track, so
 * backing-track audio files go through here unchanged. Throws if the bytes
 * can't be fetched (CORS) or the audio can't be decoded (codec). The caller is
 * expected to fall back to a grid-only editor on failure.
 */
export async function decodeVideoPeaks(
  videoUrl: string,
  opts: DecodeOptions = {}
): Promise<WaveformPeaks> {
  const targetSampleRate = opts.targetSampleRate ?? TARGET_SAMPLE_RATE;

  const arrayBuffer = await fetchWithProgress(videoUrl, opts.onProgress, opts.signal);
  opts.onProgress?.(1);

  const OfflineCtx: typeof OfflineAudioContext =
    window.OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  const offline = new OfflineCtx(1, 1, targetSampleRate);
  // decodeAudioData consumes this buffer; do not clone a potentially huge video.
  const decoded = await offline.decodeAudioData(arrayBuffer);
  const mono = decoded.getChannelData(0);
  for (let channel = 1; channel < decoded.numberOfChannels; channel++) {
    const samples = decoded.getChannelData(channel);
    for (let i = 0; i < mono.length; i++) mono[i] += samples[i];
  }
  if (decoded.numberOfChannels > 1) {
    for (let i = 0; i < mono.length; i++) mono[i] /= decoded.numberOfChannels;
  }

  const targetBuckets =
    opts.targetBuckets ??
    (opts.bucketsPerSecond != null
      ? bucketCountFor(decoded.duration, opts.bucketsPerSecond)
      : waveformBucketCount(decoded.duration));

  const peaks = computePeaks(mono, targetSampleRate, decoded.duration, targetBuckets);
  // 0.1 ms is far below the detector's accuracy and keeps the cached JSON small.
  if (opts.withHits !== false) peaks.hits = detectHits(mono, targetSampleRate).map((h) => Math.round(h * 1e4) / 1e4);
  return peaks;
}

/**
 * Return cached peaks for a class item if present, otherwise decode the video,
 * upload the peaks for next time, and return them. The cache key includes a
 * short hash of the video URL so a re-uploaded video invalidates stale peaks.
 *
 * Storage failures (read or write) are non-fatal: a read miss falls through to
 * decode, and a write failure still returns the freshly-decoded peaks.
 */
export async function loadOrComputePeaks(
  classItemId: string,
  videoUrl: string,
  supabase: SupabaseClient<Database>,
  opts: LoadPeaksOptions = {}
): Promise<WaveformPeaks> {
  const path = waveformPath(classItemId, videoUrl);

  if (!opts.force) {
    const cached = await tryLoadCache(supabase, path, opts.signal);
    if (cached) return cached;
  }

  const peaks = await decodeVideoPeaks(videoUrl, opts);

  const serialized = serializePeaks(peaks);
  await localWaveformCache(path, serialized);
  try {
    const { error } = await supabase.storage
      .from(WAVEFORM_BUCKET)
      .upload(path, new Blob([serialized], { type: 'application/json' }), {
        upsert: true,
        cacheControl: '0',
        contentType: 'application/json',
      });
    if (error) console.warn('Waveform server cache unavailable; browser cache retained.', error.message);
  } catch {
    // Caching is best-effort; the peaks are still usable this session.
  }

  return peaks;
}

/**
 * Cache-ONLY lookup: return previously-cached peaks for this class item/video,
 * or null if none exist. Never decodes — cheap enough to run on page entry so a
 * once-analyzed video shows its waveform automatically without re-clicking.
 * Tries the current path first, then the legacy v2 one (peaks without hits),
 * so an old video still shows its waveform and asks for Re-analyze.
 */
export async function loadCachedPeaks(
  classItemId: string,
  videoUrl: string,
  supabase: SupabaseClient<Database>,
  signal?: AbortSignal
): Promise<WaveformPeaks | null> {
  return (
    (await tryLoadCache(supabase, waveformPath(classItemId, videoUrl), signal)) ??
    (await tryLoadCache(supabase, legacyWaveformPath(classItemId, videoUrl), signal))
  );
}

/**
 * Where peaks are written. v3 (Studio rework P4a) carries `hits`. A fresh
 * object rather than an overwrite of v2, which the CDN may hold for a year.
 */
export function waveformPath(classItemId: string, videoUrl: string): string {
  return `peaks/${classItemId}-${shortHash(videoUrl)}-hires-v3.json`;
}

/** The pre-P4a cache path: the same peaks, never any `hits`. Read-only now. */
export function legacyWaveformPath(classItemId: string, videoUrl: string): string {
  return `peaks/${classItemId}-${shortHash(videoUrl)}-hires-v2.json`;
}

/**
 * Cache path for a backing-track lane. A distinct suffix from the main
 * waveform's `-hires-v*` keeps the two resolutions from ever colliding for the
 * same owner+url pair.
 */
export function laneWaveformPath(ownerId: string, audioUrl: string): string {
  return `peaks/${ownerId}-${shortHash(audioUrl)}-lane-v1.json`;
}

/**
 * Lane equivalent of loadOrComputePeaks: low-resolution peaks for one backing
 * track, cached in the same bucket.
 *
 * The returned `durationSeconds` IS the source duration, so the first decode
 * (or any later cache hit) doubles as the duration probe that the clip model
 * needs to clamp trims -- no extra round-trip.
 */
export async function loadOrComputeLanePeaks(
  ownerId: string,
  audioUrl: string,
  supabase: SupabaseClient<Database>,
  opts: DecodeOptions = {}
): Promise<WaveformPeaks> {
  const path = laneWaveformPath(ownerId, audioUrl);

  const cached = await tryLoadCache(supabase, path, opts.signal);
  if (cached) return cached;

  const peaks = await decodeVideoPeaks(audioUrl, {
    ...opts,
    bucketsPerSecond: opts.bucketsPerSecond ?? LANE_BUCKETS_PER_SECOND,
    withHits: false,
  });

  const serialized = serializePeaks(peaks);
  await localWaveformCache(path, serialized);
  try {
    const { error } = await supabase.storage
      .from(WAVEFORM_BUCKET)
      .upload(path, new Blob([serialized], { type: 'application/json' }), {
        upsert: true,
        cacheControl: '0',
        contentType: 'application/json',
      });
    if (error) console.warn('Waveform server cache unavailable; browser cache retained.', error.message);
  } catch {
    // Caching is best-effort; the peaks are still usable this session.
  }

  return peaks;
}

/** Cache-ONLY lane lookup, for the cheap probe-everything-on-mount pass. */
export async function loadCachedLanePeaks(
  ownerId: string,
  audioUrl: string,
  supabase: SupabaseClient<Database>,
  signal?: AbortSignal
): Promise<WaveformPeaks | null> {
  return tryLoadCache(supabase, laneWaveformPath(ownerId, audioUrl), signal);
}

async function tryLoadCache(
  supabase: SupabaseClient<Database>,
  path: string,
  signal?: AbortSignal
): Promise<WaveformPeaks | null> {
  const local = await localWaveformCache(path);
  if (local) { try { return deserializePeaks(local); } catch { /* Try the server copy. */ } }
  try {
    const { data } = supabase.storage.from(WAVEFORM_BUCKET).getPublicUrl(path);
    // `no-store`, not `force-cache`: the first read for a brand-new video
    // happens BEFORE its peaks are uploaded, so it 404s. `force-cache` would pin
    // that miss and every later read would keep returning it, re-triggering a
    // full re-decode forever. Always asking the network keeps an already-cached
    // video loading from its cached peaks instead of re-analyzing.
    const res = await fetch(data.publicUrl, { signal, cache: 'no-store' });
    if (!res.ok) return null;
    const raw = await res.text();
    const peaks = deserializePeaks(raw);
    if (peaks) await localWaveformCache(path, raw);
    return peaks;
  } catch {
    return null;
  }
}

async function fetchWithProgress(
  url: string,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal
): Promise<ArrayBuffer> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Failed to fetch video audio (${res.status})`);

  const total = Number(res.headers.get('Content-Length') ?? 0);
  if (!res.body || !total || !onProgress) {
    return res.arrayBuffer();
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      onProgress(Math.min(1, received / total));
    }
  }
  const out = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  chunks.length = 0;
  return out.buffer;
}

/** Small, stable, non-cryptographic hash (FNV-1a) rendered base36. */
function shortHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
