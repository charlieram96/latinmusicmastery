'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Clock,
  Flame,
  Music,
  RotateCcw,
  Target,
  Trophy,
  Zap,
  ChevronRight,
} from 'lucide-react'
import type { AttemptStats } from '@/lib/play-sense/types'
import { GRADE_COLORS } from '@/lib/play-sense/types'
import { getLetterGrade } from '@/lib/play-sense/exercise-utils'
import { getStarCount } from '@/lib/play-sense/animations'
import { AccuracyRing, formatDuration } from './stage-ui'

interface StageResultsProps {
  stats: AttemptStats
  exerciseTitle: string
  onRetry: () => void
  onNext: () => void
}

// Score → warm-aware band color for the hero ring + grade.
function scoreColor(score: number): string {
  if (score >= 90) return '#57B36B' // green — mastery
  if (score >= 70) return '#F2A12C' // amber
  if (score >= 50) return '#E8771C' // orange
  return '#CB3145' // deep red
}

function AnimatedScore({ target }: { target: number }) {
  const [current, setCurrent] = useState(0)
  useEffect(() => {
    const duration = 1200
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setCurrent(eased * target)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return <>{current.toFixed(1)}%</>
}

export function StageResults({ stats, exerciseTitle, onRetry, onNext }: StageResultsProps) {
  const letter = getLetterGrade(stats.score)
  const stars = getStarCount(stats.score)
  const band = scoreColor(stats.score)
  const total = stats.perfectCount + stats.goodCount + stats.okCount + stats.missCount || 1

  const distribution = [
    { count: stats.perfectCount, color: GRADE_COLORS.perfect, label: 'Perfect' },
    { count: stats.goodCount, color: GRADE_COLORS.good, label: 'Good' },
    { count: stats.okCount, color: GRADE_COLORS.ok, label: 'Ok' },
    { count: stats.missCount, color: GRADE_COLORS.miss, label: 'Miss' },
  ]

  const tiles = [
    { icon: Target, accent: 'var(--amber-hi)', value: `${stats.accuracy.toFixed(1)}%`, label: 'Accuracy' },
    ...(stats.pitchAccuracy != null
      ? [{ icon: Music, accent: '#C8884A', value: `${stats.pitchAccuracy.toFixed(1)}%`, label: 'Pitch' }]
      : []),
    { icon: Flame, accent: 'var(--terra)', value: `${stats.maxCombo}×`, label: 'Best combo' },
    { icon: Zap, accent: 'var(--gold)', value: String(stats.maxStreak), label: 'Perfect streak' },
    { icon: Trophy, accent: 'var(--green)', value: `${stats.avgOffsetMs > 0 ? '+' : ''}${stats.avgOffsetMs.toFixed(0)}ms`, label: 'Avg timing' },
    { icon: Clock, accent: 'var(--amber)', value: `${stats.tempoDriftMs > 0 ? '+' : ''}${stats.tempoDriftMs.toFixed(0)}ms`, label: 'Tempo drift' },
  ]

  return (
    <motion.div
      className="glass sv-results"
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {/* hero */}
      <div className="sv-results-hero">
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 120, damping: 14 }}
          style={{ filter: `drop-shadow(0 0 26px ${band}55)` }}
        >
          <AccuracyRing pct={stats.score} size={176} sw={8} color={band}>
            <span
              style={{ fontFamily: 'var(--head)', fontWeight: 800, fontSize: 64, color: band, lineHeight: 1 }}
            >
              {letter}
            </span>
          </AccuracyRing>
        </motion.div>

        <div className="sv-results-score">
          <AnimatedScore target={stats.score} />
        </div>
        <h2 className="sv-results-title">{exerciseTitle}</h2>
        <p className="sv-eyebrow" style={{ textAlign: 'center' }}>Performance review</p>

        {/* stars */}
        <div className="sv-results-stars">
          {Array.from({ length: 5 }).map((_, i) => (
            <motion.svg
              key={i}
              width={26}
              height={26}
              viewBox="0 0 24 24"
              initial={{ opacity: 0, scale: 0, rotate: -30 }}
              animate={{ opacity: i < stars ? 1 : 0.22, scale: i < stars ? 1 : 0.85, rotate: 0 }}
              transition={{ delay: 0.5 + i * 0.08, type: 'spring', stiffness: 380, damping: 16 }}
              style={i < stars ? { filter: 'drop-shadow(0 0 8px rgba(226,178,58,0.6))' } : {}}
            >
              <path
                d="M12 2l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.8 5.9 20.3l1.2-6.6L2.3 9l6.6-.9z"
                fill={i < stars ? 'var(--gold)' : 'transparent'}
                stroke={i < stars ? 'var(--gold)' : 'var(--faint)'}
                strokeWidth={1.4}
                strokeLinejoin="round"
              />
            </motion.svg>
          ))}
        </div>
      </div>

      {/* distribution bar */}
      <div className="sv-results-bar">
        <div className="track">
          {distribution.map((d) =>
            d.count > 0 ? (
              <motion.div
                key={d.label}
                className="seg"
                style={{ background: d.color }}
                initial={{ width: 0 }}
                animate={{ width: `${(d.count / total) * 100}%` }}
                transition={{ delay: 0.4, duration: 0.7, ease: 'easeOut' }}
              >
                <span style={{ color: d.label === 'Good' ? '#1a1410' : '#fff' }}>{d.count}</span>
              </motion.div>
            ) : null,
          )}
        </div>
        <div className="legend">
          {distribution.map((d) => (
            <span key={d.label}>
              <span className="sw" style={{ background: d.color }} />
              {d.label}
            </span>
          ))}
        </div>
      </div>

      {/* session stats */}
      <div className="sv-results-stats">
        {tiles.map((t) => (
          <div key={t.label} className="sv-stat">
            <t.icon size={15} style={{ color: t.accent }} />
            <div className="v">{t.value}</div>
            <div className="k">{t.label}</div>
          </div>
        ))}
      </div>

      {/* meta + actions */}
      <div className="sv-results-meta">
        {stats.extraHits > 0 && <span className="chip">{stats.extraHits} extra hit{stats.extraHits > 1 ? 's' : ''}</span>}
        <span className="chip">{formatDuration(stats.durationSeconds)}</span>
      </div>

      <div className="sv-results-actions">
        <button className="sv-btn ghost" onClick={onRetry}>
          <RotateCcw size={16} /> Play again
        </button>
        <button className="sv-btn primary" onClick={onNext}>
          Next track <ChevronRight size={16} />
        </button>
      </div>
    </motion.div>
  )
}
