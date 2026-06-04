'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AttemptStats } from '@/lib/play-sense/types'
import { GRADE_COLORS } from '@/lib/play-sense/types'
import { getLetterGrade } from '@/lib/play-sense/exercise-utils'
import { getStarCount } from '@/lib/play-sense/animations'
import { RotateCcw, ChevronRight, Eye, Target, Flame, Zap, Trophy, Clock, Star, Music } from 'lucide-react'

interface ResultsSummaryProps {
  stats: AttemptStats
  exerciseTitle: string
  onRetry: () => void
  /** Advance to the next item. Hidden when not provided. */
  onNext?: () => void
  /** Label for the "next" action (default "Next Track"). */
  nextLabel?: string
  /** Return to the instructional video. Shows a "Watch demo again" button when set. */
  onWatchDemo?: () => void
}

// Confetti particle
function ConfettiParticle({ index }: { index: number }) {
  const style = useMemo(() => {
    const colors = ['#22c55e', '#3b82f6', '#eab308', '#ec4899', '#D4A854', '#C4654A', '#8b5cf6', '#f97316']
    const color = colors[index % colors.length]
    const left = Math.random() * 100
    const delay = Math.random() * 0.8
    const duration = 1.5 + Math.random() * 1.5
    const rotation = Math.random() * 720 - 360
    const size = 4 + Math.random() * 6

    return { color, left, delay, duration, rotation, size }
  }, [index])

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        left: `${style.left}%`,
        top: -10,
        width: style.size,
        height: style.size,
        backgroundColor: style.color,
        borderRadius: Math.random() > 0.5 ? '50%' : '2px',
      }}
      initial={{ y: 0, opacity: 1, rotate: 0 }}
      animate={{
        y: [0, 400 + Math.random() * 200],
        x: [0, (Math.random() - 0.5) * 200],
        opacity: [1, 1, 0],
        rotate: style.rotation,
      }}
      transition={{
        duration: style.duration,
        delay: style.delay,
        ease: 'easeOut',
      }}
    />
  )
}

function AnimatedScore({ target, delay = 0 }: { target: number; delay?: number }) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      const duration = 1500
      const start = performance.now()
      const tick = (now: number) => {
        const elapsed = now - start
        const progress = Math.min(elapsed / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        setCurrent(eased * target)
        if (progress < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, delay * 1000)
    return () => clearTimeout(timer)
  }, [target, delay])

  return <>{current.toFixed(1)}%</>
}

