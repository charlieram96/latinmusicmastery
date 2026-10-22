'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/components/language-provider'

export interface LessonScreen { start:number; end:number; title:string; kind:string }
interface ManualNavigation {
 position:number
 index:number
 attach:(video:HTMLVideoElement|null)=>void
 next:()=>void
}
const Context=createContext<ManualNavigation|null>(null)
export const useManualLessonNavigation=()=>useContext(Context)

/** Keep audio/notation playback inside one authored screen. Only navigation changes screens. */
export function ManualLessonNavigation({steps,children,onComplete}:{steps:LessonScreen[];children:ReactNode;onComplete:()=>void}) {
 const {locale}=useTranslation(),es=locale==='es'
 const [video,attach]=useState<HTMLVideoElement|null>(null)
 const [index,setIndex]=useState(0),[position,setPosition]=useState(0)
 const selected=useRef(0)
 const go=(next:number)=>{
  if(next>=steps.length){video?.pause();onComplete();return}
  const n=Math.max(0,next),screen=steps[n]
  selected.current=n;setIndex(n)
  // Skip the short fade-in so a paused screen is fully readable.
  const time=screen.start+Math.min(.45,(screen.end-screen.start)/2)
  setPosition(time)
  if(video){video.pause();video.currentTime=time}
 }
 useEffect(()=>{
  if(!video||!steps.length)return
  let raf=0, internalSeek:number|null=null
  const seek=()=>{
   if(internalSeek!==null&&Math.abs(video.currentTime-internalSeek)<.001){internalSeek=null;return}
   internalSeek=null
   const n=Math.max(0,steps.findIndex(s=>video.currentTime>=s.start&&video.currentTime<s.end))
   selected.current=n;setIndex(n);setPosition(video.currentTime)
  }
  const stopAtBoundary=()=>{
   const screen=steps[selected.current]
   if(screen&&video.currentTime>=screen.end-.08){video.pause();internalSeek=Math.max(screen.start,screen.end-.12);video.currentTime=internalSeek;return}
   if(!video.paused)raf=requestAnimationFrame(stopAtBoundary)
  }
  const play=()=>{
   const screen=steps[selected.current]
   if(video.currentTime>=screen.end-.15)video.currentTime=screen.start+.45
   cancelAnimationFrame(raf);raf=requestAnimationFrame(stopAtBoundary)
  }
  const pause=()=>cancelAnimationFrame(raf)
  video.addEventListener('seeking',seek);video.addEventListener('play',play);video.addEventListener('pause',pause)
  const checkBoundary=()=>{if(!video.paused&&video.currentTime>=steps[selected.current].end-.08){video.pause();internalSeek=steps[selected.current].end-.12;video.currentTime=internalSeek}}
  video.addEventListener('timeupdate',checkBoundary)
  return()=>{cancelAnimationFrame(raf);video.pause();video.removeEventListener('seeking',seek);video.removeEventListener('play',play);video.removeEventListener('pause',pause);video.removeEventListener('timeupdate',checkBoundary)}
 },[video,steps])
 return <Context.Provider value={{position,index,attach,next:()=>go(selected.current+1)}}>
  {children}
  <nav aria-label={es?'Pantallas de la lección':'Lesson screens'} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
   <Button variant="outline" disabled={index===0} onClick={()=>go(index-1)}>{es?'← Anterior':'← Previous'}</Button>
   <span className="text-sm text-muted-foreground" role="status">{index+1} / {steps.length} · {steps[index]?.title}</span>
   <Button onClick={()=>go(index+1)}>{index===0?(es?'Empezar →':'Start →'):index===steps.length-1?(es?'Siguiente: ejercicio →':'Next: exercise →'):(es?'Siguiente →':'Next →')}</Button>
  </nav>
 </Context.Provider>
}

/** Bind the existing shared player; no alternate or reduced player is introduced. */
export function useManualLessonMedia(ref:RefObject<HTMLVideoElement|null>) {
 const manual=useManualLessonNavigation()
 const attach=manual?.attach
 useEffect(()=>{attach?.(ref.current)},[attach,ref])
 return manual
}
