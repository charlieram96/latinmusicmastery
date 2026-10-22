'use client'
import {BOOK_SOUND_STOP,publishBookPlayback} from '@/lib/solfeo/book-playback'
import {useCallback,useEffect,useRef,useState} from 'react'
export interface DemonstrationSettings {bpm?:number;metronome?:boolean;countInBars?:0|1|2;onDemoStart?:()=>void;beatsPerBar?:number}
/** Notes and clicks are scheduled on one AudioContext clock, never separate intervals. */
export function useNoteDemonstration({bpm=100,metronome=true,countInBars=1,onDemoStart,volume=.7,beatsPerBar=4}:DemonstrationSettings&{volume?:number}){
 const audio=useRef<AudioContext|null>(null),voices=useRef<OscillatorNode[]>([]),timers=useRef<ReturnType<typeof setTimeout>[]>([]),generation=useRef(0),ownsPlayback=useRef(false)
 const [active,setActive]=useState<number|null>(null),[playing,setPlaying]=useState(false),[count,setCount]=useState(0),[beatNumber,setBeatNumber]=useState(0)
 const stop=useCallback(()=>{if(ownsPlayback.current){ownsPlayback.current=false;publishBookPlayback({playing:false,beat:0,beatsPerBar:4,count:0})}generation.current++;timers.current.forEach(clearTimeout);timers.current=[];voices.current.forEach(v=>{try{v.stop()}catch{}});voices.current=[];setPlaying(false);setCount(0);setBeatNumber(0);setActive(null)},[])
 useEffect(()=>{stop();return stop},[bpm,metronome,countInBars,stop])
 useEffect(()=>{window.addEventListener('lmm-book-sound-start',stop);return()=>{window.removeEventListener('lmm-book-sound-start',stop);const previous=audio.current;audio.current=null;void previous?.close()}},[stop])
 async function play(notes:Array<{frequency?:number;beats:number;index:number}>,options:{preview?:boolean;minimumBeats?:number}={}){
  stop();window.dispatchEvent(new Event(BOOK_SOUND_STOP));onDemoStart?.();const id=generation.current,ctx=audio.current&&audio.current.state!=='closed'?audio.current:new AudioContext();audio.current=ctx;await ctx.resume();if(id!==generation.current)return
  const beat=60/bpm,start=ctx.currentTime+.03,precount=options.preview?0:beatsPerBar;let cursor=precount*beat
  const tone=(frequency:number,at:number,length:number,gainValue:number,type:OscillatorType)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.value=frequency;g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(gainValue*volume,at+Math.min(.01,length/4));g.gain.setValueAtTime(gainValue*volume,at+length*.8);g.gain.linearRampToValueAtTime(0,at+length);o.connect(g);g.connect(ctx.destination);o.start(at);o.stop(at+length);voices.current.push(o);o.onended=()=>{o.disconnect();g.disconnect()}}
  const later=(fn:()=>void,seconds:number)=>timers.current.push(setTimeout(fn,Math.max(0,seconds*1000)))
  setPlaying(true);ownsPlayback.current=!options.preview
  if(ownsPlayback.current)publishBookPlayback({playing:true,beat:1,beatsPerBar,count:precount})
  for(const n of notes){if(n.frequency)tone(n.frequency,start+cursor,n.beats*beat*.92,.17,'triangle');later(()=>setActive(n.index),.03+cursor);cursor+=n.beats*beat}
  cursor=Math.max(cursor,(precount+(options.minimumBeats??0))*beat)
  for(let i=0;i<cursor/beat-1e-8;i++){if(!options.preview)tone(i%beatsPerBar===0?1400:1000,start+i*beat,.04,.08,'sine');if(i<precount)later(()=>setCount(precount-i),.03+i*beat);if(!options.preview)later(()=>{setBeatNumber(i<precount?0:(i-precount)%beatsPerBar+1);publishBookPlayback({playing:true,beat:i%beatsPerBar+1,beatsPerBar,count:i<precount?precount-i:0})},.03+i*beat)}
  later(()=>setCount(0),.03+precount*beat);later(stop,.03+cursor)
 }
 return {active,playing,count,beatNumber,play,stop}
}
