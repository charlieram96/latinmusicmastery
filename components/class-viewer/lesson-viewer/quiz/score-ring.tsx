'use client'

import { animate, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useTranslation } from '@/components/language-provider'

/** SVG ring that counts up to `pct`. The number scales with the ring (26% of its size) so small rings never overflow. */
export function ScoreRing({ pct, size = 156, stroke = 13 }: { pct: number; size?: number; stroke?: number }) {
  const { t } = useTranslation()
  const reduce = useReducedMotion()
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const [animated, setAnimated] = useState(0)

  useEffect(() => {
    if (reduce) return
    const controls = animate(0, pct, { duration: 0.9, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setAnimated(Math.round(v)) })
    return () => controls.stop()
  }, [pct, reduce])

  // Reduced motion (or the SSR/pre-hydration `reduce === null` window) shows the
  // final value directly instead of mirroring it into state from an effect.
  const display = reduce ? pct : animated
  const offset = circumference - (display / 100) * circumference
  const tone = pct >= 80 ? 'hsl(var(--success))' : pct >= 50 ? 'hsl(var(--primary))' : 'hsl(var(--terracotta))'

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--foreground) / 0.09)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <div className="absolute grid justify-items-center leading-none">
        <span className="font-heading font-black tabular-nums tracking-[-0.03em]" style={{ fontSize: Math.round(size * 0.26) }}>
          {display}%
        </span>
        <span className="mt-1 font-semibold uppercase tracking-[0.1em] text-muted-foreground" style={{ fontSize: Math.max(8, Math.round(size * 0.07)) }}>
          {t('dashboard.classViewer.quiz.results.score')}
        </span>
      </div>
    </div>
  )
}
