import { it, expect } from 'vitest'
import { audibleTime } from '../audible-clock'
it('aligns visual time to output instead of the render head without changing input time',()=>{
 const ctx={state:'running',currentTime:10,getOutputTimestamp:()=>({contextTime:9.9,performanceTime:1000})} as unknown as AudioContext
 expect(audibleTime(ctx,1020)).toBeCloseTo(9.92)
 expect(ctx.currentTime).toBe(10)
})
it('bounds output extrapolation and handles unavailable timestamps and pause',()=>{
 expect(audibleTime({state:'running',currentTime:2,baseLatency:.01,outputLatency:.03} as AudioContext)).toBeCloseTo(1.96)
 expect(audibleTime({state:'suspended',currentTime:2} as AudioContext)).toBe(2)
})
