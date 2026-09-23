// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest'
import { extractTrackEvents } from '../score-to-vexflow'
import { REFERENCE_EXCERPT_FIXTURE as F } from '../score-fixtures'
import { beamGroups, buildMeasure, descriptorToStaveNote, formatMeasure, staveHeader } from '../notation/build-measure'
import type { Dynamic, Track } from '@/components/playsense-studio/shared/score-model/types'

beforeAll(() => {
  // VexFlow measures annotation text through a canvas; jsdom has none.
  const ctx = { measureText: (s: string) => ({ width: String(s).length * 7, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2, fontBoundingBoxAscent: 8, fontBoundingBoxDescent: 2 }), font: '' }
  HTMLCanvasElement.prototype.getContext = (() => ctx) as never
})

const blocks = () => extractTrackEvents(F.tracks[0], F.initialTimeSignature, F.initialKeyFifths)
const mods = (n: { getModifiers(): { getCategory(): string }[] }, cat: string) => n.getModifiers().filter(m => m.getCategory() === cat).length

describe('beamGroups', () => {
  it('beams per beat and keeps tuplets whole', () => {
    const [b1, b2, b3] = blocks()
    expect(beamGroups(b1.events, [3, 4])).toEqual([[1, 2, 3], [4, 5, 6, 7]])
    expect(beamGroups(b2.events, [3, 4])).toEqual([])       // an eighth alone after a rest isn't beamed
    expect(beamGroups(b3.events, [3, 4])).toEqual([[1, 2, 3, 4, 5]])
  })
})

describe('descriptorToStaveNote', () => {
  it('attaches dots, accidentals, articulations, ornaments, dynamics, text and grace notes', () => {
    const [b1, , b3, b4] = blocks()
    const dd = descriptorToStaveNote(b4.events[0], { clef: 'treble' })
    expect(mods(dd, 'Dot')).toBe(2)
    expect(mods(dd, 'Accidental')).toBe(1)
    expect(mods(dd, 'Annotation')).toBe(1)
    expect(mods(descriptorToStaveNote(b4.events[2], { clef: 'treble' }), 'Articulation')).toBe(2)
    const tr = descriptorToStaveNote(b3.events[6], { clef: 'treble' })
    expect(mods(tr, 'Ornament')).toBe(1)
    expect(mods(tr, 'Articulation')).toBe(1)
    expect(mods(descriptorToStaveNote(b3.events[0], { clef: 'treble' }), 'GraceNoteGroup')).toBe(1)
    expect(mods(descriptorToStaveNote(b1.events[1], { clef: 'treble' }), 'Annotation')).toBe(1) // mp
  })
})

describe('descriptorToStaveNote percussion marcato', () => {
  it('does not double the marcato articulation from percussion notation', () => {
    const track: Track = {
      index: 0, instrument: 'perc-conga', displayName: 'Conga', tuning: null, stringMultiplicity: 1, channel: 9, defaultView: 'rhythm-grid',
      measures: [{ number: 1, voices: [{ number: 1, events: [
        { kind: 'note', id: 'p1', midi: 65, durationQN: 1, percussion: { staffLine: 'e/5', notehead: 'normal', marcato: true }, articulations: ['marcato'] },
      ] }] }],
    }
    const [blk] = extractTrackEvents(track, [4, 4], 0)
    const note = descriptorToStaveNote(blk.events[0], { clef: 'percussion' })
    const arts = note.getModifiers().filter(m => m.getCategory() === 'Articulation')
    expect(arts).toHaveLength(1)
    expect((arts[0] as unknown as { type: string }).type).toBe('a^')
  })
})

describe('descriptorToStaveNote dynamics glyphs', () => {
  it('gives every dynamic a distinct, non-empty Bravura glyph', () => {
    const [b1] = blocks()
    const dynamics: Dynamic[] = ['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff', 'fp', 'sfz']
    const texts = dynamics.map(dynamic => {
      const note = descriptorToStaveNote({ ...b1.events[1], dynamic }, { clef: 'treble' })
      const [annotation] = note.getModifiers().filter(m => m.getCategory() === 'Annotation') as unknown as { getText(): string }[]
      return annotation.getText()
    })
    texts.forEach(t => expect(t).not.toBe(''))
    expect(new Set(texts).size).toBe(dynamics.length)
  })
})

describe('buildMeasure', () => {
  it('makes tuplets that scale ticks, and formats without throwing', () => {
    const [b1, , b3] = blocks()
    const m1 = buildMeasure([b1.events], [3, 4], 'treble')!
    expect(m1.tuplets).toHaveLength(1)
    expect(m1.beams).toHaveLength(2)
    const quarter = m1.notes[0][0].getTicks().value() // the quarter rest
    expect(m1.notes[0][1].getTicks().value()).toBeCloseTo(quarter / 3, 6)
    expect(() => formatMeasure(m1, 300)).not.toThrow()
    const m3 = buildMeasure([b3.events], [3, 4], 'treble')!
    expect(m3.tuplets).toHaveLength(1)
    expect(m3.notes[0][1].getTicks().value()).toBeCloseTo(quarter / 5, 6)
  })
  it('stems two voices apart and keeps voice 1 at notes[0]', () => {
    const [, , , b4] = blocks()
    const m = buildMeasure([b4.events, b4.voice2Events], [3, 4], 'treble')!
    expect(m.voices).toHaveLength(2)
    expect(m.notes[0]).toHaveLength(3)
    expect(m.notes[0][1].getStemDirection()).toBe(1)
    expect(m.notes[1][0].getStemDirection()).toBe(-1)
    expect(() => formatMeasure(m, 300)).not.toThrow()
  })
  it('renders an overfull or empty-voice measure instead of throwing', () => {
    const [b1, b2] = blocks()
    expect(() => formatMeasure(buildMeasure([[...b1.events, ...b2.events]], [3, 4], 'treble')!, 300)).not.toThrow()
    expect(buildMeasure([[]], [3, 4], 'treble')).toBeNull()
    expect(buildMeasure([[], b1.events], [3, 4], 'treble')!.notes[0]).toEqual([])
  })
})

describe('staveHeader', () => {
  const bar = { clef: 'treble' as const, keyFifths: 2, keyChanged: false, clefChanged: false, timeSignature: [4, 4] as [number, number] }
  it('gives the opening bar the clef, key and time signature', () => {
    expect(staveHeader(bar, { opening: true, rowStart: true })).toEqual({ clef: 'treble', key: { spec: 'D' }, time: '4/4' })
  })
  it('restates the clef and key signature at every later row start', () => {
    expect(staveHeader(bar, { opening: false, rowStart: true })).toEqual({ clef: 'treble', key: { spec: 'D' } })
    expect(staveHeader({ ...bar, keyFifths: 0 }, { opening: false, rowStart: true })).toEqual({ clef: 'treble' })
  })
  it('draws nothing mid-row unless the clef or key changes', () => {
    expect(staveHeader(bar, { opening: false, rowStart: false })).toEqual({})
    expect(staveHeader({ ...bar, clef: 'bass', clefChanged: true }, { opening: false, rowStart: false })).toEqual({ clef: 'bass' })
  })
})
