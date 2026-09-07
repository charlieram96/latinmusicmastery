'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { useMemo } from 'react'

const COLORS = ['hsl(var(--gold-highlight))', 'hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--terracotta))', 'hsl(var(--foreground) / 0.8)']

/** Deterministic framer-motion confetti (SSR-safe). Skipped under reduced motion. */
export function Confetti({ count = 70 }: { count?: number }) {
  const reduce = useReducedMotion()
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: ((i * 71) % 100) + (((i * 37) % 11) - 5) / 10,
        delay: ((i * 53) % 45) / 100,
        duration: 1.6 + ((i * 29) % 90) / 100,
        rotate: (i * 91) % 360,
        color: COLORS[i % COLORS.length],
        size: 6 + ((i * 17) % 8),
      })),
    [count],
  )
  if (reduce) return null
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute top-0 block rounded-[2px]"
          style={{ left: `${p.left}%`, width: p.size, height: p.size * 0.6, backgroundColor: p.color }}
          initial={{ y: '-12%', opacity: 0, rotate: 0 }}
          animate={{ y: '120%', opacity: [0, 1, 1, 0], rotate: p.rotate }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeIn' }}
        />
      ))}
    </div>
  )
}
