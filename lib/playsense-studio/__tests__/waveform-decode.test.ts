import { afterEach, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import {
  decodeVideoPeaks,
  legacyWaveformPath,
  loadCachedPeaks,
  loadOrComputePeaks,
  waveformPath,
} from '../waveform-decode';
import { serializePeaks, type WaveformPeaks } from '../waveform';

vi.mock('../waveform-local-cache', () => ({localWaveformCache: vi.fn(async()=>null)}));
afterEach(() => vi.unstubAllGlobals());

it('passes video bytes directly to low-rate decoding and mixes stereo channels', async () => {
  const bytes = new ArrayBuffer(16);
  const channels = [new Float32Array([1, 0, -1, 0]), new Float32Array([-1, 1, 1, -1])];
  const decode = vi.fn(async (input: ArrayBuffer) => {
    expect(input).toBe(bytes);
    return {
      duration: 1,
      numberOfChannels: 2,
      getChannelData: (i: number) => channels[i],
    };
  });
  class OfflineContext {
    constructor(channelCount: number, length: number, sampleRate: number) {
      expect([channelCount, length, sampleRate]).toEqual([1, 1, 8000]);
    }
    decodeAudioData = decode;
  }
  vi.stubGlobal('window', { OfflineAudioContext: OfflineContext });
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    headers: new Headers(),
    arrayBuffer: async () => bytes,
  })));
  const peaks = await decodeVideoPeaks('https://example.test/video.mp4', { targetBuckets: 4 });
  expect(decode).toHaveBeenCalledTimes(1);
  expect(peaks.data).toEqual([0, 0, 127, 127, 0, 0, -127, -127]);
});

const SR = 8000;

/** Silence with decaying 330 Hz bursts starting exactly at `onsets`, matching onset-detect.test.ts's `render`. */
function burstChannel(durationS: number, onsets: number[]): Float32Array {
  const out = new Float32Array(Math.round(durationS * SR));
  const decay = 0.08;
  const amp = 0.8;
  for (const t of onsets) {
    const start = Math.round(t * SR);
    for (let i = start; i < Math.min(out.length, start + Math.round(0.6 * SR)); i++) {
      const s = (i - start) / SR;
      out[i] += amp * Math.exp(-s / decay) * Math.sin(2 * Math.PI * 330 * s);
    }
  }
  return out;
}

it('computes hits during decode unless asked not to', async () => {
  const bytes = new ArrayBuffer(16);
  const channel = burstChannel(2, [0.5, 1.0]);
  const decode = vi.fn(async () => ({
    duration: 2,
    numberOfChannels: 1,
    getChannelData: () => channel,
  }));
  class OfflineContext {
    constructor(channelCount: number, length: number, sampleRate: number) {
      expect([channelCount, length, sampleRate]).toEqual([1, 1, SR]);
    }
    decodeAudioData = decode;
  }
  vi.stubGlobal('window', { OfflineAudioContext: OfflineContext });
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    headers: new Headers(),
    arrayBuffer: async () => bytes,
  })));

  const peaks = await decodeVideoPeaks('https://x/v.mp4');
  expect(peaks.hits?.length).toBe(2);
  expect(Math.abs(peaks.hits![0] - 0.5)).toBeLessThan(0.006);

  const lane = await decodeVideoPeaks('https://x/v.mp4', { withHits: false });
  expect(lane.hits).toBeUndefined();
});

it('rounds hits to 0.1 ms', async () => {
  const channel = burstChannel(2, [0.51237, 1.00481]);
  class OfflineContext {
    decodeAudioData = async () => ({ duration: 2, numberOfChannels: 1, getChannelData: () => channel });
  }
  vi.stubGlobal('window', { OfflineAudioContext: OfflineContext });
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, headers: new Headers(), arrayBuffer: async () => new ArrayBuffer(8) })));
  const peaks = await decodeVideoPeaks('https://x/v.mp4');
  expect(peaks.hits!.length).toBe(2);
  for (const h of peaks.hits!) expect(Math.round(h * 1e4) / 1e4).toBe(h);
});

// --- The peaks cache (storage mocked; nothing real is touched) ---

const CDN = 'https://cdn.test/';
const OLD: WaveformPeaks = { version: 1, durationSeconds: 2, bucketCount: 1, sampleRate: SR, data: [0, 0] };
const NEW: WaveformPeaks = { ...OLD, hits: [0.5] };

/** A storage mock whose public URL is CDN + path, plus a fetch serving `objects`
 *  (by path) and a decodable video at every other URL. */
