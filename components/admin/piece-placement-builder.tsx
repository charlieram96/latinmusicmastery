'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { QuizMediaUpload } from './quiz-media-upload'
import type { PlacementPiece } from '@/lib/quiz/grading'
import { patchLocalizedEntry, pruneLocalizedEntries, readLocalizedField } from '@/lib/quiz/options-es'

interface Props {
  questionId: string
  options: { pieces?: PlacementPiece[] } | null
  /** Spanish overlay: `{ pieces: [{ id, label }] }` with the same piece ids. */
  optionsEs?: Record<string, unknown> | null
  imageUrl: string
  onChange: (data: { options?: unknown; options_es?: unknown; image_url?: string | null }) => void
}

const clamp = (n: number) => Math.max(0, Math.min(100, n))

export function PiecePlacementBuilder({ questionId, options, optionsEs = null, imageUrl, onChange }: Props) {
  const pieces = options?.pieces ?? []
  const stageRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{ id: string; offX: number; offY: number } | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(pieces[0]?.id ?? null)

  const patch = (next: PlacementPiece[]) => onChange({ options: { pieces: next } })

  const updatePiece = (id: string, p: Partial<PlacementPiece>) => {
    patch(pieces.map((pc) => (pc.id === id ? { ...pc, ...p } : pc)))
  }

  const updatePieceLabelEs = (id: string, label: string) => {
    onChange({ options_es: patchLocalizedEntry(optionsEs, 'pieces', id, { label }) })
  }

  const addPiece = () => {
    const id = crypto.randomUUID()
    patch([
      ...pieces,
      { id, label: '', imageUrl: '', width: 15, area: { x: 40, y: 40, width: 20, height: 15 } },
    ])
    setSelectedId(id)
  }

  const removePiece = (id: string) => {
    const remaining = pieces.filter((pc) => pc.id !== id)
    onChange({
      options: { pieces: remaining },
      options_es: pruneLocalizedEntries(optionsEs, 'pieces', remaining.map((pc) => pc.id)),
    })
    if (selectedId === id) setSelectedId(null)
  }

  // Click an empty stage spot → center the selected piece's target area there.
  const handleStageClick = (e: React.MouseEvent) => {
    // Only clicks on the stage itself or the background image count — not on area rects.
    if (e.target !== e.currentTarget && (e.target as HTMLElement).tagName !== 'IMG') return
    const piece = pieces.find((p) => p.id === selectedId)
    const rect = stageRef.current?.getBoundingClientRect()
    if (!piece || !rect) return
    const x = clamp(((e.clientX - rect.left) / rect.width) * 100 - piece.area.width / 2)
    const y = clamp(((e.clientY - rect.top) / rect.height) * 100 - piece.area.height / 2)
    updatePiece(piece.id, { area: { ...piece.area, x, y } })
  }

  // Pointer-drag a target area to reposition it.
  const startDrag = (e: React.PointerEvent, piece: PlacementPiece) => {
    e.stopPropagation()
    setSelectedId(piece.id)
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return
    const px = ((e.clientX - rect.left) / rect.width) * 100
    const py = ((e.clientY - rect.top) / rect.height) * 100
    dragState.current = { id: piece.id, offX: px - piece.area.x, offY: py - piece.area.y }

    const onMove = (ev: PointerEvent) => {
      const st = dragState.current
      const r = stageRef.current?.getBoundingClientRect()
      const pc = pieces.find((p) => p.id === st?.id)
      if (!st || !r || !pc) return
      const nx = clamp(((ev.clientX - r.left) / r.width) * 100 - st.offX)
      const ny = clamp(((ev.clientY - r.top) / r.height) * 100 - st.offY)
      updatePiece(st.id, { area: { ...pc.area, x: nx, y: ny } })
    }
    const onUp = () => {
      dragState.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-2">
        <Label>Background image</Label>
        <QuizMediaUpload
          kind="image"
          slug={`${questionId}-bg`}
          value={imageUrl}
          onChange={(url) => onChange({ image_url: url || null })}
        />
      </div>

      <div className="grid gap-2">
        <Label>Target areas</Label>
        <p className="text-xs text-muted-foreground">
          Each piece has a hidden correct area — students never see these outlines. Select a piece
          below, then click or drag on the image to position its area. A piece counts as correct
          when its center is dropped inside the area. The faded piece preview shows its size on the
          image.
        </p>
        <div
          ref={stageRef}
          onClick={handleStageClick}
          className="relative w-full overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted"
          style={{ aspectRatio: imageUrl ? undefined : '16 / 9' }}
        >
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="Background" className="pointer-events-none block w-full select-none" draggable={false} />
          )}
          {pieces.map((p, i) => (
            <div key={p.id}>
              {/* Size preview: the piece image, faded, centered in its area. */}
              {p.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.imageUrl}
                  alt=""
                  draggable={false}
                  style={{
                    left: `${p.area.x + p.area.width / 2}%`,
                    top: `${p.area.y + p.area.height / 2}%`,
                    width: `${p.width}%`,
                  }}
                  className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 select-none opacity-40"
                />
              )}
              <div
                onPointerDown={(e) => startDrag(e, p)}
                style={{
                  left: `${p.area.x}%`,
                  top: `${p.area.y}%`,
                  width: `${p.area.width}%`,
                  height: `${p.area.height}%`,
                }}
                className={cn(
                  'absolute cursor-grab rounded-lg border-2 border-dashed active:cursor-grabbing',
                  selectedId === p.id ? 'border-primary bg-primary/15' : 'border-primary/40 bg-primary/5',
                )}
              >
                <span className="absolute left-1 top-1 rounded bg-background/80 px-1 text-[10px] font-semibold text-muted-foreground">
                  {p.label || `Piece ${i + 1}`}
                </span>
              </div>
            </div>
          ))}
          {pieces.length === 0 && !imageUrl && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              Upload a background image, then add pieces
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Pieces</Label>
        <p className="text-xs text-muted-foreground">
          Upload each draggable piece, set its display size (as % of the image width), and the size
          of its correct area.
        </p>
        {pieces.map((p, i) => (
          <div
            key={p.id}
            onClick={() => setSelectedId(p.id)}
            className={cn(
              'space-y-2 rounded-lg border p-3',
              selectedId === p.id ? 'border-primary' : 'border-border',
            )}
          >
            <div className="flex items-center gap-2">
              <Input
                value={p.label ?? ''}
                onChange={(e) => updatePiece(p.id, { label: e.target.value })}
                placeholder={`Piece ${i + 1} label (optional)`}
                className="flex-1"
              />
              <NumberField label="Size%" value={p.width} onChange={(v) => updatePiece(p.id, { width: clamp(v) })} />
              <NumberField
                label="Area W%"
                value={p.area.width}
                onChange={(v) => updatePiece(p.id, { area: { ...p.area, width: clamp(v) } })}
              />
              <NumberField
                label="Area H%"
                value={p.area.height}
                onChange={(v) => updatePiece(p.id, { area: { ...p.area, height: clamp(v) } })}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-destructive"
                onClick={() => removePiece(p.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">ES</span>
              <Input
                value={readLocalizedField(optionsEs, 'pieces', p.id, 'label')}
                onChange={(e) => updatePieceLabelEs(p.id, e.target.value)}
                placeholder={`Etiqueta de la pieza ${i + 1} (Español, opcional)`}
                className="flex-1 border-dashed"
              />
            </div>
            <QuizMediaUpload
              kind="image"
              slug={`${questionId}-piece-${p.id}`}
              value={p.imageUrl}
              onChange={(url) => updatePiece(p.id, { imageUrl: url })}
              compact
            />
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addPiece}>
          <Plus className="mr-2 h-4 w-4" /> Add Piece
        </Button>
      </div>
    </div>
  )
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-1 text-xs text-muted-foreground">
      {label}
      <Input
        type="number"
        value={Math.round(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 w-16"
      />
    </label>
  )
}
