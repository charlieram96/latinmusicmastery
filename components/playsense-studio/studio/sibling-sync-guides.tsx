'use client';
import {useMemo} from 'react';
import type {LaneSection} from '../sync/sections-lane';
import {seedMarkerState,noteTicks} from '../sync/marker-model';
import {readClickAnchors} from '@/lib/playsense-studio/click-anchors';
import {readNudges} from '@/lib/playsense-studio/drafts/timing';
import {useStudioText} from './use-studio-text';
/** Inactive fragments retain their timing context; selecting a point activates
 * its owning editor, whose existing drag/history path edits the point. */
export function SiblingSyncGuides({sections,activeSectionId,height,pixelsPerSecond,scrollLeftPx,viewportWidth,showNotes,onActivate}:{sections:LaneSection[];activeSectionId:string;height:number;pixelsPerSecond:number;scrollLeftPx:number;viewportWidth:number;showNotes:boolean;onActivate:(id:string)=>void}){
 const st=useStudioText();
 const rows=useMemo(()=>sections.flatMap(section=>{
  if(section.sectionId===activeSectionId||!section.score?.tracks[0]||!section.timing?.waypoints.length)return [];
  const markers=seedMarkerState(section.score.tracks[0],section.score,section.timing.waypoints,readNudges(section.timing.params));
  return [{section,markers,notes:noteTicks(markers)}];
 }),[sections,activeSectionId]);
 const x=(time:number)=>time*pixelsPerSecond-scrollLeftPx;
 const visible=(at:number)=>at>=0&&at<=viewportWidth;
 return <svg className="pointer-events-none absolute inset-0 overflow-hidden" width="100%" height={height} aria-label={st('Synchronization guides for other fragments')}>
 {rows.map(({section,markers,notes})=><g key={section.sectionId}>
  {(readClickAnchors(section.timing?.params)??(section.timing?.anchor?[{id:'legacy',seconds:section.timing.anchor.seconds}]:[])).map(a=>visible(x(a.seconds))?<g key={a.id}><line x1={x(a.seconds)} x2={x(a.seconds)} y1={height-24} y2={height} stroke="#ff8500" strokeWidth={2}/><text x={x(a.seconds)} y={height-3} fill="#ff8500" fontSize={12}>◆</text></g>:null)}
  {markers.measures.flatMap(m=>m.beats.map(b=>{const at=x(b.videoTimeSeconds);if(!visible(at))return null;
   const down=b.beatInMeasure===1;
   return <g key={`${m.measureNumber}-${b.beatInMeasure}`} role="button" tabIndex={0} aria-label={`${st('Activate synchronization')}: ${section.label}, ${st('Measure')} ${m.measureNumber}, ${st('Beat')} ${b.beatInMeasure}`} className="pointer-events-auto cursor-pointer" onClick={()=>onActivate(section.sectionId)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onActivate(section.sectionId);}}}>
    <title>{st('Select this point, then drag to synchronize')}</title>
    <line x1={at} x2={at} y1={22} y2={height} stroke={down?'#ff8500':'#a3b7cf'} strokeOpacity={down?.65:.25}/>
    {down?<><rect x={at} y={2} width={22} height={16} rx={4} fill="#ff8500"/><text x={at+11} y={14} textAnchor="middle" fontSize={11} fill="#172033">{m.measureNumber}</text></>:<circle cx={at} cy={(height+22)/2} r={4} fill="#a3b7cf"/>}
    <circle cx={at} cy={down?10:(height+22)/2} r={10} fill="transparent"/>
   </g>;
  }))}
  {showNotes&&notes.map(note=>{const at=x(note.videoTimeSeconds);if(!visible(at))return null;return <g key={note.qn} role="button" tabIndex={0} aria-label={`${st('Activate note synchronization')}: ${section.label}, ${st('Measure')} ${note.measureNumber}`} className="pointer-events-auto cursor-pointer" onClick={()=>onActivate(section.sectionId)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onActivate(section.sectionId);}}}>
   <line x1={at} x2={at} y1={22} y2={height} stroke={note.nudged?'#ff8500':'#a3b7cf'} strokeOpacity={.35}/><circle cx={at} cy={36} r={4} fill={note.nudged?'#ff8500':'#a3b7cf'}/><circle cx={at} cy={36} r={9} fill="transparent"/>
  </g>;})}
 </g>)}
 </svg>;
}