function storage(objects: Record<string, WaveformPeaks>) {
  const upload = vi.fn(async () => ({ data: null, error: null }));
  const supabase = {
    storage: {
      from: () => ({
        getPublicUrl: (path: string) => ({ data: { publicUrl: CDN + path } }),
        upload,
      }),
    },
  } as unknown as SupabaseClient<Database>;
  const channel = burstChannel(2, [0.5, 1.0]);
  class OfflineContext {
    decodeAudioData = async () => ({ duration: 2, numberOfChannels: 1, getChannelData: () => channel });
  }
  vi.stubGlobal('window', { OfflineAudioContext: OfflineContext });
  const fetchMock = vi.fn(async (url: string) => {
    if (url.startsWith(CDN)) {
      const hit = objects[url.slice(CDN.length)];
      return hit
        ? { ok: true, text: async () => serializePeaks(hit) }
        : { ok: false, status: 404, text: async () => '' };
    }
    return { ok: true, headers: new Headers(), arrayBuffer: async () => new ArrayBuffer(8) };
  });
  vi.stubGlobal('fetch', fetchMock);
  const videoFetches = () => fetchMock.mock.calls.filter(([u]) => !String(u).startsWith(CDN)).length;
  return { supabase, upload, videoFetches };
}

it('writes peaks to a fresh v3 path and keeps the v2 path for reading old caches', () => {
  expect(waveformPath('ci', 'https://x/v.mp4')).toMatch(/^peaks\/ci-[0-9a-z]+-hires-v3\.json$/);
  expect(legacyWaveformPath('ci', 'https://x/v.mp4')).toMatch(/^peaks\/ci-[0-9a-z]+-hires-v2\.json$/);
  expect(legacyWaveformPath('ci', 'https://x/v.mp4').replace('-v2', '-v3')).toBe(waveformPath('ci', 'https://x/v.mp4'));
});

it('loadCachedPeaks tries v3 first, then falls back to v2 (no hits), then null', async () => {
  const url = 'https://x/v.mp4';
  const both = storage({ [waveformPath('ci', url)]: NEW, [legacyWaveformPath('ci', url)]: OLD });
  expect(await loadCachedPeaks('ci', url, both.supabase)).toEqual(NEW);

  const legacyOnly = storage({ [legacyWaveformPath('ci', url)]: OLD });
  const old = await loadCachedPeaks('ci', url, legacyOnly.supabase);
  expect(old).toEqual(OLD);
  expect(old!.hits).toBeUndefined();

  const none = storage({});
  expect(await loadCachedPeaks('ci', url, none.supabase)).toBeNull();
  expect(none.videoFetches()).toBe(0); // cache-only: never downloads the video
});

it('loadOrComputePeaks reads the v3 cache unless forced; forced, it decodes and writes v3', async () => {
  const url = 'https://x/v.mp4';
  const cached = storage({ [waveformPath('ci', url)]: OLD });
  expect(await loadOrComputePeaks('ci', url, cached.supabase)).toEqual(OLD);
  expect(cached.videoFetches()).toBe(0);

  const forced = storage({ [waveformPath('ci', url)]: OLD });
  const peaks = await loadOrComputePeaks('ci', url, forced.supabase, { force: true });
  expect(forced.videoFetches()).toBe(1);
  expect(peaks.hits?.length).toBe(2);
  expect(forced.upload).toHaveBeenCalledTimes(1);
  expect((forced.upload.mock.calls[0] as unknown[])[0]).toBe(waveformPath('ci', url));
});

it('loadOrComputePeaks does not read the legacy v2 cache (it has no hits), so a miss decodes', async () => {
  const url = 'https://x/v.mp4';
  const legacyOnly = storage({ [legacyWaveformPath('ci', url)]: OLD });
  const peaks = await loadOrComputePeaks('ci', url, legacyOnly.supabase);
  expect(peaks.hits?.length).toBe(2);
  expect(legacyOnly.videoFetches()).toBe(1);
});


it('retains a browser copy when server storage rejects the upload and restores it without decoding',async()=>{
 const {localWaveformCache}=await import('../waveform-local-cache');
 const records=new Map<string,string>();
 vi.mocked(localWaveformCache).mockImplementation(async(path,value)=>{if(value!==undefined)records.set(path,value);return records.get(path)??null;});
 const warning=vi.spyOn(console,'warn').mockImplementation(()=>{});
 try {
  const server=storage({});server.upload.mockResolvedValue({data:null,error:{message:'Storage unavailable'}} as never);
  const first=await loadOrComputePeaks('persistent-owner','https://x/new.mp4',server.supabase);
  expect(records.size).toBe(1);expect(warning).toHaveBeenCalled();
  const restored=await loadCachedPeaks('persistent-owner','https://x/new.mp4',server.supabase);
  expect(restored).toEqual(first);expect(server.videoFetches()).toBe(1);
 } finally {vi.mocked(localWaveformCache).mockImplementation(async()=>null);warning.mockRestore();}
});
