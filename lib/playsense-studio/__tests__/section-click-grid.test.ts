import {it,expect} from 'vitest';
import {sectionClickGrid} from '../section-click-grid';
import {anchoredClickGrid} from '../click-anchors';
const grid=(anchor:number,end:number)=>anchoredClickGrid([{id:'a',seconds:anchor}],100,4,anchor,end);
it('prevents overlapping sections and a general metronome from multiplying the pulse',()=>{
 const sections=[
  {videoStartSeconds:0,videoEndSeconds:80,grid:grid(9.358,80)},
  {videoStartSeconds:26.334,videoEndSeconds:80,grid:grid(28.73375,80)},
  {videoStartSeconds:45.5234,videoEndSeconds:79.1234,grid:grid(47.90075,79.1234)},
 ];
 const result=sectionClickGrid(sections,grid(0,80));
 for(const [start,end] of [[28.73375,45.5234],[47.90075,79.1234]]){
  const beats=result.filter(t=>t>=start&&t<end);
  for(let i=1;i<beats.length;i++)expect((beats[i]-beats[i-1])/1.07).toBeCloseTo(60/107,8);
 }
 expect(result.some(t=>t>=26.334&&t<28.73375)).toBe(false);
 expect(result.some(t=>t>=45.5234&&t<47.90075)).toBe(false);
 expect(result.filter(t=>t<26.334)).toEqual(sections[0].grid.filter(t=>t<26.334));
});
it('keeps general pulses in gaps and emits a boundary beat only once',()=>{
 expect(sectionClickGrid([{videoStartSeconds:1,videoEndSeconds:2,grid:[1,2]},{videoStartSeconds:2,videoEndSeconds:3,grid:[2,3]}],[0,1,2,3,4])).toEqual([0,1,2,3,4]);
});
