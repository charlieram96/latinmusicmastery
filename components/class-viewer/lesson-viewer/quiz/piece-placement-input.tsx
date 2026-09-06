'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'
import { FALLBACK_ASPECT, type Background } from '@/lib/quiz/composition'
import { isPieceCorrect, type PiecePlacement, type PlacementPiece } from '@/lib/quiz/grading'
import styles from './quiz.module.css'

type Placement = Record<string, PiecePlacement> // pieceId -> center in % of the stage

const clamp = (n: number) => Math.max(0, Math.min(100, n))

function PieceImage({ piece }: { piece: PlacementPiece }) {
  const { t } = useTranslation()
  return piece.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={piece.imageUrl}
      alt={piece.label || t('dashboard.classViewer.quiz.puzzlePiece')}
      className="block h-auto w-full select-none"
      draggable={false}
    />
  ) : (
    <div className="aspect-square w-full rounded-lg bg-muted" />
  )
}

/** Color fill plus positioned image layers. Shared with the admin canvas. */
export function CompositionBackground({ background }: { background: Background }) {
  return (
    <>
      <div className="absolute inset-0" style={{ background: background.color }} />
      {background.layers.map((l) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={l.id}
          src={l.imageUrl}
          alt=""
          aria-hidden
          draggable={false}
          className="absolute select-none"
          style={{ left: `${l.x}%`, top: `${l.y}%`, width: `${l.width}%`, height: `${l.height}%`, objectFit: 'fill' }}
        />
      ))}
    </>
  )
}

/**
 * Resolve the stage aspect: stored value, else the first layer's natural
 * ratio once it has loaded, else the fallback. `measured` is true only once
 * the aspect is actually known (stored, or the layer image loaded) — never
 * for the fallback a not-yet-loaded or broken image falls back to, so
 * callers that persist the aspect can gate on it instead of on truthiness.
 */
export function useMeasuredAspect(background: Background): { aspect: number; measured: boolean } {
  const [loaded, setLoaded] = useState<number | null>(null)
  const first = background.layers[0]?.imageUrl
  useEffect(() => {
    if (background.aspect != null || !first) return
    const img = new Image()
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) setLoaded(img.naturalWidth / img.naturalHeight)
    }
    img.onerror = () => {} // a broken image never counts as measured
    img.src = first
  }, [background.aspect, first])
  const measured = background.aspect != null || loaded != null
  return { aspect: background.aspect ?? loaded ?? FALLBACK_ASPECT, measured }
}

/** Thin wrapper over useMeasuredAspect for callers that only need the number. */
export function useStageAspect(background: Background): number {
  return useMeasuredAspect(background).aspect
}

/**
 * Students drag pieces from the tray onto the stage. The stage keeps the
 * composition's aspect ratio and is capped by --stage-maxh (62vh by default),
 * so it can never grow past the viewport however wide the lesson column is.
 * Correct areas stay hidden until graded; a piece is correct when its center
 * lands inside its area (isPieceCorrect).
 */
