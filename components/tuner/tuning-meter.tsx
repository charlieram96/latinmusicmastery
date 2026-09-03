'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/components/language-provider'
import { verdictFor } from '@/lib/tuner/note-math'
import type { TunerStore } from '@/lib/tuner/tuner-store'

export type MeterMode = 'needle' | 'strobe'

interface TuningMeterProps {
  store: TunerStore
  mode: MeterMode
  tol: number
  onModeChange: (mode: MeterMode) => void
}

const RANGE = 50
const PAD = 22

interface Palette {
  ok: string
  warn: string
  bad: string
  muted: string
  fg: string
  tick: string
  tickMinor: string
}

function readPalette(): Palette {
  const s = getComputedStyle(document.documentElement)
  const v = (name: string) => s.getPropertyValue(name).trim()
  const fg = v('--foreground')
  return {
    ok: `hsl(${v('--success')})`,
    warn: `hsl(${v('--primary')})`,
    bad: `hsl(${v('--terracotta')})`,
    muted: `hsl(${v('--muted-foreground')})`,
    fg: `hsl(${fg})`,
    tick: `hsl(${fg} / 0.28)`,
    tickMinor: `hsl(${fg} / 0.12)`,
  }
}

/**
 * Canvas meter driven straight from the store inside its own rAF loop, so the
 * needle animates at display rate without React re-renders.
 */
