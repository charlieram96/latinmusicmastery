import { describe, expect, it } from 'vitest'
import { cueFor, initQuizState, outcomeOf, percentScore, quizReducer, seedAnswers, totalScore } from '../engine'
import type { QuizQuestion } from '@/types/modules'

function q(partial: Partial<QuizQuestion>): QuizQuestion {
  return {
    id: 'q', class_item_id: 'c', order_index: 0, question: 'Q', question_type: 'multiple_choice', options: null,
    correct_answer: null, explanation: null, question_es: null, explanation_es: null, options_es: null,
    audio_url: null, image_url: null, created_at: null, updated_at: null, ...partial,
  }
}
const mc = q({ id: 'mc', options: { choices: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] }, correct_answer: 'b' })
const tf = q({ id: 'tf', question_type: 'true_false', correct_answer: 'true' })
const ord = q({ id: 'ord', question_type: 'ordering_sequence', options: { items: [{ id: 'i1', text: '1', correctPosition: 0 }, { id: 'i2', text: '2', correctPosition: 1 }, { id: 'i3', text: '3', correctPosition: 2 }] } })
const questions = [mc, tf, ord]

describe('seedAnswers / initQuizState', () => {
  it('pre-shuffles ordering questions and seeds empty maps for matching and pieces', () => {
    const seeded = seedAnswers([ord, q({ id: 'm', question_type: 'matching_pairs' }), q({ id: 'p', question_type: 'piece_placement' })])
    expect(new Set(seeded.ord as string[])).toEqual(new Set(['i1', 'i2', 'i3']))
    expect(seeded.m).toEqual({})
    expect(seeded.p).toEqual({})
    expect(initQuizState(questions)).toMatchObject({ graded: {}, streak: 0 })
  })
})

describe('quizReducer', () => {
  const reduce = quizReducer(questions)
  it('sets answers and grades once', () => {
    let s = initQuizState(questions)
    s = reduce(s, { type: 'set', id: 'mc', value: 'b' })
    s = reduce(s, { type: 'check', id: 'mc' })
    expect(s.graded.mc).toBe(1)
    const again = reduce(reduce(s, { type: 'set', id: 'mc', value: 'a' }), { type: 'check', id: 'mc' })
    expect(again.graded.mc).toBe(1) // already graded: no re-grade
  })
  it('tracks a streak that resets on a miss', () => {
    let s = initQuizState(questions)
    s = reduce(reduce(s, { type: 'set', id: 'mc', value: 'b' }), { type: 'check', id: 'mc' })
    s = reduce(reduce(s, { type: 'set', id: 'tf', value: 'true' }), { type: 'check', id: 'tf' })
    expect(s.streak).toBe(2)
    s = reduce(reduce(s, { type: 'set', id: 'ord', value: ['i3', 'i2', 'i1'] }), { type: 'check', id: 'ord' })
    expect(s.streak).toBe(0)
    expect(s.graded.ord).toBe(0)
  })
  it('checkMany grades ungraded ids and leaves the streak at 0', () => {
    let s = initQuizState(questions)
    s = reduce(s, { type: 'set', id: 'mc', value: 'b' })
    s = reduce(s, { type: 'checkMany', ids: ['mc', 'tf'] })
    expect(s.graded).toEqual({ mc: 1, tf: 0 })
    expect(s.streak).toBe(0)
  })
  it('reset returns to the initial state', () => {
    let s = initQuizState(questions)
    s = reduce(reduce(s, { type: 'set', id: 'mc', value: 'b' }), { type: 'check', id: 'mc' })
    expect(reduce(s, { type: 'reset' })).toMatchObject({ graded: {}, streak: 0 })
  })
})

describe('scores and cues', () => {
  it('sums and rounds', () => {
    expect(totalScore(questions, { mc: 1, tf: 0.5 })).toBe(1.5)
    expect(percentScore(questions, { mc: 1, tf: 0.5 })).toBe(50)
    expect(percentScore([], {})).toBe(0)
  })
  it('maps outcomes and cues', () => {
    expect(outcomeOf(1)).toBe('ok'); expect(outcomeOf(0.4)).toBe('part'); expect(outcomeOf(0)).toBe('bad')
    expect(cueFor(1, 1)).toBe('ok'); expect(cueFor(1, 3)).toBe('streak'); expect(cueFor(1, 4)).toBe('ok'); expect(cueFor(1, 6)).toBe('streak')
    expect(cueFor(0.5, 9)).toBe('part'); expect(cueFor(0, 9)).toBe('bad')
  })
})
