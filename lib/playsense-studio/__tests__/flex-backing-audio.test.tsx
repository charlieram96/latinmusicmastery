// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { FlexMap } from '../flex';
import { backingFlexPosition, useFlexBackingAudio } from '../use-flex-backing-audio';

const map = new FlexMap([{src:0,dst:0,anchor:true},{src:4,dst:2,anchor:false},{src:8,dst:8,anchor:true}]);

afterEach(() => vi.unstubAllGlobals());
it('linked MP3s follow video source time; independent MP3s follow score time', () => {
  expect(backingFlexPosition(2,2,map,true)).toEqual({seconds:2,rate:2});
  expect(backingFlexPosition(2,2,map,false)).toEqual({seconds:1,rate:1});
  expect(backingFlexPosition(6,2/3,map,false)).toEqual({seconds:5,rate:1});
});

it('stretches linked and independent audio separately, preserves pitch and pauses during video buffering', async () => {
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  const sounds: FakeAudio[] = [];
  class FakeAudio {
    seeks=0; time=0; seeking=false; get currentTime(){return this.time;} set currentTime(value:number){this.seeks++;this.time=value;} duration=30; readyState=4; paused=true; muted=false; volume=1; playbackRate=1; preservesPitch=false;
    constructor(public src:string) {sounds.push(this);}
    play=vi.fn(async()=>{this.paused=false;});
    pause=vi.fn(()=>{this.paused=true;});
    load=vi.fn(); removeAttribute=vi.fn();
  }
  vi.stubGlobal('Audio',FakeAudio);
  let tick: FrameRequestCallback = ()=>{};
  vi.stubGlobal('requestAnimationFrame',(cb:FrameRequestCallback)=>{tick=cb;return 1;});
  vi.stubGlobal('cancelAnimationFrame',vi.fn());
  const video=document.createElement('video');
  Object.defineProperty(video,'paused',{value:false,configurable:true});
  video.currentTime=2;video.playbackRate=2;
  const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
  function Harness() {
    useFlexBackingAudio({active:true,videoRef:{current:video},map,
      clips:['a','b'].map(id=>({id,url:id+'.mp3',timelineStartSeconds:0,trimInSeconds:0,trimOutSeconds:20})),
      linked:new Set(['a']),enabled:new Set(['a','b']),levels:{a:.5,b:.8},suspended:false,usable:{startSeconds:0,endSeconds:20}});
    return null;
  }
  try {
    await act(async()=>root.render(<Harness/>));
    await act(async()=>tick(0));
    expect(sounds[0].currentTime).toBe(2);expect(sounds[0].playbackRate).toBe(2);
    expect(sounds[1].currentTime).toBe(1);expect(sounds[1].playbackRate).toBe(1);
    expect(sounds.every(a=>a.preservesPitch)).toBe(true);
    video.dispatchEvent(new Event('stalled'));
    expect(sounds.every(a=>!a.paused)).toBe(true);
    const seeks=sounds[0].seeks;
    // Persistent 60ms decoder jitter must not flush all decoders each frame.
    for(let i=0;i<60;i++){
      sounds[0].time=video.currentTime-.06;
      await act(async()=>tick(i));
    }
    expect(sounds[0].seeks).toBe(seeks);
    expect(sounds[0].playbackRate).toBeGreaterThan(2);
    expect(sounds[0].playbackRate).toBeLessThanOrEqual(2.04);
    sounds[0].seeking=true;sounds[0].time=0;
    await act(async()=>tick(61));
    expect(sounds[0].seeks).toBe(seeks);
    sounds[0].seeking=false;
    video.dispatchEvent(new Event('waiting'));
    await act(async()=>tick(1));
    expect(sounds.every(a=>a.paused)).toBe(true);
    await act(async()=>video.dispatchEvent(new Event('playing')));
    expect(sounds.every(a=>!a.paused)).toBe(true);
    Object.defineProperty(video,'paused',{value:true});
    video.dispatchEvent(new Event('pause'));
    expect(sounds.every(a=>a.paused)).toBe(true);
  } finally {act(()=>root.unmount());host.remove();}
});
