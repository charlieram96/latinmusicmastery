import { afterEach, expect, it, vi } from 'vitest';
import { decodeVideoPeaks } from '../waveform-decode';

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
