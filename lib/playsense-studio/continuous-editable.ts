import type {ScoreDocument,Measure} from '@/components/playsense-studio/shared/score-model/types';
import type {StudioTiming} from './drafts/timing';
import {emptyMeasure} from './measure-edits';
/** Materialize empty time as ordinary score measures. Only musical coordinates
 * shift; all authored media timestamps, note IDs and click seconds survive. */
export function padContinuousSection(source:ScoreDocument, original:StudioTiming, start:number,end:number) {
 const score=structuredClone(source),timing=structuredClone(original);
 const first=timing.waypoints[0],last=timing.waypoints.at(-1);
 if(!first||!last)throw new Error('Placed score required');
 const meter=score.initialTimeSignature??[4,4];const qn=meter[0]*4/meter[1];
 const period=qn*60/(score.initialTempo||120);
 const prefix=Math.max(0,first.videoTimeSeconds-start),suffix=Math.max(0,end-last.videoTimeSeconds);
 const before=prefix>1e-6?Math.max(1,Math.round(prefix/period)):0;
 const after=suffix>1e-6?Math.max(1,Math.round(suffix/period)):0;
 const offset=before*qn;const originalCount=score.tracks[0]?.measures.length??0;
 for(const track of score.tracks){
  const clef=track.measures[0]?.clef;
  const blanks=(count:number)=>Array.from({length:count},()=>({...emptyMeasure(1),clef,timeSignature:[...meter] as [number,number],endBarline:'single' as const}));
  track.measures=[...blanks(before),...track.measures,...blanks(after)].map((m,i)=>({...m,number:i+1}));
  // Each imported musical passage keeps its final bar inside the continuous staff.
  if(originalCount&&track.measures[before+originalCount-1])track.measures[before+originalCount-1].endBarline='final';
 }
 const leading=Array.from({length:before},(_,i)=>({musicalPositionQN:i*qn,videoTimeSeconds:start+prefix*i/before,measureNumber:i+1,beatInMeasure:1}));
 const authored=timing.waypoints.map(w=>({...w,musicalPositionQN:w.musicalPositionQN+offset,measureNumber:w.measureNumber==null?null:w.measureNumber+before}));
 if(after){authored[authored.length-1]={...authored.at(-1)!,measureNumber:before+originalCount+1,beatInMeasure:1};}
 const trailing=Array.from({length:after},(_,i)=>({musicalPositionQN:last.musicalPositionQN+offset+(i+1)*qn,videoTimeSeconds:last.videoTimeSeconds+suffix*(i+1)/after,measureNumber:i===after-1?null:before+originalCount+i+2,beatInMeasure:i===after-1?null:1}));
 timing.waypoints=[...leading,...authored,...trailing];
 if(timing.anchor?.qn!=null)timing.anchor.qn+=offset;
 if(Array.isArray(timing.params.nudges))timing.params.nudges=timing.params.nudges.map((n:{qn:number})=>({...n,qn:n.qn+offset}));
 if(Array.isArray(timing.params.editedBeats))timing.params.editedBeats=timing.params.editedBeats.map((b:{measure:number})=>({...b,measure:b.measure+before}));
 return {score,timing,before,after};
}
