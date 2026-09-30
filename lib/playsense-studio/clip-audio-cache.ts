// Decoded backing-track buffers for studio playback.
//
// BROWSER ONLY. Decoded audio is always Float32Array, so a 4-minute stereo
// 48kHz track is ~46MB in RAM no matter how small the MP3 was. A handful of
// tracks is therefore hundreds of megabytes on a page that already holds a
// video, waveform peaks and the score editor — which is why this is lazy,
// deduped, serialized and capped rather than a plain Map.
//
// Separate from waveform-decode's peaks cache on purpose: peaks are decoded
// once ever at 8kHz and persisted to storage, while playback buffers are
// full-rate, per-session, and never leave memory.

const MAX_CACHED_BUFFERS = 8;

/** Promise-valued so concurrent callers dedupe, like save-queue's chain. */
const cache = new Map<string, Promise<AudioBuffer>>();
const pendingSignals = new Map<string, AbortSignal>();
/** Insertion order = LRU order; refreshed on every hit. */
const order: string[] = [];
/** Buffers with a live source must never be evicted. */
const pinned = new Set<string>();

/** One decode at a time: decodeAudioData is async but the work burns CPU. */
let queue: Promise<unknown> = Promise.resolve();

function touch(url: string) {
  const at = order.indexOf(url);
  if (at >= 0) order.splice(at, 1);
  order.push(url);
}

function evict() {
  while (order.length > MAX_CACHED_BUFFERS) {
    const victim = order.find((u) => !pinned.has(u));
    if (!victim) return; // everything is in use; let memory ride
    order.splice(order.indexOf(victim), 1);
    cache.delete(victim);
  }
}

/** Mark a URL as in use, so the LRU can't drop it mid-playback. */
export function pinClipAudio(url: string) {
  pinned.add(url);
}

export function unpinClipAudio(url: string) {
  pinned.delete(url);
}

/**
 * Fetch + decode one backing track, at the playback context's own sample rate
 * so no resampling happens per source node. Repeat calls for the same URL share
 * a single decode.
 */
export function loadClipAudio(
  ctx: BaseAudioContext,
  url: string,
  signal?: AbortSignal
): Promise<AudioBuffer> {
  if (pendingSignals.get(url)?.aborted) { cache.delete(url); pendingSignals.delete(url); }
  const existing = cache.get(url);
  if (existing) {
    touch(url);
    return existing;
  }

  const work = queue.catch(() => {}).then(async () => {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`Failed to fetch backing track (${res.status})`);
    // decodeAudioData detaches this buffer; never clone a multi-MB file.
    return ctx.decodeAudioData(await res.arrayBuffer());
  });
  // One failed/cancelled clip must not reject every subsequent queued decode.
  queue = work.then(() => {}, () => {});
  const promise = work.then(
    (buffer) => { if (cache.get(url) === promise) pendingSignals.delete(url); return buffer as AudioBuffer; },
    (err) => {
      // A failed decode must not poison the cache or the queue.
      if (cache.get(url) === promise) {
        cache.delete(url); pendingSignals.delete(url);
        const at = order.indexOf(url);
        if (at >= 0) order.splice(at, 1);
      }
      throw err;
    }
  );

  cache.set(url, promise);
  if (signal) pendingSignals.set(url, signal);
  touch(url);
  evict();
  return promise;
}

/** Test/teardown hook — the cache is module-level and otherwise process-wide. */
export function clearClipAudioCache() {
  cache.clear();
  pendingSignals.clear();
  order.length = 0;
  pinned.clear();
  queue = Promise.resolve();
}
