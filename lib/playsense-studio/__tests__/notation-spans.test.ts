import { describe, expect, it } from 'vitest'
import type { StaveNote } from 'vexflow'
import { spanSegments, type PlacedNote } from '../notation/spans'

const n = (id: string, system = 0, hasDynamic = false): PlacedNote => ({ id, system, hasDynamic, note: { id } as unknown as StaveNote })

describe('spanSegments', () => {
  const placed = [n('a', 0, true), n('b'), n('c'), n('d', 1), n('e', 1)]
  it('draws a span within one system as one segment', () => {
    expect(spanSegments([{ id: 's', type: 'cresc', from: 'a', to: 'c' }], placed)).toEqual([
      { type: 'cresc', from: placed[0].note, to: placed[2].note, fromHasDynamic: true },
    ])
  })
  it('splits a slur across a line break into two open curves', () => {
    expect(spanSegments([{ id: 's', type: 'slur', from: 'b', to: 'e' }], placed)).toEqual([
      { type: 'slur', from: placed[1].note, to: undefined, fromHasDynamic: false },
      { type: 'slur', from: undefined, to: placed[4].note },
    ])
  })
  it('splits a hairpin at the last and first notes of each system', () => {
    expect(spanSegments([{ id: 's', type: 'dim', from: 'b', to: 'e' }], placed)).toEqual([
      { type: 'dim', from: placed[1].note, to: placed[2].note, fromHasDynamic: false },
      { type: 'dim', from: placed[3].note, to: placed[4].note },
    ])
  })
  it('skips spans that are degenerate, reversed or point at missing notes', () => {
    expect(spanSegments([
      { id: '1', type: 'slur', from: 'b', to: 'b' },
      { id: '2', type: 'slur', from: 'c', to: 'a' },
      { id: '3', type: 'cresc', from: 'x', to: 'c' },
    ], placed)).toEqual([])
    expect(spanSegments(undefined, placed)).toEqual([])
  })
})
