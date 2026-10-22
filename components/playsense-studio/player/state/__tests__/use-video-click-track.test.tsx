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
let contextState='running';
let resumeContext=()=>Promise.resolve();
vi.mock('@/lib/playsense-studio/click-track', () => ({
  ClickTrack: class {
    grid: readonly number[] = [];
    setGrid(grid: readonly number[]) { this.grid=grid; setGrid(grid); }
    setVolume() {}
    setOffsetSeconds() {}
    ensureContext() {
      return { state: contextState, resume: () => resumeContext() };
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

  it('preserves the beat cursor during seven 1 BPM increases to 107 BPM', () => {
    const video = playingVideo();
    act(() => root.render(<PlayingHarness video={video} />));
    act(() => root.render(<PlayingHarness video={video} />)); // the late-bound element is picked up
    expect(start).toHaveBeenCalledTimes(1);
    teardown.mockClear();
    for(let bpm=101;bpm<=107;bpm++){
      video.playbackRate=bpm/100;
      act(()=>video.dispatchEvent(new Event('ratechange')));
    }
    expect(start).toHaveBeenCalledTimes(1);
    expect(reanchor).toHaveBeenCalledTimes(7);
    expect(reanchor).toHaveBeenLastCalledWith(1.5,1.07);
    expect(teardown).not.toHaveBeenCalled();
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


it('does not resurrect the click when audio resume resolves after Pause or unmount',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 let resolve!:()=>void;
 contextState='suspended';resumeContext=()=>new Promise<void>(r=>{resolve=r});
 const root=createRoot(document.createElement('div')),video=playingVideo();
 start.mockClear();teardown.mockClear();
 try{
  act(()=>root.render(<PlayingHarness video={video}/>));
  act(()=>{video.dispatchEvent(new Event('pause'));});
  await act(async()=>{resolve();await Promise.resolve();});
  expect(start).not.toHaveBeenCalled();expect(teardown).toHaveBeenCalled();
  act(()=>video.dispatchEvent(new Event('play')));
  act(()=>root.unmount());
  await act(async()=>{resolve();await Promise.resolve();});
  expect(start).not.toHaveBeenCalled();
 }finally{contextState='running';resumeContext=()=>Promise.resolve();}
});

it('tears down on pause and ended, and schedules again only on playback',()=>{
 const root=createRoot(document.createElement('div')),video=playingVideo();
 let paused=false;Object.defineProperty(video,'paused',{get:()=>paused});
 act(()=>root.render(<PlayingHarness video={video}/>));
 expect(running).toBe(true);
 act(()=>{paused=true;video.dispatchEvent(new Event('pause'));});expect(running).toBe(false);
 act(()=>video.dispatchEvent(new Event('ratechange')));expect(running).toBe(false);
 act(()=>{paused=false;video.dispatchEvent(new Event('playing'));});expect(running).toBe(true);
 act(()=>{paused=true;video.dispatchEvent(new Event('ended'));});expect(running).toBe(false);
 act(()=>root.unmount());
});
