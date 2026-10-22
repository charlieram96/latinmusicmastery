// @vitest-environment jsdom
import React, { act, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { useOutcomeSound } from '../use-celebration-sound'
import { playCue, type SoundCue } from '@/lib/quiz/sounds'
vi.mock('@/lib/quiz/sounds',()=>({playCue:vi.fn()}))
vi.mock('@/hooks/use-quiz-prefs',()=>({useQuizPrefs:()=>[{sound:true}]}))
afterEach(()=>{vi.useRealTimers();vi.clearAllMocks()})
it('plays each outcome once, repeats distinct errors and cancels unmounted cues',async()=>{
 vi.useFakeTimers();Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true})
 function Feedback({cue,id}:{cue:SoundCue;id:number}){useOutcomeSound(cue,id);return null}
 const root=createRoot(document.createElement('div'))
 const render=async(cue:SoundCue,id:number)=>{await act(async()=>root.render(<StrictMode><Feedback cue={cue} id={id}/></StrictMode>));await act(async()=>vi.advanceTimersByTimeAsync(1))}
 await render('ok',1);expect(playCue).toHaveBeenCalledTimes(1)
 await render('ok',1);expect(playCue).toHaveBeenCalledTimes(1)
 await render('bad',2);await render('bad',3);await render('fanfare',4)
 expect(vi.mocked(playCue).mock.calls.map(c=>c[0])).toEqual(['ok','bad','bad','fanfare'])
 await act(async()=>root.render(<Feedback cue="ok" id={5}/>));await act(async()=>root.unmount());await act(async()=>vi.advanceTimersByTimeAsync(1))
 expect(playCue).toHaveBeenCalledTimes(4)
})
