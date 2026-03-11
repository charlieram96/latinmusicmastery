'use client'

import { motion, AnimatePresence } from 'framer-motion'

interface VisualMetronomeProps {
  beat: number       // 1-indexed beat in measure (0 = inactive)
  isDownbeat: boolean
}

export function VisualMetronome({ beat, isDownbeat }: VisualMetronomeProps) {
  if (beat === 0) return null

  const scale = isDownbeat ? 1.6 : 1.3
  const color = isDownbeat ? 'hsl(30, 85%, 55%)' : 'hsl(0, 0%, 60%)'
  const glowColor = isDownbeat ? 'hsl(30, 85%, 55%)' : 'hsl(0, 0%, 50%)'

  return (
    <div className="absolute inset-0 flex items-center justify-center z-[5] pointer-events-none">
      <AnimatePresence mode="wait">
        <motion.div
          key={beat + '-' + Math.floor(Date.now() / 100)}
          initial={{ scale: 1, opacity: 0.5 }}
          animate={{ scale, opacity: 0.7 }}
          exit={{ scale: 1, opacity: 0 }}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 25,
            duration: 0.2,
          }}
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            backgroundColor: color,
            boxShadow: `0 0 40px ${glowColor}40, 0 0 80px ${glowColor}20`,
            opacity: 0.35,
          }}
        />
      </AnimatePresence>
    </div>
  )
}
