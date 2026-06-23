import { describe, it, expect } from 'vitest'
import { gradeQuestion, hasAnswer, shuffleStable, norm } from '../grading'
import type { QuizQuestion } from '@/types/modules'

function q(partial: Partial<QuizQuestion>): QuizQuestion {
  return {
    id: 'q1',
    class_item_id: 'c1',
    order_index: 0,
    question: 'Q',
    question_type: 'multiple_choice',
    options: null,
    correct_answer: null,
    explanation: null,
    question_es: null,
    explanation_es: null,
    options_es: null,
    created_at: null,
    updated_at: null,
    ...partial,
  }
}

describe('norm', () => {
  it('lowercases and trims', () => {
    expect(norm('  HeLLo ')).toBe('hello')
  })
})

describe('shuffleStable', () => {
  it('is deterministic for a given seed', () => {
    const a = shuffleStable([1, 2, 3, 4, 5], 'seed')
    const b = shuffleStable([1, 2, 3, 4, 5], 'seed')
    expect(a).toEqual(b)
  })
  it('preserves all elements', () => {
    expect([...shuffleStable([1, 2, 3], 'x')].sort()).toEqual([1, 2, 3])
  })
})

describe('gradeQuestion', () => {
  it('multiple_choice: correct when answer id matches correct_answer', () => {
    const question = q({ question_type: 'multiple_choice', correct_answer: 'b', options: { choices: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] } })
    expect(gradeQuestion(question, 'b')).toBe(true)
    expect(gradeQuestion(question, 'a')).toBe(false)
    expect(gradeQuestion(question, undefined)).toBe(false)
  })

  it('true_false: case-insensitive match to correct_answer', () => {
    const question = q({ question_type: 'true_false', correct_answer: 'true' })
    expect(gradeQuestion(question, 'true')).toBe(true)
    expect(gradeQuestion(question, 'TRUE')).toBe(true)
    expect(gradeQuestion(question, 'false')).toBe(false)
  })

  it('text_answer and audio: normalized string match', () => {
    const t = q({ question_type: 'text_answer', correct_answer: 'Dorian' })
    expect(gradeQuestion(t, ' dorian ')).toBe(true)
    expect(gradeQuestion(t, 'phrygian')).toBe(false)
    const a = q({ question_type: 'audio', correct_answer: 'C major' })
    expect(gradeQuestion(a, 'c MAJOR')).toBe(true)
  })

  it('fill_in_blank: all blanks must match', () => {
    const question = q({ question_type: 'fill_in_blank', options: { text: '{{x}} and {{y}}', blanks: [{ id: 'x', answer: 'one' }, { id: 'y', answer: 'two' }] } })
    expect(gradeQuestion(question, { x: 'ONE', y: ' two ' })).toBe(true)
    expect(gradeQuestion(question, { x: 'one', y: 'three' })).toBe(false)
    expect(gradeQuestion(question, { x: 'one' })).toBe(false)
  })

  it('matching_pairs: each left maps to its right text', () => {
    const question = q({ question_type: 'matching_pairs', options: { pairs: [{ id: 'l1', left: 'A', right: 'Alpha' }, { id: 'l2', left: 'B', right: 'Beta' }] } })
    expect(gradeQuestion(question, { l1: 'Alpha', l2: 'Beta' })).toBe(true)
    expect(gradeQuestion(question, { l1: 'Beta', l2: 'Alpha' })).toBe(false)
  })

  it('ordering_sequence: ids must land in correctPosition order', () => {
    const question = q({ question_type: 'ordering_sequence', options: { items: [{ id: 'a', text: 'A', correctPosition: 0 }, { id: 'b', text: 'B', correctPosition: 1 }, { id: 'c', text: 'C', correctPosition: 2 }] } })
    expect(gradeQuestion(question, ['a', 'b', 'c'])).toBe(true)
    expect(gradeQuestion(question, ['b', 'a', 'c'])).toBe(false)
    expect(gradeQuestion(question, ['a', 'b'])).toBe(false)
  })
})

describe('hasAnswer', () => {
  it('multiple_choice needs a non-empty string', () => {
    const question = q({ question_type: 'multiple_choice' })
    expect(hasAnswer(question, 'a')).toBe(true)
    expect(hasAnswer(question, '')).toBe(false)
    expect(hasAnswer(question, undefined)).toBe(false)
  })
  it('fill_in_blank needs at least one entry', () => {
    const question = q({ question_type: 'fill_in_blank' })
    expect(hasAnswer(question, { x: 'a' })).toBe(true)
    expect(hasAnswer(question, {})).toBe(false)
  })
  it('ordering_sequence always has an order', () => {
    expect(hasAnswer(q({ question_type: 'ordering_sequence' }), undefined)).toBe(true)
  })
})
