// @vitest-environment jsdom
import {expect,it,vi} from 'vitest';
import {ClickTrack} from '../click-track';

it('schedules the first beat with the score clock and preserves the following beat intervals',()=>{
 vi.useFakeTimers();
 const starts:number[]=[];
 const ctx={currentTime:10,state:'running',sampleRate:1000,baseLatency:.02,destination:{},
  createBuffer:()=>({getChannelData:()=>new Float32Array(40)}),
  createGain:()=>({gain:{value:0,cancelScheduledValues(){},setValueAtTime(){},linearRampToValueAtTime(){}},connect(){},disconnect(){}}),
  createBufferSource:()=>({connect(){},disconnect(){},stop(){},start(t:number){starts.push(t);}}),
  close:()=>Promise.resolve(),
 };
 vi.stubGlobal('AudioContext',class {constructor(){return ctx;}});
 const click=new ClickTrack();
 try {
  click.setGrid([0,.5,1,1.5]);
  const origin=click.start(0,1,true)!;
  expect(origin).toBeCloseTo(10.045);
  expect(starts).toEqual([origin]);
  ctx.currentTime=10.45;vi.advanceTimersByTime(25);
  ctx.currentTime=10.95;vi.advanceTimersByTime(25);
  expect(starts).toHaveLength(3);
  expect(starts[1]-starts[0]).toBeCloseTo(.5);
  expect(starts[2]-starts[1]).toBeCloseTo(.5);
  // Starting between beats must not invent an extra downbeat.
  starts.length=0;ctx.currentTime=20;
  const resumed=click.start(.25,2,true)!;
  expect(starts).toEqual([]);
  ctx.currentTime=20.1;vi.advanceTimersByTime(25);
  expect(starts[0]).toBeCloseTo(resumed+.125);
 } finally {click.close();vi.useRealTimers();vi.unstubAllGlobals();}
});
