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
function Harness({volume=1,muted=false}:{volume?:number;muted?:boolean}) {
 const ref=useRef<HTMLVideoElement>(null)
 control=useDubbedAudio(ref,tracks,volume,muted)
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
