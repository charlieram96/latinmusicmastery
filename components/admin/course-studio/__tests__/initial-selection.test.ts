import { describe, expect, it } from 'vitest'
import { resolveInitialSelection } from '../initial-selection'
import type { SectionWithClasses } from '../types'

const sections = [
  { id: 'm1', classes: [{ id: 'c1', items: [{ id: 'i1' }] }] },
  { id: 'm2', classes: [{ id: 'c2', items: [{ id: 'i2' }, { id: 'i3' }] }] },
] as unknown as SectionWithClasses[]

describe('resolveInitialSelection', () => {
  it('opens the requested lesson and selects the requested item', () => {
    expect(resolveInitialSelection(sections, { classId: 'c2', itemId: 'i3' })).toEqual({
      center: { type: 'class', id: 'c2' },
      drawer: { type: 'item', id: 'i3' },
    })
  })
  it('opens the requested lesson when the item is missing or belongs elsewhere', () => {
    expect(resolveInitialSelection(sections, { classId: 'c2' })).toEqual({
      center: { type: 'class', id: 'c2' },
      drawer: { type: 'class', id: 'c2' },
    })
    expect(resolveInitialSelection(sections, { classId: 'c2', itemId: 'i1' })).toEqual({
      center: { type: 'class', id: 'c2' },
      drawer: { type: 'class', id: 'c2' },
    })
  })
  it('keeps modules closed when a saved lesson no longer exists', () => {
    expect(resolveInitialSelection(sections, { classId: 'nope', itemId: 'i3' })).toEqual({ center: null, drawer: { type: 'none' } })
  })
  it('starts with a closed inspector and no selected class or module', () => {
    expect(resolveInitialSelection(sections)).toEqual({ center: null, drawer: { type: 'none' } })
    expect(resolveInitialSelection([{ id: 'm1', classes: [] }] as unknown as SectionWithClasses[])).toEqual({ center: null, drawer: { type: 'none' } })
    expect(resolveInitialSelection([])).toEqual({ center: null, drawer: { type: 'none' } })
  })
})
