// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { assessTiming, timingPresets, readTimingCompensation, saveTimingCompensation } from '../timing-compensation'
import type { LiveAudioInput } from '../live-audio-input'
const hits = (offsetMs: number) => Array.from({length:16}, (_,beat)=>({beat,offsetMs}))
const live = (device='mic', sink='default') => ({context:{sampleRate:48000,sinkId:sink}, stream:{getAudioTracks:()=>[{getSettings:()=>({deviceId:device})}]}} as unknown as LiveAudioInput)
beforeEach(()=>{
 const values = new Map<string,string>()
 vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)})
})
afterEach(()=>vi.unstubAllGlobals())
it('expresses subdivisions in ms at the calibration tempo',()=>{
 expect(timingPresets(120)).toEqual([0,31.25,15.625,62.5,125])
 expect(timingPresets(100)).toEqual([0,37.5,18.75,75,150])
})
it('requires complete consistent input and a real 97 percent result',()=>{
 expect(assessTiming(hits(125),0).passed).toBe(false)
 expect(assessTiming(hits(125),125)).toMatchObject({passed:true,score:100})
 expect(assessTiming(hits(125).slice(1),125).passed).toBe(false)
 expect(assessTiming([...hits(125),{beat:0,offsetMs:126}],125).passed).toBe(false)
 expect(assessTiming(hits(0).map(h=>({...h,offsetMs:h.beat%2?100:150})),125).passed).toBe(false)
})
it('isolates saved compensation by mic, output route and listening mode, including zero',()=>{
 expect(saveTimingCompensation(live(),'headphones',125)).toBe(true)
 expect(readTimingCompensation(live(),'headphones')).toBe(125)
 expect(readTimingCompensation(live(),'speaker-safe')).toBeNull()
 expect(readTimingCompensation(live('other'),'headphones')).toBeNull()
 expect(readTimingCompensation(live('mic','other'),'headphones')).toBeNull()
 expect(saveTimingCompensation(live(),'speaker-safe',0)).toBe(true)
 expect(readTimingCompensation(live(),'speaker-safe')).toBe(0)
 expect(saveTimingCompensation(live(),'midi',125)).toBe(false)
 expect(saveTimingCompensation(live(),'headphones',NaN)).toBe(false)
})
