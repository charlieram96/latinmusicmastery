'use client'

import { useEffect, useRef } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'
import { cn } from '@/lib/utils'
import { GRADE_COLORS } from '@/lib/play-sense/types'
import type { HitGrade } from '@/lib/play-sense/types'
import { GRADE_LABELS, GRADE_GLOW } from '@/lib/play-sense/animations'
import { Flame } from 'lucide-react'

interface LiveScoreHUDProps {
  score: number
  combo: number
  accuracy: number
  tempoDrift: number
  lastHitGrade: string | null
  inputLevel: number
}

// Animated number that counts up smoothly
function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const spring = useSpring(0, { stiffness: 120, damping: 20 })
  const display = useTransform(spring, (v) => `${Math.round(v)}${suffix}`)

  useEffect(() => {
    spring.set(value)
  }, [spring, value])

  return <motion.span>{display}</motion.span>
}

// SVG circular accuracy ring
function AccuracyRing({ accuracy }: { accuracy: number }) {
  const radius = 30
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (accuracy / 100) * circumference

  return (
    <div className="relative w-20 h-20 mx-auto">
      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
        {/* Background ring */}
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="rgba(148,163,184,0.15)"
          strokeWidth="5"
        />
        {/* Progress ring */}
        <motion.circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="url(#accuracyGradient)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
        <defs>
          <linearGradient id="accuracyGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-slate-200 font-mono">
          {Math.round(accuracy)}%
        </span>
      </div>
    </div>
  )
}

export function LiveScoreHUD({
  score,
  combo,
  accuracy,
  tempoDrift,
  lastHitGrade,
  inputLevel,
}: LiveScoreHUDProps) {
  const tempoLabel =
    Math.abs(tempoDrift) < 15
      ? 'On track'
      : tempoDrift > 0
        ? 'Slowing down'
        : 'Speeding up'

  const tempoColor =
    Math.abs(tempoDrift) < 15
      ? 'text-green-400'
      : Math.abs(tempoDrift) < 30
        ? 'text-yellow-400'
        : 'text-red-400'

  const gradeColor = lastHitGrade
    ? GRADE_COLORS[lastHitGrade as HitGrade] || '#94a3b8'
    : '#94a3b8'

  const gradeLabel = lastHitGrade
    ? GRADE_LABELS[lastHitGrade] || lastHitGrade
    : '---'

  const gradeGlow = lastHitGrade
    ? GRADE_GLOW[lastHitGrade] || 'none'
    : 'none'

  // Normalize input level to 0-100
  const meterWidth = Math.min(inputLevel * 500, 100)
  const meterColor =
    meterWidth > 80 ? 'from-red-500 to-red-400' :
    meterWidth > 50 ? 'from-yellow-500 to-yellow-400' :
    'from-green-500 to-emerald-400'

  // Combo fire effects
  const comboHigh = combo >= 20
  const comboMed = combo >= 10
  const comboLow = combo >= 5

  const prevComboRef = useRef(combo)
  const comboChanged = combo !== prevComboRef.current
  prevComboRef.current = combo

  return (
    <div className="space-y-5">
      {/* Score */}
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Score</p>
        <p className="text-3xl font-black font-mono text-slate-100">
          <AnimatedNumber value={Math.round(score)} suffix="%" />
        </p>
      </div>

      {/* Combo with fire */}
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Combo</p>
        <motion.div
          className="flex items-center gap-2"
          animate={
            comboChanged && comboMed
              ? { x: [0, -2, 2, -2, 0], scale: [1, 1.05, 1] }
              : {}
          }
          transition={{ duration: 0.3 }}
        >
          {comboLow && (
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
            >
              <Flame
                className={cn(
                  'w-5 h-5',
                  comboHigh ? 'text-red-400' : comboMed ? 'text-orange-400' : 'text-yellow-400'
                )}
                style={{
                  filter: comboHigh
                    ? 'drop-shadow(0 0 8px rgba(239,68,68,0.6))'
                    : comboMed
                      ? 'drop-shadow(0 0 6px rgba(249,115,22,0.5))'
                      : 'drop-shadow(0 0 4px rgba(234,179,8,0.4))',
                }}
              />
            </motion.div>
          )}
          <p className={cn(
            'text-2xl font-black font-mono',
            comboHigh ? 'text-red-400' : comboMed ? 'text-orange-400' : comboLow ? 'text-yellow-400' : 'text-slate-100'
          )}>
            {combo}x
          </p>
        </motion.div>
      </div>

      {/* Accuracy Ring */}
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Accuracy</p>
        <AccuracyRing accuracy={accuracy} />
      </div>

      {/* Tempo */}
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Tempo</p>
        <p className={cn('text-sm font-medium', tempoColor)}>{tempoLabel}</p>
      </div>

      {/* Last hit grade */}
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Last Hit</p>
        <motion.p
          key={lastHitGrade}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-xl font-black"
          style={{ color: gradeColor, textShadow: gradeGlow }}
        >
          {gradeLabel}
        </motion.p>
      </div>

      {/* Mic level */}
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Mic Level</p>
        <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            className={cn('h-full rounded-full bg-gradient-to-r', meterColor)}
            animate={{ width: `${meterWidth}%` }}
            transition={{ duration: 0.075 }}
          />
        </div>
      </div>
    </div>
  )
}
