// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest'
import type { RenderContext } from 'vexflow'
import { Formatter, Renderer, Stave, StaveNote, Voice } from 'vexflow'
import { spanSegments, drawSpanSegments, type PlacedNote } from '../notation/spans'

beforeAll(() => {
  // VexFlow measures annotation text through a canvas; jsdom has none.
  const ctx = { measureText: (s: string) => ({ width: String(s).length * 7, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2, fontBoundingBoxAscent: 8, fontBoundingBoxDescent: 2 }), font: '' }
  HTMLCanvasElement.prototype.getContext = (() => ctx) as never
})

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
  it('splits a hairpin at each system boundary it crosses', () => {
    expect(spanSegments([{ id: 's', type: 'dim', from: 'b', to: 'e' }], placed)).toEqual([
      { type: 'dim', from: placed[1].note, to: placed[2].note, fromHasDynamic: false },
      { type: 'dim', from: placed[3].note, to: placed[4].note },
    ])
  })
  it('keeps a hairpin piece even when from and to are the same note (lone note at break)', () => {
    const p = [n('a', 0), n('b', 0), n('c', 1)]
    expect(spanSegments([{ id: 's', type: 'cresc', from: 'b', to: 'c' }], p)).toEqual([
      { type: 'cresc', from: p[1].note, to: p[1].note, fromHasDynamic: false },
      { type: 'cresc', from: p[2].note, to: p[2].note },
    ])
  })
  it('emits one segment per system for a span from last note of system 0 to first note of system 1', () => {
    const p = [n('a', 0), n('b', 0), n('c', 1), n('d', 1)]
    expect(spanSegments([{ id: 's', type: 'cresc', from: 'b', to: 'c' }], p)).toEqual([
      { type: 'cresc', from: p[1].note, to: p[1].note, fromHasDynamic: false },
      { type: 'cresc', from: p[2].note, to: p[2].note },
    ])
  })
  it('emits three segments for a span over systems 0..2, with middle system first-to-last', () => {
    const p = [n('a', 0), n('b', 0), n('c', 1), n('d', 1), n('e', 2), n('f', 2)]
    expect(spanSegments([{ id: 's', type: 'cresc', from: 'a', to: 'f' }], p)).toEqual([
      { type: 'cresc', from: p[0].note, to: p[1].note, fromHasDynamic: false },
      { type: 'cresc', from: p[2].note, to: p[3].note },
      { type: 'cresc', from: p[4].note, to: p[5].note },
    ])
  })
  it('emits three segments for a slur over systems 0..2, with middle system as a full curve', () => {
    const p = [n('a', 0), n('b', 0), n('c', 1), n('d', 1), n('e', 2), n('f', 2)]
    expect(spanSegments([{ id: 's', type: 'slur', from: 'a', to: 'f' }], p)).toEqual([
      { type: 'slur', from: p[0].note, to: undefined, fromHasDynamic: false },
      { type: 'slur', from: p[2].note, to: p[3].note },
      { type: 'slur', from: undefined, to: p[5].note },
    ])
  })
  it('finds the correct last note of the middle system when notes follow the span (regression: reversed-index bug)', () => {
    const p = [n('a', 0), n('b', 0), n('c', 1), n('d', 1), n('e', 2), n('f', 2), n('g', 1)]
    expect(spanSegments([{ id: 's', type: 'cresc', from: 'a', to: 'f' }], p)).toEqual([
      { type: 'cresc', from: p[0].note, to: p[1].note, fromHasDynamic: false },
      { type: 'cresc', from: p[2].note, to: p[3].note },
      { type: 'cresc', from: p[4].note, to: p[5].note },
    ])
  })
  it('does not throw when notes with matching systems appear after the span (regression: reversed-index bug)', () => {
    const p = [n('a', 0), n('b', 0), n('c', 1), n('d', 1), n('e', 2), n('f', 2), n('g', 3), n('h', 3), n('i', 3), n('j', 3), n('k', 3)]
    expect(() => spanSegments([{ id: 's', type: 'cresc', from: 'a', to: 'f' }], p)).not.toThrow()
    expect(spanSegments([{ id: 's', type: 'cresc', from: 'a', to: 'f' }], p)).toEqual([
      { type: 'cresc', from: p[0].note, to: p[1].note, fromHasDynamic: false },
      { type: 'cresc', from: p[2].note, to: p[3].note },
      { type: 'cresc', from: p[4].note, to: p[5].note },
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

// Builds a stave with two formatted, drawn StaveNotes — the same
// build-stave -> format-voice -> draw-voice sequence the real renderer uses
// (see notation/build-measure.ts and staff-renderer.tsx) — so the notes have
// real stave/x/y positions before drawSpanSegments tries to place a span on
// them. Without this, every Curve/StaveHairpin throws inside the try/catch
// and the smoke test would prove nothing.
function formattedNotes() {
  const div = document.createElement('div')
  document.body.appendChild(div)
  const renderer = new Renderer(div, Renderer.Backends.SVG)
  renderer.resize(500, 200)
  const ctx = renderer.getContext() as RenderContext

  const stave = new Stave(10, 40, 400)
  stave.addClef('treble')
  stave.setContext(ctx).draw()

  const note1 = new StaveNote({ keys: ['c/4'], duration: 'q' })
  const note2 = new StaveNote({ keys: ['e/4'], duration: 'q' })
  const voice = new Voice({ numBeats: 2, beatValue: 4 })
  voice.setMode(Voice.Mode.SOFT)
  voice.addTickables([note1, note2])
  new Formatter().joinVoices([voice]).format([voice], 350)
  voice.draw(ctx, stave)

  return { div, ctx, note1, note2 }
}

describe('drawSpanSegments (jsdom smoke test)', () => {
  it('draws a slur as an additional SVG path', () => {
    const { div, ctx, note1, note2 } = formattedNotes()
    const before = div.querySelectorAll('path').length
    expect(() => drawSpanSegments(ctx, [{ type: 'slur', from: note1, to: note2 }])).not.toThrow()
    expect(div.querySelectorAll('path').length).toBeGreaterThan(before)
    document.body.removeChild(div)
  })

  it('draws a slur that is open at a line break', () => {
    const { div, ctx, note1 } = formattedNotes()
    const before = div.querySelectorAll('path').length
    drawSpanSegments(ctx, [{ type: 'slur', from: note1, to: undefined }])
    expect(div.querySelectorAll('path').length).toBeGreaterThan(before)
    document.body.removeChild(div)
  })

  it('draws a crescendo hairpin with fromHasDynamic as an additional SVG path', () => {
    const { div, ctx, note1, note2 } = formattedNotes()
    const before = div.querySelectorAll('path').length
    expect(() => drawSpanSegments(ctx, [{ type: 'cresc', from: note1, to: note2, fromHasDynamic: true }])).not.toThrow()
    expect(div.querySelectorAll('path').length).toBeGreaterThan(before)
    document.body.removeChild(div)
  })

  it('draws a single-note hairpin piece as an additional SVG path', () => {
    const { div, ctx, note2 } = formattedNotes()
    const before = div.querySelectorAll('path').length
    expect(() => drawSpanSegments(ctx, [{ type: 'dim', from: note2, to: note2 }])).not.toThrow()
    expect(div.querySelectorAll('path').length).toBeGreaterThan(before)
    document.body.removeChild(div)
  })
})
