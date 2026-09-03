'use client'

import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/components/language-provider'
import { isPieceCorrect, type PiecePlacement, type PlacementPiece } from '@/lib/quiz/grading'

type Placement = Record<string, PiecePlacement> // pieceId -> center position in % of the image

const clamp = (n: number) => Math.max(0, Math.min(100, n))

function PieceImage({ piece }: { piece: PlacementPiece }) {
  const { t } = useTranslation()
  return piece.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={piece.imageUrl}
      alt={piece.label || t('dashboard.classViewer.quiz.puzzlePiece')}
      className="block w-full select-none"
      draggable={false}
    />
  ) : (
    <div className="aspect-square w-full rounded-lg bg-muted" />
  )
}

/**
 * Free-drag puzzle input: students drag pieces anywhere over the background
 * image. Correct target areas stay hidden until graded; a piece is correct
 * when its center lands inside its area (see isPieceCorrect).
 */
export function PiecePlacementInput({
  imageUrl,
  pieces,
  placement,
  isGraded,
  onChange,
}: {
  imageUrl: string | null
  pieces: PlacementPiece[]
  placement: Placement
  isGraded: boolean
  onChange: (v: Placement) => void
}) {
  const { t } = useTranslation()
  const wrapRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  // While dragging, the piece follows the pointer in wrapper pixels so it can
  // travel between the tray and the image without being clamped to either.
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null)

  const unplaced = pieces.filter((p) => !placement[p.id] && drag?.id !== p.id)

  const startDrag = (e: React.PointerEvent, pieceId: string) => {
    if (isGraded) return
    e.preventDefault()
    const wrap = wrapRef.current?.getBoundingClientRect()
    if (!wrap) return
    setDrag({ id: pieceId, x: e.clientX - wrap.left, y: e.clientY - wrap.top })

    const onMove = (ev: PointerEvent) => {
      const w = wrapRef.current?.getBoundingClientRect()
      if (!w) return
      setDrag({ id: pieceId, x: ev.clientX - w.left, y: ev.clientY - w.top })
    }
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setDrag(null)
      const r = stageRef.current?.getBoundingClientRect()
      if (!r) return
      const x = ((ev.clientX - r.left) / r.width) * 100
      const y = ((ev.clientY - r.top) / r.height) * 100
      const next = { ...placement }
      if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
        next[pieceId] = { x: clamp(x), y: clamp(y) }
      } else {
        delete next[pieceId] // released off the image → back to the tray
      }
      onChange(next)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const pieceState = (p: PlacementPiece): 'idle' | 'correct' | 'incorrect' => {
    if (!isGraded) return 'idle'
    return isPieceCorrect(p, placement[p.id]) ? 'correct' : 'incorrect'
  }

  return (
    <div ref={wrapRef} className="relative space-y-4">
      <div ref={stageRef} className="relative w-full rounded-2xl border-2 border-border bg-muted">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={t('dashboard.classViewer.quiz.puzzleBackground')} className="block w-full select-none rounded-2xl" draggable={false} />
        ) : (
          <div className="aspect-video" />
        )}

        {/* Revealed correct areas for missed pieces, after grading. */}
        {isGraded &&
          pieces
            .filter((p) => !isPieceCorrect(p, placement[p.id]))
            .map((p) => (
              <div
                key={`area-${p.id}`}
                style={{
                  left: `${p.area.x}%`,
                  top: `${p.area.y}%`,
                  width: `${p.area.width}%`,
                  height: `${p.area.height}%`,
                }}
                className="pointer-events-none absolute rounded-lg border-2 border-dashed border-green-500 bg-green-500/10"
              >
                {p.label && (
                  <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-green-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {p.label}
                  </span>
                )}
              </div>
            ))}

        {/* Placed pieces (the one being dragged renders in the wrapper layer instead). */}
        {pieces
          .filter((p) => placement[p.id] && drag?.id !== p.id)
          .map((p) => (
            <div
              key={p.id}
              onPointerDown={(e) => startDrag(e, p.id)}
              style={{
                left: `${placement[p.id].x}%`,
                top: `${placement[p.id].y}%`,
                width: `${p.width}%`,
              }}
              className={cn(
                'absolute -translate-x-1/2 -translate-y-1/2 touch-none',
                !isGraded && 'cursor-grab active:cursor-grabbing',
                pieceState(p) === 'correct' && 'rounded-lg ring-2 ring-green-500',
                pieceState(p) === 'incorrect' && 'rounded-lg ring-2 ring-red-500',
              )}
            >
              <PieceImage piece={p} />
            </div>
          ))}
      </div>

      {(unplaced.length > 0 || drag) && (
        <div className="rounded-2xl border border-border bg-card/50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('dashboard.classViewer.quiz.dragPieces')}
          </p>
          <div className="flex min-h-10 flex-wrap items-start gap-3">
            {unplaced.map((p) => (
              <div
                key={p.id}
                onPointerDown={(e) => startDrag(e, p.id)}
                style={{ width: `${p.width}%` }}
                className={cn(
                  'touch-none',
                  !isGraded && 'cursor-grab active:cursor-grabbing',
                  isGraded && 'rounded-lg ring-2 ring-red-500',
                )}
              >
                <PieceImage piece={p} />
                {p.label && <p className="mt-1 text-center text-xs font-medium text-muted-foreground">{p.label}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drag ghost: follows the pointer across the whole component. */}
      {drag &&
        (() => {
          const p = pieces.find((pc) => pc.id === drag.id)
          if (!p) return null
          return (
            <div
              style={{ left: drag.x, top: drag.y, width: `${p.width}%` }}
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 opacity-90 drop-shadow-lg"
            >
              <PieceImage piece={p} />
            </div>
          )
        })()}
    </div>
  )
}
