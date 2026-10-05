import { describe, it, expect } from 'vitest'
import { gradeQuestion, gradeQuestionScore, hasAnswer, isPieceCorrect, shuffleStable, norm, type PlacementPiece } from '../grading'
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
    audio_url: null,
    image_url: null,
    created_at: null,
    updated_at: null,
    ...partial,
  }
}

function piece(partial: Partial<PlacementPiece>): PlacementPiece {
  return { id: 'p1', imageUrl: '', width: 10, area: { x: 20, y: 20, width: 20, height: 20 }, ...partial }
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

  it('audio_choice: correct when answer id matches correct_answer', () => {
    const question = q({ question_type: 'audio_choice', correct_answer: 'c2', options: { optionMode: 'text', choices: [{ id: 'c1', text: 'Clave' }, { id: 'c2', text: 'Conga' }] } })
    expect(gradeQuestion(question, 'c2')).toBe(true)
    expect(gradeQuestion(question, 'c1')).toBe(false)
    expect(gradeQuestion(question, undefined)).toBe(false)
  })

})

describe('isPieceCorrect', () => {
  const p = piece({ area: { x: 20, y: 30, width: 20, height: 10 } })
  it('true when the piece center is inside the area', () => {
    expect(isPieceCorrect(p, { x: 30, y: 35 })).toBe(true)
  })
  it('true on the area boundary (inclusive)', () => {
    expect(isPieceCorrect(p, { x: 20, y: 30 })).toBe(true)
    expect(isPieceCorrect(p, { x: 40, y: 40 })).toBe(true)
  })
  it('false when the center is outside the area', () => {
    expect(isPieceCorrect(p, { x: 19.9, y: 35 })).toBe(false)
    expect(isPieceCorrect(p, { x: 30, y: 41 })).toBe(false)
  })
  it('false when the piece is unplaced', () => {
    expect(isPieceCorrect(p, undefined)).toBe(false)
  })
})

describe('gradeQuestionScore', () => {
  it('piece_placement: fraction of pieces whose center is inside their area', () => {
    const question = q({
      question_type: 'piece_placement',
      options: {
        pieces: [
          piece({ id: 'p1', area: { x: 0, y: 0, width: 20, height: 20 } }),
          piece({ id: 'p2', area: { x: 50, y: 50, width: 20, height: 20 } }),
        ],
      },
    })
    expect(gradeQuestionScore(question, { p1: { x: 10, y: 10 }, p2: { x: 60, y: 60 } })).toBe(1)
    expect(gradeQuestionScore(question, { p1: { x: 10, y: 10 }, p2: { x: 10, y: 10 } })).toBe(0.5)
    expect(gradeQuestionScore(question, { p1: { x: 90, y: 90 }, p2: { x: 10, y: 10 } })).toBe(0)
  })
  it('piece_placement: unplaced pieces count as wrong', () => {
    const question = q({
      question_type: 'piece_placement',
      options: {
        pieces: [
          piece({ id: 'p1', area: { x: 0, y: 0, width: 20, height: 20 } }),
          piece({ id: 'p2', area: { x: 50, y: 50, width: 20, height: 20 } }),
        ],
      },
    })
    expect(gradeQuestionScore(question, { p1: { x: 10, y: 10 } })).toBe(0.5)
    expect(gradeQuestionScore(question, undefined)).toBe(0)
  })
  it('piece_placement: no pieces configured scores 0', () => {
    const question = q({ question_type: 'piece_placement', options: { pieces: [] } })
    expect(gradeQuestionScore(question, {})).toBe(0)
  })
  it('boolean question types map to exactly 0 or 1', () => {
    const mc = q({ question_type: 'multiple_choice', correct_answer: 'b', options: { choices: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] } })
    expect(gradeQuestionScore(mc, 'b')).toBe(1)
    expect(gradeQuestionScore(mc, 'a')).toBe(0)
    const tf = q({ question_type: 'true_false', correct_answer: 'true' })
    expect(gradeQuestionScore(tf, 'TRUE')).toBe(1)
    expect(gradeQuestionScore(tf, 'false')).toBe(0)
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
  it('audio_choice needs a non-empty string', () => {
    const question = q({ question_type: 'audio_choice' })
    expect(hasAnswer(question, 'c1')).toBe(true)
    expect(hasAnswer(question, '')).toBe(false)
  })
  it('piece_placement needs at least one placed piece', () => {
    const question = q({ question_type: 'piece_placement' })
    expect(hasAnswer(question, { p1: { x: 10, y: 10 } })).toBe(true)
    expect(hasAnswer(question, {})).toBe(false)
  })
})


describe('small bell placement tolerance', () => {
  it.each(['Hand Bell', 'Bell Cha', 'Campana de bongó', 'Campana cha'])('requires %s near its target center', label => {
    const bell = piece({ label, area: { x: 20, y: 30, width: 20, height: 20 } })
    expect(isPieceCorrect(bell, { x: 30, y: 40 })).toBe(true)
    expect(isPieceCorrect(bell, { x: 31.5, y: 38.5 })).toBe(true)
    expect(isPieceCorrect(bell, { x: 32, y: 40 })).toBe(false)
    expect(isPieceCorrect(bell, { x: 30, y: 43 })).toBe(false)
    expect(gradeQuestionScore(q({ question_type: 'piece_placement', options: { pieces: [bell] } }), { p1: { x: 32, y: 40 } })).toBe(0)
  })
  it('preserves a stricter authored bell tolerance', () => {
    const bell = piece({ label: 'Hand Bell', tolerance: 0.5 })
    expect(isPieceCorrect(bell, { x: 30.6, y: 30 })).toBe(false)
    expect(isPieceCorrect(bell, { x: 30.5, y: 30 })).toBe(true)
  })
})
