'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'
import { FALLBACK_ASPECT, type Background } from '@/lib/quiz/composition'
import { isPieceCorrect, type PiecePlacement, type PlacementPiece } from '@/lib/quiz/grading'
import { centreOf, clampCentre, pieceHeightPct, resolveDrop, type Centre } from '@/lib/quiz/placement'
import { hitsPiecePixel, thumbnailOffset, type PieceHitMask } from '@/lib/quiz/piece-hit-test'
import styles from './quiz.module.css'
import { Volume2, VolumeX } from 'lucide-react'
import { TIMBAL_KEYS, timbalSoundKind, timbalSoundUrl } from '@/lib/quiz/timbal-sounds'

type Placement = Record<string, PiecePlacement> // pieceId -> centre in % of the stage

const DRAG_THRESHOLD_PX = 6

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
  const { t, locale } = useTranslation()
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [soundError, setSoundError] = useState(false)
  const [soundsLoading, setSoundsLoading] = useState(true)
  const audioContext = useRef<AudioContext | null>(null)
  const soundBuffers = useRef(new Map<string, AudioBuffer>())
  const playingSounds = useRef(new Set<AudioBufferSourceNode>())
  const soundAvailable = pieces.some(piece => timbalSoundKind(piece.label ?? '') !== null)
  const stopSounds = () => {
    for (const source of playingSounds.current) { source.stop(); source.disconnect() }
    playingSounds.current.clear()
  }
  useEffect(() => {
    if (!soundAvailable) return
    let alive = true
    const context = new AudioContext({ latencyHint: 'interactive' })
    audioContext.current = context
    setSoundsLoading(true)
    const names = ['high-head','high-shell','low-head','low-shell','contra','hand-bell','cha','jamblock','cymbal']
    void Promise.all(names.map(async name => {
      const url = `/audio/quiz-timbal/${name}.wav`
      const response = await fetch(url)
      if (!response.ok) throw new Error('Sound unavailable')
      const buffer = await context.decodeAudioData(await response.arrayBuffer())
      if (alive) soundBuffers.current.set(url, buffer)
    })).then(() => { if (alive) setSoundsLoading(false) }).catch(() => {
      if (alive) { setSoundError(true); setSoundsLoading(false) }
    })
    return () => {
      alive = false; stopSounds(); soundBuffers.current.clear()
      if (audioContext.current === context) audioContext.current = null
      void context.close()
    }
  }, [soundAvailable])
  const toggleSound = async () => {
    stopSounds(); setArmed(null)
    if (soundEnabled) { setSoundEnabled(false); return }
    try {
      await audioContext.current?.resume()
      if (audioContext.current?.state === 'running') { setSoundError(false); setSoundEnabled(true) }
    } catch { setSoundError(true) }
  }
  const playSound = (url: string) => {
    if (!soundEnabled) return
    const context = audioContext.current
    const buffer = url ? soundBuffers.current.get(url) : undefined
    if (!context || context.state !== 'running' || !buffer) { setSoundError(true); return }
    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(context.destination)
    playingSounds.current.add(source)
    source.onended = () => { playingSounds.current.delete(source); source.disconnect() }
    source.start()
  }
  const playPiece = (piece: PlacementPiece, x: number, y: number) => {
    const kind = timbalSoundKind(piece.label ?? '')
    if (!kind) return
    const url = timbalSoundUrl(kind, x, y, hitMasks.current.get(piece.id))
    if (url) playSound(url)
  }
  const keyboardSounds = useRef({ playSound, pieces, placement })
  keyboardSounds.current = { playSound, pieces, placement }
  useEffect(() => {
    if (!soundEnabled) return
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return
      const target = event.target
      if (target instanceof Element && target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')) return
      const binding = TIMBAL_KEYS.find(binding => binding.key === event.key.toUpperCase())
      if (!binding) return
      const current = keyboardSounds.current
      if (!current.pieces.some(piece => current.placement[piece.id] && timbalSoundKind(piece.label ?? '') === binding.kind)) return
      event.preventDefault()
      event.stopPropagation()
      // A new buffer source for every strike lets different keys and repeated
      // hits overlap naturally; no previous note is cut off.
      current.playSound(`/audio/quiz-timbal/${binding.sound}.wav`)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [soundEnabled])
  const stageRef = useRef<HTMLDivElement>(null)
  const trayRef = useRef<HTMLDivElement>(null)
  const ghostRef = useRef<HTMLDivElement>(null)
  const hitMasks = useRef(new Map<string, PieceHitMask>())
  const [thumbnailOffsets, setThumbnailOffsets] = useState<Record<string, { url: string; x: number; y: number; scale: number }>>({})
  useEffect(() => {
    let alive = true
    hitMasks.current.clear()
    pieces.forEach(piece => {
      if (!piece.imageUrl) return
      const image = new Image()
      image.crossOrigin = 'anonymous'
      image.onload = () => {
        if (!alive || !image.naturalWidth || !image.naturalHeight) return
        const scale = Math.min(1, 768 / Math.max(image.naturalWidth, image.naturalHeight))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return
        try {
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
          const alpha = new Uint8Array(canvas.width * canvas.height)
          for (let i = 0; i < alpha.length; i++) alpha[i] = pixels[i * 4 + 3]
          hitMasks.current.set(piece.id, { width: canvas.width, height: canvas.height, alpha })
          const offset = thumbnailOffset({ width: canvas.width, height: canvas.height, alpha }, 68, 60)
          setThumbnailOffsets(previous => ({ ...previous, [piece.id]: { url: piece.imageUrl, ...offset } }))
        } catch { /* Remote images without CORS retain rectangular selection and keyboard access. */ }
      }
      image.src = piece.imageUrl
    })
    return () => { alive = false }
  }, [pieces])
  const aspect = useStageAspect(background)
  const measured = useSpriteRatios(pieces)
  const reduced = useReducedMotionFlag()

  const ratioOf = (p: PlacementPiece) => p.ratio ?? measured[p.id] ?? 1
  const heightOf = (p: PlacementPiece) => pieceHeightPct(p.width, aspect, ratioOf(p))
  const labelOf = (p: PlacementPiece, i: number) => (p.label ?? '').trim() || t('dashboard.classViewer.quiz.pieces.pieceN', { n: i + 1 })
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
      if (e.type === 'pointercancel') return
      const { placement, isGraded, onChange, byId, heightOf } = latest.current
      if (isGraded) return
      if (!s.live) {
        // A press without movement: arm a tray piece for tap-to-place, or bring a placed piece to the front.
        if (s.fromTray) setArmed((a) => (a === s.id ? null : s.id))
        else lift(s.id)
        return
      }
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
    if (soundEnabled || isGraded || session.current || e.button !== 0 || !e.isPrimary) return
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
  // useLayoutEffect so the transform is written before the browser's first paint of the portal.
  useLayoutEffect(() => {
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
  }, [])

  const placeAt = (id: string, centre: Centre) => {
    const piece = byId.get(id)
    if (!piece || isGraded) return
    onChange({ ...placement, [id]: clampCentre(centre, piece.width, heightOf(piece)) })
    lift(id)
  }

  const onStagePointerDown = (e: React.PointerEvent) => {
    if ((e.target as Element).closest('[data-sound-controls]')) return
    if (e.button !== 0 || !e.isPrimary || (isGraded && !soundEnabled)) return
    // Search front to back, skipping transparent pixels instead of letting a
    // cymbal/stand's large rectangular image intercept the pieces beneath it.
    const candidates = pieces.filter(p => placement[p.id])
      .sort((a, b) => (zOrder[b.id] ?? 0) - (zOrder[a.id] ?? 0) || (indexOf.get(b.id) ?? 0) - (indexOf.get(a.id) ?? 0))
    const nodes = stageRef.current?.querySelectorAll<HTMLElement>('[data-piece]')
    for (const piece of candidates) {
      const node = Array.from(nodes ?? []).find(n => n.dataset.piece === piece.id)
      if (!node) continue
      const rect = node.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width
      const y = (e.clientY - rect.top) / rect.height
      if (x < 0 || y < 0 || x >= 1 || y >= 1) continue
      const mask = hitMasks.current.get(piece.id)
      if (mask && !hitsPiecePixel(mask, x, y)) continue
      e.stopPropagation()
      node.focus({ preventScroll: true })
      if (soundEnabled) { e.preventDefault(); playPiece(piece, x, y) }
      else startDrag(e, piece.id, false)
      return
    }
    e.stopPropagation()
  }

  const onStageClick = (e: React.MouseEvent) => {
    if (soundEnabled || !armed || isGraded || Date.now() - lastDropAt.current < 200) return
    if ((e.target as HTMLElement).closest('[data-piece]')) return
    const r = stageRef.current?.getBoundingClientRect()
    if (!r) return
    const id = armed
    setArmed(null)
    placeAt(id, { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 })
    requestAnimationFrame(() => stageRef.current?.querySelector<HTMLElement>(`[data-piece="${id}"]`)?.focus())
  }

  const onStageKey = (e: React.KeyboardEvent) => {
    if (soundEnabled || e.target !== e.currentTarget) return
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
    const step = e.altKey ? 0.1 : e.shiftKey ? 5 : 1
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
      <div className={cn(styles.pp, soundAvailable && styles.ppWithSound)}>
        <div className={styles.stageWrap}>
          <div
            ref={stageRef}
            tabIndex={0}
            role="group"
            aria-label={t('dashboard.classViewer.quiz.puzzleBackground')}
            onPointerDownCapture={onStagePointerDown}
            onClick={onStageClick}
            onKeyDown={onStageKey}
            className={cn(styles.stage, 'ring-1 ring-inset ring-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold', drag?.live && drag.overStage && styles.stageOver, armed && !isGraded && styles.stageArmed)}
            style={stageStyle}
          >
            <CompositionBackground background={background} />
      {soundAvailable && <div data-sound-controls className="absolute bottom-3 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-1" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
        <button type="button" title={locale === 'es' ? 'Toca las piezas colocadas. Desactiva para seguir armando.' : 'Tap placed pieces. Turn off to keep assembling.'} aria-pressed={soundEnabled} disabled={soundsLoading} onClick={() => void toggleSound()} className={cn('inline-flex items-center gap-2 whitespace-nowrap rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors', soundEnabled ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:border-primary hover:text-primary')}>
          {soundEnabled ? <Volume2 aria-hidden className="h-4 w-4" /> : <VolumeX aria-hidden className="h-4 w-4" />}
          {soundsLoading ? (locale === 'es' ? 'Cargando sonidos…' : 'Loading sounds…') : (locale === 'es' ? 'Probar sonido' : 'Try sound')} · {soundEnabled ? (locale === 'es' ? 'Activado' : 'On') : (locale === 'es' ? 'Desactivado' : 'Off')}
        </button>
        {soundError && <span role="alert" className="text-xs text-danger">{locale === 'es' ? 'No se pudo reproducir el sonido.' : 'The sound could not be played.'}</span>}
      </div>}


            {!isGraded && !drag?.live && (placedCount === 0 || armed) && (
              <div className="pointer-events-none absolute inset-x-0 top-3 z-[45] flex justify-center px-3">
                <span className="max-w-full truncate rounded-full bg-black/55 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
                  {armed ? t('dashboard.classViewer.quiz.pieces.tapWhere', { label: labelOf(byId.get(armed)!, indexOf.get(armed) ?? 0) }) : t('dashboard.classViewer.quiz.pieces.hintTap')}
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
                    // Keyboard-reachable so a wrongly placed piece's answer name is not hover-only.
                    tabIndex={0}
                    role="img"
                    aria-label={label}
                    onMouseEnter={() => setHover(p.id)}
                    onMouseLeave={() => setHover((h) => (h === p.id ? null : h))}
                    onFocus={() => setHover(p.id)}
                    onBlur={() => setHover((h) => (h === p.id ? null : h))}
                    style={{ left: `${c.x}%`, top: `${c.y}%`, width: `${p.width}%`, zIndex: 5 }}
                    className={cn(styles.reveal, 'rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold', hover === p.id && styles.revealHi)}
                  >
                    <PieceImage piece={p} label="" className={cn("opacity-80 transition-opacity", styles.silhouetteOk)} />
                    <span className={cn(styles.revealTag, 'absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded bg-success px-1.5 py-0.5 text-[10px] font-semibold text-white')}>{label}</span>
                  </div>
                )
              })}

            {/* Placed pieces stay at the submitted positions, including after grading. */}
            {pieces
              .filter((p) => placement[p.id])
              .sort((a, b) => (zOrder[a.id] ?? 0) - (zOrder[b.id] ?? 0))
              .map((p) => {
                const ok = correct(p)
                const pos = placement[p.id]
                const label = labelOf(p, indexOf.get(p.id) ?? 0)
                const lifting = drag?.live && drag.id === p.id
                return (
                  <div
                    key={p.id}
                    data-piece={p.id}
                    role="button"
                    tabIndex={isGraded && !soundEnabled ? -1 : 0}
                    aria-label={t('dashboard.classViewer.quiz.pieces.placedAria', { label })}
                    title={label}
                    onPointerDown={(e) => startDrag(e, p.id, false)}
                    onKeyDown={(e) => { if (soundEnabled) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); playPiece(p, .5, .5) } } else onPieceKey(e, p.id) }}
                    style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: `${p.width}%`, zIndex: 10 + (zOrder[p.id] ?? 0) }}
                    className={cn(
                      styles.piece,
                      'drop-shadow-lg focus-visible:outline-none',
                      soundEnabled ? 'cursor-pointer' : !isGraded && 'cursor-grab active:cursor-grabbing',
                      lifting && 'invisible',
                      isGraded && styles.pieceSnap,
                      isGraded && (ok ? styles.pieceOk : styles.pieceBad),
                    )}
                  >
                    <PieceImage piece={p} label={label} className={isGraded ? (ok ? styles.silhouetteOk : styles.silhouetteBad) : undefined} />
                  </div>
                )
              })}
          </div>
        </div>

        <aside ref={trayRef} aria-label={t('dashboard.classViewer.quiz.pieces.title')} className={styles.tray}>
          <div className={cn('rounded-2xl border border-border bg-card p-3 transition-colors', drag?.live && drag.overTray && styles.trayDrop)}>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-heading text-[11px] font-bold uppercase tracking-[0.14em] text-gold">{t('dashboard.classViewer.quiz.pieces.title')}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{t('dashboard.classViewer.quiz.pieces.placedOf', { placed: placedCount, total: pieces.length })}</span>
            </div>
            <div className={styles.trayList}>
              {unplaced.map((p) => {
                const i = indexOf.get(p.id) ?? 0
                const label = labelOf(p, i)
                const lifted = drag?.live && drag.id === p.id && drag.fromTray
                const isArmed = armed === p.id
                const soundKind = timbalSoundKind(p.label ?? '')
                const thumbnailScale = soundKind === 'cha' ? 0.72 : soundKind === 'cymbal' ? 1.12 : 1
                return (
                  <button
                    key={p.id}
                    type="button"
                    data-piece-id={p.id}
                    aria-pressed={isArmed}
                    aria-label={isArmed ? t('dashboard.classViewer.quiz.pieces.selectedAria', { label }) : label}
                    onPointerDown={(e) => startDrag(e, p.id, true)}
                    onClick={(e) => {
                      if (e.detail === 0 && !isGraded && !soundEnabled) setArmed((a) => (a === p.id ? null : p.id))
                    }}
                    onMouseEnter={() => setHover(p.id)}
                    onMouseLeave={() => setHover((h) => (h === p.id ? null : h))}
                    onFocus={() => setHover(p.id)}
                    onBlur={() => setHover((h) => (h === p.id ? null : h))}
                    className={cn(
                      styles.trayItem,
                      'grid min-h-[80px] w-full grid-cols-[76px_1fr] items-center gap-2.5 rounded-xl border-[1.5px] border-border bg-raised px-1.5 text-left select-none transition-[transform,border-color,opacity,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
                      !isGraded && 'cursor-grab hover:-translate-y-px hover:border-foreground/20 active:cursor-grabbing',
                      lifted && styles.trayLifted,
                      isArmed && 'border-gold shadow-[0_0_0_3px_hsl(var(--gold-highlight)/0.25)]',
                      isGraded && 'border-terracotta',
                    )}
                  >
                    <span className="relative block h-[68px] w-[76px] overflow-hidden rounded-lg bg-sunken">
                      <span className="absolute inset-0" style={{ transform: `scale(${thumbnailScale})` }}>
                      <span className="absolute inset-1" style={{ transform: thumbnailOffsets[p.id]?.url === p.imageUrl ? `translate(${thumbnailOffsets[p.id].x}px, ${thumbnailOffsets[p.id].y}px) scale(${thumbnailOffsets[p.id].scale})` : undefined }}>
                        <PieceImage piece={p} label="" fit />
                      </span>
                      </span>
                    </span>
                    <span className="min-w-0 break-words text-sm font-semibold leading-snug">
                      {label}
                      {isGraded && <small className="block text-[11px] font-medium text-muted-foreground">{t('dashboard.classViewer.quiz.pieces.notPlaced')}</small>}
                    </span>
                  </button>
                )
              })}
              {unplaced.length === 0 && (
                <div className="rounded-xl border border-dashed border-border px-2.5 py-4 text-center text-xs text-muted-foreground">
                  {isGraded ? t('dashboard.classViewer.quiz.pieces.wasPlaced') : t('dashboard.classViewer.quiz.pieces.allPlaced')}
                </div>
              )}
            </div>
            {isGraded && pieces.some((p) => !isPieceCorrect(p, placement[p.id])) && (
              <p className="mt-2.5 text-[11.5px] leading-snug text-muted-foreground">{t('dashboard.classViewer.quiz.pieces.revealHint')}</p>
            )}
          </div>
        </aside>
          {soundAvailable && <section className={cn(styles.soundLegend, "rounded-2xl border border-border bg-card p-3")} aria-label={locale === 'es' ? 'Teclas para tocar' : 'Playing keys'}>
            <h3 className="mb-2 text-sm font-semibold">{locale === 'es' ? 'Toca con el teclado' : 'Play with your keyboard'}</h3>
            <div className="space-y-1.5">
              {TIMBAL_KEYS.filter(binding => pieces.some(piece => timbalSoundKind(piece.label ?? '') === binding.kind)).map(binding => {
                const placed = pieces.some(piece => placement[piece.id] && timbalSoundKind(piece.label ?? '') === binding.kind)
                return <div key={binding.key} className={cn('flex items-center gap-2 text-xs text-foreground', !placed && 'opacity-80')}>
                  <kbd className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-primary/25 bg-primary/10 font-semibold text-primary">{binding.key}</kbd>
                  <span>= {locale === 'es' ? binding.es : binding.en}</span>
                </div>
              })}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{locale === 'es' ? 'Activa Probar sonido. Las piezas colocadas se pueden tocar con varias teclas a la vez.' : 'Turn on Try sound. Play placed pieces with several keys at once.'}</p>
          </section>}
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
