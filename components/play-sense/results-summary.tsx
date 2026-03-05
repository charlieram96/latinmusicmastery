'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AttemptStats } from '@/lib/play-sense/types'
import { GRADE_COLORS } from '@/lib/play-sense/types'
import { getLetterGrade } from '@/lib/play-sense/exercise-utils'
import { getStarCount, staggerContainer, staggerItem } from '@/lib/play-sense/animations'
import { RotateCcw, ChevronRight, Target, Flame, Zap, Trophy, Star } from 'lucide-react'

interface ResultsSummaryProps {
  stats: AttemptStats
  exerciseTitle: string
  onRetry: () => void
  onNext: () => void
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

function AnimatedScore({ target }: { target: number }) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    const duration = 1500
    const start = performance.now()
    const tick = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setCurrent(eased * target)
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target])

  return <>{current.toFixed(1)}%</>
}

export function ResultsSummary({ stats, exerciseTitle, onRetry, onNext }: ResultsSummaryProps) {
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

  return (
    <div className="max-w-2xl mx-auto bg-card rounded-2xl border border-border p-6 md:p-8 space-y-8 relative overflow-hidden">
      {/* Confetti */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
          {Array.from({ length: 30 }).map((_, i) => (
            <ConfettiParticle key={i} index={i} />
          ))}
        </div>
      )}

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-center space-y-2"
      >
        <h2 className="text-xl font-semibold text-foreground">{exerciseTitle}</h2>
        <p className="text-sm text-muted-foreground tracking-wider uppercase">Practice Complete</p>
      </motion.div>

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
            transition={{ delay: 0.3 + i * 0.12, type: 'spring', stiffness: 400, damping: 15 }}
          >
            <Star
              className={cn(
                'w-8 h-8',
                i < starCount ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/40'
              )}
              style={i < starCount ? { filter: 'drop-shadow(0 0 8px rgba(234,179,8,0.5))' } : {}}
            />
          </motion.div>
        ))}
      </div>

      {/* Letter Grade + Score */}
      <div className="flex items-center justify-center gap-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.3 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, type: 'spring', stiffness: 300, damping: 20 }}
          className="text-center"
        >
          <p
            className={cn('text-7xl font-black', gradeColor)}
            style={{ textShadow: gradeGlow }}
          >
            {letterGrade}
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-center"
        >
          <p className="text-4xl font-black font-mono text-foreground">
            <AnimatedScore target={stats.score} />
          </p>
          <p className="text-sm text-muted-foreground mt-1">Score</p>
        </motion.div>
      </div>

      {/* Hit Distribution */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="space-y-3"
      >
        <p className="text-sm font-medium text-muted-foreground">Hit Distribution</p>
        <div className="flex h-7 rounded-full overflow-hidden bg-secondary">
          {hitDistribution.map((item) =>
            item.count > 0 ? (
              <motion.div
                key={item.label}
                className="flex items-center justify-center text-[10px] font-bold"
                style={{ backgroundColor: item.color }}
                initial={{ width: 0 }}
                animate={{ width: `${(item.count / totalHits) * 100}%` }}
                transition={{ delay: 1.0, duration: 0.8, ease: 'easeOut' }}
              >
                <span className={item.label === 'Good' ? 'text-black' : 'text-white'}>
                  {item.count}
                </span>
              </motion.div>
            ) : null
          )}
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

      {/* Stats Grid - cascading */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 gap-3"
      >
        {[
          { icon: Target, color: 'text-blue-600 dark:text-blue-400', value: `${stats.accuracy.toFixed(1)}%`, label: 'Accuracy' },
          { icon: Flame, color: 'text-orange-600 dark:text-orange-400', value: `${stats.maxCombo}x`, label: 'Best Combo' },
          { icon: Zap, color: 'text-yellow-600 dark:text-yellow-400', value: String(stats.maxStreak), label: 'Perfect Streak' },
          { icon: Trophy, color: 'text-green-600 dark:text-green-400', value: `${stats.avgOffsetMs > 0 ? '+' : ''}${stats.avgOffsetMs.toFixed(1)}ms`, label: 'Avg Timing' },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            variants={staggerItem}
            className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border"
          >
            <stat.icon className={cn('w-5 h-5 flex-shrink-0', stat.color)} />
            <div>
              <p className="text-sm font-bold text-foreground font-mono">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Extra info */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="flex gap-2 flex-wrap"
      >
        {stats.extraHits > 0 && (
          <span className="text-xs px-2 py-1 rounded-full bg-secondary text-muted-foreground border border-border">
            {stats.extraHits} extra hit{stats.extraHits > 1 ? 's' : ''}
          </span>
        )}
        <span className="text-xs px-2 py-1 rounded-full bg-secondary text-muted-foreground border border-border">
          {stats.durationSeconds.toFixed(0)}s duration
        </span>
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.6 }}
        className="flex gap-3"
      >
        <Button
          variant="outline"
          className="flex-1 border-border text-foreground dark:text-slate-300 hover:bg-secondary"
          onClick={onRetry}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Retry
        </Button>
        <Button
          className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border-0"
          onClick={onNext}
        >
          Next Exercise
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </motion.div>
    </div>
  )
}
