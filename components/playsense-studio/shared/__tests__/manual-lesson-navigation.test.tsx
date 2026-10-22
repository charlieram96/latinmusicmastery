// @vitest-environment jsdom
import React, { act, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ManualLessonNavigation, useManualLessonMedia } from '../manual-lesson-navigation'
vi.mock('@/components/language-provider',()=>({useTranslation:()=>({locale:'es'})}))
vi.mock('@/components/ui/button',()=>({Button:(props:React.ButtonHTMLAttributes<HTMLButtonElement>)=><button {...props}/>}))
const steps=[{start:0,end:6,title:'Portada',kind:'intro'},{start:6,end:15,title:'Tema',kind:'explanation'},{start:15,end:20,title:'Cierre',kind:'completion'}]
afterEach(()=>vi.restoreAllMocks())
describe('manual lesson screens',()=>{
 it('keeps the bar fixed during sound, stops at the screen edge, and navigates only explicitly',()=>{
  let tick:FrameRequestCallback=()=>{};vi.stubGlobal('requestAnimationFrame',vi.fn(fn=>{tick=fn;return 1}));vi.stubGlobal('cancelAnimationFrame',vi.fn())
  const pause=vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{})
  const host=document.createElement('div'),root=createRoot(host),complete=vi.fn()
  function Player(){const ref=useRef<HTMLVideoElement|null>(null);const manual=useManualLessonMedia(ref);return <><video ref={ref}/><output>{manual?.position}</output></>}
  act(()=>root.render(<ManualLessonNavigation steps={steps} onComplete={complete}><Player/></ManualLessonNavigation>))
  const video=host.querySelector('video')!
  const next=()=>act(()=>{Array.from(host.querySelectorAll('button')).at(-1)!.click()})
  next();expect(video.currentTime).toBe(6.45)
  act(()=>{video.currentTime=10;video.dispatchEvent(new Event('timeupdate'))})
  expect(host.querySelector('output')!.textContent).toBe('6.45')
  act(()=>{video.dispatchEvent(new Event('play'));video.currentTime=14.95;tick(0)})
  expect(pause).toHaveBeenCalled();expect(video.currentTime).toBe(14.88)
  expect(host.textContent).toContain('2 / 3 · Tema')
  next();expect(video.currentTime).toBe(15.45)
  next();expect(complete).toHaveBeenCalledOnce()
  act(()=>{video.currentTime=8;video.dispatchEvent(new Event('seeking'))})
  expect(host.textContent).toContain('2 / 3 · Tema');expect(host.querySelector('output')!.textContent).toBe('8')
  act(()=>root.unmount());vi.unstubAllGlobals()
 })
})
