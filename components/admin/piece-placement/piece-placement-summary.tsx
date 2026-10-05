'use client'

import { AdminText } from '@/components/admin/admin-text'


import { Maximize2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { CompositionBackground, useStageAspect } from '@/components/class-viewer/lesson-viewer/quiz/piece-placement-input'
import { readComposition, readPieces } from '@/lib/quiz/composition'
import { centreOf } from '@/lib/quiz/placement'
import { PiecePlacementBuilderDialog, type BuilderProps } from './builder-dialog'

/** Replaces the inline form: a thumbnail of the composition, a piece count, and the button that opens the full-width builder. */
export function PiecePlacementSummary(props: BuilderProps) {
  const { options, imageUrl } = props
  const [open, setOpen] = useState(false)
  const background = useMemo(() => readComposition(options, imageUrl), [options, imageUrl])
  const pieces = useMemo(() => readPieces(options), [options])
  const aspect = useStageAspect(background)
  const missingImages = pieces.filter((p) => !p.imageUrl).length
  return (
    <div className="grid gap-2">
      <Label><AdminText text={"Stage &amp; pieces"} /></Label>
      <div className="grid grid-cols-[120px_1fr] items-center gap-3.5 rounded-xl border border-border bg-raised p-3">
        <div className="relative overflow-hidden rounded-lg border border-border" style={{ aspectRatio: aspect }}>
          <CompositionBackground background={background} />
          {pieces.map((p) => {
            const c = centreOf(p.area)
            return p.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.id} src={p.imageUrl} alt="" draggable={false} className="absolute -translate-x-1/2 -translate-y-1/2 select-none" style={{ left: `${c.x}%`, top: `${c.y}%`, width: `${p.width}%` }} />
            ) : null
          })}
        </div>
        <div className="grid gap-1.5 text-xs text-muted-foreground">
          <span>
            <b className="text-foreground">{pieces.length}</b> {pieces.length === 1 ? 'piece' : 'pieces'} · <b className="text-foreground">{background.layers.length}</b> {background.layers.length === 1 ? 'image layer' : 'image layers'}
            {missingImages > 0 && <span className="text-terracotta"> · {missingImages} <AdminText text={"without an image"} /></span>}
          </span>
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setOpen(true)}>
            <Maximize2 className="h-3.5 w-3.5" /> <AdminText text={"Open builder"} /> </Button>
        </div>
      </div>
      <PiecePlacementBuilderDialog open={open} onOpenChange={setOpen} {...props} />
    </div>
  )
}
