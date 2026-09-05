import { describe, expect, it } from 'vitest'
import { countCorrectPieces, fullCorrectLabel, userAnswerLabel } from '../labels'
import type { QuizQuestion } from '@/types/modules'

function q(partial: Partial<QuizQuestion>): QuizQuestion {
  return {
    id: 'q', class_item_id: 'c', order_index: 0, question: 'Q', question_type: 'multiple_choice', options: null,
    correct_answer: null, explanation: null, question_es: null, explanation_es: null, options_es: null,
    audio_url: null, image_url: null, created_at: null, updated_at: null, ...partial,
  }
}

describe('userAnswerLabel', () => {
  it('names choices, echoes text, joins structured answers', () => {
    const mc = q({ options: { choices: [{ id: 'a', text: 'Four' }, { id: 'b', text: 'Five' }] }, correct_answer: 'b' })
    expect(userAnswerLabel(mc, 'a')).toBe('Four')
    expect(userAnswerLabel(mc, 'zzz')).toBe('')
    expect(userAnswerLabel(q({ question_type: 'text_answer' }), 'claves')).toBe('claves')
    const fill = q({ question_type: 'fill_in_blank', options: { text: '{{a}} and {{b}}', blanks: [{ id: 'a', answer: 'guajeo' }, { id: 'b', answer: 'clave' }] } })
    expect(userAnswerLabel(fill, { a: 'tumbao' })).toBe('tumbao, —')
    const match = q({ question_type: 'matching_pairs', options: { pairs: [{ id: 'p1', left: 'Congas', right: 'Marcha' }, { id: 'p2', left: 'Bongó', right: 'Martillo' }] } })
    expect(userAnswerLabel(match, { p1: 'Martillo' })).toBe('Congas → Martillo · Bongó → —')
    const ord = q({ question_type: 'ordering_sequence', options: { items: [{ id: 'i1', text: 'Intro', correctPosition: 0 }, { id: 'i2', text: 'Coda', correctPosition: 1 }] } })
    expect(userAnswerLabel(ord, ['i2', 'i1'])).toBe('Coda → Intro')
  })
})

describe('fullCorrectLabel', () => {
  it('covers every type the review list shows', () => {
    expect(fullCorrectLabel(q({ options: { choices: [{ id: 'b', text: 'Five' }] }, correct_answer: 'b' }))).toBe('Five')
    expect(fullCorrectLabel(q({ question_type: 'true_false', correct_answer: 'true' }))).toBe('true')
    expect(fullCorrectLabel(q({ question_type: 'fill_in_blank', options: { text: '', blanks: [{ id: 'a', answer: 'guajeo' }, { id: 'b', answer: 'clave' }] } }))).toBe('guajeo, clave')
    expect(fullCorrectLabel(q({ question_type: 'matching_pairs', options: { pairs: [{ id: 'p1', left: 'Congas', right: 'Marcha' }] } }))).toBe('Congas → Marcha')
    expect(fullCorrectLabel(q({ question_type: 'ordering_sequence', options: { items: [{ id: 'i2', text: 'Coda', correctPosition: 1 }, { id: 'i1', text: 'Intro', correctPosition: 0 }] } }))).toBe('Intro → Coda')
    expect(fullCorrectLabel(q({ question_type: 'piece_placement', options: { pieces: [] } }))).toBe('')
  })
})

describe('countCorrectPieces', () => {
  it('counts centers inside areas', () => {
    const pp = q({ question_type: 'piece_placement', options: { pieces: [
      { id: 'a', imageUrl: '', width: 10, area: { x: 0, y: 0, width: 10, height: 10 } },
      { id: 'b', imageUrl: '', width: 10, area: { x: 50, y: 50, width: 10, height: 10 } },
    ] } })
    expect(countCorrectPieces(pp, { a: { x: 5, y: 5 }, b: { x: 5, y: 5 } })).toEqual({ correct: 1, total: 2 })
    expect(countCorrectPieces(pp, undefined)).toEqual({ correct: 0, total: 2 })
  })
})
