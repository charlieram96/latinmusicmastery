'use client'

import { useRef } from 'react'
import { cn } from '@/lib/utils'
import type { Background } from '@/lib/quiz/composition'
import type { PlacementPiece } from '@/lib/quiz/grading'
import type { Rect } from '@/lib/quiz/transform'
import { useStageAspect } from '@/components/class-viewer/lesson-viewer/quiz/piece-placement-input'
import { Handles } from './handles'
import { useCanvasTransform } from './use-canvas-transform'

export type Selection = { kind: 'layer' | 'piece'; id: string } | null

const BASE_HEIGHT_PX = 500

/**
 * The editable composition: color, draggable/resizable image layers, and one
 * draggable/resizable target box per piece with the piece ghost centered in
 * it. Clicking empty canvas moves the selected piece's box there.
 */
export function CompositionCanvas({
  background,
  pieces,
  selection,
  onSelect,
  onLayerRect,
  onPieceArea,
  onPieceWidth,
  snap,
  showGrid,
}: {
  background: Background
  pieces: PlacementPiece[]
  selection: Selection
  onSelect: (s: Selection) => void
  onLayerRect: (id: string, rect: Rect) => void
  onPieceArea: (id: string, rect: Rect) => void
  onPieceWidth: (id: string, width: number) => void
  snap: boolean
  showGrid: boolean
}) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const aspect = useStageAspect(background)
  const tf = useCanvasTransform(canvasRef, snap)
  const selectedPiece = selection?.kind === 'piece' ? pieces.find((p) => p.id === selection.id) : undefined

  const onCanvasClick = (e: React.MouseEvent) => {
    if (tf.consumeClick()) return
    if (e.target !== e.currentTarget) return
    if (!selectedPiece) {
      onSelect(null)
      return
    }
    const r = canvasRef.current!.getBoundingClientRect()
    const a = selectedPiece.area
    const x = ((e.clientX - r.left) / r.width) * 100 - a.width / 2
    const y = ((e.clientY - r.top) / r.height) * 100 - a.height / 2
    onPieceArea(selectedPiece.id, { ...a, x: Math.min(100 - a.width, Math.max(0, x)), y: Math.min(100 - a.height, Math.max(0, y)) })
  }

  return (
    <div className="grid min-h-[380px] place-items-center bg-[radial-gradient(hsl(var(--foreground)/0.1)_1px,transparent_1px)] bg-[length:16px_16px] p-6">
      <div
        ref={canvasRef}
        onClick={onCanvasClick}
        {...tf.handlers}
        className="relative touch-none select-none rounded-[10px] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6),0_0_0_1px_hsl(var(--foreground)/0.15)]"
        style={{ width: `min(100%, ${BASE_HEIGHT_PX * aspect}px)`, aspectRatio: aspect, background: background.color }}
      >
        {background.layers.map((l) => {
          const on = selection?.kind === 'layer' && selection.id === l.id
          const rect: Rect = { x: l.x, y: l.y, width: l.width, height: l.height }
          return (
            <div
              key={l.id}
              className={cn('absolute cursor-move', on && 'outline outline-[1.5px] outline-primary')}
              style={{ left: `${l.x}%`, top: `${l.y}%`, width: `${l.width}%`, height: `${l.height}%` }}
              onPointerDown={(e) => {
                onSelect({ kind: 'layer', id: l.id })
                tf.begin(e, { mode: 'move', rect, onChange: (r) => onLayerRect(l.id, r) })
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={l.imageUrl} alt="" draggable={false} className="pointer-events-none block h-full w-full select-none" style={{ objectFit: 'fill' }} />
              {on && <Handles tone="neutral" onDown={(e, h) => tf.begin(e, { mode: 'resize', rect, handle: h, keepRatio: true, onChange: (r) => onLayerRect(l.id, r) })} />}
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
          const a = p.area
          return (
            <div
              key={p.id}
              className={cn(
                'absolute cursor-move rounded-md border-[1.5px] border-dashed border-primary/55 bg-primary/8',
                on && 'border-solid border-primary bg-primary/15 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]',
              )}
              style={{ left: `${a.x}%`, top: `${a.y}%`, width: `${a.width}%`, height: `${a.height}%`, zIndex: on ? 5 : 2 }}
              onPointerDown={(e) => {
                onSelect({ kind: 'piece', id: p.id })
                tf.begin(e, { mode: 'move', rect: a, onChange: (r) => onPieceArea(p.id, r) })
              }}
            >
              <span className="absolute -top-[22px] left-0 whitespace-nowrap rounded-[5px] bg-primary px-1.5 py-0.5 text-[10.5px] font-bold leading-[1.5] text-white">
                {p.label || `Piece ${i + 1}`}
              </span>
              {/* Ghost: the piece at its student size, centered in the box. The gold dot resizes it. */}
              <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: `${(p.width / a.width) * 100}%` }}>
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt="" draggable={false} className="block h-auto w-full select-none opacity-50" />
                ) : (
                  <div className="aspect-square w-full rounded border-2 border-dashed border-white/50" />
                )}
                {on && (
                  <span
                    title="Drag to change how big the piece appears to students"
                    onPointerDown={(e) => tf.begin(e, { mode: 'size', width: p.width, onChange: (w) => onPieceWidth(p.id, w) })}
                    className="pointer-events-auto absolute -bottom-[7px] -right-[7px] z-[4] h-[13px] w-[13px] cursor-nwse-resize rounded-full border-[1.5px] border-white bg-gold shadow-[0_1px_3px_rgba(0,0,0,0.4)]"
                  />
                )}
              </div>
              {on && <Handles onDown={(e, h) => tf.begin(e, { mode: 'resize', rect: a, handle: h, onChange: (r) => onPieceArea(p.id, r) })} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
