// Slurs and hairpins (ScoreDocument.spans) resolved to drawn notes, split where
// a span crosses a line break. Ties stay with the renderers (scoreTieIndices).
import { Curve, Modifier, type RenderContext, type StaveNote, StaveHairpin } from 'vexflow'
import type { Span } from '@/components/playsense-studio/shared/score-model/types'

export interface PlacedNote { id?: string; note: StaveNote; system: number; hasDynamic?: boolean }
export interface SpanSegment { type: 'slur' | 'cresc' | 'dim'; from?: StaveNote; to?: StaveNote; fromHasDynamic?: boolean }

export function spanSegments(spans: Span[] | undefined, placed: PlacedNote[]): SpanSegment[] {
  if (!spans?.length) return []
  const index = new Map<string, number>()
  placed.forEach((p, i) => { if (p.id && !index.has(p.id)) index.set(p.id, i) })
  const out: SpanSegment[] = []
  for (const s of spans) {
    const ia = index.get(s.from), ib = index.get(s.to)
    if (ia === undefined || ib === undefined || ia >= ib) continue
    const a = placed[ia], b = placed[ib]
    if (a.system === b.system) { out.push({ type: s.type, from: a.note, to: b.note, fromHasDynamic: !!a.hasDynamic }); continue }
    if (s.type === 'slur') {
      out.push({ type: 'slur', from: a.note, to: undefined, fromHasDynamic: !!a.hasDynamic })
      out.push({ type: 'slur', from: undefined, to: b.note })
      continue
    }
    const lastOfA = [...placed].reverse().find(p => p.system === a.system)!
    const firstOfB = placed.find(p => p.system === b.system)!
    if (lastOfA.note !== a.note) out.push({ type: s.type, from: a.note, to: lastOfA.note, fromHasDynamic: !!a.hasDynamic })
    if (firstOfB.note !== b.note) out.push({ type: s.type, from: firstOfB.note, to: b.note })
  }
  return out
}

export function drawSpanSegments(ctx: RenderContext, segments: SpanSegment[]): void {
  for (const seg of segments) {
    try {
      if (seg.type === 'slur') {
        new Curve(seg.from, seg.to, { thickness: 2, cps: [{ x: 0, y: 12 }, { x: 0, y: 12 }] }).setContext(ctx).draw()
      } else if (seg.from && seg.to) {
        const hp = new StaveHairpin({ firstNote: seg.from, lastNote: seg.to }, seg.type === 'cresc' ? StaveHairpin.type.CRESC : StaveHairpin.type.DECRESC)
        hp.setContext(ctx).setPosition(Modifier.Position.BELOW)
        hp.setRenderOptions({ height: 8, yShift: 4, leftShiftPx: seg.fromHasDynamic ? -26 : 0, rightShiftPx: 0 })
        hp.draw()
      }
    } catch {
      // A span VexFlow can't place (e.g. notes without a stave yet) is skipped, never fatal.
    }
  }
}
