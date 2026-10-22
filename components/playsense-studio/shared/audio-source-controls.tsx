'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Trash2} from 'lucide-react';
import {useTranslation} from '@/components/language-provider';
import {audioClips,clipEnd,type AudioClip} from '@/lib/playsense-studio/audio-source';
import {audioFileDuration,clipPeaks} from '@/lib/playsense-studio/audio-layer-analysis';
import type {WaveformPeaks} from '@/lib/playsense-studio/waveform';
import type {useAudioSource} from './use-audio-source';
type Audio=ReturnType<typeof useAudioSource>;
export function OriginalAudioMute({audio}:{audio:Audio}) {
 const {locale}=useTranslation();const es=locale==='es';
 return <button type="button" data-score-preserve-selection aria-pressed={!!audio.settings.originalMuted} disabled={audio.busy||!audio.loaded} className="text-xs text-primary" onClick={()=>void audio.save({originalMuted:!audio.settings.originalMuted})}>{audio.settings.originalMuted?(es?'Oír original':'Unmute original'):(es?'Silenciar original':'Mute original')}</button>;
}
export function AudioSourceControls({audio,duration=0,getPlayhead=()=>0,timeline,waveformHeight=120}:{audio:Audio;waveformHeight?:number;duration?:number;getPlayhead?:()=>number;sections?:{id:string;label:string;start:number;end:number}[];timeline?:{pps:number;scrollLeft:number;toTimeline:(t:number)=>number;toMedia:(t:number)=>number}}){
 const {locale}=useTranslation();const es=locale==='es';
 const [error,setError]=useState('');const [reading,setReading]=useState(false);
 const [drag,setDrag]=useState<{id:string;start:number}|null>(null);
 const gesture=useRef<{id:string;x:number;start:number;scale:number}|null>(null);
 const clips=audioClips(audio.settings);
 const total=Math.max(1,duration,...clips.map(c=>Number.isFinite(clipEnd(c))?clipEnd(c):0));
 const position=(t:number)=>timeline?`${timeline.toTimeline(t)*timeline.pps-timeline.scrollLeft}px`:`${t/total*100}%`;
 const width=(start:number,end:number)=>timeline?`${Math.max(6,(timeline.toTimeline(end)-timeline.toTimeline(start))*timeline.pps)}px`:`${Math.max(.8,(end-start)/total*100)}%`;
 const moved=(g:{start:number;x:number;scale:number},x:number)=>Math.max(0,timeline?timeline.toMedia(timeline.toTimeline(g.start)+(x-g.x)*g.scale):g.start+(x-g.x)*g.scale);
 const disabled=audio.busy||!audio.loaded||reading;
 // Preserve the old original-only choice as muted clips when first editing it.
 const editable=clips.map(c=>({...c,muted:c.muted||audio.settings.selected==='original'}));
 const update=(clip:AudioClip,patch:Partial<AudioClip>)=>void audio.save({selected:'imported',clips:editable.map(c=>c.id===clip.id?{...c,...patch}:c)});
 const add=async(file:File)=>{if(!/\.(mp3|wav|m4a|aac|ogg|flac|aif|aiff)$/i.test(file.name)){setError(es?'Elige un audio MP3, WAV, M4A, AAC, OGG, FLAC o AIFF.':'Choose MP3, WAV, M4A, AAC, OGG, FLAC or AIFF audio.');return;}setReading(true);setError('');try{const length=await audioFileDuration(file);await audio.save({clips:[{id:'upload',url:'',name:file.name,durationSeconds:length,startSeconds:Math.max(0,getPlayhead()),trimStartSeconds:0,trimEndSeconds:length,muted:false}]},file);}catch(e){setError((e as Error).message);}finally{setReading(false);}};
 const legacy=clips.find(c=>!Number.isFinite(c.durationSeconds));
 useEffect(()=>{if(!legacy||!audio.loaded)return;let alive=true;void clipPeaks(legacy.url).then(p=>{if(alive)void audio.save({clips:[{...legacy,durationSeconds:p.durationSeconds,trimEndSeconds:p.durationSeconds}]});}).catch(e=>{if(alive)setError(String(e));});return()=>{alive=false;};},[legacy?.url,audio.loaded]);
 return <div data-score-preserve-selection className="border-b border-border text-xs">
  <div className="flex flex-wrap items-center gap-3 px-3 py-1">
   <label className="cursor-pointer text-primary">{reading?(es?'Cargando…':'Loading…'):(es?'+ Importar audio':'+ Import audio')}<input className="sr-only" aria-label={es?'Importar audio':'Import audio'} type="file" disabled={disabled} onChange={e=>{const file=e.target.files?.[0];if(file)void add(file);e.target.value='';}}/></label>
   <button type="button" disabled={disabled||!audio.canUndo} onClick={()=>void audio.undo()} className="disabled:opacity-40">{es?'Deshacer':'Undo'}</button>
   <button type="button" disabled={disabled||!audio.canRedo} onClick={()=>void audio.redo()} className="disabled:opacity-40">{es?'Rehacer':'Redo'}</button>
  </div>
  <div className="max-h-64 overflow-y-auto">
  {clips.map((clip,index)=>{const start=drag?.id===clip.id?drag.start:clip.startSeconds;const muted=clip.muted||audio.settings.selected==='original';return <div key={clip.id} className="border-t border-border">
   <div className="flex items-center gap-3 px-3"><span className="min-w-0 truncate">{es?'Audio importado':'Imported audio'} {index+1} · {clip.name}</span><button type="button" disabled={disabled} aria-pressed={muted} className="shrink-0 text-primary" onClick={()=>update(clip,{muted:!muted})}>{muted?(es?'Oír':'Unmute'):(es?'Silenciar':'Mute')}</button><button type="button" disabled={disabled} className="shrink-0 rounded p-1 text-primary hover:bg-primary/10 disabled:opacity-40" aria-label={`${es?'Quitar audio importado':'Remove imported audio'} ${index+1}: ${clip.name}`} title={es?'Quitar audio importado · puedes deshacer':'Remove imported audio · can be undone'} onClick={()=>void audio.save({clips:clips.filter(c=>c.id!==clip.id)})}><Trash2 className="h-3.5 w-3.5" aria-hidden="true"/></button></div>
   <div className="relative overflow-hidden bg-muted/30" style={{height:waveformHeight}}>
    <button type="button" disabled={disabled} aria-label={`${es?'Mover audio':'Move audio'} ${index+1}: ${clip.name}`} title={`${clip.name} · ${start.toFixed(2)} s`} className={`absolute inset-y-0 touch-none overflow-hidden border border-primary bg-muted/30 ${muted?'opacity-70':''}`} style={{left:position(start),width:width(start,start+clip.trimEndSeconds-clip.trimStartSeconds)}} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();update(clip,{startSeconds:Math.max(0,clip.startSeconds+(e.key==='ArrowRight'?1:-1)*(e.shiftKey?1:.01))});}}} onPointerDown={e=>{e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);gesture.current={id:clip.id,x:e.clientX,start:clip.startSeconds,scale:timeline?1/timeline.pps:total/(e.currentTarget.parentElement?.clientWidth||1)};setDrag({id:clip.id,start:clip.startSeconds});}} onPointerMove={e=>{const g=gesture.current;if(g?.id===clip.id)setDrag({id:clip.id,start:moved(g,e.clientX)});}} onPointerUp={e=>{const g=gesture.current;if(!g)return;const at=moved(g,e.clientX);gesture.current=null;setDrag(null);if(Math.abs(at-clip.startSeconds)>.0001)update(clip,{startSeconds:at});}} onPointerCancel={()=>{gesture.current=null;setDrag(null);}}><ClipWave clip={clip}/></button>
   </div>
  </div>;})}
  </div>
  {(audio.error||error)&&<p role="alert" className="text-destructive">{audio.error||error}</p>}
 </div>;
}
function ClipWave({clip}:{clip:AudioClip}){
 const [peaks,setPeaks]=useState<WaveformPeaks|null>(null);
 const [width,setWidth]=useState(1);
 const element=useRef<SVGSVGElement>(null);
 useEffect(()=>{let alive=true;setPeaks(null);void clipPeaks(clip.url).then(p=>{if(alive)setPeaks(p);}).catch(()=>{});return()=>{alive=false;};},[clip.url]);
 useEffect(()=>{const el=element.current;if(!el)return;const measure=()=>setWidth(Math.max(1,Math.ceil(el.getBoundingClientRect().width)));measure();const observer=new ResizeObserver(measure);observer.observe(el);return()=>observer.disconnect();},[]);
 const columns=Math.min(16384,width);
 const path=useMemo(()=>{
  if(!peaks?.bucketCount)return '';
  const points:string[]=[];
  const span=clip.trimEndSeconds-clip.trimStartSeconds;
  for(let x=0;x<columns;x++){
   const from=(clip.trimStartSeconds+x/columns*span)/peaks.durationSeconds*peaks.bucketCount;
   const to=(clip.trimStartSeconds+(x+1)/columns*span)/peaks.durationSeconds*peaks.bucketCount;
   let min=0,max=0;
   for(let i=Math.max(0,Math.floor(from));i<Math.min(peaks.bucketCount,Math.max(Math.floor(from)+1,Math.ceil(to)));i++){
    min=Math.min(min,peaks.data[i*2]);max=Math.max(max,peaks.data[i*2+1]);
   }
   // Cached peaks are signed int8, just like the original video's waveform.
   points.push(`M${x+.5},${50-max/127*46}V${50-min/127*46}`);
  }
  return points.join(' ');
 },[peaks,columns,clip.trimStartSeconds,clip.trimEndSeconds]);
 return <svg ref={element} className="block h-full w-full text-slate-500 dark:text-slate-400" viewBox={`0 0 ${columns} 100`} preserveAspectRatio="none" aria-hidden><path d={`M0,50H${columns}`} stroke="currentColor" strokeOpacity=".25" vectorEffect="non-scaling-stroke"/><path d={path} stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke"/></svg>;
}
