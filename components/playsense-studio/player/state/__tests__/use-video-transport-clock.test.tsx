// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { useVideoTransportClock, type VideoTransportClock } from '../use-video-transport-clock';
import {useTransportCountIn} from "../use-transport-count-in";


it('enters an enabled loop on Play from outside and resumes inside it', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const video = document.createElement('video');
  const play = vi.spyOn(video, 'play').mockResolvedValue();
  const ref = { current: video };
  let clock!: VideoTransportClock;
  function Harness() { clock = useVideoTransportClock(ref); return null; }
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    act(() => root.render(<Harness />));
    act(() => { clock.setLoopA(226); clock.setLoopB(228); clock.setLoopEnabled(true); });
    video.currentTime = 152;
    await act(async () => { await clock.toggle(); });
    expect(video.currentTime).toBe(226);
    expect(play).toHaveBeenCalledOnce();
    video.currentTime = 227;
    await act(async () => { await clock.play(); });
    expect(video.currentTime).toBe(227);
    video.currentTime = 229;
    await act(async () => { await clock.play(); });
    expect(video.currentTime).toBe(226);
    act(() => clock.clearLoop());
    video.currentTime = 100;
    await act(async () => { await clock.play(); });
    expect(video.currentTime).toBe(100);
  } finally { act(() => root.unmount()); play.mockRestore(); }
});

it('handles pause while play is pending and allows a later play', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const video = document.createElement('video');
  let rejectPlay!: (reason: unknown) => void;
  const play = vi.spyOn(video, 'play').mockImplementationOnce(() => new Promise<void>((_, reject) => { rejectPlay = reject; })).mockResolvedValue();
  const pause = vi.spyOn(video, 'pause').mockImplementation(() => {
    rejectPlay(new DOMException('The play() request was interrupted by pause().', 'AbortError'));
    video.dispatchEvent(new Event('pause'));
  });
  let clock!: VideoTransportClock;
  const ref = { current: video };
  function Harness() { clock = useVideoTransportClock(ref); return null; }
  const root = createRoot(document.createElement('div'));
  try {
    act(() => root.render(<Harness />));
    await act(async () => {
      const pending = clock.play();
      clock.pause();
      await expect(pending).resolves.toBeUndefined();
    });
    expect(clock.isPlaying).toBe(false);
    expect(play).toHaveBeenCalledTimes(1);
    await act(async () => { await clock.play(); });
    expect(play).toHaveBeenCalledTimes(2);
    const refused = new DOMException('Autoplay blocked', 'NotAllowedError');
    play.mockRejectedValueOnce(refused);
    await act(async () => { await expect(clock.play()).rejects.toBe(refused); });
  } finally {
    act(() => root.unmount());
    play.mockRestore();
    pause.mockRestore();
  }
});

it('keeps notation on the media time during buffering and follows resumed frames without a timeupdate', () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  let frame!: FrameRequestCallback;
  const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { frame = cb; return 1; });
  const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  const now = vi.spyOn(performance, 'now').mockReturnValue(0);
  const video = document.createElement('video');
  const ref = { current: video };
  let clock!: VideoTransportClock;
  function Harness() { clock = useVideoTransportClock(ref); return null; }
  const root = createRoot(document.createElement('div'));
  try {
    act(() => root.render(<Harness />));
    act(() => { video.currentTime = 44; video.dispatchEvent(new Event('play')); });
    now.mockReturnValue(3000);
    act(() => { video.dispatchEvent(new Event('waiting')); frame(3000); });
    expect(clock.currentSeconds).toBe(44);
    act(() => { video.currentTime = 44.2; frame(3200); });
    expect(clock.currentSeconds).toBe(44.2);
    act(() => { video.currentTime = 12; video.dispatchEvent(new Event('seeking')); frame(3400); });
    expect(clock.currentSeconds).toBe(12);
  } finally { act(() => root.unmount()); raf.mockRestore(); cancel.mockRestore(); now.mockRestore(); }
});

