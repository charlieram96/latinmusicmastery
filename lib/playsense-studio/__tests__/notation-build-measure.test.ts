// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest'
import { extractTrackEvents } from '../score-to-vexflow'
import { REFERENCE_EXCERPT_FIXTURE as F } from '../score-fixtures'
import { beamGroups, buildMeasure, descriptorToStaveNote, formatMeasure, staveHeader } from '../notation/build-measure'
import type { VexEventDescriptor } from '../score-to-vexflow'
import type { Dynamic, Track } from '@/components/playsense-studio/shared/score-model/types'
import { PERCUSSION_GLYPHS } from '../percussion-noteheads'

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

  // Every event is a plain (non-tuplet, non-rest) eighth note, at eighth-index i (0-based).
  const eighths = (count: number): VexEventDescriptor[] =>
    Array.from({ length: count }, (_, i) => ({ beatInMeasure: i + 1, durationCode: '8', isRest: false, tuplet: null })) as unknown as VexEventDescriptor[]

  it('beams additive x/8 meters in their natural groups', () => {
    // 7/8 = 2+2+3; the 8th event is a rest, so it never joins a group.
    const seven = eighths(8)
    seven[7] = { ...seven[7], isRest: true }
    expect(beamGroups(seven, [7, 8])).toEqual([[0, 1], [2, 3], [4, 5, 6]])
    // 5/8 = 3+2.
    expect(beamGroups(eighths(5), [5, 8])).toEqual([[0, 1, 2], [3, 4]])
    // 8/8 = 3+3+2, 10/8 = 3+3+2+2, 11/8 = 3+3+3+2.
    expect(beamGroups(eighths(8), [8, 8])).toEqual([[0, 1, 2], [3, 4, 5], [6, 7]])
    expect(beamGroups(eighths(10), [10, 8])).toEqual([[0, 1, 2], [3, 4, 5], [6, 7], [8, 9]])
    expect(beamGroups(eighths(11), [11, 8])).toEqual([[0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10]])
  })

  it('still beams by quarter for other x/8 meters', () => {
    // 4/8 isn't one of the additive meters, so it keeps the old per-quarter (2-eighth) grouping.
    expect(beamGroups(eighths(4), [4, 8])).toEqual([[0, 1], [2, 3]])
  })

  // Every event is a plain (non-tuplet, non-rest) sixteenth note, at sixteenth-index i (0-based).
  const sixteenths = (count: number): VexEventDescriptor[] =>
    Array.from({ length: count }, (_, i) => ({ beatInMeasure: i * 0.5 + 1, durationCode: '16', isRest: false, tuplet: null })) as unknown as VexEventDescriptor[]

  it('beams additive sixteenths by the eighth they start in, not the eighth they round to', () => {
    // Fix round 1: Math.round moved a sixteenth on the "and" of an eighth into
    // the next eighth, which could move it into the wrong additive group.
    // 7/8 = 2+2+3 eighths = 4+4+6 sixteenths.
    expect(beamGroups(sixteenths(14), [7, 8])).toEqual([[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11, 12, 13]])
    // 5/8 = 3+2 eighths = 6+4 sixteenths.
    expect(beamGroups(sixteenths(10), [5, 8])).toEqual([[0, 1, 2, 3, 4, 5], [6, 7, 8, 9]])
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

describe('descriptorToStaveNote percussion flam grace', () => {
  it('draws a flam grace note with its stroke\'s own notehead, matching the main note', () => {
    const percussion = { staffLine: 'e/5', notehead: 'x' as const, strokeId: 'rim' }
    const track: Track = {
      index: 0, instrument: 'perc-conga', displayName: 'Conga', tuning: null, stringMultiplicity: 1, channel: 9, defaultView: 'rhythm-grid',
      measures: [{ number: 1, voices: [{ number: 1, events: [
        { kind: 'note', id: 'p1', midi: 65, durationQN: 1, percussion, grace: [{ midi: 65, percussion, slash: true }] },
      ] }] }],
    }
    const [blk] = extractTrackEvents(track, [4, 4], 0)
    const note = descriptorToStaveNote(blk.events[0], { clef: 'percussion' })
    const [group] = note.getModifiers().filter(m => m.getCategory() === 'GraceNoteGroup') as unknown as { getGraceNotes(): { noteHeads: { getText(): string }[] }[] }[]
    const graceGlyph = group.getGraceNotes()[0].noteHeads[0].getText()
    expect(graceGlyph).toBe(PERCUSSION_GLYPHS['x'])
    expect(graceGlyph).toBe(note.noteHeads[0].getText())
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
  const bar = { clef: 'treble' as const, keyFifths: 2, previousKeyFifths: 2, keyChanged: false, clefChanged: false, timeSignature: [4, 4] as [number, number] }
  it('gives the opening bar the clef, key and time signature', () => {
    expect(staveHeader(bar, { opening: true, rowStart: true })).toEqual({ clef: 'treble', key: { spec: 'D' }, time: '4/4' })
  })
  it('restates the clef and key signature at every later row start', () => {
    expect(staveHeader(bar, { opening: false, rowStart: true })).toEqual({ clef: 'treble', key: { spec: 'D' } })
    expect(staveHeader({ ...bar, keyFifths: 0, previousKeyFifths: 0 }, { opening: false, rowStart: true })).toEqual({ clef: 'treble' })
  })
  it('draws nothing mid-row unless the clef or key changes', () => {
    expect(staveHeader(bar, { opening: false, rowStart: false })).toEqual({})
    expect(staveHeader({ ...bar, clef: 'bass', clefChanged: true }, { opening: false, rowStart: false })).toEqual({ clef: 'bass' })
  })
})

describe('staveHeader key changes', () => {
  const bar = { clef: 'treble' as const, keyFifths: 0, previousKeyFifths: 2, keyChanged: true, clefChanged: false, timeSignature: [4, 4] as [number, number] }
  it('cancels the old key when it changes mid-row', () => {
    expect(staveHeader(bar, { opening: false, rowStart: false })).toEqual({ key: { spec: 'C', cancel: 'D' } })
    expect(staveHeader({ ...bar, keyFifths: 1, previousKeyFifths: 3 }, { opening: false, rowStart: false })).toEqual({ key: { spec: 'G', cancel: 'A' } })
  })
  it('cancels the old key when the change falls on a row start', () => {
    expect(staveHeader(bar, { opening: false, rowStart: true })).toEqual({ clef: 'treble', key: { spec: 'C', cancel: 'D' } })
  })
})

it('engraves editable symbols in their own translated SVG groups', async () => {
  const {Renderer,Stave}=await import('vexflow');
  const {drawMeasure}=await import('../notation/build-measure');
  const host=document.createElement('div');document.body.append(host);
  const renderer=new Renderer(host,Renderer.Backends.SVG);renderer.resize(500,240);
  const ctx=renderer.getContext();const stave=new Stave(10,30,450).setContext(ctx);stave.draw();
  const d={...blocks()[0].events[0],id:'symbol-note',dynamic:'mf' as const,symbolOffsets:{dynamic:{x:14,y:-9}}};
  const built=buildMeasure([[d],[]],[4,4],'treble')!;
  formatMeasure(built,350);drawMeasure(ctx,stave,built);
  const group=[...host.querySelectorAll('[data-notation-symbol]')].find(g=>JSON.parse(g.getAttribute('data-notation-symbol')!).symbol==='dynamic');
  expect(group?.getAttribute('transform')).toBe('translate(14 -9)');
  expect(group?.querySelector('text,path')).not.toBeNull();host.remove();
});
