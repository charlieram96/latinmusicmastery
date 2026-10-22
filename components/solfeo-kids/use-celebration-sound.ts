'use client'
import { useEffect, useRef } from 'react'
import { useQuizPrefs } from '@/hooks/use-quiz-prefs'
import { playCue, type SoundCue } from '@/lib/quiz/sounds'

/** Shared course feedback. One cue per event, independent of decorative animation loops. */
export function useOutcomeSound(cue:SoundCue|undefined,event:string|number|undefined){
 const [prefs]=useQuizPrefs()
 const enabled=useRef(prefs.sound)
 enabled.current=prefs.sound
 useEffect(()=>{
  if(!cue||event===undefined)return
  // Cancel React development's effect replay before scheduling any audio.
  const timer=setTimeout(()=>playCue(cue,enabled.current),0)
  return()=>clearTimeout(timer)
 },[cue,event])
}
export function useCelebrationSound(enabled=true){useOutcomeSound(enabled?'fanfare':undefined,'celebration')}