it('publishes one render per moving frame without a passive ref-update render', () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  let frame!: FrameRequestCallback;
  const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { frame = cb; return 1; });
  const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  const ref = { current: document.createElement('video') };
  let renders = 0;
  function Harness() { useVideoTransportClock(ref); renders++; return null; }
  const root = createRoot(document.createElement('div'));
  try {
    act(() => root.render(<Harness />));
    act(() => ref.current.dispatchEvent(new Event('play')));
    const baseline = renders;
    for (let i = 1; i <= 120; i++) act(() => { ref.current.currentTime = i / 60; frame(i * 1000 / 60); });
    expect(renders - baseline).toBe(120);
    act(() => ref.current.dispatchEvent(new Event('pause')));
  } finally { act(() => root.unmount()); raf.mockRestore(); cancel.mockRestore(); }
});

it('does not schedule redundant passive updates when an idle count-in is cancelled on every frame', () => {
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 let frame!:FrameRequestCallback;
 const raf=vi.spyOn(window,'requestAnimationFrame').mockImplementation(cb=>{frame=cb;return 1;});
 const cancel=vi.spyOn(window,'cancelAnimationFrame').mockImplementation(()=>{});
 const ref={current:document.createElement('video')};let renders=0;
 function Harness(){const clock=useVideoTransportClock(ref);const count=useTransportCountIn();React.useEffect(()=>count.cancel(),[clock.currentSeconds,count.cancel]);renders++;return null;}
 const root=createRoot(document.createElement('div'));
 try{act(()=>root.render(<Harness/>));act(()=>ref.current.dispatchEvent(new Event('play')));const baseline=renders;
 for(let i=1;i<=120;i++)act(()=>{ref.current.currentTime=i/60;frame(i*1000/60);});
 expect(renders-baseline).toBe(120);
 }finally{act(()=>root.unmount());raf.mockRestore();cancel.mockRestore();}
});

import {useVideoClickTrack} from '../use-video-click-track';
import {useBackingMixer} from '../use-backing-mixer';
import {BackingMixer} from '@/lib/playsense-studio/backing-mixer';
import {useScoreSynth} from '../use-score-synth';
import {useFlexPlayback} from '@/lib/playsense-studio/use-flex-playback';
import {FlexMap} from '@/lib/playsense-studio/flex';
it.each(['click','mixer','synth','flex'] as const)('does not enqueue passive updates from the %s media binding on every clock frame',kind=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 let frame!:FrameRequestCallback;
 const raf=vi.spyOn(window,'requestAnimationFrame').mockImplementation(cb=>{frame=cb;return 1;});
 const cancel=vi.spyOn(window,'cancelAnimationFrame').mockImplementation(()=>{});
 const context=vi.spyOn(BackingMixer.prototype,'ensureContext').mockReturnValue({state:'running'} as AudioContext);
 const ref={current:document.createElement('video')};let renders=0;
 function Harness(){
  useVideoTransportClock(ref);renders++;
  if(kind==='click')useVideoClickTrack({videoRef:ref,grid:[],enabled:false});
  if(kind==='mixer')useBackingMixer({videoRef:ref,clips:[],enabled:new Set(),usable:{startSeconds:0,endSeconds:60},suspended:true});
  if(kind==='flex')useFlexPlayback(ref,new FlexMap([]),1,false);
  if(kind==='synth')useScoreSynth({videoRef:ref,notes:[],enabled:false});
  return null;
 }
 const root=createRoot(document.createElement('div'));
 try{act(()=>root.render(<Harness/>));act(()=>ref.current.dispatchEvent(new Event('play')));const baseline=renders;
 for(let i=1;i<=120;i++)act(()=>{ref.current.currentTime=i/60;frame(i*1000/60);});
 expect(renders-baseline).toBe(120);
 }finally{act(()=>root.unmount());raf.mockRestore();cancel.mockRestore();context.mockRestore();}
});
