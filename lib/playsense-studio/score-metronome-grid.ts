import type {ScoreDocument} from '@/components/playsense-studio/shared/score-model/types';
import {WaypointTimeMap,type Waypoint} from '@/components/playsense-studio/shared/time-map/time-map';
import {measureLengthInQN,walkMeasures} from './time-mapping';
// Imported tempo marks are dormant until reviewed, just as in graded play.
// playbackTempoOverride is applied by the transport's playback rate, not twice here.
/** The click follows the chosen tempo, not unconfirmed imports or note-sync nudges. */
export function scoreMetronomeGrid(score:ScoreDocument,waypoints:Waypoint[],from:number,to:number,anchor?:number|null,endLimit=Infinity):number[] {
 if(waypoints.length<2||!score.tracks[0]||!(to>from))return [];
 const start=anchor??new WaypointTimeMap('metronome','drag',waypoints).toVideoTime(0);
 if(!Number.isFinite(start))return [];
 const times:number[]=[];
 const track = score.tempoMarksConfirmed ? score.tracks[0] : {
  ...score.tracks[0], measures: score.tracks[0].measures.map(({tempoChange: _importedTempo, ...measure}) => measure),
 };
 for(const {measure,state} of walkMeasures(track,score)) {
  if(!Number.isFinite(state.tempo)||state.tempo<=0) return [];
  const length=measureLengthInQN(state.timeSignature,measure),step=4/state.timeSignature[1];
  if(!(step>0)||!Number.isFinite(length))return [];
  for(let offset=0;offset<length-1e-7;offset+=step){
   const t=start+state.cumulativeMs/1000+offset*60/state.tempo;
   // Finish the written beats even when the last sync handle is too early.
   // The next section/video boundary remains a hard stop.
   if(t>=from-1e-7&&t<endLimit-1e-7)times.push(t);
  }
 }
 return times;
}

/** A general lesson pulse must never play on top of a scored passage. */
export function withoutScoreClicks(general:number[],scoreClicks:number[],from:number,to:number):number[] {
 const last=scoreClicks.at(-1);
 const period=scoreClicks.length>1?last!-scoreClicks[scoreClicks.length-2]:0;
 const end=Math.max(to,last===undefined?to:last+period);
 return general.filter(t=>t<from-1e-7||t>=end-1e-7);
}
