'use client';
import {REP_H} from './measure/repeat-lane';
import {useMemo} from 'react';
import {timelineGaps,emptyTimelineMeasures} from '@/lib/playsense-studio/continuous-project';
import {ContinuousStaff} from './continuous-staff';
import type {MeasureStripItem} from './editable-measure-strip';
import type {LaneSection} from '../sync/sections-lane';
import {extractTrackEvents} from '@/lib/playsense-studio/score-to-vexflow';
import {measureFill} from '@/lib/playsense-studio/measure-fill';
import {useStudioText} from './use-studio-text';
const noop=()=>{};
export function ContinuousScoreGaps({sections,trackIndex,height,pixelsPerSecond,scrollLeftPx,viewportWidth}:{sections:LaneSection[];trackIndex:number;height:number;pixelsPerSecond:number;scrollLeftPx:number;viewportWidth:number}) {
 const st=useStudioText();
 const project=sections.find(s=>s.continuousProject)?.continuousProject;
 const gaps=useMemo(()=>project?timelineGaps(project.editableEmptyMeasures && project.musicRanges ? Object.values(project.musicRanges).map(r=>({startSeconds:r.start,endSeconds:r.end})) : sections,project.durationSeconds):[],[sections,project]);
 const items=useMemo<MeasureStripItem[]>(()=>{
  const source=sections.find(s=>s.score?.tracks[trackIndex])?.score;
  if(!source || project?.editableEmptyMeasures)return [];
  const track=source.tracks[trackIndex];const first=extractTrackEvents(track,source.initialTimeSignature,source.initialKeyFifths)[0];
  return gaps.flatMap(gap=>{
   const preceding=[...sections].filter(s=>s.score&&s.endSeconds!=null&&s.endSeconds<=gap.start).sort((a,b)=>b.endSeconds!-a.endSeconds!)[0]?.score??source;
   return emptyTimelineMeasures(gap.start,gap.end,preceding.initialTempo,preceding.initialTimeSignature);
  }).map((gap,i)=>({measureIndex:i,measureNumber:0,startVideoTimeSeconds:gap.start,endVideoTimeSeconds:gap.end,
   events:[],voice2Events:[],timeSignature:source.initialTimeSignature??[4,4],isFirst:gap.start===0,
   clef:first?.clef??'treble',keyFifths:first?.keyFifths??0,previousKeyFifths:0,keyChanged:false,clefChanged:false,
   fill:measureFill([],[],source.initialTimeSignature??[4,4]),finalBarline:gap.end===project?.durationSeconds}));
 },[sections,gaps,trackIndex]);
 if(!project)return null;
 return <div aria-label={st('Continuous empty staff')} className="playsense-studio-notation pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden" style={{height}}>
   {!project.editableEmptyMeasures && <svg aria-hidden="true" className="absolute inset-0 h-full w-full" style={{color:'hsl(var(--playsense-studio-notation))'}}>
    {[-20,-10,0,10,20].map(offset=><line key={offset} x1={Math.max(0,-scrollLeftPx)} x2={Math.max(0,project.durationSeconds*pixelsPerSecond-scrollLeftPx)} y1={REP_H+(height-REP_H)/2+offset} y2={REP_H+(height-REP_H)/2+offset} stroke="currentColor" strokeWidth="0.6"/>)}</svg>}
   <ContinuousStaff items={items} height={height} pixelsPerSecond={pixelsPerSecond} scrollLeftPx={scrollLeftPx} viewportWidth={viewportWidth} onHitsReady={noop}/>

 </div>;
}
