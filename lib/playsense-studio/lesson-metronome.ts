import {beatGridFromAnchor} from './beat-grid';
export interface LessonMetronome {bpm:number;anchorSeconds:number|null;segments?:Array<{from:number;to:number;bpm:number}>}
/** A confirmed first beat never generates clicks before itself or into the next score. */
export function lessonMetronomeGrid(settings:LessonMetronome,duration:number,scoreStarts:readonly number[]=[]) {
 if(settings.segments)return settings.segments.flatMap(s=>beatGridFromAnchor(s.from,s.bpm,s.from,Math.min(s.to,duration)).filter(t=>t<s.to&&t<duration));
 const anchor=settings.anchorSeconds;
 if(anchor===null||!Number.isFinite(anchor)||anchor<0)return [];
 const next=scoreStarts.filter(t=>Number.isFinite(t)&&t>=anchor).sort((a,b)=>a-b)[0]??duration;
 const end=Math.min(duration,next);
 if(!(end>anchor))return [];
 return beatGridFromAnchor(anchor,settings.bpm,anchor,end).filter(t=>t<end);
}
