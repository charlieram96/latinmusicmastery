import { describe, expect, it } from 'vitest'
import { CONGA_TUMBAO_FIXTURE } from '../score-fixtures'
import { exerciseReadingScore, exerciseReadingTime } from '../exercise-reading-score'
import { trackDurationMs } from '../time-mapping'
import { repeatProjection } from '../repeats'

describe('continuous exercise reading passes', () => {
  it('shows upcoming passes in performance order without changing the authored score', () => {
    const original = CONGA_TUMBAO_FIXTURE
    const snapshot = JSON.stringify(original)
    const reading = exerciseReadingScore(original, 3)
    const count = original.tracks[0].measures.length
    expect(reading.tracks[0].measures).toHaveLength(count * 3)
    // Bar numbers restart every pass, as the HUD counts them.
    expect(reading.tracks[0].measures.map(m => m.number)).toEqual(Array.from({length:count * 3}, (_, i) => i % count + 1))
    expect(reading.tracks[0].measures[count].voices).toEqual(original.tracks[0].measures[0].voices)
    expect(JSON.stringify(original)).toBe(snapshot)
  })
  it('resets tempo and meter for every pass and preserves the complete duration', () => {
    const original = structuredClone(CONGA_TUMBAO_FIXTURE)
    original.tracks[0].measures.at(-1)!.tempoChange = 180
    original.tracks[0].measures.at(-1)!.timeSignature = [3, 4]
    original.tracks[0].measures.at(-1)!.keyFifths = 2
    const reading = exerciseReadingScore(original, 2)
    const nextPass = reading.tracks[0].measures[original.tracks[0].measures.length]
    expect(nextPass.tempoChange).toBe(original.initialTempo)
    expect(nextPass.timeSignature).toEqual(original.initialTimeSignature)
    expect(nextPass.keyFifths).toBe(original.initialKeyFifths)
    expect(trackDurationMs(reading.tracks[0], reading)).toBeCloseTo(trackDurationMs(original.tracks[0], original) * 2)
  })
  it('keeps authored repeat signs in every pass so the staff draws them', () => {
    const original = structuredClone(CONGA_TUMBAO_FIXTURE)
    original.tracks[0].measures = Array.from({length:4}, (_, pass) => ({...original.tracks[0].measures[0],number:pass + 1,
      repeat:{id:'repeat',pass,count:4,offset:0,length:1}}))
    expect(repeatProjection(original, 0)).not.toBeNull()
    const reading = exerciseReadingScore(original, 2)
    expect(reading.tracks[0].measures).toHaveLength(8)
    // Each reading pass carries its own repeat group; ids never collide across passes.
    const ids = new Set(reading.tracks[0].measures.map(m => m.repeat?.id))
    expect(ids.size).toBe(2)
    expect(reading.tracks[0].measures.map(m => m.repeat?.pass)).toEqual([0, 1, 2, 3, 0, 1, 2, 3])
    const projection = repeatProjection(reading, 0)
    expect(projection).not.toBeNull()
    // Four written-out bars collapse to one bar with a repeat sign, per pass.
    expect(projection!.score.tracks[0].measures).toHaveLength(2)
    expect(projection!.score.tracks[0].measures.map(m => m.repeat?.count)).toEqual([4, 4])
    // The reading clock still covers every written-out bar.
    expect(projection!.originalDuration).toBeCloseTo(trackDurationMs(reading.tracks[0], reading))
  })
  it('numbers the bars as the student reads them: a collapsed written-out repeat is numbered once', () => {
    const original = structuredClone(CONGA_TUMBAO_FIXTURE)
    const [a, b] = original.tracks[0].measures
    original.tracks[0].measures = [
      {...a,number:1,repeat:{id:'r',pass:0,count:2,offset:0,length:1}},
      {...a,number:2,repeat:{id:'r',pass:1,count:2,offset:0,length:1}},
      {...b,number:3},
      {...a,number:4},
    ]
    const reading = exerciseReadingScore(original, 2)
    expect(reading.tracks[0].measures.map(m => m.number)).toEqual([1, 1, 2, 3, 1, 1, 2, 3])
    // What the staff engraves (the projected bars) counts 1..n in every pass, like the HUD.
    expect(repeatProjection(reading, 0)!.score.tracks[0].measures.map(m => m.number)).toEqual([1, 2, 3, 1, 2, 3])
  })
  it('crosses pass boundaries continuously and clamps the count-in and final hold', () => {
    expect(exerciseReadingTime(7999, 1, 2, 8000)).toBe(7999)
    expect(exerciseReadingTime(0, 2, 2, 8000)).toBe(8000)
    expect(exerciseReadingTime(1, 2, 2, 8000)).toBe(8001)
    expect(exerciseReadingTime(-2000, 0, 2, 8000)).toBe(0)
    expect(exerciseReadingTime(8000, 3, 2, 8000)).toBe(16000)
  })
})
