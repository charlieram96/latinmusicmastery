import type {ScoreDocument,Measure} from '@/components/playsense-studio/shared/score-model/types';
import {WaypointTimeMap,type Waypoint} from '@/components/playsense-studio/shared/time-map/time-map';
import {walkMeasures,measureLengthInQN} from './time-mapping';
export function isClickFinalBar(measure:Measure):boolean {
 return measure.endBarline==='final'&&!measure.repeatEnd&&(!measure.repeat||measure.repeat.offset!==measure.repeat.length-1||measure.repeat.pass===measure.repeat.count-1);
}
/** Authored thin/thick final bars close click passages. Repeat dots and plain
 * double bars do not. Their times follow the score's synchronized bar ends. */
export function finalBarClickStops(score:ScoreDocument,waypoints:Waypoint[]):number[]{
 const track=score.tracks[0];if(!track)return [];
 const map=waypoints.length>=2?new WaypointTimeMap('click-stops','drag',waypoints):null;
 return [...walkMeasures(track,score)].flatMap(({measure,state})=>{
  if(measure!==track.measures[track.measures.length-1]&&!isClickFinalBar(measure))return [];
  const length=measureLengthInQN(state.timeSignature,measure);
  return [map?map.toVideoTime(state.cumulativeQN+length):(state.cumulativeMs+length*60000/state.tempo)/1000];
 });
}
/** A final bar silences the click until a new authored start at/after it. */
export function stopClicksAtFinalBars(times:number[],starts:number[],stops:number[]):number[]{
 if(!stops.length)return times;
 return times.filter(t=>{
  const stop=Math.max(-Infinity,...stops.filter(s=>s<=t+1e-7));
  if(stop===-Infinity)return true;
  return starts.some(s=>s>=stop-1e-7&&s<=t+1e-7);
 });
}
