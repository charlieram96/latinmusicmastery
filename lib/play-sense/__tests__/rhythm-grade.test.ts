import { it, expect } from 'vitest'
import { rhythmGrade } from '../rhythm-grade'
const counts={perfectCount:0,goodCount:0,okCount:0,missCount:0,extraHits:0}
it('gives each tier its stated credit, including Keep going',()=>{
 expect(rhythmGrade({...counts,perfectCount:4}).percentage).toBe(100)
 expect(rhythmGrade({...counts,goodCount:4}).percentage).toBe(90)
 expect(rhythmGrade({...counts,okCount:4}).percentage).toBe(75)
 expect(rhythmGrade({...counts,missCount:4}).percentage).toBe(0)
 expect(rhythmGrade(counts).percentage).toBe(0)
})
it('averages tiers and includes missed notes and extra hits without combo bonuses',()=>{
 expect(rhythmGrade({...counts,perfectCount:1,goodCount:1,okCount:1,missCount:1}).percentage).toBe(66.25)
 expect(rhythmGrade({...counts,perfectCount:2,okCount:2}).percentage).toBe(87.5)
 expect(rhythmGrade({...counts,perfectCount:2,okCount:2,extraHits:1}).percentage).toBe(70)
})
