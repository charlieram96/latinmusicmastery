import { describe, expect, it } from 'vitest'
import { completionRequirements, finishedExercise, finishLessonActivity } from '../lesson-completion'

describe('lesson completion requirements', () => {
  it('finishes videos and jams on media end, quizzes on questions, exercises on their authored activities', () => {
    expect(completionRequirements('VIDEO', true, false)).toEqual(['media'])
    expect(completionRequirements('JAM_SESSION', true, false)).toEqual(['media'])
    expect(completionRequirements('QUIZ', true, true)).toEqual(['questions'])
    expect(completionRequirements('EXERCISE', true, false)).toEqual(['performance'])
    expect(completionRequirements('EXERCISE', false, true)).toEqual(['questions'])
    expect(completionRequirements('EXERCISE', true, true)).toEqual(['performance', 'questions'])
  })
  it('does not complete empty, unconfigured activities', () => {
    expect(completionRequirements('QUIZ', false, false)).toEqual([])
    expect(completionRequirements('EXERCISE', false, false)).toEqual([])
    expect(finishLessonActivity(undefined, 'questions', [])).toBeUndefined()
  })
  it('accepts either order for a combined exercise and does not count intro media', () => {
    const required = completionRequirements('EXERCISE', true, true)
    expect(finishLessonActivity(undefined, 'media', required)).toBeUndefined()
    const questions = finishLessonActivity(undefined, 'questions', required)
    expect(questions?.status).toBe('in-progress')
    expect(finishLessonActivity(questions, 'performance', required)?.status).toBe('saving')
  })
  it('does not complete a stopped session or a visual demo, even when results are open', () => {
    expect(finishedExercise('results', .8, false)).toBe(false)
    expect(finishedExercise('playing', 1, false)).toBe(false)
    expect(finishedExercise('results', 1, true)).toBe(false)
    expect(finishedExercise('results', NaN, false)).toBe(false)
    expect(finishedExercise('results', 1, false)).toBe(true)
  })
})
