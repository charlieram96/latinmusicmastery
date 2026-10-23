'use client';
import {useCallback,useEffect,useRef,useState,type RefObject} from 'react';
import {ORIGINAL_AUDIO,audioClips,audibleClip,type AudioSourceSettings,type AudioSourcePart} from '@/lib/playsense-studio/audio-source';
const changeEvent='lmm-audio-source-change';
const layerHistories=new Map<string,{past:AudioSourceSettings[];future:AudioSourceSettings[]}>();
export function useAudioSource(item:string,part:AudioSourcePart,video:string|null){
 const query=new URLSearchParams({item,part,video:video??''}).toString();
 const [record,setRecord]=useState<{key:string;settings:AudioSourceSettings}|null>(null);
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 useEffect(()=>{
  if(!video||!item)return;let alive=true;let revision=0;
  const load=async()=>{const run=++revision;try{const response=await fetch('/api/studio-audio-source?'+query,{cache:'no-store'});if(!response.ok)throw new Error('Could not load audio source');const settings=await response.json();if(alive&&run===revision){setRecord({key:query,settings});setError('');}}catch(e){if(alive&&run===revision){setRecord({key:query,settings:ORIGINAL_AUDIO});setError((e as Error).message);}}};
  void load();const changed=(event:Event)=>{if((event as CustomEvent).detail===query)void load();};
  const channel=typeof BroadcastChannel==='undefined'?null:new BroadcastChannel(changeEvent);if(channel)channel.onmessage=e=>{if(e.data===query)void load();};
  window.addEventListener(changeEvent,changed);return()=>{alive=false;channel?.close();window.removeEventListener(changeEvent,changed);};
 },[query,video,item]);
 const settings=record?.key===query?record.settings:ORIGINAL_AUDIO;
 const save=useCallback(async(patch:Partial<AudioSourceSettings>,file?:File,remember=true)=>{
  setBusy(true);setError('');try{
   const form=new FormData();form.set('item',item);form.set('part',part);form.set('video',video??'');
   form.set('originalMuted',String(patch.originalMuted??settings.originalMuted??false));
   if(patch.clips)form.set('clips',JSON.stringify(patch.clips));
   form.set('selected',patch.selected??settings.selected);form.set('offsetSeconds',String(patch.offsetSeconds??settings.offsetSeconds));if(file){form.set('file',file);const metadata=patch.clips?.[0];if(metadata){form.set('durationSeconds',String(metadata.durationSeconds));form.set('startSeconds',String(metadata.startSeconds));}}
   const response=await fetch('/api/studio-audio-source',{method:'POST',body:form});const result=await response.json();if(!response.ok)throw new Error(result.error);
   if(remember){const history=layerHistories.get(query)??{past:[],future:[]};layerHistories.set(query,{past:[...history.past,settings].slice(-50),future:[]});}
   setRecord({key:query,settings:result});window.dispatchEvent(new CustomEvent(changeEvent,{detail:query}));
   if(typeof BroadcastChannel!=='undefined'){const channel=new BroadcastChannel(changeEvent);channel.postMessage(query);channel.close();}
   return true;
  }catch(e){setError((e as Error).message);return false;}finally{setBusy(false);}
 },[item,part,video,settings,query]);
 const history=layerHistories.get(query);
 const travel=async(direction:'undo'|'redo')=>{const h=layerHistories.get(query);if(!h)return;const from=direction==='undo'?h.past:h.future;const target=from.at(-1);if(!target)return;const next=direction==='undo'?{past:h.past.slice(0,-1),future:[...h.future,settings]}:{past:[...h.past,settings],future:h.future.slice(0,-1)};layerHistories.set(query,next);if(!await save({...target,clips:target.clips??[]},undefined,false))layerHistories.set(query,h);};
 return {settings,save,busy,error,undo:()=>travel('undo'),redo:()=>travel('redo'),canUndo:!!history?.past.length,canRedo:!!history?.future.length,loaded:!video||!item||record?.key===query,sourceUrl:video};
}

