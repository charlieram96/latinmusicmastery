import type { AttemptStats } from './types'
/** Teacher-facing practice rubric, distinct from binary onset F1. No combo bonus. */
export const RHYTHM_GRADE_POINTS = { perfect:100, good:90, ok:75, miss:0 } as const
export function rhythmGrade(stats: Pick<AttemptStats,'perfectCount'|'goodCount'|'okCount'|'missCount'|'extraHits'>) {
  const total=stats.perfectCount+stats.goodCount+stats.okCount+stats.missCount
  const earned=stats.perfectCount*RHYTHM_GRADE_POINTS.perfect+stats.goodCount*RHYTHM_GRADE_POINTS.good+stats.okCount*RHYTHM_GRADE_POINTS.ok
  // Unmatched extra attacks add a zero-credit opportunity; never improve the mark.
  const possible=(total+Math.max(0,stats.extraHits))*100
  return {version:'rhythm-weighted-v1' as const,points:RHYTHM_GRADE_POINTS,earned,possible,percentage:possible?100*earned/possible:0}
}
export function applyRhythmGrade(stats: AttemptStats): AttemptStats {
  const assessment=rhythmGrade(stats)
  return {...stats,assessment,accuracy:assessment.percentage,score:assessment.percentage}
}
