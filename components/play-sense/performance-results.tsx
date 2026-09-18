'use client'

import { useEffect, useId, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import Image from 'next/image'
import { ArrowRight, Check, ChevronDown, Clock3, Eye, Flame, RotateCcw, Sparkles, Star, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/components/language-provider'
import type { AttemptStats } from '@/lib/play-sense/types'
import { getLetterGrade } from '@/lib/play-sense/exercise-utils'
import { getStarCount } from '@/lib/play-sense/animations'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import './performance.css'

export interface PerformanceResultsProps {
  stats: AttemptStats
  exerciseTitle: string
  onRetry: () => void
  onNext?: () => void
  nextLabel?: string
  onWatchDemo?: () => void
  demo?: boolean
}

function AnimatedScore({ score }: { score: number }) {
  const reduced = useReducedMotion()
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (reduced) return
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const progress = Math.max(0, Math.min(1, (now - start) / 850))
      setValue(score * (1 - Math.pow(1 - progress, 3)))
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [score, reduced])
  return <>{(reduced ? score : value).toFixed(1)}</>
}

function nextPractice(stats: AttemptStats, total: number) {
  if (!total) return 'Start another take when you’re ready. Follow the notes to the light line.'
  if (stats.missCount / total > .25) return 'Try the phrase a little slower. Keep the pulse steady as each note reaches the line.'
  if (stats.pitchAccuracy != null && stats.pitchAccuracy < 80) return 'Isolate a short phrase and check the notes before bringing the tempo back up.'
  if (stats.extraHits > total * .08) return 'Leave space between the notes. Aim for one clean attack for each note you see.'
  if (Math.abs(stats.avgOffsetMs) >= 25) return stats.avgOffsetMs > 0
    ? 'Your attacks tended to arrive late. Listen for the pulse and prepare the next movement a little earlier.'
    : 'Your attacks tended to arrive early. Let the pulse come to you before you play.'
  if (stats.score >= 90) return 'Keep this feel. Try another take and aim for the same control from the first note to the last.'
  return 'Repeat a short phrase and listen for an even pulse. Let consistency lead the next take.'
}

export function PerformanceResults({ stats, exerciseTitle, onRetry, onNext, nextLabel = 'Next track', onWatchDemo, demo = false }: PerformanceResultsProps) {
  const { t } = useTranslation()
  const reduced = useReducedMotion()
  const titleId = useId()
  const score = Math.max(0, Math.min(100, stats.score))
  const total = stats.perfectCount + stats.goodCount + stats.okCount + stats.missCount
  const hits = total - stats.missCount
  const stars = total ? getStarCount(score) : 0
  const title = !total ? 'Your next take awaits.' : score >= 95 ? 'That was a beautiful take.' : score >= 80 ? 'You found the groove.' : score >= 60 ? 'The groove is taking shape.' : 'Every take is a step forward.'
  const distribution = [
    { label: 'Perfect', count: stats.perfectCount, color: 'hsl(var(--primary))' },
    { label: 'Good', count: stats.goodCount, color: 'hsl(var(--success))' },
    { label: 'Okay', count: stats.okCount, color: 'hsl(var(--gold-highlight))' },
    { label: 'Missed', count: stats.missCount, color: 'hsl(var(--terracotta))' },
  ]
  const duration = Math.max(0, Math.round(stats.durationSeconds))
  const durationLabel = `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`
  const timing = (value: number) => !hits ? '—' : `${Math.abs(Math.round(value))} ms${Math.round(value) === 0 ? ' · centered' : value > 0 ? ' late' : ' early'}`
  const retryPrimary = !onNext || score < 70 || !total
  return <motion.section className="ps-review" aria-labelledby={titleId}
    initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3 }}>
    <header className="ps-review-heading"><span className="ps-review-brand"><Image src="/logo-solo-color.svg" alt="Latin Music Mastery" width={30} height={24} /><span><strong>PlaySense</strong><small>Session complete</small></span></span><span><Clock3 size={14} />{durationLabel}</span></header>
    <div className="ps-review-hero">
      <div className="ps-score-medallion" aria-label={total ? `Score ${score.toFixed(1)} out of 100, grade ${getLetterGrade(score)}` : 'No notes graded'}>
        <svg viewBox="0 0 220 220" aria-hidden="true">
          <circle cx="110" cy="110" r="99" fill="hsl(var(--primary) / .04)" stroke="hsl(var(--primary) / .12)" />
          <circle cx="110" cy="110" r="86" fill="none" stroke="hsl(var(--secondary))" strokeWidth="7" />
          <motion.circle cx="110" cy="110" r="86" fill="none" stroke="hsl(var(--primary))" strokeWidth="7" strokeLinecap="round" pathLength="100"
            strokeDasharray="100" transform="rotate(-90 110 110)" initial={reduced ? false : { strokeDashoffset: 100 }} animate={{ strokeDashoffset: 100 - score }} transition={{ duration: .85, ease: 'easeOut' }} />
        </svg>
        <div className="ps-medallion-value" aria-hidden="true"><span>SCORE</span><strong>{total ? <AnimatedScore score={score} /> : '—'}</strong><small>OUT OF 100</small></div>
        <span className="ps-medallion-grade" aria-hidden="true">{total ? getLetterGrade(score) : '—'}</span>
      </div>
      <div className="ps-review-intro">
        {demo && <span className="ps-review-demo">Demo results · not saved</span>}
        <div className="ps-review-stars" aria-label={`${stars} of 5 stars`}>{Array.from({ length: 5 }, (_, i) => <Star key={i} size={17} aria-hidden="true" fill={i < stars ? 'currentColor' : 'none'} data-earned={i < stars} />)}</div>
        <h2 id={titleId}>{title}</h2><p>{exerciseTitle}</p>
        <span className="ps-review-hit-count"><Check size={13} />{hits} of {total} notes played</span>
      </div>
    </div>
    <div className="ps-review-metrics">
      <div><span><Target size={13} />Accuracy</span><strong>{total ? stats.accuracy.toFixed(1) : '—'}{total > 0 && <small>%</small>}</strong><p>Perfect + good notes</p></div>
      <div><span><Flame size={13} />Best combo</span><strong>{stats.maxCombo}<small>notes</small></strong><p>Played in a row</p></div>
      <div><span><Star size={13} />Perfect streak</span><strong>{stats.maxStreak}<small>notes</small></strong><p>Perfect, back to back</p></div>
    </div>
    <div className="ps-review-breakdown">
      <div className="ps-review-section-heading"><h3>Your notes</h3><span>{total} graded</span></div>
      <div className="ps-review-distribution" aria-hidden="true">{distribution.map(item => item.count > 0 && <span key={item.label} style={{ background: item.color, flex: item.count }} />)}</div>
      <dl className="ps-review-legend">{distribution.map(item => <div key={item.label}><dt><i style={{ background: item.color }} />{item.label}</dt><dd>{item.count}</dd></div>)}</dl>
    </div>
    <div className="ps-review-coach"><Sparkles size={17} /><div><h3>For your next take</h3><p>{nextPractice(stats, total)}</p></div></div>
    <details className="ps-review-details"><summary>Timing & session details <ChevronDown size={15} /></summary>
      <dl><div><dt>Average timing</dt><dd>{timing(stats.avgOffsetMs)}</dd></div><div><dt>Recent timing <small>Last 8 attacks</small></dt><dd>{timing(stats.tempoDriftMs)}</dd></div>
        {stats.pitchAccuracy != null && <div><dt>Pitch accuracy</dt><dd>{stats.pitchAccuracy.toFixed(1)}%</dd></div>}
        <div><dt>Extra hits</dt><dd>{stats.extraHits}</dd></div><div><dt>Duration</dt><dd>{durationLabel}</dd></div></dl>
    </details>
    <footer className="ps-review-actions">
      {onWatchDemo && <Button type="button" variant="ghost" size="sm" className="ps-review-watch" onClick={onWatchDemo}><Eye size={16} />{t('dashboard.classViewer.exercise.watchTeacherAgain')}</Button>}
      <div><Button type="button" variant={retryPrimary ? 'default' : 'outline'} onClick={onRetry}><RotateCcw size={16} />Play again</Button>
        {onNext && <Button type="button" variant={retryPrimary ? 'outline' : 'default'} onClick={onNext}>{nextLabel}<ArrowRight size={16} /></Button>}</div>
    </footer>
  </motion.section>
}

/** Shared focus-managed result overlay; lessons can also embed the review card directly. */
export function PerformanceResultsDialog({ open, onClose, ...props }: PerformanceResultsProps & { open: boolean; onClose: () => void }) {
  return <Dialog open={open} onOpenChange={value => { if (!value) onClose() }}><DialogContent className="ps-review-dialog" showCloseButton={false}>
    <DialogTitle className="sr-only">Session results</DialogTitle>
    <DialogDescription className="sr-only">Your score, note breakdown, and next practice steps for {props.exerciseTitle}.</DialogDescription>
    <PerformanceResults {...props} />
  </DialogContent></Dialog>
}
