// @vitest-environment jsdom
//
// The mixer takes the video's pitch preservation off on a rate change so the
// video and its backing tracks slow down together, in one key. With no backing
// tracks there is nothing to keep in key: the Studio's Loop speed keeps pitch.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/playsense-studio/backing-mixer', () => ({
  BackingMixer: class {
    setClips() {}
    setEnabled() {}
    setLevels() {}
    setUsableRegion() {}
    ensureContext() {
      return { state: 'running', resume: () => Promise.resolve(), decodeAudioData: () => Promise.resolve({}) };
    }
    start() {}
    teardown() {}
    drift() {
      return null;
    }
    stopClip() {}
    rescheduleClip() {}
    close() {}
  },
}));
vi.mock('@/lib/playsense-studio/clip-audio-cache', () => ({
  loadClipAudio: () => new Promise(() => {}),
}));

import { useBackingMixer, type MixerClipInput } from '../use-backing-mixer';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const USABLE = { startSeconds: 0, endSeconds: 60 };
const NO_ENABLED = new Set<string>();

describe('useBackingMixer pitch on a rate change', () => {
  let container: HTMLDivElement;
  let root: Root;
  let video: HTMLVideoElement;

  function Harness({ clips }: { clips: MixerClipInput[] }) {
    useBackingMixer({ videoRef: { current: video }, clips, enabled: NO_ENABLED, usable: USABLE });
    return null;
  }

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    root = createRoot(container);
    video = document.createElement('video');
  });

  afterEach(() => {
    act(() => root.unmount());
  });

  it('leaves pitch preservation alone with no backing tracks', () => {
    act(() => root.render(<Harness clips={[]} />));
    video.preservesPitch = true;
    act(() => { video.dispatchEvent(new Event('ratechange')); });
    expect(video.preservesPitch).toBe(true);
  });

  it('turns it off with backing tracks, so the video and backing stay in one key', () => {
    const clips: MixerClipInput[] = [{ id: 'a', url: 'a.mp3', timelineStartSeconds: 0, trimInSeconds: 0, trimOutSeconds: null }];
    act(() => root.render(<Harness clips={clips} />));
    video.preservesPitch = true;
    act(() => { video.dispatchEvent(new Event('ratechange')); });
    expect(video.preservesPitch).toBe(false);
  });
});
