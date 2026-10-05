import { expect,it } from 'vitest'
import { evaluateRhythm } from '../rhythm-evaluation'
it('scores perfect timing, silence, misses and extra attacks explicitly',()=>{
 expect(evaluateRhythm([0,1,2],[0,1,2]).f1).toBe(100)
 expect(evaluateRhythm([0,1,2],[]).f1).toBe(0)
 expect(evaluateRhythm([0,1,2,3],[0,1,2]).f1).toBeCloseTo(600/7)
 expect(evaluateRhythm([0,1],[0,.2,1,1.2]).f1).toBeCloseTo(200/3)
})
it('uses inclusive 50 ms without subtracting the student timing bias',()=>{
 expect(evaluateRhythm([1],[1.05]).f1).toBe(100)
 expect(evaluateRhythm([1],[1.051]).f1).toBe(0)
 expect(evaluateRhythm([1,2],[1.1,2.1]).f1).toBe(0)
})
it('matches one to one and reports absolute error',()=>{
 const result=evaluateRhythm([1,2],[.98,2.03])
 expect(result.meanAbsoluteErrorMs).toBeCloseTo(25)
 expect(evaluateRhythm([1],[1,1]).f1).toBeCloseTo(200/3)
})
