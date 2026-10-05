import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { analyzeLoopback, makeLatencyProbe, PROBE_COUNT, PROBE_INTERVAL } from '../loopback-latency'
const offsets=Array.from({length:PROBE_COUNT},(_,i)=>.5+i*PROBE_INTERVAL)
function recording(rate:number, delays:number[], amplitude=.12) {
  const samples=new Float32Array(Math.ceil(7*rate)), probe=makeLatencyProbe(rate)
  let seed=17
  for(let i=0;i<samples.length;i++){seed=(seed*1664525+1013904223)>>>0;samples[i]=.00004*(seed/4294967296-.5)+.00002*Math.sin(2*Math.PI*80*i/rate)}
  delays.forEach((delay,i)=>{const start=Math.round((offsets[i]+delay)*rate);for(let j=0;j<probe.length;j++)samples[start+j]+=probe[j]*amplitude})
  return samples
}
describe('acoustic round-trip measurement',()=>{
  for(const rate of [44100,48000]) it(`recovers quiet delayed probes with ambient noise at ${rate}Hz`,()=>{
    const result=analyzeLoopback(recording(rate,offsets.map(()=>.083)),rate,offsets)
    expect(result.reliable).toBe(true);expect(result.detected).toBe(8)
    expect(Math.abs(result.medianMs!-83)).toBeLessThan(.3)
    expect(result.iqrMs).toBeLessThan(.3)
  })
  it('verifies the direct internal reference at zero delay',()=>{
    const r=analyzeLoopback(recording(48000,offsets.map(()=>0)),48000,offsets)
    expect(r.detected).toBe(8);expect(Math.abs(r.medianMs!)).toBeLessThan(.1);expect(r.pulses).toHaveLength(8)
  })
  it('rejects room noise and silence',()=>{
    expect(analyzeLoopback(recording(48000,[]),48000,offsets).detected).toBe(0)
    expect(analyzeLoopback(new Float32Array(336000),48000,offsets).reliable).toBe(false)
  })
  it('rejects too few pulses, timing instability, and clipped input',()=>{
    expect(analyzeLoopback(recording(48000,[.08,.08,.08]),48000,offsets).reliable).toBe(false)
    expect(analyzeLoopback(recording(48000,[.02,.06,.10,.14,.18,.22,.26,.30]),48000,offsets).reliable).toBe(false)
    const clipped=recording(48000,offsets.map(()=>.08));clipped[1]=1
    expect(analyzeLoopback(clipped,48000,offsets).reliable).toBe(false)
  })
  it('rejects ambiguous equal-strength echoes',()=>{
    const samples=recording(48000,offsets.map(()=>.08)), echo=recording(48000,offsets.map(()=>.16))
    for(let i=0;i<samples.length;i++)samples[i]+=echo[i]
    expect(analyzeLoopback(samples,48000,offsets).reliable).toBe(false)
  })
  it('timestamps the recorder by frames and transfers exactly the requested range',()=>{
    let Processor:any, captured:any
    const context:any={AudioWorkletProcessor:class{port={onmessage:null,postMessage:(data:any)=>{captured=data}}},currentFrame:0,Float32Array,registerProcessor:(_:string,p:any)=>{Processor=p}}
    vm.runInNewContext(readFileSync('public/audio-worklets/latency-recorder.js','utf8'),context)
    const instance=new Processor()
    instance.port.onmessage({data:{type:'record',startFrame:150,length:200}})
    for(let frame=0;frame<384;frame+=128){context.currentFrame=frame;instance.process([[Float32Array.from({length:128},(_,i)=>frame+i)],[Float32Array.from({length:128},()=>.25)]])}
    expect(captured.reference[0]).toBe(.25);expect(captured.discontinuities).toBe(0);expect(captured.maxZeroRun).toBe(0);expect(captured.received).toBe(200);expect(captured.samples[0]).toBe(150);expect(captured.samples[199]).toBe(349)
  })
})

it('ignores pre-capture graph gaps but rejects gaps inside the recording',()=>{
 const run=(start:number)=>{
   let Processor:any,captured:any
   const context:any={AudioWorkletProcessor:class{port={onmessage:null,postMessage:(data:any)=>{captured=data}}},currentFrame:0,Float32Array,registerProcessor:(_:string,p:any)=>{Processor=p}}
   vm.runInNewContext(readFileSync('public/audio-worklets/latency-recorder.js','utf8'),context)
   const instance=new Processor();instance.port.onmessage({data:{type:'record',startFrame:start,length:256}})
   for(const frame of [0,256,384,512]){context.currentFrame=frame;instance.process([[new Float32Array(128).fill(.1)]])}
   return captured
 }
 expect(run(256).discontinuities).toBe(0)
 expect(run(256).received).toBe(256)
 expect(run(64).discontinuities).toBe(1)
 expect(run(64).gaps).toEqual([{fromFrame:64,toFrame:192}])
 expect(run(64).received).toBeLessThan(256)
})
