import { expect,it } from 'vitest';
import { resizeMarkerRange } from '../resize-marker-range';
import type { MarkerState } from '@/components/playsense-studio/sync/marker-model';
const state: MarkerState = {tailQN:12,tailVideoTimeSeconds:8,measures:[0,1,2].map(i=>({
  measureNumber:i+1,beatsInMeasure:4,downbeatQN:i*4,expanded:false,onsetQNs:[],nudges:[],
  beats:[0,1,2,3].map(b=>({beatInMeasure:b+1,musicalPositionQN:i*4+b,videoTimeSeconds:2+i*2+b*.5,edited:false})),
}))};
it('stretches one bar without changing musical positions or later bar durations',()=>{
  const next=resizeMarkerRange(state,0,0,5);
  expect(next.measures[0].beats.map(b=>b.videoTimeSeconds)).toEqual([2,2.75,3.5,4.25]);
  expect(next.measures[1].beats[0].videoTimeSeconds).toBe(5);
  expect(next.measures[2].beats[0].videoTimeSeconds).toBe(7);
  expect(next.tailVideoTimeSeconds).toBe(9);
  expect(next.measures.map(m=>m.beats.map(b=>b.musicalPositionQN))).toEqual(state.measures.map(m=>m.beats.map(b=>b.musicalPositionQN)));
  expect(state.tailVideoTimeSeconds).toBe(8);
});
it('compresses a selected pair as one interval and respects the recording end',()=>{
  const next=resizeMarkerRange(state,0,1,4);
  expect(next.measures.map(m=>m.beats[0].videoTimeSeconds)).toEqual([2,3,4]);
  expect(next.tailVideoTimeSeconds).toBe(6);
  expect(resizeMarkerRange(state,0,1,50,10).tailVideoTimeSeconds).toBe(10);
});
