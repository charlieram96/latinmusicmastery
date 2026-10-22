import {expect,it} from 'vitest';
import {readClickAnchors,addClickAnchor,anchoredClickGrid} from '../click-anchors';
import {timingFromLive,timingToTimeMap} from '../drafts/timing';
it('adds without replacing, starts exactly at each point and never before the first',()=>{
 const first=[{id:'a',seconds:1.13}];
 const anchors=addClickAnchor(first,{id:'b',seconds:2.37});
 expect(first).toEqual([{id:'a',seconds:1.13}]);
 expect(anchoredClickGrid(anchors,120,4,0,3.5)).toEqual([1.13,1.63,2.13,2.37,2.87,3.37]);
 expect(anchoredClickGrid(anchors,120,4,2.5,3.5)).toEqual([2.87,3.37]);
 expect(anchoredClickGrid([],120,4,0,10)).toEqual([]);
 expect(addClickAnchor(anchors,{id:'c',seconds:2.37})).toBe(anchors);
});
it('round trips all starts through the student map including explicit deletion',()=>{
 const anchors=[{id:'a',seconds:1.13},{id:'b',seconds:2.37}];
 const timing=timingFromLive({method:'drag',params:{clickAnchors:anchors},waypoints:[{musicalPositionQN:0,videoTimeSeconds:0,measureNumber:1,beatInMeasure:1},{musicalPositionQN:8,videoTimeSeconds:4,measureNumber:null,beatInMeasure:null}]},null);
 expect(readClickAnchors(timingToTimeMap(timing)?.params)).toEqual(anchors);
 expect(readClickAnchors({clickAnchors:[]})).toEqual([]);
 expect(readClickAnchors({})).toBeUndefined();
});

it('does not extend an old zero anchor into the next section before its authored start',async()=>{
 const {sectionClickAnchors}=await import('../click-anchors');
 const anchors=sectionClickAnchors([{id:'old',seconds:0},{id:'new',seconds:28.72317}],26.3338);
 expect(anchoredClickGrid(anchors,100,4,26.3338,30)).toEqual([28.72317,29.32317,29.92317]);
});
