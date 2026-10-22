/** Local draft rewards; independent of account achievements and never redeemed automatically. */
export const REWARDS_KEY='lmm-kids-quiz-rewards-v1'
export const REWARDS_EVENT='lmm-kids-quiz-rewards-change'
export type RewardScores=Record<string,number>
export function improveReward(scores:RewardScores,id:string,score:number):RewardScores{
 if(!id||!Number.isFinite(score))return scores
 const value=Math.max(0,Math.min(100,Math.round(score)))
 return {...scores,[id]:Math.max(scores[id]??0,value)}
}
export function rewardTotals(scores:RewardScores){
 const points=Object.values(scores).reduce((sum,score)=>sum+score,0)
 return {points,stars:Math.floor(points/100),quizzes:Object.keys(scores).length,fruit:Math.floor(points/500),nextMilestone:(Math.floor(points/500)+1)*500}
}
export function readRewards():RewardScores{
 try{const data=JSON.parse(localStorage.getItem(REWARDS_KEY)??'{}');return Object.fromEntries(Object.entries(data).filter(([,v])=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=100)) as RewardScores}catch{return {}}
}
export function saveReward(id:string,score:number){
 try{localStorage.setItem(REWARDS_KEY,JSON.stringify(improveReward(readRewards(),id,score)));window.dispatchEvent(new Event(REWARDS_EVENT));return true}catch{return false}
}
