import {beatGridFromAnchor} from './beat-grid';
export interface LessonMetronome {bpm:number;anchorSeconds:number|null}
/** A confirmed first beat never generates clicks before itself or into the next score. */
export function lessonMetronomeGrid(settings:LessonMetronome,duration:number,scoreStarts:readonly number[]=[]) {
 const anchor=settings.anchorSeconds;
 if(anchor===null||!Number.isFinite(anchor)||anchor<0)return [];
 const next=scoreStarts.filter(t=>Number.isFinite(t)&&t>=anchor).sort((a,b)=>a-b)[0]??duration;
 const end=Math.min(duration,next);
 if(!(end>anchor))return [];
 return beatGridFromAnchor(anchor,settings.bpm,anchor,end).filter(t=>t<end);
}
