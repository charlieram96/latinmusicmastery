// @vitest-environment jsdom
import {act} from 'react'
import {createRoot} from 'react-dom/client'
;(globalThis as unknown as {IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true
function renderHook<T>(hook:()=>T){const result={current:undefined as unknown as T};function Probe(){result.current=hook();return null}const root=createRoot(document.createElement('div'));act(()=>root.render(<Probe/>));return {result}}
import {afterEach,expect,it,vi} from 'vitest'
import {useNoteDemonstration} from '../use-note-demonstration'
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers()})
it('schedules count-in, whole notes and clicks on the same audio clock and cancels them',async()=>{
 vi.useFakeTimers()
 const scheduled:Array<{frequency:{value:number};start:ReturnType<typeof vi.fn>;stop:ReturnType<typeof vi.fn>}> = []
 class FakeAudio {
  currentTime=10;destination={};resume=vi.fn().mockResolvedValue(undefined);close=vi.fn()
  createOscillator(){const o={frequency:{value:0},type:'sine',connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn(),onended:null};scheduled.push(o);return o}
  createGain(){return {gain:{setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn()},connect:vi.fn(),disconnect:vi.fn()}}
 }
 vi.stubGlobal('AudioContext',FakeAudio)
 const {result}=renderHook(()=>useNoteDemonstration({bpm:100,countInBars:1}))
 await act(async()=>result.current.play([{frequency:261.6256,beats:4,index:0},{frequency:293.6648,beats:4,index:1}]))
 const notes=scheduled.filter(o=>o.frequency.value<500),clicks=scheduled.filter(o=>o.frequency.value>=1000)
 expect(notes[0].start.mock.calls[0][0]).toBeCloseTo(12.43)
 expect(notes[1].start.mock.calls[0][0]-notes[0].start.mock.calls[0][0]).toBeCloseTo(2.4)
 expect(clicks).toHaveLength(12)
 expect(clicks[4].start.mock.calls[0][0]).toBe(notes[0].start.mock.calls[0][0])
 act(()=>result.current.stop());expect(result.current.playing).toBe(false)
 for(const voice of scheduled)expect(voice.stop).toHaveBeenCalledTimes(2)
})
it('recreates a closed audio context so notes remain playable after an audio reset',async()=>{
 vi.useFakeTimers()
 const contexts:FakeAudio[]=[]
 class FakeAudio {
  state='running';currentTime=0;destination={};started=vi.fn()
  constructor(){contexts.push(this)}
  resume=vi.fn(async()=>{if(this.state==='closed')throw new Error('closed context')})
  close=vi.fn(()=>{this.state='closed'})
  createOscillator(){return {frequency:{value:0},type:'triangle',connect:vi.fn(),disconnect:vi.fn(),start:this.started,stop:vi.fn(),onended:null}}
  createGain(){return {gain:{setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn()},connect:vi.fn(),disconnect:vi.fn()}}
 }
 vi.stubGlobal('AudioContext',FakeAudio)
 const {result}=renderHook(()=>useNoteDemonstration({metronome:false,countInBars:0}))
 await act(async()=>result.current.play([{frequency:261.63,beats:1,index:0}],{preview:true}))
 contexts[0].close()
 await act(async()=>result.current.play([{frequency:293.66,beats:1,index:1}],{preview:true}))
 expect(contexts).toHaveLength(2)
 expect(contexts[1].resume).toHaveBeenCalledOnce()
 expect(contexts[1].started).toHaveBeenCalledOnce()
 act(()=>result.current.stop())
})
it('keeps four metronome beats after count-in while a half note sounds only once',async()=>{
 vi.useFakeTimers()
 const voices:Array<{frequency:{value:number};start:ReturnType<typeof vi.fn>;stop:ReturnType<typeof vi.fn>}>=[]
 class FakeAudio {
  currentTime=0;destination={};resume=vi.fn().mockResolvedValue(undefined);close=vi.fn()
  createOscillator(){const o={frequency:{value:0},connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn()};voices.push(o);return o}
  createGain(){return {gain:{setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn()},connect:vi.fn(),disconnect:vi.fn()}}
 }
 vi.stubGlobal('AudioContext',FakeAudio)
 const {result}=renderHook(()=>useNoteDemonstration({bpm:60}))
 await act(async()=>result.current.play([{frequency:261.63,beats:2,index:1}],{minimumBeats:4}))
 expect(voices.filter(v=>v.frequency.value===261.63)).toHaveLength(1)
 expect(voices.filter(v=>v.frequency.value>=1000)).toHaveLength(8)
 const note=voices[0];expect(note.stop.mock.calls[0][0]).toBeLessThan(6.04)
 act(()=>vi.advanceTimersByTime(7050));expect(result.current.playing).toBe(true);expect(result.current.beatNumber).toBe(4)
 act(()=>vi.advanceTimersByTime(1000));expect(result.current.playing).toBe(false)
})
