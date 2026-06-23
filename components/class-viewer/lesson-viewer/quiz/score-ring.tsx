'use client'

import { animate } from 'framer-motion'
import { useEffect, useState } from 'react'

/** SVG progress ring that counts up to `pct` on mount. */
export function ScoreRing({ pct, size = 168, stroke = 14 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const controls = animate(0, pct, {
      duration: 1.1,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(Math.round(v)),
    })
    return () => controls.stop()
  }, [pct])

  const offset = circumference - (display / 100) * circumference
  const tone = pct >= 80 ? 'hsl(145 55% 42%)' : pct >= 50 ? 'hsl(30 85% 55%)' : 'hsl(0 72% 55%)'

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-4xl font-black tabular-nums">{display}%</span>
      </div>
    </div>
  )
}
