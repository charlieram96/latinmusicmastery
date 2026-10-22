// @vitest-environment jsdom
import {act} from 'react'
import {readFileSync} from 'node:fs'
import {createRoot} from 'react-dom/client'
import {afterEach,expect,it,vi} from 'vitest'
import {useBookAudio} from '../use-book-audio'
import {BOOK_PLAYBACK_STATE,BOOK_SOUND_STOP,type BookPlaybackState} from '@/lib/solfeo/book-playback'
;(globalThis as unknown as {IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers()})
it('counts one 3/4 measure, shares note/click timestamps, and stops both at the end or on cancel',async()=>{
 vi.useFakeTimers();let time=10
 const voices:Array<{frequency:{value:number};start:ReturnType<typeof vi.fn>;stop:ReturnType<typeof vi.fn>;onended:(()=>void)|null}>=[]
 class FakeAudio{get currentTime(){return time}destination={};resume=vi.fn().mockResolvedValue(undefined);close=vi.fn();createOscillator(){const o={frequency:{value:0},type:'sine',connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn(),onended:null};voices.push(o);return o}createGain(){return {gain:{setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn()},connect:vi.fn(),disconnect:vi.fn()}}}
 vi.stubGlobal('AudioContext',FakeAudio)
 let playback!:ReturnType<typeof useBookAudio>;function Probe(){playback=useBookAudio();return null}
 const states:BookPlaybackState[]=[];const listener=(e:Event)=>states.push((e as CustomEvent<BookPlaybackState>).detail);window.addEventListener(BOOK_PLAYBACK_STATE,listener)
 const root=createRoot(document.createElement('div'));act(()=>root.render(<Probe/>))
 const score={bpm:60,duration:3,pulses:[0,1,2].map(i=>({start:i,beat:i+1,beatsPerBar:3,beatSeconds:1})),events:[{frequency:392,start:0,duration:2.76,gain:.17,visualIndex:0,pitch:'G4'}]}
 await act(async()=>playback.play(score,'test'))
 expect(voices[0].start.mock.calls[0][0]).toBeCloseTo(13.04)
 expect(voices[4].start.mock.calls[0][0]).toBe(voices[0].start.mock.calls[0][0])
 expect(voices).toHaveLength(8);expect(playback.count).toBe(3);expect(playback.active).toEqual([])
 time=13.1;act(()=>vi.advanceTimersByTime(20));expect(playback.active).toEqual([0]);expect(playback.count).toBe(0)
 time=16.1;act(()=>vi.advanceTimersByTime(20));expect(playback.playing).toBe(false);expect(states.at(-1)?.playing).toBe(false)
 await act(async()=>playback.play(score,'test'));act(()=>window.dispatchEvent(new Event(BOOK_SOUND_STOP)));expect(playback.playing).toBe(false)
 expect(voices.every(o=>o.stop.mock.calls.length>=2)).toBe(true)
 // Only schedule the selected staff. Natural completion advances; manual stop repeats it.
 const divided={...score,stops:[1,3],events:[...score.events.map(e=>({...e,duration:.9})),{...score.events[0],start:1,duration:1.8,visualIndex:1}]}
 await act(async()=>playback.play(divided,'test'));const before=voices.length
 expect(playback.section).toBe(0);expect(playback.sectionCount).toBe(2)
 time+=4.1;act(()=>vi.advanceTimersByTime(20));expect(playback.playing).toBe(false);expect(playback.section).toBe(1)
 expect(voices.length).toBe(before)
 await act(async()=>playback.play(divided,'test'));expect(playback.section).toBe(1)
 act(()=>playback.stop());await act(async()=>playback.play(divided,'test'));expect(playback.section).toBe(1)
 // The real dynamics page has three staves and trailing rests. Audio completion
 // advances through all three even when animation frames never run.
 const dynamics=JSON.parse(readFileSync('local-artifacts/solfeo-course/book-audit/local-solfeo-m08-c01.json','utf8')).vectors.a3dbb5a2f98fa608.audio
 for(let index=0;index<3;index++){
  await act(async()=>playback.play(dynamics,'a3dbb5a2f98fa608'))
  expect(playback.section).toBe(index)
  const marker=voices.at(-1)!
  time=marker.stop.mock.calls[0][0]
  act(()=>marker.onended?.())
  expect(playback.playing).toBe(false)
  expect(playback.section).toBe((index+1)%3)
 }
 act(()=>root.unmount());window.removeEventListener(BOOK_PLAYBACK_STATE,listener)
})
