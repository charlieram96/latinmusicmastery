'use client'

import { motion } from 'framer-motion'
import { CheckCircle2, ChevronDown, MinusCircle, RotateCcw, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'
import { correctAnswerLabel } from '@/lib/quiz/grading'
import type { QuizQuestion } from '@/types/modules'
import { Confetti } from './confetti'
import { ScoreRing } from './score-ring'

export function ResultsScreen({
  kind,
  questions,
  graded,
  onRestart,
}: {
  kind: string
  questions: QuizQuestion[]
  graded: Record<string, number>
  onRestart: () => void
}) {
  const { t } = useTranslation()
  const totalScore = questions.reduce((sum, q) => sum + (graded[q.id] ?? 0), 0)
  // Show fractional totals (e.g. "7.5") only when partial credit was earned.
  const scoreLabel = Number.isInteger(totalScore) ? String(totalScore) : totalScore.toFixed(1)
  const pct = questions.length ? Math.round((totalScore / questions.length) * 100) : 0
  const [open, setOpen] = useState<string | null>(null)

  const headline =
    pct >= 90
      ? t('dashboard.classViewer.quiz.results.perfect')
      : pct >= 70
        ? t('dashboard.classViewer.quiz.results.greatWork')
        : pct >= 50
          ? t('dashboard.classViewer.quiz.results.niceEffort')
          : t('dashboard.classViewer.quiz.results.keepPracticing')
  const sub =
    pct >= 90
      ? t('dashboard.classViewer.quiz.results.nailedIt', { kind: kind.toLowerCase() })
      : pct >= 70
        ? t('dashboard.classViewer.quiz.results.gettingHang')
        : t('dashboard.classViewer.quiz.results.reviewAndRetry')

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-10">
      {pct >= 80 && <Confetti />}

      <div className="relative flex flex-col items-center text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 18 }}
        >
          <ScoreRing pct={pct} />
        </motion.div>
        <h2 className="mt-6 text-3xl font-black">{headline}</h2>
        <p className="mt-1 text-muted-foreground">{sub}</p>
        <p className="mt-4 text-sm font-semibold">
          <span className="text-primary">{scoreLabel}</span>
          <span className="text-muted-foreground"> / {questions.length} {t('dashboard.classViewer.quiz.results.correct')}</span>
        </p>
      </div>

      <div className="relative mt-8 space-y-2">
        {questions.map((q, i) => {
          const score = graded[q.id] ?? 0
          const isOpen = open === q.id
          const label = correctAnswerLabel(q)
          return (
            <div key={q.id} className="overflow-hidden rounded-2xl border border-border">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : q.id)}
                className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/50"
              >
                {score >= 1 ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                ) : score > 0 ? (
                  <MinusCircle className="h-5 w-5 shrink-0 text-amber-600" />
                ) : (
                  <XCircle className="h-5 w-5 shrink-0 text-red-600" />
                )}
                <span className="flex-1 text-sm font-medium">
                  {i + 1}. {q.question}
                </span>
                <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
              </button>
              {isOpen && (
                <div className="border-t border-border bg-muted/30 p-4 text-sm">
                  {label && (
                    <p>
                      <span className="font-semibold text-muted-foreground">{t('dashboard.classViewer.quiz.results.correctAnswer')} </span>
                      {label}
                    </p>
                  )}
                  {q.explanation && <p className="mt-1 text-muted-foreground">{q.explanation}</p>}
                  {!label && !q.explanation && <p className="text-muted-foreground">{t('dashboard.classViewer.quiz.results.noDetails')}</p>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <Button onClick={onRestart} size="lg" className="relative mt-8 w-full rounded-xl">
        <RotateCcw className="mr-2 h-4 w-4" /> {t('dashboard.pages.tuner.tryAgain')}
      </Button>
    </div>
  )
}
