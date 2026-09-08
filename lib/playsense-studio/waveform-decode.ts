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
  computePeaks,
  deserializePeaks,
  serializePeaks,
  waveformBucketCount,
  type WaveformPeaks,
} from '@/lib/playsense-studio/waveform';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const WAVEFORM_BUCKET = 'score-waveforms';
const TARGET_SAMPLE_RATE = 8000;

export interface DecodeOptions {
  targetBuckets?: number;
  targetSampleRate?: number;
  /** Called with progress 0..1 during the network download. */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/**
 * Fetch a video's bytes, decode its audio, and return compact peaks. Throws if
 * the bytes can't be fetched (CORS) or the audio can't be decoded (codec). The
 * caller is expected to fall back to a grid-only editor on failure.
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

  return computePeaks(mono, targetSampleRate, decoded.duration, opts.targetBuckets ?? waveformBucketCount(decoded.duration));
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
  opts: DecodeOptions = {}
): Promise<WaveformPeaks> {
  const path = waveformPath(classItemId, videoUrl);

  const cached = await tryLoadCache(supabase, path, opts.signal);
  if (cached) return cached;

  const peaks = await decodeVideoPeaks(videoUrl, opts);

  try {
    await supabase.storage
      .from(WAVEFORM_BUCKET)
      .upload(path, new Blob([serializePeaks(peaks)], { type: 'application/json' }), {
        upsert: true,
        cacheControl: '31536000',
        contentType: 'application/json',
      });
  } catch {
    // Caching is best-effort; the peaks are still usable this session.
  }

  return peaks;
}

/**
 * Cache-ONLY lookup: return previously-cached peaks for this class item/video,
 * or null if none exist. Never decodes — cheap enough to run on page entry so a
 * once-analyzed video shows its waveform automatically without re-clicking.
 */
export async function loadCachedPeaks(
  classItemId: string,
  videoUrl: string,
  supabase: SupabaseClient<Database>,
  signal?: AbortSignal
): Promise<WaveformPeaks | null> {
  return tryLoadCache(supabase, waveformPath(classItemId, videoUrl), signal);
}

export function waveformPath(classItemId: string, videoUrl: string): string {
  return `peaks/${classItemId}-${shortHash(videoUrl)}-hires-v2.json`;
}

async function tryLoadCache(
  supabase: SupabaseClient<Database>,
  path: string,
  signal?: AbortSignal
): Promise<WaveformPeaks | null> {
  try {
    const { data } = supabase.storage.from(WAVEFORM_BUCKET).getPublicUrl(path);
    // `no-store`, not `force-cache`: the first read for a brand-new video
    // happens BEFORE its peaks are uploaded, so it 404s. `force-cache` would pin
    // that miss and every later read would keep returning it, re-triggering a
    // full re-decode forever. Always asking the network keeps an already-cached
    // video loading from its cached peaks instead of re-analyzing.
    const res = await fetch(data.publicUrl, { signal, cache: 'no-store' });
    if (!res.ok) return null;
    return deserializePeaks(await res.text());
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
