import {it,expect} from 'vitest';
import {FlexMap,protectFlexMeasure,moveFlexPoint,type FlexPoint} from '../flex';
it('isolates an interior edit to one bar while preserving an existing non-identity warp outside it',()=>{
 const points:FlexPoint[]=[{src:0,dst:0,anchor:true},{src:10,dst:12,anchor:false},{src:20,dst:20,anchor:true}];
 const before=new FlexMap(points);
 const protectedPoints=protectFlexMeasure(points,10,[0,4,8,16,20]);
 const moved=moveFlexPoint(protectedPoints,protectedPoints.findIndex(p=>p.src===10),13,{start:0,end:20});
 const after=new FlexMap(moved);
 for(const dst of [0,1,4,7,8,16,17,20,25])expect(after.toMedia(dst)).toBeCloseTo(before.toMedia(dst),9);
 expect(after.toTimeline(10)).toBe(13);
 expect(points[1].dst).toBe(12);
});
it('pins the two adjacent bars when the dragged point is their shared boundary',()=>{
 const points:FlexPoint[]=[{src:0,dst:0,anchor:true},{src:8,dst:8,anchor:false},{src:20,dst:20,anchor:true}];
 const protectedPoints=protectFlexMeasure(points,8,[0,4,8,12,16,20]);
 expect(protectedPoints.filter(p=>p.anchor).map(p=>p.dst)).toEqual([0,4,12,20]);
});
