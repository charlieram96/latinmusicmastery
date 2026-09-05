'use client'

import { useReducedMotion } from 'framer-motion'
import { useMemo } from 'react'
import styles from './quiz.module.css'

const COLORS = ['hsl(var(--success))', 'hsl(var(--gold-highlight))', 'hsl(var(--primary))', '#F5E6C8']

/** Small confetti burst from the center of its (position: relative) parent. Deterministic, SSR-safe, skipped under reduced motion. */
export function Burst({ count = 14, spread = 64 }: { count?: number; spread?: number }) {
  const reduce = useReducedMotion()
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + (i % 2) * 0.35
        const dist = spread * (0.6 + ((i * 7) % 5) / 10)
        return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist - 18, rot: (i * 53) % 360, color: COLORS[i % COLORS.length], delay: (i % 3) * 25 }
      }),
    [count, spread],
  )
  if (reduce) return null
  return (
    <span className={styles.burst} aria-hidden>
      {pieces.map((p, i) => (
        <i
          key={i}
          className={styles.burstPiece}
          style={{ ['--dx' as string]: `${p.dx}px`, ['--dy' as string]: `${p.dy}px`, ['--r' as string]: `${p.rot}deg`, background: p.color, animationDelay: `${p.delay}ms` }}
        />
      ))}
    </span>
  )
}
