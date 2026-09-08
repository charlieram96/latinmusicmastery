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