export function TuningMeter({ store, mode, tol, onModeChange }: TuningMeterProps) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const modeRef = useRef(mode)
  const tolRef = useRef(tol)
  useEffect(() => {
    modeRef.current = mode
    tolRef.current = tol
  }, [mode, tol])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    let W = 0
    let H = 0
    let needle = 0
    let phase = 0
    let glow = 0
    let last = performance.now()
    let palette = readPalette()
    let paletteAt = last
    let raf = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.getBoundingClientRect()
      W = rect.width
      H = rect.height
      canvas.width = Math.max(1, Math.round(W * dpr))
      canvas.height = Math.max(1, Math.round(H * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const xOf = (c: number) => PAD + ((c + RANGE) / (2 * RANGE)) * (W - 2 * PAD)

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      const dt = Math.min(64, now - last) / 1000
      last = now
      if (now - paletteAt > 400) {
        palette = readPalette()
        paletteAt = now
      }
      const P = palette
      const { frame } = store.getSnapshot()
      const tolerance = tolRef.current
      const target = frame ? Math.max(-RANGE, Math.min(RANGE, frame.cents)) : 0
      needle += (target - needle) * (reduce ? 1 : Math.min(1, dt * 14))
      const locked = !!frame && Math.abs(needle) <= tolerance
      glow += ((locked ? 1 : 0) - glow) * Math.min(1, dt * 8)
      const v = verdictFor(needle, tolerance)
      const col = frame ? (v === 'ok' ? P.ok : v === 'warn' ? P.warn : P.bad) : P.muted

      ctx.clearRect(0, 0, W, H)

      if (modeRef.current === 'needle') {
        const y = H - 22
        const x0 = xOf(-RANGE)
        const x1 = xOf(RANGE)
        const g = ctx.createLinearGradient(x0, 0, x1, 0)
        g.addColorStop(0, P.bad)
        g.addColorStop(0.33, P.warn)
        g.addColorStop(0.5 - tolerance / 100, P.ok)
        g.addColorStop(0.5 + tolerance / 100, P.ok)
        g.addColorStop(0.67, P.warn)
        g.addColorStop(1, P.bad)
        ctx.globalAlpha = 0.28 + glow * 0.25
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.roundRect(x0, y, x1 - x0, 6, 3)
        ctx.fill()
        ctx.globalAlpha = 1

        for (let c = -RANGE; c <= RANGE; c += 2) {
          const major = c % 10 === 0
          const tall = c === 0 || Math.abs(c) === RANGE
          const h = tall ? 22 : major ? 14 : 7
          ctx.fillStyle = major ? P.tick : P.tickMinor
          ctx.fillRect(Math.round(xOf(c)) - 0.5, y - 6 - h, tall ? 2 : 1, h)
        }

        ctx.fillStyle = P.ok
        ctx.globalAlpha = 0.1 + glow * 0.18
        ctx.fillRect(xOf(-tolerance), 6, xOf(tolerance) - xOf(-tolerance), y - 8)
        ctx.globalAlpha = 1

        const nx = xOf(needle)
        ctx.save()
        ctx.globalAlpha = frame ? 1 : 0.28
        ctx.shadowColor = col
        ctx.shadowBlur = frame ? 10 + glow * 18 : 0
        ctx.strokeStyle = col
        ctx.lineWidth = 3
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(nx, 14)
        ctx.lineTo(nx, y - 4)
        ctx.stroke()
        ctx.fillStyle = col
        ctx.beginPath()
        ctx.moveTo(nx - 8, 2)
        ctx.lineTo(nx + 8, 2)
        ctx.lineTo(nx, 14)
        ctx.closePath()
        ctx.fill()
        ctx.restore()

        if (frame && Math.abs(frame.cents) > RANGE) {
          ctx.fillStyle = col
          ctx.font = '600 12px Inter, system-ui, sans-serif'
          ctx.textAlign = frame.cents < 0 ? 'left' : 'right'
          ctx.fillText(
            frame.cents < 0 ? `◀ ${t('dashboard.pages.tuner.readout.overFlat')}` : `${t('dashboard.pages.tuner.readout.overSharp')} ▶`,
            frame.cents < 0 ? PAD + 4 : W - PAD - 4,
            12
          )
        }
      } else {
        const speed = frame ? (frame.cents / RANGE) * 260 : 0
        if (!reduce && frame && !locked) phase += speed * dt
        const bands: [number, number, number][] = [
          [8, 34, 1],
          [46, 30, 4],
        ]
        bands.forEach(([y, h, mult]) => {
          const sw = 28 / mult
          const ph = (((phase * mult) % sw) + sw) % sw
          ctx.save()
          ctx.beginPath()
          ctx.roundRect(PAD, y, W - 2 * PAD, h, 6)
          ctx.clip()
          ctx.fillStyle = P.tickMinor
          ctx.fillRect(PAD, y, W - 2 * PAD, h)
          ctx.fillStyle = col
          ctx.globalAlpha = frame ? 0.5 + glow * 0.3 : 0.12
          for (let x = PAD - sw + ph; x < W; x += sw) ctx.fillRect(x, y, sw / 2, h)
          ctx.restore()
        })
        ctx.fillStyle = P.fg
        ctx.globalAlpha = 0.6
        ctx.fillRect(W / 2 - 0.5, 4, 1, H - 20)
        ctx.globalAlpha = 1
        const nx = xOf(needle)
        ctx.fillStyle = col
        ctx.globalAlpha = frame ? 1 : 0.3
        ctx.beginPath()
        ctx.moveTo(nx - 6, H - 4)
        ctx.lineTo(nx + 6, H - 4)
        ctx.lineTo(nx, H - 14)
        ctx.closePath()
        ctx.fill()
        ctx.globalAlpha = 1
      }
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [store, t])

  return (
    <div className="relative mx-auto mt-1.5 w-full max-w-[720px] select-none">
      <div className="absolute -top-6 right-0 inline-flex gap-0.5 rounded-[7px] border border-border bg-card p-0.5" role="group" aria-label={t('dashboard.pages.tuner.meter.label')}>
        {(['needle', 'strobe'] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => onModeChange(m)}
            className={cn(
              'rounded-[5px] px-2 py-[3px] text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              mode === m ? 'bg-raised text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t(`dashboard.pages.tuner.meter.${m}`)}
          </button>
        ))}
      </div>
      <span className="absolute left-0 top-[22px] font-heading text-[22px] leading-none text-muted-foreground" aria-hidden>
        ♭
      </span>
      <span className="absolute right-0 top-[22px] font-heading text-[22px] leading-none text-muted-foreground" aria-hidden>
        ♯
      </span>
      <canvas ref={canvasRef} className="block h-[84px] w-full sm:h-24" aria-hidden />
      <div className="mt-0.5 flex justify-between px-0.5 text-[11px] text-muted-foreground tabular-nums" aria-hidden>
        <span>−50</span>
        <span>−25</span>
        <span className="text-foreground">0</span>
        <span>+25</span>
        <span>+50</span>
      </div>
    </div>
  )
}
