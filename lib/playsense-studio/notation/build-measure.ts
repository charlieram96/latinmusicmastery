// The one place descriptors become VexFlow objects. The student renderer and
// the Studio strip both build notes, tuplets and beams here, so they can't drift.
import {
  Accidental, Annotation, Articulation, Beam, Dot, Formatter, GraceNote, GraceNoteGroup, Modifier, Ornament,
  type RenderContext, type Stave, type StaveNote, Tuplet, Voice,
} from 'vexflow'
import type { Articulation as ArticulationKind, Dynamic, Ornament as OrnamentKind } from '@/components/playsense-studio/shared/score-model/types'
import { createStaveNote } from '../percussion-stave-note'
import type { NotationClef, VexEventDescriptor } from '../score-to-vexflow'

const ARTIC: Record<ArticulationKind, string> = { staccato: 'a.', staccatissimo: 'av', tenuto: 'a-', accent: 'a>', marcato: 'a^', fermata: 'a@a' }
const ORN: Record<OrnamentKind, string> = { trill: 'tr', mordent: 'mordent', turn: 'turn' }
// Bravura private-use dynamics glyphs (SMuFL "Dynamics" range).
const DYN: Record<Dynamic, string> = { ppp: '\uE52A', pp: '\uE52B', p: '\uE520', mp: '\uE52C', mf: '\uE52D', f: '\uE522', ff: '\uE52F', fff: '\uE530', fp: '\uE534', sfz: '\uE539' }
const BEAMABLE = new Set(['8', '16', '32', '64', '128'])

/** Beam per beat (a dotted quarter in compound meters); tuplet groups stay whole. */
export function beamGroups(ds: VexEventDescriptor[], ts: [number, number]): number[][] {
  const [num, den] = ts
  const beatQN = den === 8 && num % 3 === 0 ? 1.5 : den === 2 ? 2 : den === 8 ? 1 : 4 / den
  const groups: number[][] = []
  let run: number[] = []
  let runKey: string | null = null
  const end = () => { if (run.length > 1) groups.push(run); run = []; runKey = null }
  ds.forEach((d, i) => {
    const qn = (d.beatInMeasure - 1) * (4 / den)
    const key = d.tuplet ? `T${d.tuplet.id}` : `B${Math.floor(qn / beatQN + 1e-9)}`
    if (!d.isRest && BEAMABLE.has(d.durationCode)) {
      if (runKey !== key) end()
      run.push(i)
      runKey = key
    } else {
      end()
    }
  })
  end()
  return groups
}

export function descriptorToStaveNote(d: VexEventDescriptor, opts: { clef: NotationClef; stem?: 'up' | 'down' | 'auto' }): StaveNote {
  const stem = opts.stem ?? 'auto'
  const note = createStaveNote({
    keys: d.keys,
    clef: opts.clef,
    duration: d.isRest ? `${d.durationCode}r` : d.durationCode,
    dots: d.dots,
    ...(stem === 'up' ? { stemDirection: 1 } : stem === 'down' ? { stemDirection: -1 } : { autoStem: true }),
    ...(d.noteType && !d.isRest ? { type: d.noteType } : {}),
  }, d.percussion)
  for (let i = 0; i < d.dots; i++) Dot.buildAndAttach([note], { all: true })
  d.accidentals.forEach((acc, i) => { if (acc) note.addModifier(new Accidental(acc), i) })
  if (!d.isRest) {
    const up = note.getStemDirection() === 1
    // PercussionStaveNote already adds an 'a^' Articulation per notehead flagged
    // marcato in d.percussion (see percussion-stave-note.ts); skip it here so an
    // event carrying both percussion.marcato and articulations:['marcato'] (as
    // the MusicXML importer does for <strong-accent>) doesn't draw it twice.
    const percMarcato = d.percussion?.some(p => p.marcato) ?? false
    d.articulations.forEach(a => {
      if (a === 'marcato' && percMarcato) return
      const art = new Articulation(ARTIC[a])
      art.setPosition(a === 'fermata' ? Modifier.Position.ABOVE : up ? Modifier.Position.BELOW : Modifier.Position.ABOVE)
      note.addModifier(art, 0)
    })
    if (d.ornament) note.addModifier(new Ornament(ORN[d.ornament]), 0)
    if (d.grace?.length) {
      const graces = d.grace.map(g => {
        const gn = new GraceNote({ keys: g.keys, duration: '8', slash: g.slash, clef: opts.clef })
        g.accidentals.forEach((acc, i) => { if (acc) gn.addModifier(new Accidental(acc), i) })
        return gn
      })
      note.addModifier(new GraceNoteGroup(graces, true), 0)
    }
  }
  if (d.dynamic) {
    const a = new Annotation(DYN[d.dynamic])
    a.setFont('Bravura', 30)
    a.setVerticalJustification(Annotation.VerticalJustify.BOTTOM)
    note.addModifier(a, 0)
  }
  if (d.text) {
    const a = new Annotation(d.text)
    a.setFont('Georgia, serif', 12, 'normal', 'italic')
    a.setVerticalJustification(Annotation.VerticalJustify.TOP)
    note.addModifier(a, 0)
  }
  return note
}

export interface BuiltMeasure { voices: Voice[]; notes: StaveNote[][]; beams: Beam[]; tuplets: Tuplet[] }

export function buildMeasure(voiceDescriptors: VexEventDescriptor[][], ts: [number, number], clef: NotationClef): BuiltMeasure | null {
  const two = voiceDescriptors.length > 1 && voiceDescriptors[1].length > 0
  if (!voiceDescriptors.some(v => v.length)) return null
  const out: BuiltMeasure = { voices: [], notes: [], beams: [], tuplets: [] }
  voiceDescriptors.forEach((ds, vi) => {
    const notes = ds.map(d => descriptorToStaveNote(d, { clef, stem: two ? (vi === 0 ? 'up' : 'down') : 'auto' }))
    out.notes.push(notes)
    if (!notes.length) return
    // Tuplets first: they rescale the notes' ticks, which the voice and formatter read.
    let start = 0
    while (start < ds.length) {
      const t = ds[start].tuplet
      if (!t) { start++; continue }
      let end = start
      while (end + 1 < ds.length && ds[end + 1].tuplet?.id === t.id) end++
      const group = notes.slice(start, end + 1)
      const beamed = ds.slice(start, end + 1).every(d => !d.isRest && BEAMABLE.has(d.durationCode))
      out.tuplets.push(new Tuplet(group, { numNotes: t.n, notesOccupied: t.m, bracketed: !beamed, ratioed: false }))
      start = end + 1
    }
    beamGroups(ds, ts).forEach(ix => out.beams.push(new Beam(ix.map(i => notes[i]))))
    const voice = new Voice({ numBeats: ts[0], beatValue: ts[1] })
    voice.setStrict(false)
    voice.addTickables(notes)
    out.voices.push(voice)
  })
  return out
}

export function formatMeasure(b: BuiltMeasure, width: number): void {
  new Formatter().joinVoices(b.voices).format(b.voices, Math.max(40, width))
}

export function drawMeasure(ctx: RenderContext, stave: Stave, b: BuiltMeasure): void {
  b.voices.forEach(v => v.draw(ctx, stave))
  b.beams.forEach(beam => beam.setContext(ctx).draw())
  b.tuplets.forEach(t => t.setContext(ctx).draw())
}
