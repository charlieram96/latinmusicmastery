'use client'

import { ChevronRight, Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { PlacementPiece } from '@/lib/quiz/grading'
import { readLocalizedField, type LocalizedOptions } from '@/lib/quiz/options-es'
import { clampPieceWidth } from '@/lib/quiz/transform'
import { QuizMediaUpload } from '../quiz-media-upload'
import type { Selection } from './composition-canvas'

const FIELDS: { label: string; key: 'x' | 'y' | 'width' | 'height' }[] = [
  { label: 'X', key: 'x' },
  { label: 'Y', key: 'y' },
  { label: 'W', key: 'width' },
  { label: 'H', key: 'height' },
]

export function InspectorPieces({
  questionId,
  pieces,
  optionsEs,
  selection,
  onSelect,
  onPatch,
  onLabelEs,
  onAdd,
  onRemove,
}: {
  questionId: string
  pieces: PlacementPiece[]
  optionsEs: LocalizedOptions
  selection: Selection
  onSelect: (s: Selection) => void
  onPatch: (id: string, patch: Partial<PlacementPiece>) => void
  onLabelEs: (id: string, label: string) => void
  onAdd: () => void
  onRemove: (id: string) => void
}) {
  return (
    <div className="grid content-start gap-3 p-3.5">
      {pieces.map((p, i) => {
        const on = selection?.kind === 'piece' && selection.id === p.id
        return (
          <div key={p.id} aria-selected={on} onClick={() => onSelect({ kind: 'piece', id: p.id })} className={cn('grid gap-2 rounded-xl border-[1.5px] bg-raised p-2.5', on ? 'border-primary' : 'border-border')}>
            <div className="grid grid-cols-[40px_1fr_auto] items-center gap-2.5">
              <span className="grid h-[34px] w-10 place-items-center overflow-hidden rounded-lg bg-sunken">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt="" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-[10px] text-muted-foreground">img</span>
                )}
              </span>
              <span className="min-w-0">
                <Input value={p.label ?? ''} onChange={(e) => onPatch(p.id, { label: e.target.value })} placeholder={`Piece ${i + 1} label`} className="h-7 border-0 bg-transparent px-0 text-[13px] font-semibold shadow-none focus-visible:ring-0" aria-label="Piece label" />
                <small className="block text-[11px] tabular-nums text-muted-foreground">size {p.width}% · target {Math.round(p.area.width)}×{Math.round(p.area.height)}%</small>
              </span>
              <button type="button" aria-label="Delete piece" onClick={(e) => { e.stopPropagation(); onRemove(p.id) }} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-foreground/7 hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            {on && (
              <>
                <QuizMediaUpload kind="image" slug={`${questionId}-piece-${p.id}`} value={p.imageUrl} onChange={(url) => onPatch(p.id, { imageUrl: url })} compact />
                <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">ES</span>
                  <Input value={readLocalizedField(optionsEs, 'pieces', p.id, 'label')} onChange={(e) => onLabelEs(p.id, e.target.value)} placeholder={`Etiqueta de la pieza ${i + 1} (Español, opcional)`} className="h-8 border-dashed text-xs" />
                </div>
                <details className="grid gap-2">
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11.5px] font-bold text-muted-foreground [&::-webkit-details-marker]:hidden">
                    <ChevronRight className="h-3 w-3 transition-transform [details[open]>summary>&]:rotate-90" /> Precise values
                  </summary>
                  <div className="grid grid-cols-5 gap-1.5">
                    {FIELDS.map((f) => (
                      <label key={f.key} className="grid gap-0.5 text-center text-[10px] font-bold text-muted-foreground">
                        {f.label}
                        <input type="number" step="0.1" value={Math.round(p.area[f.key] * 10) / 10} onChange={(e) => onPatch(p.id, { area: { ...p.area, [f.key]: Number(e.target.value) } })} className="h-7 w-full rounded-[7px] border border-border bg-sunken text-center text-xs tabular-nums outline-none focus:border-primary" />
                      </label>
                    ))}
                    <label className="grid gap-0.5 text-center text-[10px] font-bold text-muted-foreground">
                      Size
                      <input type="number" step="0.1" value={p.width} onChange={(e) => onPatch(p.id, { width: clampPieceWidth(Number(e.target.value)) })} className="h-7 w-full rounded-[7px] border border-border bg-sunken text-center text-xs tabular-nums outline-none focus:border-primary" />
                    </label>
                  </div>
                </details>
              </>
            )}
          </div>
        )
      })}
      <button type="button" onClick={onAdd} className="flex h-[38px] w-full items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-dashed border-foreground/25 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-foreground">
        <Plus className="h-3.5 w-3.5" /> Add piece
      </button>
      <div className="grid gap-1.5 rounded-xl border border-gold/30 bg-gold/8 px-3.5 py-3 text-xs leading-snug">
        <b className="text-gold">How to position</b>
        Select a piece, then drag its box on the canvas or click an empty spot to jump it there. Pull the square handles to resize the target. The gold dot on the faded piece sets how big the piece appears to students.
      </div>
    </div>
  )
}