export function PiecePlacementInput({
  background,
  pieces,
  placement,
  isGraded,
  onChange,
  maxHeight,
}: {
  background: Background
  pieces: PlacementPiece[]
  placement: Placement
  isGraded: boolean
  onChange: (v: Placement) => void
  /** CSS length for the stage's max height (default 62vh; the admin preview passes px). */
  maxHeight?: string
}) {
  const { t } = useTranslation()
  const stageRef = useRef<HTMLDivElement>(null)
  const aspect = useStageAspect(background)
  // The dragged piece follows the pointer in viewport px so it can travel
  // between the tray and the stage without being clamped to either.
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; width: number } | null>(null)

  const unplaced = pieces.filter((p) => !placement[p.id] && drag?.id !== p.id)
  const placedCount = pieces.filter((p) => placement[p.id]).length

  const startDrag = (e: React.PointerEvent, pieceId: string) => {
    if (isGraded) return
    e.preventDefault()
    const stage = stageRef.current?.getBoundingClientRect()
    const piece = pieces.find((p) => p.id === pieceId)
    if (!stage || !piece) return
    setDrag({ id: pieceId, x: e.clientX, y: e.clientY, width: (stage.width * piece.width) / 100 })
    const onMove = (ev: PointerEvent) => setDrag((d) => (d ? { ...d, x: ev.clientX, y: ev.clientY } : d))
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      setDrag(null)
      const r = stageRef.current?.getBoundingClientRect()
      if (!r) return
      const x = ((ev.clientX - r.left) / r.width) * 100
      const y = ((ev.clientY - r.top) / r.height) * 100
      const next = { ...placement }
      if (x >= 0 && x <= 100 && y >= 0 && y <= 100) next[pieceId] = { x: clamp(x), y: clamp(y) }
      else delete next[pieceId] // released off the stage → back to the tray
      onChange(next)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const state = (p: PlacementPiece): 'idle' | 'correct' | 'wrong' =>
    !isGraded ? 'idle' : isPieceCorrect(p, placement[p.id]) ? 'correct' : 'wrong'

  return (
    <div className={styles.ppRoot}>
      <div className={styles.pp}>
        <div className={styles.stageWrap}>
          <div
            ref={stageRef}
            className={cn(styles.stage, 'border border-border')}
            style={{ ['--stage-ratio' as string]: aspect, ['--stage-maxh' as string]: maxHeight ?? '62vh' }}
            aria-label={t('dashboard.classViewer.quiz.puzzleBackground')}
          >
            <CompositionBackground background={background} />

            {placedCount === 0 && !drag && !isGraded && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <span className="rounded-full bg-black/45 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur-sm">
                  {t('dashboard.classViewer.quiz.pieces.hint')}
                </span>
              </div>
            )}

            {/* Revealed correct areas for missed or unplaced pieces, after grading. */}
            {isGraded &&
              pieces
                .filter((p) => !isPieceCorrect(p, placement[p.id]))
                .map((p) => (
                  <div
                    key={`area-${p.id}`}
                    style={{ left: `${p.area.x}%`, top: `${p.area.y}%`, width: `${p.area.width}%`, height: `${p.area.height}%` }}
                    className="pointer-events-none absolute rounded-lg border-2 border-dashed border-success bg-success/15"
                  >
                    {p.label && (
                      <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-success px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {p.label}
                      </span>
                    )}
                  </div>
                ))}

            {/* Placed pieces (the one being dragged renders as the ghost instead). */}
            {pieces
              .filter((p) => placement[p.id] && drag?.id !== p.id)
              .map((p) => (
                <div
                  key={p.id}
                  onPointerDown={(e) => startDrag(e, p.id)}
                  title={p.label}
                  style={{ left: `${placement[p.id].x}%`, top: `${placement[p.id].y}%`, width: `${p.width}%` }}
                  className={cn(
                    'absolute -translate-x-1/2 -translate-y-1/2 touch-none drop-shadow-lg',
                    !isGraded && 'cursor-grab active:cursor-grabbing',
                    state(p) === 'correct' && 'rounded-lg outline outline-[2.5px] outline-offset-[3px] outline-success',
                    state(p) === 'wrong' && 'rounded-lg outline outline-[2.5px] outline-offset-[3px] outline-terracotta',
                  )}
                >
                  <PieceImage piece={p} />
                </div>
              ))}
          </div>
        </div>

        <aside className={styles.tray}>
          <div className="rounded-2xl border border-border bg-card p-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="font-heading text-[11px] font-bold uppercase tracking-[0.14em] text-gold">
                {t('dashboard.classViewer.quiz.pieces.title')}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {t('dashboard.classViewer.quiz.pieces.placedOf', { placed: placedCount, total: pieces.length })}
              </span>
            </div>
            <div className={styles.trayList}>
              {unplaced.map((p) => (
                <div
                  key={p.id}
                  onPointerDown={(e) => startDrag(e, p.id)}
                  className={cn(
                    styles.trayItem,
                    'grid grid-cols-[56px_1fr] items-center gap-2.5 rounded-xl border-[1.5px] border-border bg-raised p-2 pr-2.5 touch-none select-none transition-all',
                    !isGraded && 'cursor-grab hover:-translate-y-px hover:border-foreground/20 active:cursor-grabbing',
                    isGraded && 'border-terracotta',
                  )}
                >
                  <span className="grid h-12 w-14 place-items-center rounded-lg bg-sunken p-1">
                    <PieceImage piece={p} />
                  </span>
                  <span className="text-[13px] font-semibold leading-tight">
                    {p.label}
                    {isGraded && <small className="block text-[11px] font-medium text-muted-foreground">{t('dashboard.classViewer.quiz.pieces.notPlaced')}</small>}
                  </span>
                </div>
              ))}
              {unplaced.length === 0 && !drag && (
                <div className="rounded-xl border border-dashed border-border px-2.5 py-4 text-center text-xs text-muted-foreground">
                  {isGraded ? t('dashboard.classViewer.quiz.pieces.wasPlaced') : t('dashboard.classViewer.quiz.pieces.allPlaced')}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Drag ghost: fixed to the viewport so it can cross from tray to stage. */}
      {drag &&
        (() => {
          const p = pieces.find((pc) => pc.id === drag.id)
          if (!p) return null
          return (
            <div
              style={{ left: drag.x, top: drag.y, width: drag.width }}
              className="pointer-events-none fixed z-[1000] -translate-x-1/2 -translate-y-1/2 opacity-95 drop-shadow-2xl"
            >
              <PieceImage piece={p} />
            </div>
          )
        })()}
    </div>
  )
}
