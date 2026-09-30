import { symbolGroup, type SymbolOffset } from './symbol-layout'
// Slurs and hairpins (ScoreDocument.spans) resolved to drawn notes, split where
// a span crosses a line break. Ties stay with the renderers (scoreTieIndices).
import { Curve, Modifier, type RenderContext, type StaveNote, StaveHairpin } from 'vexflow'
import type { Span } from '@/components/playsense-studio/shared/score-model/types'

export interface PlacedNote { id?: string; note: StaveNote; system: number; hasDynamic?: boolean }
export interface SpanSegment { id?: string; offset?: SymbolOffset; type: 'slur' | 'cresc' | 'dim'; from?: StaveNote; to?: StaveNote; fromHasDynamic?: boolean }

export function spanSegments(spans: Span[] | undefined, placed: PlacedNote[], opts?: { openEnds?: boolean }): SpanSegment[] {
  if (!spans?.length) return []
  const index = new Map<string, number>()
  placed.forEach((p, i) => { if (p.id && !index.has(p.id)) index.set(p.id, i) })
  const out: SpanSegment[] = []
  for (const s of spans) {
    const ia = index.get(s.from), ib = index.get(s.to)
    if (ia === undefined || ib === undefined) {
      // One end is outside the admin strip's drawn window entirely (not just on
      // another system, which the placed-note walk below already handles). A
      // slur still shows as an open curve to the window edge; a hairpin needs
      // both ends, so it's dropped.
      if (opts?.openEnds && s.type === 'slur') {
        if (ia !== undefined) out.push({ id: s.id, offset: s.offset, type: 'slur', from: placed[ia].note, to: undefined })
        else if (ib !== undefined) out.push({ id: s.id, offset: s.offset, type: 'slur', from: undefined, to: placed[ib].note })
      }
      continue
    }
    if (ia >= ib) continue
    const a = placed[ia], b = placed[ib]
    if (a.system === b.system) { out.push({ id: s.id, offset: s.offset, type: s.type, from: a.note, to: b.note, fromHasDynamic: !!a.hasDynamic }); continue }

    // Walk only the notes within the span (ia..ib) once, forward, tracking each
    // system's first and last note as we go. No reversed-array index tricks:
    // those confuse an index into the reversed copy with an index into `placed`.
    const firstInSys = new Map<number, PlacedNote>()
    const lastInSys = new Map<number, PlacedNote>()
    for (let i = ia; i <= ib; i++) {
      const p = placed[i]
      if (!firstInSys.has(p.system)) firstInSys.set(p.system, p)
      lastInSys.set(p.system, p)
    }
    const sortedSystems = Array.from(firstInSys.keys()).sort((x, y) => x - y)

    // Build one segment per system touched
    let isFirst = true
    for (const sys of sortedSystems) {
      // A slur stays open at each break (VexFlow runs an open end to the stave
      // edge); a middle line has no end in it, so it spans that line's notes.
      // Hairpins need both ends, so they close on each line's first/last note.
      const slur = s.type === 'slur'
      const middle = sys !== a.system && sys !== b.system
      const from = sys === a.system ? a.note : slur && !middle ? undefined : firstInSys.get(sys)!.note
      const to = sys === b.system ? b.note : slur && !middle ? undefined : lastInSys.get(sys)!.note
      const fromHasDynamic = isFirst ? !!a.hasDynamic : undefined

      out.push({ id: s.id, offset: s.offset, type: s.type, from, to, fromHasDynamic })
      isFirst = false
    }
  }
  return out
}

export function drawSpanSegments(ctx: RenderContext, segments: SpanSegment[]): void {
  for (const seg of segments) {
    try {
      symbolGroup(ctx, {spanId:seg.id, symbol:seg.type}, seg.offset, () => {
      if (seg.type === 'slur') {
        if (!seg.from && !seg.to) return
        new Curve(seg.from, seg.to, { thickness: 2, cps: [{ x: 0, y: 12 }, { x: 0, y: 12 }] }).setContext(ctx).draw()
      } else if (seg.from && seg.to) {
        const hp = new StaveHairpin({ firstNote: seg.from, lastNote: seg.to }, seg.type === 'cresc' ? StaveHairpin.type.CRESC : StaveHairpin.type.DECRESC)
        hp.setContext(ctx).setPosition(Modifier.Position.BELOW)
        const isSingleNote = seg.from === seg.to
        hp.setRenderOptions({ height: 8, yShift: 4, leftShiftPx: seg.fromHasDynamic ? 18 : 0, rightShiftPx: isSingleNote ? 24 : 0 })
        hp.draw()
      }
      });
    } catch {
      // A span VexFlow can't place (e.g. notes without a stave yet) is skipped, never fatal.
    }
  }
}
