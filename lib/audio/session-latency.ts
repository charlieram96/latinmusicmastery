import type { LiveAudioInput } from './live-audio-input'
import type { LoopbackResult } from './loopback-latency'
type Entry={stream:MediaStream;epoch:number;route:string;previous:number|null;ms:number|null}
const entries=new WeakMap<AudioContext,Entry>()
let epoch=0,watching=false
function watch(){
 if(!watching && typeof navigator!=='undefined' && navigator.mediaDevices?.addEventListener){
   navigator.mediaDevices.addEventListener('devicechange',()=>{epoch++});watching=true
 }
}
// Latency estimates are measurements, not device identity. They can fluctuate
// on the same route; exact floating-point equality silently invalidated calibration.
function route(ctx:AudioContext){return JSON.stringify([(ctx as AudioContext & {sinkId?:string}).sinkId??'default',ctx.sampleRate])}
/** Only direct acoustic loopback measurements may enter this registry, never claps. */
export function recordSessionLatency(live:LiveAudioInput,result:LoopbackResult){
 watch()
 let entry=entries.get(live.context)
 if(!entry || entry.stream!==live.stream || entry.epoch!==epoch || entry.route!==route(live.context)){
   entry={stream:live.stream,epoch,route:route(live.context),previous:null,ms:null};entries.set(live.context,entry)
 }
 const ms=result.medianMs
 const valid=result.reliable && result.detected===result.total && Number.isFinite(ms) && ms!==null && ms>=0 && ms<=500
 const previous=entry.previous
 entry.ms=null // An unstable repeat invalidates any older compensation.
 entry.previous=valid?ms:null
 if(valid && previous!==null && Math.abs(ms-previous)<=10)entry.ms=(ms+previous)/2
 return entry.ms
}
export function sessionLatencyMs(live:LiveAudioInput|null|undefined):number|null{
 if(!live || live.context.state==='closed' || !live.stream.active)return null
 const e=entries.get(live.context)
 return e && e.stream===live.stream && e.epoch===epoch && e.route===route(live.context)?e.ms:null
}