// Vinyl disc with concentric grooves
function VinylDisc({ letterGrade, gradeColor, gradeGlow, score }: {
  letterGrade: string
  gradeColor: string
  gradeGlow: string
  score: number
}) {
  const size = 200
  const center = size / 2
  const ringRadius = 90
  const strokeWidth = 5
  const circumference = 2 * Math.PI * ringRadius
  const scoreFraction = Math.min(score / 100, 1)

  const ringColor =
    score >= 90 ? '#22c55e' :
    score >= 70 ? '#eab308' :
    score >= 50 ? '#f97316' :
    '#ef4444'

  // Groove radii for the vinyl look
  const grooves = [30, 38, 46, 54, 62, 70, 78]

  return (
    <motion.div
      className="relative mx-auto"
      style={{ width: size, height: size }}
      initial={{ opacity: 0, scale: 0.3, rotate: -180 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={{ delay: 0.2, duration: 1, type: 'spring', stiffness: 80, damping: 14 }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Disc background */}
        <circle cx={center} cy={center} r={95} fill="hsl(var(--secondary))" />
        <circle cx={center} cy={center} r={93} className="fill-zinc-900 dark:fill-zinc-900" />

        {/* Grooves */}
        {grooves.map((r) => (
          <circle
            key={r}
            cx={center}
            cy={center}
            r={r}
            fill="none"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={0.5}
            opacity={0.12}
          />
        ))}

        {/* Score ring background track */}
        <circle
          cx={center}
          cy={center}
          r={ringRadius}
          fill="none"
          stroke="hsl(var(--secondary))"
          strokeWidth={strokeWidth}
        />

        {/* Score ring animated fill */}
        <motion.circle
          cx={center}
          cy={center}
          r={ringRadius}
          fill="none"
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          style={{ transformOrigin: 'center', rotate: '-90deg' }}
          animate={{ strokeDashoffset: circumference * (1 - scoreFraction) }}
          transition={{ delay: 0.8, duration: 1.2, ease: 'easeOut' }}
        />

        {/* Center label area */}
        <circle cx={center} cy={center} r={24} fill="hsl(var(--secondary))" opacity={0.3} />
      </svg>

      {/* Grade letter overlay */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.2, type: 'spring', stiffness: 400, damping: 15 }}
      >
        <span
          className={cn('text-5xl font-black', gradeColor)}
          style={{ textShadow: gradeGlow }}
        >
          {letterGrade}
        </span>
      </motion.div>
    </motion.div>
  )
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export function ResultsSummary({
  stats,
  exerciseTitle,
  onRetry,
  onNext,
  nextLabel = 'Next Track',
  onWatchDemo,
}: ResultsSummaryProps) {
  const letterGrade = getLetterGrade(stats.score)
  const totalHits = stats.perfectCount + stats.goodCount + stats.okCount + stats.missCount
  const starCount = getStarCount(stats.score)
  const showConfetti = stats.score >= 80

  const gradeColor =
    stats.score >= 90 ? 'text-green-600 dark:text-green-400' :
    stats.score >= 70 ? 'text-yellow-600 dark:text-yellow-400' :
    stats.score >= 50 ? 'text-orange-600 dark:text-orange-400' :
    'text-red-600 dark:text-red-400'

  const gradeGlow =
    stats.score >= 90 ? '0 0 40px rgba(34,197,94,0.4)' :
    stats.score >= 70 ? '0 0 40px rgba(234,179,8,0.4)' :
    stats.score >= 50 ? '0 0 30px rgba(249,115,22,0.3)' :
    '0 0 20px rgba(239,68,68,0.3)'

  const hitDistribution = [
    { count: stats.perfectCount, color: GRADE_COLORS.perfect, label: 'Perfect' },
    { count: stats.goodCount, color: GRADE_COLORS.good, label: 'Good' },
    { count: stats.okCount, color: GRADE_COLORS.ok, label: 'Ok' },
    { count: stats.missCount, color: GRADE_COLORS.miss, label: 'Miss' },
  ]

  const sessionNotes = [
    { icon: Target, color: 'text-amber-600 dark:text-amber-400', value: `${stats.accuracy.toFixed(1)}%`, label: 'Accuracy' },
    ...(stats.pitchAccuracy != null
      ? [{ icon: Music, color: 'text-violet-600 dark:text-violet-400', value: `${stats.pitchAccuracy.toFixed(1)}%`, label: 'Pitch Accuracy' }]
      : []),
    { icon: Flame, color: 'text-[hsl(14,52%,48%)] dark:text-[hsl(14,52%,53%)]', value: `${stats.maxCombo}x`, label: 'Best Combo' },
    { icon: Zap, color: 'text-[hsl(38,58%,50%)] dark:text-[hsl(38,58%,58%)]', value: String(stats.maxStreak), label: 'Perfect Streak' },
    { icon: Trophy, color: 'text-emerald-600 dark:text-emerald-400', value: `${stats.avgOffsetMs > 0 ? '+' : ''}${stats.avgOffsetMs.toFixed(1)}ms`, label: 'Avg Timing' },
    { icon: Clock, color: 'text-blue-600 dark:text-blue-400', value: `${stats.tempoDriftMs > 0 ? '+' : ''}${stats.tempoDriftMs.toFixed(1)}ms`, label: 'Tempo Drift' },
  ]

  const lowScore = stats.score < 50

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-2xl mx-auto bg-card rounded-2xl border border-border p-6 md:p-8 space-y-7 relative overflow-hidden"
    >
      {/* Confetti */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
          {Array.from({ length: 30 }).map((_, i) => (
            <ConfettiParticle key={i} index={i} />
          ))}
        </div>
      )}

      {/* Hero: Vinyl Disc + Score Ring */}
      <div className="text-center space-y-3 pt-2">
        <VinylDisc
          letterGrade={letterGrade}
          gradeColor={gradeColor}
          gradeGlow={gradeGlow}
          score={stats.score}
        />

        {/* Animated score counter */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
          className="text-3xl font-black font-mono text-foreground"
        >
          <AnimatedScore target={stats.score} delay={1.4} />
        </motion.p>

        {/* Title + subtitle */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6 }}
          className="space-y-1"
        >
          <h2 className="text-lg font-semibold text-foreground">{exerciseTitle}</h2>
          <p className="tracking-widest text-xs uppercase text-muted-foreground">Performance Review</p>
        </motion.div>
      </div>

      {/* Stars */}
      <div className="flex justify-center gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0, rotate: -30 }}
            animate={
              i < starCount
                ? { opacity: 1, scale: 1, rotate: 0 }
                : { opacity: 0.2, scale: 0.8, rotate: 0 }
            }
            transition={{ delay: 1.8 + i * 0.1, type: 'spring', stiffness: 400, damping: 15 }}
          >
            <Star
              className={cn(
                'w-7 h-7',
                i < starCount ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/40'
              )}
              style={i < starCount ? { filter: 'drop-shadow(0 0 8px rgba(234,179,8,0.5))' } : {}}
            />
          </motion.div>
        ))}
      </div>

      {/* Performance Bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.2 }}
        className="space-y-2.5"
      >
        <div className="relative">
          <div className="flex h-5 rounded-full overflow-hidden bg-secondary shadow-inner">
            {/* Tick marks */}
            <div className="absolute inset-0 pointer-events-none z-[1]">
              {[25, 50, 75].map(pct => (
                <div
                  key={pct}
                  className="absolute top-0 bottom-0 w-px bg-foreground/10"
                  style={{ left: `${pct}%` }}
                />
              ))}
            </div>
            {hitDistribution.map((item) =>
              item.count > 0 ? (
                <motion.div
                  key={item.label}
                  className="flex items-center justify-center text-[10px] font-bold relative z-[2]"
                  style={{ backgroundColor: item.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(item.count / totalHits) * 100}%` }}
                  transition={{ delay: 2.2, duration: 0.8, ease: 'easeOut' }}
                >
                  <span className={item.label === 'Good' ? 'text-black' : 'text-white'}>
                    {item.count}
                  </span>
                </motion.div>
              ) : null
            )}
          </div>
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          {hitDistribution.map((item) => (
            <span key={item.label} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      </motion.div>

      {/* Session Notes */}
      <div className="space-y-2">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.5 }}
          className="tracking-[0.25em] text-[10px] uppercase text-muted-foreground font-medium"
        >
          Session Notes
        </motion.p>
        <div className="space-y-0">
          {sessionNotes.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 2.6 + i * 0.08 }}
              className={cn(
                'flex items-center gap-3 py-2.5 px-1',
                i < sessionNotes.length - 1 && 'border-b border-border/40'
              )}
            >
              <stat.icon className={cn('w-4 h-4 flex-shrink-0', stat.color)} />
              <span className="text-xs text-muted-foreground uppercase tracking-wide flex-1">
                {stat.label}
              </span>
              <span className="text-sm font-bold font-mono text-foreground">
                {stat.value}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Extra info */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 3.0 }}
        className="flex gap-2 flex-wrap"
      >
        {stats.extraHits > 0 && (
          <span className="text-xs px-2 py-1 rounded-full bg-secondary text-muted-foreground border border-border">
            {stats.extraHits} extra hit{stats.extraHits > 1 ? 's' : ''}
          </span>
        )}
        <span className="text-xs px-2 py-1 rounded-full bg-secondary text-muted-foreground border border-border">
          {formatDuration(stats.durationSeconds)}
        </span>
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 3.2 }}
        className="flex gap-3 flex-wrap"
      >
        {(() => {
          const gradient =
            'bg-gradient-to-r from-primary to-[hsl(14,52%,48%)] hover:from-primary/90 hover:to-[hsl(14,52%,53%)] text-white border-0'
          const outline = 'border-border text-foreground dark:text-slate-300 hover:bg-secondary'
          // Play Again is the hero action when the run was weak (or when there's no
          // "next" to advance to); otherwise the next/continue action is the hero.
          const retryIsHero = lowScore || !onNext
          return (
            <>
              <Button
                variant={retryIsHero ? undefined : 'outline'}
                className={cn('flex-1', retryIsHero ? gradient : outline)}
                onClick={onRetry}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Play Again
              </Button>

              {onWatchDemo && (
                <Button
                  variant="outline"
                  className={cn('flex-1', outline)}
                  onClick={onWatchDemo}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Watch demo again
                </Button>
              )}

              {onNext && (
                <Button
                  variant={retryIsHero ? 'outline' : undefined}
                  className={cn('flex-1', retryIsHero ? outline : gradient)}
                  onClick={onNext}
                >
                  {nextLabel}
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </>
          )
        })()}
      </motion.div>
    </motion.div>
  )
}