/** Original video remains the master clock; an enabled clip replaces only its covered range. */
export function useSelectedAudio(videoRef:RefObject<HTMLVideoElement|null>,settings:AudioSourceSettings,options:{volume:number;muted:boolean;loaded:boolean;enabled?:boolean}){
 const latest=useRef(options);latest.current=options;
 const [element,setElement]=useState<HTMLVideoElement|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{if(element!==videoRef.current)setElement(videoRef.current);});
 useEffect(()=>{if(element&&options.enabled!==false&&element.volume!==options.volume)element.volume=options.volume;},[element,options.volume,options.enabled]);
 const configuration=JSON.stringify(settings);
 useEffect(()=>{
  if(!element||options.enabled===false)return;
  const video=element;
  const current=JSON.parse(configuration) as AudioSourceSettings;
  const clips=audioClips(current);
  if(current.selected==='original'||!clips.length){
   const enforce=()=>{const muted=!latest.current.loaded||latest.current.muted||!!current.originalMuted;if(video.muted!==muted)video.muted=muted;};
   enforce();setError('');video.addEventListener('volumechange',enforce);
   return()=>video.removeEventListener('volumechange',enforce);
  }
  const layers=clips.map(clip=>{const audio=new Audio(clip.url);audio.preload='auto';audio.preservesPitch=true;return {clip,audio,pending:false,failed:false};});
  let frame=0,disposed=false,waiting=false;
  setError('');
  const resolved=()=>({...current,clips:layers.map(({clip,audio})=>({...clip,trimEndSeconds:Math.min(clip.trimEndSeconds,Number.isFinite(audio.duration)?audio.duration:clip.trimEndSeconds)}))});
  const mute=()=>{const covered=!!audibleClip(resolved(),video.currentTime);const muted=!latest.current.loaded||latest.current.muted||!!current.originalMuted||covered;if(video.muted!==muted)video.muted=muted;};
  const pause=()=>layers.forEach(({audio})=>audio.pause());
  const sync=(force=false)=>{
   if(disposed)return;
   const active=audibleClip(resolved(),video.currentTime);mute();
   if(video.volume!==latest.current.volume)video.volume=latest.current.volume;
   for(const layer of layers){const {clip,audio}=layer;
    if(audio.volume!==latest.current.volume)audio.volume=latest.current.volume;
    if(audio.muted!==latest.current.muted)audio.muted=latest.current.muted;
    if(audio.playbackRate!==video.playbackRate)audio.playbackRate=video.playbackRate;
    if(active?.id!==clip.id){audio.pause();continue;}
    const at=video.currentTime-clip.startSeconds+clip.trimStartSeconds;
    if(audio.readyState>=1&&(force||Math.abs(audio.currentTime-at)>.06))audio.currentTime=Math.max(0,at);
    if(video.paused||video.ended||video.seeking||waiting||!latest.current.loaded){audio.pause();continue;}
    if(audio.paused&&!layer.pending&&!layer.failed){layer.pending=true;void audio.play().then(()=>{if(disposed||video.paused||audibleClip(resolved(),video.currentTime)?.id!==clip.id)audio.pause();}).catch(()=>{if(!disposed){layer.failed=true;video.pause();setError('No se pudo reproducir el audio importado / Imported audio unavailable.');}}).finally(()=>{layer.pending=false;});}
   }
  };
  const tick=()=>{sync();frame=requestAnimationFrame(tick);};
  const seek=()=>sync(true);
  const play=()=>{layers.forEach(l=>{l.failed=false;});waiting=false;setError('');sync(true);};
  const wait=()=>{waiting=true;pause();};const resume=()=>{waiting=false;sync(true);};
  const failures=new Map<HTMLAudioElement,()=>void>();
  for(const {audio,clip} of layers)failures.set(audio,()=>{if(audibleClip(resolved(),video.currentTime)?.id!==clip.id)return;video.pause();setError('No se pudo cargar el audio importado / Imported audio unavailable.');});
  const events={volumechange:mute,play,pause,seeking:pause,seeked:seek,ratechange:seek,waiting:wait,playing:resume,ended:pause};
  for(const [event,handler] of Object.entries(events))video.addEventListener(event,handler);
  for(const {audio} of layers){audio.addEventListener('loadedmetadata',seek);audio.addEventListener('error',failures.get(audio)!);}
  sync(true);frame=requestAnimationFrame(tick);
  return()=>{disposed=true;cancelAnimationFrame(frame);for(const [event,handler] of Object.entries(events))video.removeEventListener(event,handler);for(const {audio} of layers){audio.removeEventListener('loadedmetadata',seek);audio.removeEventListener('error',failures.get(audio)!);audio.pause();audio.removeAttribute('src');audio.load();}video.muted=latest.current.muted;};
 },[element,configuration,options.enabled]);
 useEffect(()=>{if(element&&options.enabled!==false&&(settings.selected==='original'||!audioClips(settings).length))element.muted=!options.loaded||options.muted||!!settings.originalMuted;},[element,settings,options.loaded,options.muted,options.enabled]);
 return error;
}
