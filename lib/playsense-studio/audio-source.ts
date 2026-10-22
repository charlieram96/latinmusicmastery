import type { WaveformPeaks } from './waveform';
export type AudioSourcePart = 'watch' | 'exercise';
export interface AudioClip {
 id: string;
 url: string;
 name: string;
 startSeconds: number;
 trimStartSeconds: number;
 trimEndSeconds: number;
 durationSeconds: number;
 muted: boolean;
}
export interface AudioSourceSettings {
 originalMuted?: boolean;
 clips?: AudioClip[];
 /** Retained assets allow local layer undo without deleting uploaded files. */
 assets?: AudioClip[];

 selected: 'original' | 'imported';
 url?: string;
 name?: string;
 /** Positive values start the imported audio later on the video's clock. */
 offsetSeconds: number;
}
export const ORIGINAL_AUDIO: AudioSourceSettings = {selected:'original',offsetSeconds:0};
export function audioTimeAt(videoSeconds:number,offsetSeconds:number){return videoSeconds-offsetSeconds;}
/** Analysis and display use the same video clock as playback, including silence at either edge. */
export function audioPeaksOnVideo(peaks:WaveformPeaks,offset:number,duration:number):WaveformPeaks{
 if(!duration||duration<=0)return peaks;
 const count=Math.min(600000,Math.max(1,Math.ceil(duration*peaks.bucketCount/Math.max(.001,peaks.durationSeconds))));
 const data=new Array<number>(count*2).fill(0);
 for(let i=0;i<count;i++){
  const source=Math.floor(audioTimeAt(i*duration/count,offset)/peaks.durationSeconds*peaks.bucketCount);
  if(source>=0&&source<peaks.bucketCount){data[2*i]=peaks.data[2*source];data[2*i+1]=peaks.data[2*source+1];}
 }
 return {...peaks,durationSeconds:duration,bucketCount:count,data,hits:peaks.hits?.map(t=>t+offset).filter(t=>t>=0&&t<=duration)};
}

/** Old whole-file replacements keep working until their first edit. */
export function audioClips(settings: AudioSourceSettings): AudioClip[] {
 if(settings.clips) return settings.clips;
 return settings.url ? [{id:'legacy',url:settings.url,name:settings.name??'Audio',startSeconds:Math.max(0,settings.offsetSeconds),trimStartSeconds:Math.max(0,-settings.offsetSeconds),trimEndSeconds:Infinity,durationSeconds:Infinity,muted:false}] : [];
}
export function clipEnd(clip:AudioClip){return clip.startSeconds+clip.trimEndSeconds-clip.trimStartSeconds;}
/** Last placed layer wins on overlaps; muting it reveals the original, not a hidden layer. */
export function coveringClip(settings:AudioSourceSettings,time:number):AudioClip|undefined {
 if(settings.selected!=='imported')return;
 return [...audioClips(settings)].reverse().find(c=>time>=c.startSeconds&&time<clipEnd(c));
}
export function audibleClip(settings:AudioSourceSettings,time:number){const clip=coveringClip(settings,time);return clip&&!clip.muted?clip:undefined;}
export function mixAudioPeaks(original:WaveformPeaks,settings:AudioSourceSettings,layers:Map<string,WaveformPeaks>):WaveformPeaks {
 const data=[...original.data];const clips=audioClips(settings);
 for(let i=0;i<original.bucketCount;i++){
  const time=i*original.durationSeconds/original.bucketCount;const clip=audibleClip(settings,time);if(!clip){if(settings.originalMuted){data[2*i]=0;data[2*i+1]=0;}continue;}
  const peaks=layers.get(clip.id);if(!peaks)continue;
  const at=time-clip.startSeconds+clip.trimStartSeconds;
  const j=Math.floor(at/peaks.durationSeconds*peaks.bucketCount);
  if(j>=0&&j<peaks.bucketCount){data[2*i]=peaks.data[2*j];data[2*i+1]=peaks.data[2*j+1];}
 }
 const hits=(settings.originalMuted?[]:original.hits??[]).filter(t=>!audibleClip(settings,t));
 for(const clip of clips){for(const t of layers.get(clip.id)?.hits??[]){const at=t-clip.trimStartSeconds+clip.startSeconds;if(at>=0&&at<=original.durationSeconds&&audibleClip(settings,at)?.id===clip.id)hits.push(at);}}
 return {...original,data,hits:hits.sort((a,b)=>a-b)};
}
