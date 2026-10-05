import { it, expect } from 'vitest'
import { recordSessionLatency,sessionLatencyMs } from '../session-latency'
import type { LiveAudioInput } from '../live-audio-input'
import type { LoopbackResult } from '../loopback-latency'
const sample=(ms:number,reliable=true)=>({reliable,medianMs:ms,detected:8,total:8}) as LoopbackResult
it('requires two complete stable hardware rounds; invalidates unstable repeats and changed sessions',()=>{
 const context={state:'running',sampleRate:48000,baseLatency:.01,outputLatency:.02,sinkId:'default'}
 const stream={active:true}
 const live={context,stream} as unknown as LiveAudioInput
 expect(recordSessionLatency(live,sample(79))).toBeNull()
 expect(recordSessionLatency(live,sample(77))).toBe(78)
 expect(sessionLatencyMs(live)).toBe(78)
 expect(sessionLatencyMs({...live,stream:{active:true} as MediaStream})).toBeNull()
 context.outputLatency=.020001
 expect(sessionLatencyMs(live)).toBe(78)
 context.sinkId='different-output'
 expect(sessionLatencyMs(live)).toBeNull()
 expect(recordSessionLatency(live,sample(80))).toBeNull()
 expect(recordSessionLatency(live,sample(81))).toBe(80.5)
 expect(recordSessionLatency(live,sample(110))).toBeNull()
 recordSessionLatency(live,sample(110))
 expect(recordSessionLatency(live,sample(110,false))).toBeNull()
 expect(sessionLatencyMs(live)).toBeNull()
})
