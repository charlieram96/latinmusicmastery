'use client';
import {lessonAudioTracks} from '@/lib/audio/lesson-audio';
import {useDubbedAudio} from '@/components/class-viewer/lesson-viewer/use-dubbed-audio';
import { ExerciseVideoGuidance } from '../shared/exercise-video-guidance';
import {AudioWaveformLabel} from '../shared/audio-waveform-label';
import {useAudioSource,useSelectedAudio} from '../shared/use-audio-source';
import {AudioSourceControls,OriginalAudioMute} from '../shared/audio-source-controls';
import {analyzeAudioLayers} from '@/lib/playsense-studio/audio-layer-analysis';
import { SOBAO_EFFECTS_ITEM_ID, SOBAO_EFFECTS_TITLE } from '@/lib/playsense-studio/video-preview-cues';
import { EffectsPlayer, VideoEffectsPreview } from './video-effects-preview';
import { VideoWatermark } from '@/components/playsense-studio/shared/video-watermark';
import { LessonPresentationOverlay } from '@/components/playsense-studio/shared/lesson-presentation';
import { lessonPresentationFor } from '@/lib/playsense-studio/lesson-presentation';
import {useEffect,useMemo,useRef,useState} from 'react';
import {getLessonMetronome,saveLessonMetronome} from '@/app/actions/playsense-studio';
import {createClient} from '@/lib/supabase/client';
import {lessonMetronomeGrid,type LessonMetronome} from '@/lib/playsense-studio/lesson-metronome';
import type {WaveformPeaks} from '@/lib/playsense-studio/waveform';
import {useVideoClickTrack} from '../player/state/use-video-click-track';
import {WaveformCanvas} from '../sync/waveform-canvas';
import {useTranslation} from '@/components/language-provider';
import {useStudioText} from './use-studio-text';
export function LessonMetronomeEditor({classItemId,videoUrl,durationSeconds,title,scoreStarts=[],onSaved}:{classItemId:string;videoUrl:string|null;durationSeconds:number|null;title?:string;scoreStarts?:number[];onSaved?:(settings:LessonMetronome)=>void}) {
 const {locale}=useTranslation();
 const hasEffects=classItemId===SOBAO_EFFECTS_ITEM_ID;
 const st=useStudioText();const videoRef=useRef<HTMLVideoElement>(null);const area=useRef<HTMLDivElement>(null);
 const audioSource=useAudioSource(classItemId,'watch',videoUrl);
 const [audioVolume,setAudioVolume]=useState(1);
 const dubbed=useDubbedAudio(videoRef,hasEffects||audioSource.settings.selected==='imported'?[]:lessonAudioTracks(videoUrl??''),audioVolume,!!audioSource.settings.originalMuted||!audioSource.loaded,locale);
 const audioError=useSelectedAudio(videoRef,audioSource.settings,{volume:audioVolume,muted:dubbed.language!=='original',loaded:audioSource.loaded,enabled:!hasEffects});
 const [settings,setSettings]=useState<LessonMetronome>({bpm:120,anchorSeconds:null});
 const [bpm,setBpm]=useState('120');const [candidate,setCandidate]=useState<number|null>(null);const [placing,setPlacing]=useState(false);
 const [enabled,setEnabled]=useState(true);const [volume,setVolume]=useState(.2);const [duration,setDuration]=useState(durationSeconds??0);
 const [originalPeaks,setOriginalPeaks]=useState<WaveformPeaks|null>(null);
 const [peaks,setPeaks]=useState<WaveformPeaks|null>(null);const [width,setWidth]=useState(800);const [zoom,setZoom]=useState(1);const [scroll,setScroll]=useState(0);
 const [loaded,setLoaded]=useState(false);const [saving,setSaving]=useState(false);const [error,setError]=useState('');const [waveError,setWaveError]=useState(false);
 useEffect(()=>{let alive=true;void getLessonMetronome(classItemId).then(result=>{if(!alive)return;if(result.data){setSettings(result.data);setBpm(String(result.data.bpm));setLoaded(true);}else setError(result.error??'Unable to load metronome');});return()=>{alive=false;};},[classItemId]);
 useEffect(()=>{if(!audioSource.sourceUrl||!audioSource.loaded)return;let alive=true;setPeaks(null);setWaveError(false);void import('@/lib/playsense-studio/waveform-decode').then(m=>m.loadOrComputePeaks(classItemId,audioSource.sourceUrl!,createClient())).then(p=>{setOriginalPeaks(p);return analyzeAudioLayers(p,audioSource.settings);}).then(p=>{if(alive)setPeaks(p);}).catch(()=>{if(alive)setWaveError(true);});return()=>{alive=false;};},[classItemId,audioSource.sourceUrl,audioSource.loaded,audioSource.settings,durationSeconds,duration]);
 useEffect(()=>{const el=area.current;if(!el)return;const observer=new ResizeObserver(()=>setWidth(el.clientWidth));observer.observe(el);setWidth(el.clientWidth);return()=>observer.disconnect();},[]);
 const grid=useMemo(()=>lessonMetronomeGrid(settings,duration,scoreStarts),[settings,duration,scoreStarts]);
 useVideoClickTrack({videoRef,grid,enabled:enabled&&loaded,volume});
 const pps=width/Math.max(1,duration)*zoom;
 const choose=(seconds:number)=>{const at=Math.max(0,Math.min(duration,seconds));if(videoRef.current)videoRef.current.currentTime=at;if(placing)setCandidate(at);};
 const confirm=async()=>{const anchor=candidate??settings.anchorSeconds;const tempo=Number(bpm);if(anchor===null||!Number.isFinite(tempo)||tempo<20||tempo>400)return;setSaving(true);setError('');const result=await saveLessonMetronome({classItemId,bpm:tempo,anchorSeconds:anchor});setSaving(false);if(result.error){setError(result.error);return;}setSettings({bpm:tempo,anchorSeconds:anchor});onSaved?.({bpm:tempo,anchorSeconds:anchor});setCandidate(null);setPlacing(false);};
 return <section className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-5">

  {dubbed.error&&<p role="status">{locale==='es'?'Doblaje no disponible. Se restauró el original.':'Dub unavailable. Original audio restored.'}</p>}
  {audioError&&<p role="alert">{audioError}</p>}
  {!hasEffects&&audioSource.settings.selected==='imported'&&<label className="flex items-center gap-2 text-xs">{locale==='es'?'Volumen del audio importado':'Imported audio volume'}<input type="range" min="0" max="1" step=".01" value={audioVolume} onChange={e=>setAudioVolume(Number(e.target.value))}/></label>}
  {videoUrl && !hasEffects && <div className="flex justify-end"><VideoEffectsPreview audioSourceItemId={classItemId} title={classItemId === SOBAO_EFFECTS_ITEM_ID ? SOBAO_EFFECTS_TITLE : title ?? st('Exercise')} videoUrl={videoUrl} showSobao={classItemId === SOBAO_EFFECTS_ITEM_ID} onOpen={()=>videoRef.current?.pause()} /></div>}
  {videoUrl && hasEffects ? <EffectsPlayer audioSourceItemId={classItemId} key={videoUrl} videoUrl={videoUrl} es={locale==='es'} showSobao title={SOBAO_EFFECTS_TITLE} videoRef={videoRef} onDuration={setDuration} preview={false} bpm={settings.bpm} anchorSeconds={settings.anchorSeconds ?? 0} /> : <div className="relative">  <video controlsList="nodownload noremoteplayback" disablePictureInPicture disableRemotePlayback onContextMenu={event => event.preventDefault()} ref={videoRef} src={videoUrl??undefined} poster={videoUrl ? lessonPresentationFor(videoUrl)?.poster : undefined} controls playsInline preload="metadata" onLoadedMetadata={()=>setDuration(videoRef.current?.duration||durationSeconds||0)} className="mx-auto max-h-[45vh] w-full rounded-xl bg-black"/><ExerciseVideoGuidance key={videoUrl} watch itemId={classItemId} videoRef={videoRef} /><VideoWatermark nativeControls />{videoUrl && <LessonPresentationOverlay src={videoUrl} />}</div>}
  <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
   <button type="button" className="st-chip" aria-pressed={enabled} onClick={()=>setEnabled(!enabled)}>{st('Metronome')} {enabled?'✓':''}</button>
   <label className="flex items-center gap-2">BPM<input aria-label="Metronome BPM" type="number" min={20} max={400} value={bpm} onChange={e=>setBpm(e.target.value)} className="st-input w-20"/></label>
   <input aria-label={st('Metronome volume')} type="range" min={0} max={1} step={.05} value={volume} onChange={e=>setVolume(Number(e.target.value))}/>
   <button type="button" className="st-chip" aria-pressed={placing} disabled={!loaded||!duration} onClick={()=>{setPlacing(!placing);setCandidate(null);}}>{st('Place metronome at playhead')}</button>
   <button type="button" className="st-btn-primary" disabled={!loaded||saving||(candidate===null&&settings.anchorSeconds===null)||!Number.isFinite(Number(bpm))||Number(bpm)<20||Number(bpm)>400} onClick={()=>void confirm()}>{st(saving?'Saving…':'Confirm metronome')}</button>
   <label className="flex items-center gap-2">{st('Zoom')}<input aria-label="Waveform zoom" type="range" min={1} max={20} step={.5} value={zoom} onChange={e=>{setZoom(Number(e.target.value));setScroll(0);}}/></label>
  </div>
  <p className="text-sm text-muted-foreground" role="status">{placing?st('Click the video waveform to choose the first beat, then confirm.'):settings.anchorSeconds===null?st('Default: 120 BPM. Place and confirm the first beat.'): `${st('First beat')}: ${settings.anchorSeconds.toFixed(3)} s · ${settings.bpm} BPM`}{candidate!==null?` · ${st('Preview')}: ${candidate.toFixed(3)} s`:''}</p>
  {error&&<p role="alert" className="text-destructive">{error}</p>}
  <div ref={area} className="min-w-0 rounded-xl border border-border">
   <div className="flex items-center gap-3 px-3 py-1"><AudioWaveformLabel source="original"/><OriginalAudioMute audio={audioSource}/></div>
   <WaveformCanvas peaks={originalPeaks} durationSeconds={duration} handles={[]} noteTicks={[]} showNotes={false} tailVideoTimeSeconds={duration} pixelsPerSecond={pps} scrollLeftPx={scroll} dragAll={false} selected={null} height={180} getCurrentSeconds={()=>videoRef.current?.currentTime??0} onSeek={choose} onSelect={()=>{}} onMarkerDrag={()=>{}} onTailDrag={()=>{}} onDragEnd={()=>{}} onViewportWidth={setWidth} onScrollByPx={dx=>setScroll(s=>Math.max(0,Math.min(Math.max(0,duration*pps-width),s+dx)))} markersLocked metronomeAnchorSeconds={candidate??settings.anchorSeconds}/>
  </div>
  <AudioSourceControls audio={audioSource} waveformHeight={180} duration={duration} getPlayhead={()=>videoRef.current?.currentTime??0} timeline={{pps,scrollLeft:scroll,toTimeline:t=>t,toMedia:t=>t}}/>
  {zoom>1&&<input aria-label="Waveform scroll" type="range" min={0} max={Math.max(0,duration*pps-width)} value={scroll} onChange={e=>setScroll(Number(e.target.value))}/>}
  {!peaks&&<p className="text-xs text-muted-foreground">{st(waveError?'Audio analysis unavailable. You can still place the beat on the timeline.':'Analyzing video audio…')}</p>}
  <p className="text-xs text-muted-foreground">{st('The confirmed beat stays fixed until the next placed score. BPM changes keep the same first beat.')}</p>
 </section>;
}
