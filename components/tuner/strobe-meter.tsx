'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface StrobeMeterProps {
  /** Signed cents from the nearest target, or null when nothing is detected. */
  cents: number | null
  isListening: boolean
}

const CENTS_RANGE = 50 // meter spans -50..+50 cents
const LOCK_CENTS = 5 // |cents| under this counts as in-tune

/** Resolve an RGB triple for the current deviation (gold lock → amber → terracotta-red). */
function colorForCents(cents: number | null): [number, number, number] {
  if (cents === null) return [120, 120, 120]
  const abs = Math.abs(cents)
  if (abs < LOCK_CENTS) return [214, 168, 84] // gold lock
  if (abs <= 20) return [232, 150, 70] // amber
  return [201, 96, 70] // terracotta red
}

/**
 * The signature element: a strobe band whose stripes scroll toward the side
 * you're off (left = flat, right = sharp), faster the further out of tune you
 * are, and freeze with a warm gold glow when locked — the defining behavior of
 * a real strobe tuner. A bright indicator also tracks the exact cents position.
 */
export function StrobeMeter({ cents, isListening }: StrobeMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const centsRef = useRef<number | null>(cents)
  const listeningRef = useRef(isListening)
  const phaseRef = useRef(0)
  const lockGlowRef = useRef(0) // eased 0..1 for the lock pulse

  centsRef.current = cents
  listeningRef.current = isListening

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    let raf = 0
    let last = performance.now()

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const draw = (now: number) => {
      const dt = Math.min(64, now - last) / 1000
      last = now

      const rect = canvas.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      const c = centsRef.current
      const live = listeningRef.current
      const [r, g, b] = colorForCents(live ? c : null)
      const locked = live && c !== null && Math.abs(c) < LOCK_CENTS

      // Ease the lock glow in/out
      lockGlowRef.current += ((locked ? 1 : 0) - lockGlowRef.current) * Math.min(1, dt * 8)
      const glow = lockGlowRef.current

      ctx.clearRect(0, 0, w, h)

      // Band background
      const radius = Math.min(18, h / 2)
      ctx.beginPath()
      ctx.roundRect(0, 0, w, h, radius)
      ctx.fillStyle = 'rgba(255,255,255,0.025)'
      ctx.fill()
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'
      ctx.stroke()

      ctx.save()
      ctx.beginPath()
      ctx.roundRect(0.5, 0.5, w - 1, h - 1, radius)
      ctx.clip()

      // Scroll the strobe phase. Speed ∝ deviation; direction by sign.
      const dev = live && c !== null ? c : 0
      if (!reduceMotion && live) {
        const speed = (dev / CENTS_RANGE) * 360 // px/sec at full deflection
        phaseRef.current += speed * dt
      }

      // Strobe stripes
      const stripeW = 26
      const phase = ((phaseRef.current % stripeW) + stripeW) % stripeW
      for (let x = -stripeW + phase; x < w + stripeW; x += stripeW) {
        const grad = ctx.createLinearGradient(x, 0, x + stripeW / 2, 0)
        const a = live ? 0.5 : 0.12
        grad.addColorStop(0, `rgba(${r},${g},${b},0)`)
        grad.addColorStop(0.5, `rgba(${r},${g},${b},${a})`)
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
        ctx.fillStyle = grad
        ctx.fillRect(x, 0, stripeW / 2, h)
      }

      // Center lock zone
      const cx = w / 2
      const zoneW = (LOCK_CENTS / CENTS_RANGE) * (w / 2) * 2
      ctx.fillStyle = `rgba(214,168,84,${0.06 + glow * 0.14})`
      ctx.fillRect(cx - zoneW / 2, 0, zoneW, h)

      // Center hairline
      ctx.fillStyle = 'rgba(255,255,255,0.22)'
      ctx.fillRect(cx - 0.5, 0, 1, h)

      // Position indicator
      if (live && c !== null) {
        const clamped = Math.max(-CENTS_RANGE, Math.min(CENTS_RANGE, c))
        const ix = cx + (clamped / CENTS_RANGE) * (w / 2)
        ctx.shadowColor = `rgba(${r},${g},${b},${0.7 + glow * 0.3})`
        ctx.shadowBlur = 12 + glow * 22
        ctx.fillStyle = `rgb(${r},${g},${b})`
        const iw = 4
        ctx.beginPath()
        ctx.roundRect(ix - iw / 2, 4, iw, h - 8, 2)
        ctx.fill()
        ctx.shadowBlur = 0
      }

      ctx.restore()

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return (
    <div className="w-full select-none">
      {/* Flat / target / sharp markers */}
      <div className="mb-2 flex items-end justify-between px-1">
        <span className="text-lg leading-none text-muted-foreground" aria-hidden>
          ♭
        </span>
        <span
          className={cn(
            'text-[11px] font-medium uppercase tracking-[0.2em] transition-colors',
            isListening && cents !== null && Math.abs(cents) < LOCK_CENTS
              ? 'text-[hsl(var(--gold-highlight))]'
              : 'text-muted-foreground'
          )}
        >
          ● target
        </span>
        <span className="text-lg leading-none text-muted-foreground" aria-hidden>
          ♯
        </span>
      </div>

      <canvas ref={canvasRef} className="h-24 w-full sm:h-32" aria-hidden />

      {/* Cents scale */}
      <div className="mt-2 flex justify-between px-0.5 font-mono text-[11px] text-muted-foreground tabular-nums">
        <span>-50</span>
        <span>-25</span>
        <span className="text-foreground/70">0</span>
        <span>+25</span>
        <span>+50</span>
      </div>
    </div>
  )
}
