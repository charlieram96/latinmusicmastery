import type {BookAudio} from '@/components/solfeo/use-book-audio'
/** A single count-in precedes musical time zero, including any written rests. */
export function bookAudioTimeline(source:BookAudio,targetBpm=source.bpm){
 const ratio=source.bpm/targetBpm,beat=60/targetBpm
 const score={...source,bpm:targetBpm,duration:source.duration*ratio,events:source.events.map(e=>({...e,start:e.start*ratio,duration:e.duration*ratio})),pulses:source.pulses?.map(p=>({...p,start:p.start*ratio,beatSeconds:p.beatSeconds*ratio}))}
 const pulses=score.pulses?.length?score.pulses:Array.from({length:Math.ceil(score.duration/beat)},(_,i)=>({start:i*beat,beat:i%4+1,beatsPerBar:4,beatSeconds:beat}))
 const first=pulses[0],origin=first.start,precount=first.beatsPerBar*first.beatSeconds
 const clicks=[...Array.from({length:first.beatsPerBar},(_,i)=>({start:i*first.beatSeconds,beat:i+1,beatsPerBar:first.beatsPerBar,count:first.beatsPerBar-i})),...pulses.map(p=>({...p,start:precount+p.start-origin,count:0}))]
 return {score,origin,precount,clicks}
}

/** Keep complete measures (including trailing rests) up to the authored double bar. */
export function bookAudioSections(source:BookAudio,vectorId:string){
 const ends=[...new Set([...(source.stops??[]),source.duration])].filter(t=>t>0&&t<=source.duration).sort((a,b)=>a-b)
 let start=0
 return ends.map(end=>{const from=start;start=end;return {from,end}}).filter(({from,end})=>!source.completeScore||source.events.some(e=>e.start>=from&&e.start<end&&(!e.vectorId||e.vectorId===vectorId))).map(({from,end})=>({
  ...source,stops:undefined,duration:end-from,
  events:source.events.filter(e=>e.start>=from-1e-8&&e.start<end-1e-8).map(e=>({...e,start:Math.max(0,e.start-from),duration:Math.min(e.duration,end-e.start)})),
  pulses:source.pulses?.filter(p=>p.start>=from-1e-8&&p.start<end-1e-8).map(p=>({...p,start:Math.max(0,p.start-from)})),
 }))
}
