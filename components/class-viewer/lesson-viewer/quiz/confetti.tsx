'use client'

import { motion } from 'framer-motion'
import { useMemo } from 'react'

const COLORS = ['#f59e0b', '#fbbf24', '#34d399', '#60a5fa', '#f472b6', '#a78bfa']

/** Deterministic framer-motion confetti burst. No randomness so it is SSR-safe. */
export function Confetti({ count = 90 }: { count?: number }) {
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
