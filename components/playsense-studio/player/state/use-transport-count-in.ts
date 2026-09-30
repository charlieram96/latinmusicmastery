'use client';
import {useCallback, useEffect, useRef, useState} from 'react';
import {ClickTrack} from '@/lib/playsense-studio/click-track';

/** Audible count-in on the audio clock. Media stays paused until the downbeat.
 * Cancellation invalidates even a pending AudioContext.resume(). */
export function useTransportCountIn() {
 const [remaining,setRemaining]=useState(0);
 const [error,setError]=useState('');
 const engine=useRef<ClickTrack|null>(null), timer=useRef<ReturnType<typeof setInterval>|null>(null), token=useRef(0);
 const cancel=useCallback(()=>{token.current++;if(timer.current)clearInterval(timer.current);timer.current=null;engine.current?.teardown();setRemaining(0);},[]);
 useEffect(()=>()=>{token.current++;if(timer.current)clearInterval(timer.current);engine.current?.close();},[]);
 const start=async (options:{bpm:number;denominator:number;beats:number;bars:number;volume:number},done:()=>void)=>{
  cancel();setError('');
  if(!options.bars){done();return;}
  const id=token.current, total=options.beats*options.bars;
  const beatSeconds=60/options.bpm*4/options.denominator;
  if(!(beatSeconds>0)||!Number.isFinite(beatSeconds))return;
  setRemaining(total);
  try {
   const click=engine.current??(engine.current=new ClickTrack());const ctx=click.ensureContext();
   if(ctx.state!=='running')await ctx.resume();
   if(id!==token.current)return;
   if(ctx.state!=='running')throw new Error('Audio unavailable');
   const lead=.06, origin=ctx.currentTime+lead;
   click.setVolume(options.volume);click.setGrid(Array.from({length:total},(_,i)=>i*beatSeconds));click.start(-lead,1);
   timer.current=setInterval(()=>{
    if(id!==token.current)return;
    const elapsed=ctx.currentTime-origin;
    if(elapsed>=total*beatSeconds){cancel();done();}
    else setRemaining(Math.max(1,total-Math.max(0,Math.floor(elapsed/beatSeconds))));
   },8);
  }catch{if(id===token.current){cancel();setError('Unable to start audio. Press Play to retry.');}}
 };
 return {remaining,start,cancel,error};
}
