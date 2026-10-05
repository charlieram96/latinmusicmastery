import { it, expect } from 'vitest'
import { microphoneTiming, MIC_PRACTICE_ALLOWANCE_MS } from '../microphone-timing'
import { evaluateRhythm } from '../rhythm-evaluation'
import { gradeSingleOnset } from '../scoring'
it('gives microphone Perfect and Good ten additional milliseconds; Good also counts in final F1',()=>{
 const expected=[{timestamp:1,eventIndex:0}]
 const timing=microphoneTiming('beginner')
 for(const [ms,grade] of [[49,'perfect'],[79,'good'],[90,'ok']] as const){
   expect(gradeSingleOnset(1+ms/1000,1,expected,new Set(),'beginner',0,MIC_PRACTICE_ALLOWANCE_MS)?.grade).toBe(grade)
   expect(evaluateRhythm([1],[1+ms/1000],timing.good).f1).toBe(ms<=80?100:0)
 }
 expect(evaluateRhythm([1],[1.079]).f1).toBe(0) // research default unchanged
 expect(evaluateRhythm([1],[1.079],timing.good).version).toBe('onset-f1-80ms-v1')
 expect(gradeSingleOnset(1.049,1,expected,new Set(),'beginner')?.grade).toBe('good') // other inputs unchanged
})
