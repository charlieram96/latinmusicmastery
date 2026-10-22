// @vitest-environment jsdom
import React, {act, useRef} from 'react'
import {createRoot} from 'react-dom/client'
import {afterEach, beforeEach, expect, it, vi} from 'vitest'
import {useDubbedAudio} from '../use-dubbed-audio'

let host: HTMLDivElement
let root: ReturnType<typeof createRoot>
let audio: HTMLAudioElement
let control: ReturnType<typeof useDubbedAudio>
const tracks=[{lang:'en',label:'English',src:'https://example.com/english.mp3'}]
function Harness({volume=1,muted=false,locale='original'}:{volume?:number;muted?:boolean;locale?:string}) {
 const ref=useRef<HTMLVideoElement>(null)
 control=useDubbedAudio(ref,tracks,volume,muted,locale)
 return <video ref={ref}/>
}
beforeEach(()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true})
 audio=document.createElement('audio')
 vi.stubGlobal('Audio',function(){return audio})
 vi.spyOn(audio,'play').mockResolvedValue()
 vi.spyOn(audio,'pause').mockImplementation(()=>{})
 Object.defineProperty(audio,'readyState',{value:4})
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
 act(()=>root.render(<Harness/>))
})
afterEach(()=>{act(()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals()})
it('switches only sound and follows video seek, speed, volume, and pause',async()=>{
 const video=host.querySelector('video')!
 video.currentTime=32
 Object.defineProperty(video,'paused',{value:false,configurable:true})
 await act(async()=>control.setLanguage('en'))
 expect(video.muted).toBe(true)
 expect(audio.currentTime).toBe(32)
 expect(audio.play).toHaveBeenCalled()
 video.currentTime=8;video.playbackRate=.75
 act(()=>video.dispatchEvent(new Event('seeked')))
 expect(audio.currentTime).toBe(8)
 expect(audio.playbackRate).toBe(.75)
 act(()=>root.render(<Harness volume={.4} muted/>))
 expect(audio.volume).toBe(.4);expect(audio.muted).toBe(true)
 act(()=>video.dispatchEvent(new Event('pause')))
 expect(audio.pause).toHaveBeenCalled()
 act(()=>control.setLanguage('original'))
 expect(video.muted).toBe(true)
 act(()=>root.render(<Harness muted={false}/>))
 expect(video.muted).toBe(false)
})
it('restores the original audio when a dub fails',()=>{
 act(()=>control.setLanguage('en'))
 act(()=>audio.dispatchEvent(new Event('error')))
 expect(control.language).toBe('original')
 expect(control.error).toBe(true)
 expect(host.querySelector('video')!.muted).toBe(false)
})
it('stops translated audio on unmount',()=>{
 act(()=>control.setLanguage('en'))
 const calls=vi.mocked(audio.pause).mock.calls.length
 act(()=>root.render(null))
 expect(vi.mocked(audio.pause).mock.calls.length).toBeGreaterThan(calls)
})

it('defaults to the application language and changes sound without moving the video clock', () => {
 const video=host.querySelector('video')!
 video.currentTime=301
 act(()=>root.render(<Harness locale="en"/>))
 expect(control.language).toBe('en')
 expect(audio.src).toBe(tracks[0].src)
 expect(audio.currentTime).toBe(301)
 expect(video.muted).toBe(true)
 act(()=>root.render(<Harness locale="es"/>))
 expect(control.language).toBe('original')
 expect(video.muted).toBe(false)
 expect(video.currentTime).toBe(301)
 act(()=>root.render(<Harness locale="en"/>))
 expect(control.language).toBe('en')
 expect(audio.currentTime).toBe(301)
})
it('uses the original for an unavailable language and does not retry a failed dub on every render', () => {
 act(()=>root.render(<Harness locale="fr"/>))
 expect(control.language).toBe('original')
 act(()=>root.render(<Harness locale="en"/>))
 act(()=>audio.dispatchEvent(new Event('error')))
 act(()=>root.render(<Harness locale="en" volume={.5}/>))
 expect(control.language).toBe('original')
 expect(control.error).toBe(true)
})

it('keeps the dub after seeking interrupts a pending play request', async () => {
 const video=host.querySelector('video')!
 Object.defineProperty(video,'paused',{value:false,configurable:true})
 vi.mocked(audio.play).mockRejectedValueOnce(new DOMException('Interrupted by pause', 'AbortError'))
 await act(async()=>control.setLanguage('en'))
 expect(control.language).toBe('en')
 expect(control.error).toBe(false)
 expect(video.muted).toBe(true)
 expect(audio.play).toHaveBeenCalledTimes(2)
})
