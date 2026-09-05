import { describe, expect, it } from 'vitest'
import { QUIZ_FIELDS, localizeRow, mergeLocalizedOptions } from '@/lib/i18n/localize'

// `quiz_questions.correct_answer` and student answers are English choice ids, so
// the Spanish overlay must never replace ids — only the translated strings.

function mcQuestion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'q1',
    question: 'Where does the timbal have its roots?',
    question_es: '¿De dónde proviene el timbal?',
    correct_answer: 'b',
    options: {
      choices: [
        { id: 'a', text: 'The African djembe' },
        { id: 'b', text: 'The European timpani' },
        { id: 'c', text: 'The Spanish tambor' },
      ],
    },
    options_es: null as unknown,
    ...overrides,
  }
}

describe('localizeRow – quiz options overlay', () => {
  it('keeps English choice ids when options_es was saved with fresh ids (positional match)', () => {
    const row = mcQuestion({
      options_es: {
        choices: [
          { id: 'x1', text: 'El djembe africano.' },
          { id: 'x2', text: 'Los timpani europeos.' },
          { id: 'x3', text: 'El tambor español.' },
        ],
      },
    })
    localizeRow(row, 'es', QUIZ_FIELDS)
    expect(row.question).toBe('¿De dónde proviene el timbal?')
    expect(row.options).toEqual({
      choices: [
        { id: 'a', text: 'El djembe africano.' },
        { id: 'b', text: 'Los timpani europeos.' },
        { id: 'c', text: 'El tambor español.' },
      ],
    })
    // The correct answer still resolves to a rendered choice.
    const choices = (row.options as { choices: { id: string }[] }).choices
    expect(choices.some((c) => c.id === row.correct_answer)).toBe(true)
  })

  it('matches by id when ids line up, even if the Spanish list is reordered', () => {
    const row = mcQuestion({
      options_es: {
        choices: [
          { id: 'c', text: 'El tambor español.' },
          { id: 'a', text: 'El djembe africano.' },
          { id: 'b', text: 'Los timpani europeos.' },
        ],
      },
    })
    localizeRow(row, 'es', QUIZ_FIELDS)
    expect(row.options).toEqual({
      choices: [
        { id: 'a', text: 'El djembe africano.' },
        { id: 'b', text: 'Los timpani europeos.' },
        { id: 'c', text: 'El tambor español.' },
      ],
    })
  })

  it('leaves an English entry untouched when the Spanish list has no match for it', () => {
    const row = mcQuestion({
      options_es: { choices: [{ id: 'b', text: 'Los timpani europeos.' }] },
    })
    localizeRow(row, 'es', QUIZ_FIELDS)
    expect(row.options).toEqual({
      choices: [
        { id: 'a', text: 'The African djembe' },
        { id: 'b', text: 'Los timpani europeos.' },
        { id: 'c', text: 'The Spanish tambor' },
      ],
    })
  })

  it('keeps the English list when no ids match and the lengths differ', () => {
    const row = mcQuestion({
      options_es: { choices: [{ id: 'x1', text: 'Uno' }, { id: 'x2', text: 'Dos' }] },
    })
    localizeRow(row, 'es', QUIZ_FIELDS)
    expect(row.options).toEqual(mcQuestion().options)
  })

  it('ignores empty Spanish strings and never overlays the id', () => {
    const row = mcQuestion({
      options_es: { choices: [{ id: 'zzz', text: '' }, { id: 'zzz', text: '  ' }, { id: 'zzz', text: 'Tres' }] },
    })
    localizeRow(row, 'es', QUIZ_FIELDS)
    expect(row.options).toEqual({
      choices: [
        { id: 'a', text: 'The African djembe' },
        { id: 'b', text: 'The European timpani' },
        { id: 'c', text: 'Tres' },
      ],
    })
  })

  it('overlays strings but keeps structural values on the other option shapes', () => {
    const ordering = {
      options: {
        items: [
          { id: 'i1', text: 'First', correctPosition: 0 },
          { id: 'i2', text: 'Second', correctPosition: 1 },
        ],
      },
      options_es: {
        items: [
          { id: 'i1', text: 'Primero', correctPosition: 99 },
          { id: 'i2', text: 'Segundo', correctPosition: 99 },
        ],
      },
    }
    localizeRow(ordering, 'es', QUIZ_FIELDS)
    expect(ordering.options).toEqual({
      items: [
        { id: 'i1', text: 'Primero', correctPosition: 0 },
        { id: 'i2', text: 'Segundo', correctPosition: 1 },
      ],
    })

    const pairs = {
      options: { pairs: [{ id: 'p1', left: 'Clave', right: 'Wood' }] },
      options_es: { pairs: [{ id: 'p1', left: 'Clave', right: 'Madera' }] },
    }
    localizeRow(pairs, 'es', QUIZ_FIELDS)
    expect(pairs.options).toEqual({ pairs: [{ id: 'p1', left: 'Clave', right: 'Madera' }] })

    const blanks = {
      options: { text: 'The {{blank}} keeps time', blanks: [{ id: 'b1', answer: 'clave' }] },
      options_es: { text: 'La {{blank}} lleva el tiempo', blanks: [{ id: 'b1', answer: 'clave' }] },
    }
    localizeRow(blanks, 'es', QUIZ_FIELDS)
    expect(blanks.options).toEqual({ text: 'La {{blank}} lleva el tiempo', blanks: [{ id: 'b1', answer: 'clave' }] })

    const pieces = {
      options: {
        pieces: [{ id: 'pc1', label: 'Bell', imageUrl: '/bell.png', width: 10, area: { x: 1, y: 2, width: 3, height: 4 } }],
      },
      options_es: { pieces: [{ id: 'pc1', label: 'Campana', width: 50, area: { x: 9, y: 9, width: 9, height: 9 } }] },
    }
    localizeRow(pieces, 'es', QUIZ_FIELDS)
    expect(pieces.options).toEqual({
      pieces: [{ id: 'pc1', label: 'Campana', imageUrl: '/bell.png', width: 10, area: { x: 1, y: 2, width: 3, height: 4 } }],
    })
  })

  it('keeps a non-object English value (true_false answer) untouched', () => {
    const row = { options: { answer: true }, options_es: { answer: false } }
    localizeRow(row, 'es', QUIZ_FIELDS)
    expect(row.options).toEqual({ answer: true })
  })

  it('falls back to options_es wholesale when there are no English options', () => {
    const row = { options: null as unknown, options_es: { choices: [{ id: 'x', text: 'Sí' }] } }
    localizeRow(row, 'es', QUIZ_FIELDS)
    expect(row.options).toEqual({ choices: [{ id: 'x', text: 'Sí' }] })
  })

  it('does nothing for the en locale or when options_es is empty', () => {
    const en = mcQuestion({ options_es: { choices: [{ id: 'x1', text: 'Uno' }] } })
    localizeRow(en, 'en', QUIZ_FIELDS)
    expect(en.options).toEqual(mcQuestion().options)

    const empty = mcQuestion({ options_es: null })
    localizeRow(empty, 'es', QUIZ_FIELDS)
    expect(empty.options).toEqual(mcQuestion().options)
  })

  it('exposes mergeLocalizedOptions for direct use', () => {
    expect(mergeLocalizedOptions({ choices: [{ id: 'a', text: 'A' }] }, { choices: [{ id: 'z', text: 'Á' }] })).toEqual({
      choices: [{ id: 'a', text: 'Á' }],
    })
  })
})

describe('mergeLocalizedOptions – piece placement composition', () => {
  it('keeps the background composition structural (only piece labels overlay)', () => {
    const en = {
      background: { color: '#0A0A0A', aspect: 1.6, layers: [{ id: 'l1', imageUrl: 'riser.png', x: 20, y: 5, width: 60, height: 30 }] },
      pieces: [{ id: 'p1', label: 'Congas', imageUrl: 'c.png', width: 12, area: { x: 1, y: 2, width: 3, height: 4 } }],
    }
    const es = { pieces: [{ id: 'p1', label: 'Congas (ES)' }] }
    const out = mergeLocalizedOptions(en, es) as typeof en
    expect(out.background).toEqual(en.background)
    expect(out.pieces[0]).toEqual({ ...en.pieces[0], label: 'Congas (ES)' })
  })
})
