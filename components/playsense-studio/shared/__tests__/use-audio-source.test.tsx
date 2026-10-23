// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {useAudioSource,useSelectedAudio} from '../use-audio-source';
import type {AudioSourceSettings} from '@/lib/playsense-studio/audio-source';
it('routes audio exclusively and follows video seeking, pause, rate, volume and source switches',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 let audio!:HTMLAudioElement;let audioPaused=true;let paused=true;let tick:FrameRequestCallback=()=>{};
 vi.stubGlobal('requestAnimationFrame',(cb:FrameRequestCallback)=>{tick=cb;return 1;});vi.stubGlobal('cancelAnimationFrame',()=>{});
 vi.stubGlobal('Audio',class{constructor(){audio=document.createElement('audio');Object.defineProperties(audio,{readyState:{value:1},duration:{value:40},paused:{get:()=>audioPaused}});audio.play=vi.fn(async()=>{audioPaused=false;});audio.pause=vi.fn(()=>{audioPaused=true;});audio.load=vi.fn();return audio;}});
 const video=document.createElement('video');Object.defineProperties(video,{paused:{get:()=>paused},readyState:{value:1},duration:{value:40}});video.currentTime=10;video.playbackRate=1.25;
 const ref={current:video};const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 function Test({settings,muted=false}:{settings:AudioSourceSettings;muted?:boolean}){useSelectedAudio(ref,settings,{volume:.4,muted,loaded:true});return null;}
 const settings:AudioSourceSettings={selected:'imported',url:'/test.wav',offsetSeconds:2};
 try{
  await act(async()=>root.render(<Test settings={settings}/>));
  expect(video.muted).toBe(true);expect(audio.currentTime).toBe(8);expect(audio.paused).toBe(true);
  await act(async()=>{paused=false;video.dispatchEvent(new Event('play'));});
  expect(audio.paused).toBe(false);expect(audio.playbackRate).toBe(1.25);expect(audio.volume).toBe(.4);
  await act(async()=>{video.currentTime=20;video.dispatchEvent(new Event('seeked'));});expect(audio.currentTime).toBe(18);
  await act(async()=>{video.playbackRate=1.07;video.dispatchEvent(new Event('ratechange'));});expect(audio.playbackRate).toBe(1.07);
  await act(async()=>{video.dispatchEvent(new Event('waiting'));tick(0);});expect(audio.paused).toBe(true);
  await act(async()=>{video.dispatchEvent(new Event('playing'));});expect(audio.paused).toBe(false);
  await act(async()=>{video.currentTime=1;video.dispatchEvent(new Event('seeked'));});expect(audio.paused).toBe(true);expect(video.muted).toBe(false);
  await act(async()=>{video.currentTime=43;video.dispatchEvent(new Event('seeked'));});expect(audio.paused).toBe(true);expect(video.muted).toBe(false);expect(video.playbackRate).toBe(1.07);
  // Re-renders and clock ticks after the replacement ends must not toggle mute
  // or rewrite the media rate: that churn disrupted the browser media clock.
  const muteWrites=vi.spyOn(video,'muted','set');
  const rateWrites=vi.spyOn(audio,'playbackRate','set');
  for(let frame=0;frame<20;frame++){
   await act(async()=>root.render(<Test settings={settings}/>));
   act(()=>tick(frame*16));
  }
  expect(muteWrites).not.toHaveBeenCalled();expect(rateWrites).not.toHaveBeenCalled();
  expect(video.muted).toBe(false);expect(video.playbackRate).toBe(1.07);
  muteWrites.mockRestore();rateWrites.mockRestore();
  await act(async()=>root.render(<Test settings={settings} muted/>));act(()=>tick(0));expect(audio.muted).toBe(true);
  await act(async()=>root.render(<Test settings={{...settings,clips:[{id:'clip',url:'/test.wav',name:'Test',durationSeconds:40,startSeconds:2,trimStartSeconds:0,trimEndSeconds:20,muted:true}]}}/>));
  await act(async()=>{video.currentTime=10;video.dispatchEvent(new Event('seeked'));});expect(video.muted).toBe(false);expect(audio.paused).toBe(true);
  await act(async()=>root.render(<Test settings={{...settings,clips:[{id:'clip',url:'/test.wav',name:'Test',durationSeconds:40,startSeconds:2,trimStartSeconds:0,trimEndSeconds:20,muted:false}]}}/>));
  expect(video.muted).toBe(true);expect(audio.currentTime).toBe(8);
  await act(async()=>{paused=true;video.dispatchEvent(new Event('pause'));});expect(audio.paused).toBe(true);
  await act(async()=>root.render(<Test settings={{selected:'original',offsetSeconds:0}}/>));expect(audio.paused).toBe(true);expect(video.muted).toBe(false);
  await act(async()=>root.render(<Test settings={{selected:'original',offsetSeconds:0,originalMuted:true}}/>));expect(video.muted).toBe(true);
  await act(async()=>root.render(<Test settings={{...settings,originalMuted:true}}/>));
  await act(async()=>{paused=false;video.currentTime=10;video.dispatchEvent(new Event('play'));});expect(video.muted).toBe(true);expect(audio.muted).toBe(false);expect(audio.paused).toBe(false);
  await act(async()=>{video.currentTime=1;video.dispatchEvent(new Event('seeked'));});expect(video.muted).toBe(true);expect(audio.paused).toBe(true);
 }finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});

it('restores original sound after a settings failure and clears the warning on retry',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 const fetcher=vi.fn().mockResolvedValueOnce({ok:false}).mockResolvedValueOnce({ok:true,json:async()=>({selected:'original',offsetSeconds:0})});
 vi.stubGlobal('fetch',fetcher);
 const host=document.createElement('div'),root=createRoot(host),video=document.createElement('video');
 const ref={current:video};let result!:ReturnType<typeof useAudioSource>;
 function Test(){result=useAudioSource('item','watch','/video.mp4');useSelectedAudio(ref,result.settings,{volume:1,muted:false,loaded:result.loaded});return null;}
 try{
  await act(async()=>root.render(<Test/>));
  expect(result.loaded).toBe(true);expect(result.error).toBeTruthy();expect(video.muted).toBe(false);
  await act(async()=>window.dispatchEvent(new CustomEvent('lmm-audio-source-change',{detail:new URLSearchParams({item:'item',part:'watch',video:'/video.mp4'}).toString()})));
  expect(result.error).toBe('');expect(video.muted).toBe(false);
 }finally{await act(async()=>root.unmount());vi.unstubAllGlobals();}
});
