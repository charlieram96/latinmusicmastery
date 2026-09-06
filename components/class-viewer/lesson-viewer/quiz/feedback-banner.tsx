'use client'

import { motion } from 'framer-motion'
import { Check, Minus, X } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'
import { outcomeOf } from '@/lib/quiz/engine'
import { Burst } from './burst'

/** Graded feedback for a score in [0, 1]. Announced to screen readers via role="status". */
export function FeedbackBanner({
  score,
  explanation,
  correctAnswer,
}: {
  score: number
  explanation?: string | null
  /** Shown on a miss so the student sees the right answer without hunting for it. */
  correctAnswer?: string | null
}) {
  const { t } = useTranslation()
  const tone = outcomeOf(score)
  const title =
    tone === 'ok'
      ? t('dashboard.classViewer.quiz.feedback.correct')
      : tone === 'part'
        ? t('dashboard.classViewer.quiz.feedback.partly', { pct: Math.round(score * 100) })
        : t('dashboard.classViewer.quiz.feedback.incorrect')
  const Icon = tone === 'ok' ? Check : tone === 'part' ? Minus : X
  return (
    <motion.div
      role="status"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'grid grid-cols-[auto_1fr] items-start gap-3 rounded-[14px] border p-4',
        tone === 'ok' && 'border-success/40 bg-success/10',
        tone === 'part' && 'border-primary/40 bg-primary/10',
        tone === 'bad' && 'border-terracotta/40 bg-terracotta/10',
      )}
    >
      <span
        className={cn(
          'relative grid h-7 w-7 place-items-center rounded-[9px] text-white',
          tone === 'ok' && 'bg-success',
          tone === 'part' && 'bg-primary',
          tone === 'bad' && 'bg-terracotta',
        )}
      >
        {tone === 'ok' && <Burst count={10} spread={40} />}
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="font-heading text-[13.5px] font-extrabold">{title}</p>
        {tone === 'bad' && correctAnswer && (
          <p className="mt-0.5 text-[13.5px] text-muted-foreground">
            {t('dashboard.classViewer.quiz.feedback.correctAnswer')} <span className="font-semibold text-foreground">{correctAnswer}</span>
          </p>
        )}
        {explanation && <p className="mt-0.5 text-[13.5px] leading-relaxed text-muted-foreground">{explanation}</p>}
      </div>
    </motion.div>
  )
}
