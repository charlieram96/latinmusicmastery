'use client'

import type { ReactNode } from 'react'

/** Shared time formatting for the stage chrome. */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

/**
 * Circular progress ring used by both the live HUD (accuracy) and the results
 * panel (score). Defaults to the brand green; pass `color` to override and
 * `children` to render custom centered content (e.g. a letter grade).
 */
export function AccuracyRing({
  pct,
  size = 46,
  sw = 4,
  color = '#57B36B',
  trackColor = 'rgba(255,255,255,0.12)',
  children,
}: {
  pct: number
  size?: number
  sw?: number
  color?: string
  trackColor?: string
  children?: ReactNode
}) {
  const r = size / 2 - sw
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <div className="sv-acc-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={sw} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped / 100)}
          style={{ transition: 'stroke-dashoffset .6s ease-out' }}
        />
      </svg>
      <span className="pct" style={{ fontSize: size * 0.28 }}>
        {children ?? `${Math.round(clamped)}%`}
      </span>
    </div>
  )
}
