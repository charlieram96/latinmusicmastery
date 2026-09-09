import { describe, expect, it } from 'vitest'
import { changedJudgments, createStageModel, firstVisibleNote } from '@/components/play-sense/stage-highway/model'
import type { ExerciseDefinition, HitGrade } from '../types'

const exercise: ExerciseDefinition = {
  id: 'test', title: 'Test', description: '', instrument: 'piano', bpm: 120,
  timeSignature: [4, 4], swing: 0, difficulty: 'beginner', measures: 1, loopCount: 2,
  events: [67, 60, 64].map((expectedPitch, i) => ({ expectedPitch, instrument: 'piano', technique: 'open', hand: 'R', duration: 1, vexKey: 'c/4', accent: false, measure: 1, beat: i === 0 ? 2 : 1 })),
}
describe('3D stage model', () => {
  it('preserves original event identities after timestamp sorting and looping', () => {
    const { notes, lanes } = createStageModel(exercise)
    expect(notes.map(n => n.index)).toEqual([1, 2, 0, 4, 5, 3])
    expect(notes.map(n => lanes[n.lane].midi)).toEqual([60, 64, 67, 60, 64, 67])
  })
  it('displays all 88 keys when the exercise spans the keyboard', () => {
    const wide = { ...exercise, events: exercise.events.map((e, i) => ({ ...e, expectedPitch: i === 0 ? 21 : 108 })) }
    expect(createStageModel(wide).lanes.length).toBe(88)
  })
  it('finds only the visible time window in a long exercise', () => {
    const { notes } = createStageModel(exercise)
    expect(firstVisibleNote(notes, 2)).toBe(3)
    expect(firstVisibleNote(notes, 99)).toBe(notes.length)
  })
  it('handles same-length miss corrections exactly once', () => {
    const seen = new Map<number, HitGrade>()
    changedJudgments([{ eventIndex: 0, grade: 'miss' }], seen)
    expect(changedJudgments([{ eventIndex: 0, grade: 'perfect' }], seen)).toEqual([{ eventIndex: 0, grade: 'perfect' }])
    expect(changedJudgments([{ eventIndex: 0, grade: 'perfect' }], seen)).toEqual([])
  })
})
