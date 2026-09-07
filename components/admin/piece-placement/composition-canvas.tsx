'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { Background } from '@/lib/quiz/composition'
import type { PlacementPiece } from '@/lib/quiz/grading'
import { centreOf, effectiveRatio, pieceHeightPct, type Centre, type PieceWarning } from '@/lib/quiz/placement'
import type { Rect } from '@/lib/quiz/transform'
import { Handles } from './handles'
import { useCanvasTransform } from './use-canvas-transform'

export type Selection = { kind: 'layer' | 'piece'; id: string } | null

/**
 * The composed answer: colour, image layers, and every piece drawn where it
 * belongs at the size the student sees. Dragging a sprite moves its target;
 * the gold dot changes its width; the dashed halo is the grading tolerance.
 * The canvas fills its container's height (container-type: size on the wrap).
 */
export function CompositionCanvas({
  background,
  pieces,
  aspect,
  tolerance,
  ratios,
  selection,
  onSelect,
  onLayerRect,
  onPieceCentre,
  onPieceWidth,
  onRemovePiece,
  onGestureEnd,
  snap,
  showGrid,
  showHalos,
  zoom,
  warnings,
  labels,
}: {
  background: Background
  pieces: PlacementPiece[]
  aspect: number
  tolerance: number
  ratios: Record<string, number>
  selection: Selection
  onSelect: (s: Selection) => void
  onLayerRect: (id: string, rect: Rect) => void
  onPieceCentre: (id: string, centre: Centre) => void
  onPieceWidth: (id: string, width: number) => void
  onRemovePiece: (id: string) => void
  onGestureEnd: () => void
  snap: boolean
  showGrid: boolean
  showHalos: boolean
  zoom: 1 | 2
  warnings: Record<string, PieceWarning[]>
  labels: (piece: PlacementPiece, index: number) => string
}) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const tf = useCanvasTransform(canvasRef, { snap, onEnd: (moved) => moved && onGestureEnd() })

  const ratioOf = (p: PlacementPiece) => p.ratio ?? ratios[p.id] ?? effectiveRatio(p, aspect, tolerance)
  const focusPiece = (id: string) => canvasRef.current?.querySelector<HTMLElement>(`[data-piece="${id}"]`)?.focus()

  // A selection made elsewhere (e.g. a pieces-panel row in a later task) should still move
  // keyboard focus onto the canvas so arrow/Backspace/Escape work without a click first.
  useEffect(() => {
    if (selection?.kind !== 'piece') return
    const root = canvasRef.current
    if (!root || root.contains(document.activeElement)) return
    root.querySelector<HTMLElement>(`[data-piece="${selection.id}"]`)?.focus({ preventScroll: true })
  }, [selection])

  const onPieceKey = (e: React.KeyboardEvent, p: PlacementPiece) => {
    const c = centreOf(p.area)
    const step = e.shiftKey ? 1 : 0.1
    let next: Centre | null = null
    if (e.key === 'ArrowLeft') next = { x: c.x - step, y: c.y }
    else if (e.key === 'ArrowRight') next = { x: c.x + step, y: c.y }
    else if (e.key === 'ArrowUp') next = { x: c.x, y: c.y - step }
    else if (e.key === 'ArrowDown') next = { x: c.x, y: c.y + step }
    else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      onRemovePiece(p.id)
      return
    } else if (e.key === 'Escape') {
      onSelect(null)
      return
    }
    if (!next) return
    e.preventDefault()
    onPieceCentre(p.id, { x: Math.round(next.x * 10) / 10, y: Math.round(next.y * 10) / 10 })
    onGestureEnd()
    requestAnimationFrame(() => focusPiece(p.id))
  }

  const fit = `min(100cqw - 48px, calc((100cqh - 48px) * ${aspect}))`
  return (
    <div className="grid h-full min-h-[360px] place-items-center overflow-auto bg-[radial-gradient(hsl(var(--foreground)/0.1)_1px,transparent_1px)] bg-[length:16px_16px] p-6 [container-type:size]">
      <div
        ref={canvasRef}
        onClick={(e) => {
          if (tf.consumeClick()) return
          if (e.target === e.currentTarget) onSelect(null)
        }}
        {...tf.handlers}
        className="relative touch-none select-none rounded-[10px] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6),0_0_0_1px_hsl(var(--foreground)/0.15)] [container-type:inline-size]"
        style={{ width: zoom === 2 ? `calc(2 * ${fit})` : fit, aspectRatio: aspect, background: background.color }}
      >
        {background.layers.map((l) => {
          const on = selection?.kind === 'layer' && selection.id === l.id
          const rect: Rect = { x: l.x, y: l.y, width: l.width, height: l.height }
          return (
            <div
              key={l.id}
              className={cn('absolute cursor-move', on && 'ring-[1.5px] ring-primary')}
              style={{ left: `${l.x}%`, top: `${l.y}%`, width: `${l.width}%`, height: `${l.height}%` }}
              onPointerDown={(e) => {
                onSelect({ kind: 'layer', id: l.id })
                tf.begin(e, { mode: 'move', rect, onChange: (r) => onLayerRect(l.id, r) })
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={l.imageUrl} alt="" draggable={false} className="pointer-events-none block h-full w-full select-none" style={{ objectFit: 'fill' }} />
              {on && (
                <Handles
                  tone="neutral"
                  onDown={(e, h) => tf.begin(e, { mode: 'resize', rect, handle: h, keepRatio: true, boxRatio: l.ratio ? l.ratio / aspect : undefined, onChange: (r) => onLayerRect(l.id, r) })}
                />
              )}
            </div>
          )
        })}

        {showGrid && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg, transparent 0 calc(5% - 1px), rgba(255,255,255,0.12) calc(5% - 1px) 5%), repeating-linear-gradient(90deg, transparent 0 calc(5% - 1px), rgba(255,255,255,0.12) calc(5% - 1px) 5%)',
            }}
          />
        )}

        {pieces.map((p, i) => {
          const on = selection?.kind === 'piece' && selection.id === p.id
          const c = centreOf(p.area)
          const t = p.tolerance ?? tolerance
          const warn = (warnings[p.id]?.length ?? 0) > 0
          const label = labels(p, i)
          const h = pieceHeightPct(p.width, aspect, ratioOf(p))
          return (
            <div
              key={p.id}
              data-piece={p.id}
              role="button"
              tabIndex={0}
              aria-label={`${label}: drag to move, arrows nudge, Backspace removes`}
              className={cn('group absolute -translate-x-1/2 -translate-y-1/2 cursor-move touch-none focus-visible:outline-none', on && 'ring-[1.5px] ring-primary ring-offset-1 ring-offset-transparent')}
              style={{ left: `${c.x}%`, top: `${c.y}%`, width: `${p.width}%`, height: `${h}%`, zIndex: on ? 30 : 10 + i }}
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).dataset.sizeHandle) return
                ;(e.currentTarget as HTMLElement).focus()
                onSelect({ kind: 'piece', id: p.id })
                tf.begin(e, { mode: 'centre', centre: c, onChange: (next) => onPieceCentre(p.id, next) })
              }}
              onKeyDown={(e) => onPieceKey(e, p)}
            >
              {(on || showHalos) && (
                <span aria-hidden className="pointer-events-none absolute rounded-lg border-[1.5px] border-dashed border-terracotta/80 bg-terracotta/[0.07]" style={{ inset: `calc(-1 * ${t}cqw)` }} />
              )}
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt="" draggable={false} className="pointer-events-none block h-full w-full select-none" style={{ objectFit: 'fill' }} />
              ) : (
                <div className="h-full w-full rounded border-2 border-dashed border-white/50" />
              )}
              <span className={cn('pointer-events-none absolute -left-2 -top-2 grid h-[18px] w-[18px] place-items-center rounded-full text-[10px] font-bold text-white shadow-[0_1px_3px_rgba(0,0,0,0.35)]', warn ? 'bg-terracotta' : 'bg-primary')}>{i + 1}</span>
              <span className={cn('pointer-events-none absolute bottom-full left-1/2 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-[5px] bg-primary px-1.5 py-0.5 text-[10.5px] font-bold leading-[1.5] text-white group-hover:block', on && 'block')}>{label}</span>
              {on && (
                <span
                  data-size-handle="1"
                  title="Drag to change how big the piece appears to students"
                  onPointerDown={(e) => tf.begin(e, { mode: 'size', width: p.width, onChange: (w) => onPieceWidth(p.id, w) })}
                  className="absolute -bottom-[7px] -right-[7px] z-[4] h-[13px] w-[13px] cursor-nwse-resize rounded-full border-[1.5px] border-white bg-gold shadow-[0_1px_3px_rgba(0,0,0,0.4)]"
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
