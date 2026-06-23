'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Mic, MicOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/components/language-provider'

interface SignalWaveformProps {
  getAnalyser: () => AnalyserNode | null
  level: number
  isListening: boolean
  onStart: () => void
  onStop: () => void
}

const LEVEL_SEGMENTS = 14

export function SignalWaveform({ getAnalyser, level, isListening, onStart, onStop }: SignalWaveformProps) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
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

    let buf: Float32Array<ArrayBuffer> | null = null

    const draw = () => {
      const rect = canvas.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      ctx.clearRect(0, 0, w, h)

      const analyser = getAnalyser()
      const mid = h / 2

      ctx.lineWidth = 2
      ctx.lineJoin = 'round'

      if (analyser) {
        if (!buf || buf.length !== analyser.fftSize) buf = new Float32Array(analyser.fftSize)
        analyser.getFloatTimeDomainData(buf)
        const step = Math.max(1, Math.floor(buf.length / w))
        ctx.beginPath()
        for (let x = 0; x < w; x++) {
          const v = buf[Math.min(buf.length - 1, x * step)]
          const y = mid + v * mid * 0.95
          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        const grad = ctx.createLinearGradient(0, 0, w, 0)
        grad.addColorStop(0, 'rgba(232,150,70,0.35)')
        grad.addColorStop(0.5, 'rgba(232,150,70,0.95)')
        grad.addColorStop(1, 'rgba(232,150,70,0.35)')
        ctx.strokeStyle = grad
        ctx.stroke()
      } else {
        // Idle: a flat dim baseline
        ctx.beginPath()
        ctx.moveTo(0, mid)
        ctx.lineTo(w, mid)
        ctx.strokeStyle = 'rgba(255,255,255,0.10)'
        ctx.stroke()
      }

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [getAnalyser])

  const litSegments = Math.round(level * LEVEL_SEGMENTS)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
          {t('dashboard.pages.tuner.signal.title')}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className={cn(
              'h-2 w-2 rounded-full transition-colors',
              isListening ? 'animate-pulse bg-green-500' : 'bg-muted-foreground/40'
            )}
          />
          {isListening ? t('dashboard.pages.tuner.signal.live') : t('dashboard.pages.tuner.signal.off')}
        </span>
      </div>

      {/* Waveform */}
      <canvas ref={canvasRef} className="h-14 w-full" aria-hidden />

      {/* Input level meter */}
      <div className="flex items-center gap-2">
        <span className="w-8 shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
          {t('dashboard.pages.tuner.signal.level')}
        </span>
        <div className="flex flex-1 gap-[3px]">
          {Array.from({ length: LEVEL_SEGMENTS }).map((_, i) => {
            const on = i < litSegments
            const hot = i >= LEVEL_SEGMENTS - 3
            return (
              <span
                key={i}
                className={cn(
                  'h-3 flex-1 rounded-[2px] transition-colors duration-75',
                  on ? (hot ? 'bg-terracotta' : 'bg-primary') : 'bg-muted/40'
                )}
              />
            )
          })}
        </div>
      </div>

      {/* Mic control */}
      <div className="flex items-center gap-3 pt-1">
        <div className="relative">
          {isListening && (
            <motion.span
              className="absolute inset-0 rounded-full bg-destructive/30"
              animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0, 0.4] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          <button
            type="button"
            onClick={isListening ? onStop : onStart}
            aria-label={isListening ? t('dashboard.pages.tuner.stopTuner') : t('dashboard.pages.tuner.startTuner')}
            className={cn(
              'relative flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              isListening
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
          >
            {isListening ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </button>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium">
            {isListening ? t('dashboard.pages.tuner.stopTuner') : t('dashboard.pages.tuner.startTuner')}
          </div>
          <div className="text-xs text-muted-foreground">
            {isListening ? t('dashboard.pages.tuner.signal.hintLive') : t('dashboard.pages.tuner.signal.hintIdle')}
          </div>
        </div>
      </div>
    </div>
  )
}
