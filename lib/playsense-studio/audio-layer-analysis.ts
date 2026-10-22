import {audioClips,mixAudioPeaks,type AudioSourceSettings} from './audio-source';
import type {WaveformPeaks} from './waveform';
const cache=new Map<string,Promise<WaveformPeaks>>();
export async function clipPeaks(url:string){
 let pending=cache.get(url);
 if(!pending){pending=import('./waveform-decode').then(m=>m.decodeVideoPeaks(url));cache.set(url,pending);pending.catch(()=>cache.delete(url));}
 return pending;
}
export async function analyzeAudioLayers(original:WaveformPeaks,settings:AudioSourceSettings){
 const layers=new Map<string,WaveformPeaks>();
 if(settings.selected==='imported')await Promise.all(audioClips(settings).filter(c=>!c.muted).map(async c=>layers.set(c.id,await clipPeaks(c.url))));
 return mixAudioPeaks(original,settings,layers);
}
export function audioFileDuration(file:File):Promise<number>{
 return new Promise((resolve,reject)=>{
  const url=URL.createObjectURL(file);const audio=new Audio();
  const cleanup=()=>{clearTimeout(timer);audio.removeAttribute('src');audio.load();URL.revokeObjectURL(url);};
  const timer=setTimeout(()=>{cleanup();reject(new Error('No se pudo leer el audio / Cannot read audio'));},15000);
  audio.onloadedmetadata=()=>{const d=audio.duration;cleanup();if(Number.isFinite(d)&&d>0)resolve(d);else reject(new Error('Duración de audio inválida / Invalid audio duration'));};
  audio.onerror=()=>{cleanup();reject(new Error('Formato de audio no compatible / Unsupported audio'));};
  audio.preload='metadata';audio.src=url;
 });
}
