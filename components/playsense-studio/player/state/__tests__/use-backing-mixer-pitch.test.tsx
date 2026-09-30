// @vitest-environment jsdom
//
// The mixer takes the video's pitch preservation off on a rate change so the
// video and its backing tracks slow down together, in one key. With no backing
// tracks there is nothing to keep in key: the Studio's Loop speed keeps pitch.

import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const audio = vi.hoisted(()=>({state:'running',resume:vi.fn(()=>Promise.resolve()),start:vi.fn(), instances:[] as Array<{closed:boolean;clips:unknown[]}>}));
vi.mock('@/lib/playsense-studio/backing-mixer', () => ({
  BackingMixer: class {
    closed=false; isRunning=false; clips:unknown[]=[];
    constructor(){audio.instances.push(this);}
    setClips(clips:unknown[]) {this.clips=clips;}
    setEnabled() {}
    setLevels() {}
    setUsableRegion() {}
    ensureContext() {
      if(this.closed) throw new Error("Closed mixer used");
      return { state: audio.state, resume: audio.resume, decodeAudioData: () => Promise.resolve({}) };
    }
    start(...args: unknown[]) { this.isRunning=true; audio.start(...args); }
    teardown() {this.isRunning=false;}
    drift() {
      return null;
    }
    stopClip() {}
    rescheduleClip() {}
    close() {this.closed=true;}
  },
}));
vi.mock('@/lib/playsense-studio/clip-audio-cache', () => ({
  loadClipAudio: async () => ({duration:30}),
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
    const mixer=useBackingMixer({ videoRef: { current: video }, clips, enabled: NO_ENABLED, usable: USABLE });
    return <button onClick={mixer.unlock}>Unmute</button>;
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

  it('does not interrupt playback on download stalls or duplicate playing events',async()=>{
    audio.instances.length=0;audio.state='running';audio.start.mockClear();
    await act(async()=>root.render(<Harness clips={[]}/>));
    Object.defineProperty(video,'paused',{value:false,configurable:true});
    act(()=>video.dispatchEvent(new Event('play')));
    expect(audio.start).toHaveBeenCalledTimes(1);
    act(()=>{video.dispatchEvent(new Event('playing'));video.dispatchEvent(new Event('stalled'));video.dispatchEvent(new Event('playing'));});
    expect(audio.start).toHaveBeenCalledTimes(1);
    act(()=>{video.dispatchEvent(new Event('waiting'));video.dispatchEvent(new Event('playing'));});
    expect(audio.start).toHaveBeenCalledTimes(2);
  });

  it('loads clips into the live mixer after StrictMode restarts effects',async()=>{
    audio.instances.length=0;audio.state='running';audio.start.mockClear();
    const clips: MixerClipInput[]=[{id:'a',url:'a.mp3',timelineStartSeconds:0,trimInSeconds:0,trimOutSeconds:null}];
    await act(async()=>root.render(<StrictMode><Harness clips={clips}/></StrictMode>));
    expect(audio.instances).toHaveLength(2);
    expect(audio.instances[0].closed).toBe(true);
    expect(audio.instances[1].closed).toBe(false);
    expect(audio.instances[1].clips).toHaveLength(1);
    Object.defineProperty(video,'paused',{value:false});video.currentTime=4;
    act(()=>video.dispatchEvent(new Event('play')));
    expect(audio.start).toHaveBeenCalledWith(4,1);
  });
  it('unlocks suspended audio on unmute and resumes at the video clock',async()=>{
    audio.state='suspended';audio.resume.mockClear();audio.start.mockClear();
    Object.defineProperty(video,'paused',{value:false});video.currentTime=12;
    act(()=>root.render(<Harness clips={[]}/>));
    await act(async()=>container.querySelector('button')!.click());
    expect(audio.resume).toHaveBeenCalled();expect(audio.start).toHaveBeenCalledWith(12,1);
    audio.state='running';
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
