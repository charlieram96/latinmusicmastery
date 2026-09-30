// @vitest-environment jsdom
//
// The click grid is keyed by EVERY entry (to the millisecond), not just its
// length and ends: a flex edit moves interior beats only, and the admin click
// must reschedule when it does.

import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const setGrid = vi.fn();
const start = vi.fn();
const scheduledGrid = vi.fn();
const reanchor = vi.fn();
const teardown = vi.fn();
let running = false;
vi.mock('@/lib/playsense-studio/click-track', () => ({
  ClickTrack: class {
    grid: readonly number[] = [];
    setGrid(grid: readonly number[]) { this.grid=grid; setGrid(grid); }
    setVolume() {}
    setOffsetSeconds() {}
    ensureContext() {
      return { state: 'running', resume: () => Promise.resolve() };
    }
    start(media: number, rate: number) {
      running = true;
      start(media, rate);
      scheduledGrid(this.grid);
    }
    reanchor = reanchor;
    teardown() {
      running = false;
      teardown();
    }
    get isRunning() {
      return running;
    }
    drift() {
      return null;
    }
    close() {}
  },
}));

import { clickGridKey, useVideoClickTrack } from '../use-video-click-track';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

describe('clickGridKey', () => {
  it('changes when an interior beat moves, even with the same length and ends', () => {
    expect(clickGridKey([1, 2, 3, 4])).not.toBe(clickGridKey([1, 2.1, 3, 4]));
    expect(clickGridKey([1, 2, 3, 4])).not.toBe(clickGridKey([1, 2, 3.002, 4]));
  });

  it('is stable for the same values and ignores sub-millisecond noise', () => {
    expect(clickGridKey([1, 2, 3])).toBe(clickGridKey([1, 2, 3]));
    expect(clickGridKey([1, 2.0000001, 3])).toBe(clickGridKey([1, 2, 3]));
    expect(clickGridKey([])).toBe(clickGridKey([]));
    expect(clickGridKey([])).not.toBe(clickGridKey([0]));
  });
});

function Harness({ grid }: { grid: number[] }) {
  useVideoClickTrack({ videoRef: { current: null }, grid, enabled: false });
  return null;
}

describe('useVideoClickTrack grid', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    setGrid.mockClear();
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
  });

  it('reschedules when only an interior beat moves, and not for an equal grid', () => {
    act(() => root.render(<Harness grid={[1, 2, 3, 4]} />));
    expect(setGrid).toHaveBeenCalledTimes(1);
    act(() => root.render(<Harness grid={[1, 2, 3, 4]} />));
    expect(setGrid).toHaveBeenCalledTimes(1);
    act(() => root.render(<Harness grid={[1, 2.25, 3, 4]} />));
    expect(setGrid).toHaveBeenCalledTimes(2);
    expect(setGrid).toHaveBeenLastCalledWith([1, 2.25, 3, 4]);
  });
});

function PlayingHarness({ video, smooth }: { video: HTMLVideoElement; smooth?: boolean }) {
  useVideoClickTrack({ videoRef: { current: video }, grid: [0, 1, 2], enabled: true, smoothRateChanges: smooth });
  return null;
}

// jsdom fires its own ratechange from the playbackRate setter, so the rate is
// a plain property here and each test dispatches exactly one event.
function playingVideo(): HTMLVideoElement {
  const video = document.createElement('video');
  Object.defineProperty(video, 'paused', { configurable: true, get: () => false });
  Object.defineProperty(video, 'playbackRate', { configurable: true, writable: true, value: 1 });
  Object.defineProperty(video, 'currentTime', { configurable: true, writable: true, value: 1.5 });
  return video;
}

describe('useVideoClickTrack rate changes', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    running = false;
    start.mockClear();
    reanchor.mockClear();
    teardown.mockClear();
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
  });

  it('restarts on a ratechange by default (unflexed behaviour is unchanged)', () => {
    const video = playingVideo();
    act(() => root.render(<PlayingHarness video={video} />));
    act(() => root.render(<PlayingHarness video={video} />)); // the late-bound element is picked up
    expect(start).toHaveBeenCalledTimes(1);
    teardown.mockClear();
    video.playbackRate = 0.8;
    act(() => { video.dispatchEvent(new Event('ratechange')); });
    expect(start).toHaveBeenCalledTimes(2);
    expect(start).toHaveBeenLastCalledWith(1.5, 0.8);
    expect(teardown).not.toHaveBeenCalled(); // start() itself tears down; the hook adds nothing
    expect(reanchor).not.toHaveBeenCalled();
  });

  it('re-anchors instead of restarting with smoothRateChanges while running', () => {
    const video = playingVideo();
    act(() => root.render(<PlayingHarness video={video} smooth />));
    act(() => root.render(<PlayingHarness video={video} smooth />));
    expect(start).toHaveBeenCalledTimes(1);
    video.playbackRate = 1.1;
    act(() => { video.dispatchEvent(new Event('ratechange')); });
    expect(reanchor).toHaveBeenCalledWith(1.5, 1.1);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('still starts on a ratechange with smoothRateChanges when nothing is running yet', () => {
    const video = playingVideo();
    act(() => root.render(<PlayingHarness video={video} smooth />));
    act(() => root.render(<PlayingHarness video={video} smooth />));
    running = false;
    video.playbackRate = 1.1;
    act(() => { video.dispatchEvent(new Event('ratechange')); });
    expect(reanchor).not.toHaveBeenCalled();
    expect(start).toHaveBeenCalledTimes(2);
  });
});

it('keeps the lesson metronome grid on the live engine after StrictMode remount',()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 scheduledGrid.mockClear();
 const video=playingVideo();const root=createRoot(document.createElement('div'));
 try {
  act(()=>root.render(<StrictMode><PlayingHarness video={video}/></StrictMode>));
  act(()=>video.dispatchEvent(new Event('play')));
  expect(scheduledGrid).toHaveBeenLastCalledWith([0,1,2]);
 } finally {act(()=>root.unmount());}
});
