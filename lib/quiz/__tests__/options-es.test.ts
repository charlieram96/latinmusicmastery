import { describe, expect, it } from 'vitest'
import { patchLocalizedEntry, pruneLocalizedEntries, readLocalizedField } from '@/lib/quiz/options-es'

// `options_es` mirrors the English `options` lists entry-by-entry, keyed by the
// SAME ids, carrying only translated strings. These helpers keep that invariant
// for the admin builder.

describe('patchLocalizedEntry', () => {
  it('creates the list and entry when options_es is empty', () => {
    expect(patchLocalizedEntry(null, 'choices', 'a', { text: 'Uno' })).toEqual({
      choices: [{ id: 'a', text: 'Uno' }],
    })
    expect(patchLocalizedEntry(undefined, 'items', 'i1', { text: 'Primero' })).toEqual({
      items: [{ id: 'i1', text: 'Primero' }],
    })
  })

  it('updates an existing entry in place and preserves sibling entries and other keys', () => {
    const es = { text: 'La {{b}} lleva el tiempo', choices: [{ id: 'a', text: 'Uno' }, { id: 'b', text: 'Dos' }] }
    expect(patchLocalizedEntry(es, 'choices', 'b', { text: 'Dos!' })).toEqual({
      text: 'La {{b}} lleva el tiempo',
      choices: [{ id: 'a', text: 'Uno' }, { id: 'b', text: 'Dos!' }],
    })
  })

  it('merges partial patches (left/right) without dropping the other side', () => {
    const es = { pairs: [{ id: 'p1', left: 'Clave' }] }
    expect(patchLocalizedEntry(es, 'pairs', 'p1', { right: 'Madera' })).toEqual({
      pairs: [{ id: 'p1', left: 'Clave', right: 'Madera' }],
    })
  })

  it('does not mutate its input', () => {
    const es = { choices: [{ id: 'a', text: 'Uno' }] }
    patchLocalizedEntry(es, 'choices', 'a', { text: 'X' })
    expect(es).toEqual({ choices: [{ id: 'a', text: 'Uno' }] })
  })

  it('never writes an id other than the one requested', () => {
    const out = patchLocalizedEntry(null, 'choices', 'a', { id: 'zzz', text: 'Uno' } as never)
    expect(out).toEqual({ choices: [{ id: 'a', text: 'Uno' }] })
  })
})

describe('pruneLocalizedEntries', () => {
  it('drops Spanish entries whose id no longer exists in the English list', () => {
    const es = { choices: [{ id: 'a', text: 'Uno' }, { id: 'gone', text: 'X' }] }
    expect(pruneLocalizedEntries(es, 'choices', ['a', 'b'])).toEqual({ choices: [{ id: 'a', text: 'Uno' }] })
  })

  it('returns the input untouched when there is nothing to prune', () => {
    expect(pruneLocalizedEntries(null, 'choices', ['a'])).toBeNull()
    const es = { choices: [{ id: 'a', text: 'Uno' }] }
    expect(pruneLocalizedEntries(es, 'choices', ['a'])).toEqual(es)
  })
})

describe('readLocalizedField', () => {
  it('reads a translated string by list, id and field, defaulting to empty', () => {
    const es = { pairs: [{ id: 'p1', left: 'Clave', right: 'Madera' }] }
    expect(readLocalizedField(es, 'pairs', 'p1', 'right')).toBe('Madera')
    expect(readLocalizedField(es, 'pairs', 'p1', 'left')).toBe('Clave')
    expect(readLocalizedField(es, 'pairs', 'nope', 'left')).toBe('')
    expect(readLocalizedField(null, 'pairs', 'p1', 'left')).toBe('')
  })
})
