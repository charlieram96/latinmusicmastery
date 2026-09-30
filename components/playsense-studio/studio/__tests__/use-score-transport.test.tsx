// @vitest-environment jsdom
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {useScoreTransport} from '../use-score-transport';
import type {ScoreDocument} from '../../shared/score-model/types';
const audio=vi.hoisted(()=>({now:0,start:vi.fn(),teardown:vi.fn(),volume:vi.fn(),grid:vi.fn()}));
vi.mock('@/lib/playsense-studio/click-track',()=>({readStoredClickVolume:()=>.2,writeStoredClickVolume:vi.fn(),ClickTrack:class {context={get currentTime(){return audio.now/1000;},state:'running'};ensureContext(){return this.context;}setGrid=audio.grid;setVolume=audio.volume;start=audio.start;teardown=audio.teardown;close=vi.fn();}}));
it('plays by tempo, pauses, seeks, resumes and stops without editing the score', () => {
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 let frame:FrameRequestCallback=()=>{};
 audio.now=0;
 vi.spyOn(performance,'now').mockImplementation(()=>999999);
 vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>{frame=fn;return 1;});
 vi.stubGlobal('cancelAnimationFrame',()=>{});
 const score={initialTempo:120,initialTimeSignature:[4,4],tracks:[{measures:[{number:1},{number:2,tempoChange:60,timeSignature:[3,4]}]}]} as ScoreDocument;
 const before=JSON.stringify(score);
 let api:ReturnType<typeof useScoreTransport>;
 function Harness(){api=useScoreTransport(score,0);return null;}
 const el=document.createElement('div'),root=createRoot(el);
 try {
  act(()=>root.render(<Harness/>));
  expect(api!.duration).toBe(5000);
  act(()=>{void api!.play();});
  expect(audio.grid).toHaveBeenCalledWith([0,.5,1,1.5,2,3,4]);
  act(()=>api!.setMetronome(false));expect(audio.volume).toHaveBeenLastCalledWith(0);
  act(()=>api!.setMetronome(true));expect(audio.volume).toHaveBeenLastCalledWith(.2);
  act(()=>{void api!.play();});audio.now=1000;act(()=>frame(audio.now));expect(api!.currentMs).toBe(1000);
  act(()=>api!.pause());expect(api!.playing).toBe(false);
  audio.now=6000;act(()=>{void api!.play();});audio.now=6500;act(()=>frame(audio.now));expect(api!.currentMs).toBe(1500);
  act(()=>api!.seekBar(1));expect(api!.currentMs).toBe(2000);expect(api!.index).toBe(1);
  audio.now=9500;act(()=>frame(audio.now));expect(api!.playing).toBe(false);expect(api!.currentMs).toBe(5000);
  act(()=>api!.stop());expect(api!.currentMs).toBe(0);
  act(()=>api!.changeRate(1.5));
  act(()=>{void api!.play();});
  expect(audio.start).toHaveBeenLastCalledWith(0,1.5,true);
  audio.now=10000;act(()=>frame(audio.now));expect(api!.currentMs).toBe(750);
  act(()=>api!.changeRate(.5));expect(api!.currentMs).toBe(750);
  audio.now=11000;act(()=>frame(audio.now));expect(api!.currentMs).toBe(1250);
  act(()=>api!.changeRate(1));expect(api!.rate).toBe(1);expect(api!.currentMs).toBe(1250);
  expect(JSON.stringify(score)).toBe(before);
 } finally {act(()=>root.unmount());vi.restoreAllMocks();vi.unstubAllGlobals();}
});

it('seeks to the selected note using its voice, rests and local tempo, then plays there',()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});audio.now=0;audio.start.mockClear();
 vi.stubGlobal('requestAnimationFrame',()=>1);vi.stubGlobal('cancelAnimationFrame',()=>{});
 const score={initialTempo:120,initialTimeSignature:[4,4],tracks:[{measures:[
  {number:1,voices:[{events:[]}]},
  {number:2,tempoChange:60,timeSignature:[7,8],voices:[{events:[]},{events:[{kind:'rest',durationQN:1.5},{kind:'note',durationQN:0.5,midi:60}]}]},
 ]}]} as unknown as ScoreDocument;
 let api:ReturnType<typeof useScoreTransport>;
 function Harness(){api=useScoreTransport(score,0);return null;}
 const host=document.createElement('div'),root=createRoot(host);
 try{
  act(()=>root.render(<Harness/>));
  act(()=>api!.seekEvent(1,1,1));
  expect(api!.currentMs).toBe(3500);expect(api!.index).toBe(1);expect(api!.beat).toBe(4);
  act(()=>api!.play());expect(audio.start).toHaveBeenLastCalledWith(3.5,1,true);
  act(()=>api!.pause());act(()=>api!.seekEvent(1));expect(api!.currentMs).toBe(2000);
 }finally{act(()=>root.unmount());vi.unstubAllGlobals();}
});

it('starts the score clock at the scheduled first click, including after a playing seek',()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});audio.now=0;
 audio.start.mockImplementation(()=>audio.now/1000+.04);
 let frame:FrameRequestCallback=()=>{};
 vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>{frame=fn;return 1;});
 vi.stubGlobal('cancelAnimationFrame',()=>{});
 const score={initialTempo:120,initialTimeSignature:[4,4],tracks:[{measures:[{number:1}]}]} as ScoreDocument;
 let api:ReturnType<typeof useScoreTransport>;
 function Harness(){api=useScoreTransport(score,0);return null;}
 const host=document.createElement('div'),root=createRoot(host);
 try{
  act(()=>root.render(<Harness/>));act(()=>api!.play());
  audio.now=20;act(()=>frame(audio.now));expect(api!.currentMs).toBe(0);
  audio.now=40;act(()=>frame(audio.now));expect(api!.currentMs).toBe(0);
  audio.now=540;act(()=>frame(audio.now));expect(api!.currentMs).toBe(500);
  act(()=>api!.seek(0));expect(audio.start).toHaveBeenLastCalledWith(0,1,true);
  audio.now=580;act(()=>frame(audio.now));expect(api!.currentMs).toBeCloseTo(0);
  audio.now=1080;act(()=>frame(audio.now));expect(api!.currentMs).toBeCloseTo(500);
 }finally{act(()=>root.unmount());audio.start.mockReset();vi.unstubAllGlobals();}
});
