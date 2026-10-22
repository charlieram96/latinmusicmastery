import { describe, expect, it } from 'vitest'
import { barPracticeScore } from '../bar-practice-score'
import { CONGA_TUMBAO_FIXTURE } from '@/lib/playsense-studio/score-fixtures'

describe('practice score excerpts', () => {
  it('uses the selected performance bar, including repeated passes, without changing the source', () => {
    const source = structuredClone(CONGA_TUMBAO_FIXTURE)
    source.tracks[0].measures[0].timeSignature = [3,4]
    source.tracks[0].measures[0].keyFifths = 2
    const selected = source.tracks[0].measures[1]
    selected.repeat = {id:'r',pass:1,count:2,length:1,offset:0}
    const before = JSON.stringify(source)
    const excerpt = barPracticeScore(source, 2, 90)!
    expect(excerpt.tracks[0].measures).toHaveLength(1)
    expect(excerpt.tracks[0].measures[0].voices).toEqual(selected.voices)
    expect(excerpt.tracks[0].measures[0].repeat).toBeUndefined()
    expect(excerpt.tracks[0].measures[0].endBarline).toBe('final')
    expect(excerpt.initialTempo).toBe(90)
    expect(excerpt.initialTimeSignature).toEqual([3,4])
    expect(excerpt.initialKeyFifths).toBe(2)
    expect(JSON.stringify(source)).toBe(before)
  })
  it('does not substitute a different measure when the requested bar is missing', () => {
    expect(barPracticeScore(CONGA_TUMBAO_FIXTURE, 999, 120)).toBeNull()
  })
})
