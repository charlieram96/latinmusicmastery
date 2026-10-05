import { TOLERANCE_BY_DIFFICULTY, type Difficulty } from './types'
/** Provisional practice allowance requested by the teacher, not hardware compensation. */
export const MIC_PRACTICE_ALLOWANCE_MS = 10
export function microphoneTiming(difficulty: Difficulty) {
  const base=TOLERANCE_BY_DIFFICULTY[difficulty]
  return {perfect:base.perfect+MIC_PRACTICE_ALLOWANCE_MS,good:base.good+MIC_PRACTICE_ALLOWANCE_MS,ok:base.ok+MIC_PRACTICE_ALLOWANCE_MS}
}
