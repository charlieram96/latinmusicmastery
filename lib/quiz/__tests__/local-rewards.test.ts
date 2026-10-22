import {expect,it} from 'vitest'
import {improveReward,rewardTotals} from '../local-rewards'
it('credits only the best quiz score, including improvements and failed attempts',()=>{
 let scores=improveReward({},'quiz-a',50)
 scores=improveReward(scores,'quiz-a',50)
 scores=improveReward(scores,'quiz-a',20)
 expect(rewardTotals(scores).points).toBe(50)
 scores=improveReward(scores,'quiz-a',80)
 scores=improveReward(scores,'quiz-b',100)
 expect(rewardTotals(scores)).toMatchObject({points:180,stars:1,fruit:0,nextMilestone:500})
})
it('caps rewards and unlocks fruit at each milestone',()=>{
 let scores={}
 for(let i=0;i<5;i++)scores=improveReward(scores,String(i),200)
 expect(rewardTotals(scores)).toMatchObject({points:500,stars:5,fruit:1,nextMilestone:1000})
 expect(improveReward(scores,'bad',NaN)).toEqual(scores)
})
