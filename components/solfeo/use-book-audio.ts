'use client'
import {bookAudioTimeline,bookAudioSections} from '@/lib/solfeo/book-audio-timeline'
import {useEffect,useRef,useState,useCallback} from 'react'
import {BOOK_SOUND_STOP,publishBookPlayback,type BookPulse} from '@/lib/solfeo/book-playback'
export type BookAudio={duration:number;bpm:number;completeScore?:boolean;stops?:number[];pulses?:BookPulse[];events:{frequency:number;start:number;duration:number;gain:number;visualIndex:number;pitch:string;vectorId?:string}[]}
export function useBookAudio(volume=.7,onStart?:()=>void,targetBpm?:number){
 const context=useRef<AudioContext|null>(null),voices=useRef<OscillatorNode[]>([]),frame=useRef(0),generation=useRef(0),ownsPlayback=useRef(false),selection=useRef({source:null as BookAudio|null,vectorId:"",index:0})
 const completion=useRef<null|{at:number;advance:()=>void}>(null)
 const [playing,setPlaying]=useState(false),[active,setActive]=useState<number[]>([]),[error,setError]=useState(false),[count,setCount]=useState(0),[section,setSection]=useState(0),[sectionCount,setSectionCount]=useState(1)
 const stop=useCallback(()=>{const pending=completion.current;completion.current=null;if(pending&&context.current&&context.current.currentTime>=pending.at)pending.advance();generation.current++;cancelAnimationFrame(frame.current);for(const v of voices.current)try{v.stop()}catch{}voices.current=[];setPlaying(false);setActive([]);setCount(0);if(ownsPlayback.current){ownsPlayback.current=false;publishBookPlayback({playing:false,beat:0,beatsPerBar:4,count:0})}},[])
 useEffect(()=>{window.addEventListener(BOOK_SOUND_STOP,stop);return()=>{window.removeEventListener(BOOK_SOUND_STOP,stop);stop();void context.current?.close()}},[stop])
 async function play(source:BookAudio,vectorId:string){
  if(selection.current.source!==source||selection.current.vectorId!==vectorId)selection.current={source,vectorId,index:0}
  const sections=bookAudioSections(source,vectorId),index=selection.current.index%Math.max(1,sections.length)
  setSection(index);setSectionCount(sections.length)
  const {score,origin,precount,clicks}=bookAudioTimeline(sections[index]??source,targetBpm)
  stop();window.dispatchEvent(new Event(BOOK_SOUND_STOP));onStart?.();const id=generation.current
  try{const ctx=context.current??new AudioContext();context.current=ctx;await ctx.resume();if(id!==generation.current)return;setError(false)
   const start=ctx.currentTime+.04
   const tone=(frequency:number,at:number,length:number,gain:number,type:OscillatorType)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.value=frequency;g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(Math.min(.3,gain)*volume,at+Math.min(.008,length/4));g.gain.setValueAtTime(Math.min(.3,gain)*volume,at+length*.8);g.gain.linearRampToValueAtTime(0,at+length);o.connect(g);g.connect(ctx.destination);o.start(at);o.stop(at+length);voices.current.push(o);o.onended=()=>{o.disconnect();g.disconnect()}}
   for(const e of score.events)tone(e.frequency,start+precount+e.start-origin,e.duration,e.gain,'triangle')

   for(const p of clicks)tone(p.beat===1?1400:1000,start+p.start,.04,.08,'sine')
   // Audio completion must not depend on animation frames (hidden tabs throttle them).
   const end=start+precount+score.duration-origin
   completion.current={at:end,advance:()=>{selection.current.index=(index+1)%Math.max(1,sections.length);setSection(selection.current.index)}}
   const marker=ctx.createOscillator(),silent=ctx.createGain();silent.gain.setValueAtTime(0,start);marker.connect(silent);silent.connect(ctx.destination)
   marker.onended=()=>{marker.disconnect();silent.disconnect();if(id===generation.current)stop()}
   marker.start(start);marker.stop(end);voices.current.push(marker)
   setPlaying(true);ownsPlayback.current=true;let previous=-1
   const tick=()=>{if(id!==generation.current)return;const elapsed=ctx.currentTime-start,t=elapsed-precount+origin;if(t>=score.duration){stop();return}const pulse=clicks.findLastIndex(p=>p.start<=elapsed);if(pulse!==previous||previous===-1){previous=pulse;const p=clicks[Math.max(0,pulse)];setCount(p.count);publishBookPlayback({playing:true,beat:p.beat,beatsPerBar:p.beatsPerBar,count:p.count})}setActive(elapsed<precount?[]:score.events.filter(e=>(!e.vectorId||e.vectorId===vectorId)&&t>=e.start&&t<e.start+e.duration).map(e=>e.visualIndex));frame.current=requestAnimationFrame(tick)};tick()
  }catch{stop();setError(true)}
 }
 return {playing,active,play,stop,error,count,section,sectionCount}
}
