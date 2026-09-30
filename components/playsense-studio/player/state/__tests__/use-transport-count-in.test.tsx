// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import {useTransportCountIn} from '../use-transport-count-in';
const audio=vi.hoisted(()=>({time:0,grid:vi.fn(),start:vi.fn(),stop:vi.fn()}));
vi.mock('@/lib/playsense-studio/click-track',()=>({ClickTrack:class{ensureContext(){return {state:'running',get currentTime(){return audio.time;}};}setVolume(){}setGrid=audio.grid;start=audio.start;teardown=audio.stop;close(){} }}));
it('counts on the audio clock at the effective tempo, and cancellation prevents a delayed start',()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});vi.useFakeTimers();audio.time=0;
 let api:ReturnType<typeof useTransportCountIn>;
 function Harness(){api=useTransportCountIn();return null;}
 const root=createRoot(document.createElement('div')),done=vi.fn();
 try{
  act(()=>root.render(<Harness/>));
  act(()=>{void api!.start({bpm:180,denominator:4,beats:4,bars:1,volume:.2},done);});
  expect(api!.remaining).toBe(4);expect(audio.grid).toHaveBeenLastCalledWith([0,1/3,2/3,1]);
  audio.time=.06+1/3;act(()=>vi.advanceTimersByTime(8));expect(api!.remaining).toBe(3);expect(done).not.toHaveBeenCalled();
  audio.time=.06+4/3;act(()=>vi.advanceTimersByTime(8));expect(done).toHaveBeenCalledTimes(1);expect(api!.remaining).toBe(0);
  act(()=>{void api!.start({bpm:60,denominator:8,beats:6,bars:2,volume:.2},done);});
  expect(audio.grid.mock.lastCall?.[0]).toHaveLength(12);expect(audio.grid.mock.lastCall?.[0][1]).toBe(.5);
  act(()=>api!.cancel());audio.time=100;act(()=>vi.advanceTimersByTime(20000));expect(done).toHaveBeenCalledTimes(1);
 }finally{act(()=>root.unmount());vi.useRealTimers();}
});
