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
  it('falls back to the first lesson when the requested lesson is unknown', () => {
    expect(resolveInitialSelection(sections, { classId: 'nope', itemId: 'i3' })).toEqual({
      center: { type: 'class', id: 'c1' },
      drawer: { type: 'class', id: 'c1' },
    })
  })
  it('defaults to the first lesson, then first module, then course settings', () => {
    expect(resolveInitialSelection(sections)).toEqual({
      center: { type: 'class', id: 'c1' },
      drawer: { type: 'class', id: 'c1' },
    })
    const emptyModules = [{ id: 'm1', classes: [] }] as unknown as SectionWithClasses[]
    expect(resolveInitialSelection(emptyModules)).toEqual({
      center: { type: 'module', id: 'm1' },
      drawer: { type: 'module', id: 'm1' },
    })
    expect(resolveInitialSelection([])).toEqual({ center: null, drawer: { type: 'course' } })
  })
})
