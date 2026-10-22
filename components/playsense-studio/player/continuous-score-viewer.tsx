'use client';
import {ScoreHeading} from '../shared/score-heading';
import {useEffect,useRef,useState} from 'react';
import type {PlayerSection} from './playsense-studio-player';
import type {LaneSection} from '../sync/sections-lane';
import {ContinuousScoreGaps} from '../studio/continuous-score-gaps';
import {SiblingSectionScores} from '../studio/sibling-section-scores';
export function ContinuousScoreViewer({sections,currentSeconds,zoom,onSeek}:{sections:PlayerSection[];currentSeconds:number;zoom:number;onSeek:(seconds:number)=>void}){
 const host=useRef<HTMLDivElement>(null);const [width,setWidth]=useState(800);const [scroll,setScroll]=useState(0);
 useEffect(()=>{const el=host.current;if(!el)return;const ro=new ResizeObserver(()=>setWidth(el.clientWidth));ro.observe(el);return()=>ro.disconnect();},[]);
 const duration=sections[0]?.continuousProject?.durationSeconds??1;
 const pps=Math.max(30,width/duration)*(zoom||1);const height=220;
 useEffect(()=>{const el=host.current;if(!el)return;const x=currentSeconds*pps+110;
   if(x<el.scrollLeft || x>el.scrollLeft+width-32)el.scrollLeft=Math.max(0,x-width*.2);
 },[currentSeconds,pps,width]);
 const lanes:LaneSection[]=sections.map(s=>({sectionId:s.id,label:s.label??s.score.title,startSeconds:s.videoStartSeconds,endSeconds:s.videoEndSeconds,score:s.score,continuousProject:s.continuousProject,
 timing:s.activeTimeMap?{method:'drag',params:{},waypoints:s.activeTimeMap.waypoints,anchor:s.metronomeAnchorSeconds==null?null:{seconds:s.metronomeAnchorSeconds,qn:null}}:undefined}));
 const tracks=Math.max(1,...sections.map(s=>s.score.tracks.length));
 const active=sections.find(s=>currentSeconds>=(s.videoStartSeconds??0)&&currentSeconds<(s.videoEndSeconds??Infinity))??sections[0];
 return <div className="flex h-full min-h-0 flex-col">
 <ScoreHeading score={{...active.score,title:sections[0].continuousProject?.title??active.score.title}} bpm={active.score.initialTempo} trackIndex={0}/>
 <div ref={host} className="min-h-0 flex-1 overflow-auto" onScroll={e=>setScroll(e.currentTarget.scrollLeft)}>
  <div style={{width:Math.max(width,duration*pps+110),height:height*tracks}}>
   <div className="sticky left-0" style={{width,height:height*tracks}}>
    {Array.from({length:tracks},(_,trackIndex)=><div key={trackIndex} className="relative" style={{height}}>
     <ContinuousScoreGaps sections={lanes} trackIndex={trackIndex} height={height} pixelsPerSecond={pps} scrollLeftPx={scroll-110} viewportWidth={width}/>
     <SiblingSectionScores sections={lanes} activeSectionId="" trackIndex={trackIndex} height={height} pixelsPerSecond={pps} scrollLeftPx={scroll-110} onSelectSection={id=>onSeek(lanes.find(s=>s.sectionId===id)?.startSeconds??0)}/>
     <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-primary" style={{left:currentSeconds*pps-scroll+110}}/>
    </div>)}
   </div>
  </div>
 </div></div>;
}
