'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'
import { FALLBACK_ASPECT, type Background } from '@/lib/quiz/composition'
import { isPieceCorrect, type PiecePlacement, type PlacementPiece } from '@/lib/quiz/grading'
import { centreOf, clampCentre, pieceHeightPct, resolveDrop, type Centre } from '@/lib/quiz/placement'
import styles from './quiz.module.css'

type Placement = Record<string, PiecePlacement> // pieceId -> centre in % of the stage

const DRAG_THRESHOLD_PX = 6
const KEY = 'dashboard.classViewer.quiz.pieces.'

function PieceImage({ piece, label, fit = false, className }: { piece: PlacementPiece; label: string; fit?: boolean; className?: string }) {
  return piece.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={piece.imageUrl} alt={label} draggable={false} className={cn('pointer-events-none block select-none', fit ? 'h-full w-full object-contain' : 'h-auto w-full', className)} />
  ) : (
    <div className={cn('rounded-lg bg-muted', fit ? 'h-full w-full' : 'aspect-square w-full', className)} />
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
          className="pointer-events-none absolute select-none"
          style={{ left: `${l.x}%`, top: `${l.y}%`, width: `${l.width}%`, height: `${l.height}%`, objectFit: 'fill' }}
        />
      ))}
    </>
  )
}

/**
 * Resolve the stage aspect: stored value, else the first layer's natural
 * ratio once it has loaded, else the fallback. `measured` is true only once
 * the aspect is actually known (stored, or the layer image loaded).
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

/** Natural width/height of sprites that have no stored `ratio`, measured once per image URL. */
function useSpriteRatios(pieces: PlacementPiece[]): Record<string, number> {
  const [ratios, setRatios] = useState<Record<string, number>>({})
  const key = pieces.map((p) => `${p.id}:${p.ratio ?? ''}:${p.imageUrl}`).join('|')
  useEffect(() => {
    let alive = true
    for (const p of pieces) {
      if (p.ratio || !p.imageUrl) continue
      const img = new Image()
      img.onload = () => {
        if (alive && img.naturalWidth > 0 && img.naturalHeight > 0) setRatios((r) => (r[p.id] ? r : { ...r, [p.id]: img.naturalWidth / img.naturalHeight }))
      }
      img.src = p.imageUrl
    }
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return ratios
}

function useReducedMotionFlag(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  )
}

type DragSession = {
  id: string
  fromTray: boolean
  pointerId: number
  /** grab offset: pointer minus piece centre, viewport px (0 for tray pickups) */
  dx: number
  dy: number
  pxW: number
  pxH: number
  sx: number
  sy: number
  x: number
  y: number
  live: boolean
}

type DragView = { id: string; fromTray: boolean; live: boolean; overStage: boolean; overTray: boolean }

/**
 * Students drag pieces from the tray onto the stage, or tap a piece and then
 * tap the stage. The stage keeps the composition's aspect ratio and is capped
 * by the viewport (--stage-maxh). Correct areas stay hidden until graded; a
 * piece is correct when its centre lands inside its area (isPieceCorrect).
 * After grading, correct pieces snap to their target, wrong ones shake, and
 * every missed piece is shown faded where it belongs.
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
  /** CSS length for the stage's max height (defaults to the viewport minus the lesson chrome; the admin preview passes px). */
  maxHeight?: string
}) {
  const { t } = useTranslation()
  const stageRef = useRef<HTMLDivElement>(null)
  const trayRef = useRef<HTMLDivElement>(null)
  const ghostRef = useRef<HTMLDivElement>(null)
  const aspect = useStageAspect(background)
  const measured = useSpriteRatios(pieces)
  const reduced = useReducedMotionFlag()

  const ratioOf = (p: PlacementPiece) => p.ratio ?? measured[p.id] ?? 1
  const heightOf = (p: PlacementPiece) => pieceHeightPct(p.width, aspect, ratioOf(p))
  const labelOf = (p: PlacementPiece, i: number) => (p.label ?? '').trim() || t(KEY + 'pieceN', { n: i + 1 })
  const indexOf = useMemo(() => new Map(pieces.map((p, i) => [p.id, i])), [pieces])
  const byId = useMemo(() => new Map(pieces.map((p) => [p.id, p])), [pieces])

  const [zOrder, setZOrder] = useState<Record<string, number>>({})
  const zRef = useRef(1)
  const lift = (id: string) => {
    zRef.current += 1
    setZOrder((z) => ({ ...z, [id]: zRef.current }))
  }
  const [armed, setArmed] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [drag, setDrag] = useState<DragView | null>(null)
  const session = useRef<DragSession | null>(null)
  const lastDropAt = useRef(0)

  // Latest props/derivations for the stable window listeners.
  const latest = useRef({ placement, isGraded, onChange, byId, heightOf })
  latest.current = { placement, isGraded, onChange, byId, heightOf }

  const paintGhost = () => {
    const s = session.current, el = ghostRef.current
    if (!s || !el) return
    el.style.transform = `translate(${s.x - s.dx - s.pxW / 2}px, ${s.y - s.dy - s.pxH / 2}px)`
  }

  const impl = useRef({
    move(e: PointerEvent) {
      const s = session.current
      if (!s || e.pointerId !== s.pointerId) return
      s.x = e.clientX
      s.y = e.clientY
      if (!s.live) {
        if (Math.hypot(e.clientX - s.sx, e.clientY - s.sy) < DRAG_THRESHOLD_PX) return
        s.live = true
        setArmed(null)
      }
      const stage = stageRef.current?.getBoundingClientRect()
      const tray = trayRef.current?.getBoundingClientRect()
      const cx = s.x - s.dx, cy = s.y - s.dy
      const overStage = !!stage && cx >= stage.left && cx <= stage.right && cy >= stage.top && cy <= stage.bottom
      const overTray = !s.fromTray && !!tray && s.x >= tray.left && s.x <= tray.right && s.y >= tray.top && s.y <= tray.bottom
      setDrag((d) => (d && d.live && d.overStage === overStage && d.overTray === overTray ? d : { id: s.id, fromTray: s.fromTray, live: true, overStage, overTray }))
      paintGhost()
    },
    up(e: PointerEvent) {
      const s = session.current
      if (!s || e.pointerId !== s.pointerId) return
      window.removeEventListener('pointermove', stable.current.move)
      window.removeEventListener('pointerup', stable.current.up)
      window.removeEventListener('pointercancel', stable.current.up)
      session.current = null
      setDrag(null)
      const { placement, isGraded, onChange, byId, heightOf } = latest.current
      if (isGraded) return
      if (!s.live) {
        // A press without movement: arm a tray piece for tap-to-place, or bring a placed piece to the front.
        if (s.fromTray) setArmed((a) => (a === s.id ? null : s.id))
        else lift(s.id)
        return
      }
      if (e.type === 'pointercancel') return
      const stage = stageRef.current?.getBoundingClientRect()
      const piece = byId.get(s.id)
      if (!stage || !piece) return
      const centre = resolveDrop({ x: e.clientX, y: e.clientY }, { dx: s.dx, dy: s.dy }, stage)
      const next = { ...placement }
      if (centre) {
        next[s.id] = clampCentre(centre, piece.width, heightOf(piece))
        lift(s.id)
      } else {
        delete next[s.id] // released off the stage → back to the tray
      }
      lastDropAt.current = Date.now()
      onChange(next)
    },
  })
  const stable = useRef({ move: (e: PointerEvent) => impl.current.move(e), up: (e: PointerEvent) => impl.current.up(e) })

  const startDrag = (e: React.PointerEvent, id: string, fromTray: boolean) => {
    if (isGraded || session.current || e.button !== 0 || !e.isPrimary) return
    const stage = stageRef.current?.getBoundingClientRect()
    const piece = byId.get(id)
    if (!stage || !piece) return
    e.preventDefault()
    const pxW = (stage.width * piece.width) / 100
    let dx = 0, dy = 0
    if (!fromTray) {
      const c = placement[id]
      if (c) {
        dx = e.clientX - (stage.left + (stage.width * c.x) / 100)
        dy = e.clientY - (stage.top + (stage.height * c.y) / 100)
      }
    }
    session.current = { id, fromTray, pointerId: e.pointerId, dx, dy, pxW, pxH: pxW / ratioOf(piece), sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, live: false }
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      // capture is best-effort; the window listeners still see the pointer
    }
    window.addEventListener('pointermove', stable.current.move)
    window.addEventListener('pointerup', stable.current.up)
    window.addEventListener('pointercancel', stable.current.up)
  }

  // Position the ghost as soon as it mounts, and grow it from the tray thumbnail.
  useEffect(() => {
    if (!drag?.live) return
    paintGhost()
    const el = ghostRef.current
    if (el && drag.fromTray && !reduced) {
      void el.offsetWidth
      el.style.scale = '1'
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.live])

  useEffect(() => () => {
    window.removeEventListener('pointermove', stable.current.move)
    window.removeEventListener('pointerup', stable.current.up)
    window.removeEventListener('pointercancel', stable.current.up)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const placeAt = (id: string, centre: Centre) => {
    const piece = byId.get(id)
    if (!piece || isGraded) return
    onChange({ ...placement, [id]: clampCentre(centre, piece.width, heightOf(piece)) })
    lift(id)
  }

  const onStageClick = (e: React.MouseEvent) => {
    if (!armed || isGraded || Date.now() - lastDropAt.current < 200) return
    if ((e.target as HTMLElement).closest('[data-piece]')) return
    const r = stageRef.current?.getBoundingClientRect()
    if (!r) return
    const id = armed
    setArmed(null)
    placeAt(id, { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 })
    requestAnimationFrame(() => stageRef.current?.querySelector<HTMLElement>(`[data-piece="${id}"]`)?.focus())
  }

  const onStageKey = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' && armed && !isGraded) {
      e.preventDefault()
      const id = armed
      setArmed(null)
      placeAt(id, { x: 50, y: 50 })
      requestAnimationFrame(() => stageRef.current?.querySelector<HTMLElement>(`[data-piece="${id}"]`)?.focus())
    } else if (e.key === 'Escape') setArmed(null)
  }

  const onPieceKey = (e: React.KeyboardEvent, id: string) => {
    if (isGraded) return
    const c = placement[id]
    if (!c) return
    const step = e.shiftKey ? 5 : 1
    let next: Centre | null = null
    if (e.key === 'ArrowLeft') next = { x: c.x - step, y: c.y }
    else if (e.key === 'ArrowRight') next = { x: c.x + step, y: c.y }
    else if (e.key === 'ArrowUp') next = { x: c.x, y: c.y - step }
    else if (e.key === 'ArrowDown') next = { x: c.x, y: c.y + step }
    else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      const rest = { ...placement }
      delete rest[id]
      onChange(rest)
      requestAnimationFrame(() => trayRef.current?.querySelector<HTMLElement>(`[data-piece-id="${id}"]`)?.focus())
      return
    }
    if (!next) return
    e.preventDefault()
    placeAt(id, next)
  }

  const placedCount = pieces.filter((p) => placement[p.id]).length
  const unplaced = pieces.filter((p) => !placement[p.id])
  const correct = (p: PlacementPiece) => isGraded && isPieceCorrect(p, placement[p.id])
  const dragPiece = drag ? byId.get(drag.id) : undefined
  const stageStyle = { ['--stage-ratio' as string]: aspect, ...(maxHeight ? { ['--stage-maxh' as string]: maxHeight } : {}) }

  return (
    <div className={styles.ppRoot}>
      <div className={styles.pp}>
        <div className={styles.stageWrap}>
          <div
            ref={stageRef}
            tabIndex={0}
            role="group"
            aria-label={t('dashboard.classViewer.quiz.puzzleBackground')}
            onClick={onStageClick}
            onKeyDown={onStageKey}
            className={cn(styles.stage, 'border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold', drag?.live && drag.overStage && styles.stageOver, armed && !isGraded && styles.stageArmed)}
            style={stageStyle}
          >
            <CompositionBackground background={background} />

            {!isGraded && !drag?.live && (placedCount === 0 || armed) && (
              <div className="pointer-events-none absolute inset-x-0 top-3 z-[45] flex justify-center px-3">
                <span className="max-w-full truncate rounded-full bg-black/55 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
                  {armed ? t(KEY + 'tapWhere', { label: labelOf(byId.get(armed)!, indexOf.get(armed) ?? 0) }) : t(KEY + 'hintTap')}
                </span>
              </div>
            )}

            {/* Faded reveal of every missed or unplaced piece at its target, after grading. */}
            {isGraded &&
              pieces.map((p, i) => {
                if (isPieceCorrect(p, placement[p.id])) return null
                const c = centreOf(p.area)
                const label = labelOf(p, i)
                return (
                  <div
                    key={`reveal-${p.id}`}
                    data-reveal={p.id}
                    onMouseEnter={() => setHover(p.id)}
                    onMouseLeave={() => setHover((h) => (h === p.id ? null : h))}
                    style={{ left: `${c.x}%`, top: `${c.y}%`, width: `${p.width}%`, zIndex: 5 }}
                    className={cn(styles.reveal, hover === p.id && styles.revealHi)}
                  >
                    <div className="rounded-lg border-2 border-dashed border-success p-0.5">
                      <PieceImage piece={p} label="" className="opacity-40 transition-opacity" />
                    </div>
                    <span className={cn(styles.revealTag, 'absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded bg-success px-1.5 py-0.5 text-[10px] font-semibold text-white')}>{label}</span>
                  </div>
                )
              })}

            {/* Placed pieces, last-touched on top. After grading, correct ones sit on their exact target. */}
            {pieces
              .filter((p) => placement[p.id])
              .sort((a, b) => (zOrder[a.id] ?? 0) - (zOrder[b.id] ?? 0))
              .map((p) => {
                const ok = correct(p)
                const pos = ok ? centreOf(p.area) : placement[p.id]
                const label = labelOf(p, indexOf.get(p.id) ?? 0)
                const lifting = drag?.live && drag.id === p.id
                return (
                  <div
                    key={p.id}
                    data-piece={p.id}
                    role="button"
                    tabIndex={isGraded ? -1 : 0}
                    aria-label={t(KEY + 'placedAria', { label })}
                    title={label}
                    onPointerDown={(e) => startDrag(e, p.id, false)}
                    onKeyDown={(e) => onPieceKey(e, p.id)}
                    style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: `${p.width}%`, zIndex: 10 + (zOrder[p.id] ?? 0) }}
                    className={cn(
                      styles.piece,
                      'drop-shadow-lg focus-visible:outline-none',
                      !isGraded && 'cursor-grab active:cursor-grabbing',
                      lifting && 'invisible',
                      isGraded && styles.pieceSnap,
                      isGraded && (ok ? styles.pieceOk : styles.pieceBad),
                    )}
                  >
                    <div className={cn('rounded-lg', isGraded && (ok ? 'ring-[2.5px] ring-success ring-offset-[3px] ring-offset-card' : 'ring-[2.5px] ring-terracotta ring-offset-[3px] ring-offset-card'), !isGraded && 'focus-visible:ring-2')}>
                      <PieceImage piece={p} label={label} />
                    </div>
                  </div>
                )
              })}
          </div>
        </div>

        <aside ref={trayRef} className={styles.tray}>
          <div className={cn('rounded-2xl border border-border bg-card p-3 transition-colors', drag?.live && drag.overTray && styles.trayDrop)}>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-heading text-[11px] font-bold uppercase tracking-[0.14em] text-gold">{t(KEY + 'title')}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{t(KEY + 'placedOf', { placed: placedCount, total: pieces.length })}</span>
            </div>
            <div className={styles.trayList}>
              {unplaced.map((p) => {
                const i = indexOf.get(p.id) ?? 0
                const label = labelOf(p, i)
                const lifted = drag?.live && drag.id === p.id && drag.fromTray
                const isArmed = armed === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    data-piece-id={p.id}
                    aria-pressed={isArmed}
                    aria-label={isArmed ? t(KEY + 'selectedAria', { label }) : label}
                    onPointerDown={(e) => startDrag(e, p.id, true)}
                    onClick={(e) => {
                      if (e.detail === 0 && !isGraded) setArmed((a) => (a === p.id ? null : p.id))
                    }}
                    onMouseEnter={() => setHover(p.id)}
                    onMouseLeave={() => setHover((h) => (h === p.id ? null : h))}
                    onFocus={() => setHover(p.id)}
                    onBlur={() => setHover((h) => (h === p.id ? null : h))}
                    className={cn(
                      styles.trayItem,
                      'grid h-[46px] w-full grid-cols-[40px_1fr] items-center gap-2.5 rounded-xl border-[1.5px] border-border bg-raised px-1.5 text-left select-none transition-[transform,border-color,opacity,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
                      !isGraded && 'cursor-grab hover:-translate-y-px hover:border-foreground/20 active:cursor-grabbing',
                      lifted && styles.trayLifted,
                      isArmed && 'border-gold shadow-[0_0_0_3px_hsl(var(--gold-highlight)/0.25)]',
                      isGraded && 'border-terracotta',
                    )}
                  >
                    <span className="grid h-9 w-10 place-items-center overflow-hidden rounded-lg bg-sunken p-1">
                      <PieceImage piece={p} label="" fit />
                    </span>
                    <span className="min-w-0 truncate text-[13px] font-semibold leading-tight">
                      {label}
                      {isGraded && <small className="block text-[11px] font-medium text-muted-foreground">{t(KEY + 'notPlaced')}</small>}
                    </span>
                  </button>
                )
              })}
              {unplaced.length === 0 && (
                <div className="rounded-xl border border-dashed border-border px-2.5 py-4 text-center text-xs text-muted-foreground">
                  {isGraded ? t(KEY + 'wasPlaced') : t(KEY + 'allPlaced')}
                </div>
              )}
            </div>
            {isGraded && pieces.some((p) => !isPieceCorrect(p, placement[p.id])) && (
              <p className="mt-2.5 text-[11.5px] leading-snug text-muted-foreground">{t(KEY + 'revealHint')}</p>
            )}
          </div>
        </aside>
      </div>

      {/* Drag ghost: portaled to <body> so no transformed ancestor can offset it. */}
      {drag?.live && dragPiece && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={ghostRef}
            aria-hidden
            className={cn(styles.ghost, 'opacity-95 drop-shadow-2xl', !reduced && styles.ghostGrow)}
            style={{ width: session.current?.pxW, scale: drag.fromTray && !reduced ? '0.4' : '1' }}
          >
            <PieceImage piece={dragPiece} label="" />
          </div>,
          document.body,
        )}
    </div>
  )
}
