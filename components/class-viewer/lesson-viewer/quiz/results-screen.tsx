'use client'

import { motion } from 'framer-motion'
import { CheckCircle2, ChevronDown, RotateCcw, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
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
  graded: Record<string, boolean>
  onRestart: () => void
}) {
  const correctCount = questions.filter((q) => graded[q.id]).length
  const pct = questions.length ? Math.round((correctCount / questions.length) * 100) : 0
  const [open, setOpen] = useState<string | null>(null)

  const headline = pct >= 90 ? 'Perfect!' : pct >= 70 ? 'Great work!' : pct >= 50 ? 'Nice effort!' : 'Keep practicing'
  const sub =
    pct >= 90
      ? `You nailed this ${kind.toLowerCase()}.`
      : pct >= 70
        ? "You're getting the hang of it."
        : 'Review the answers below and try again.'

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
          <span className="text-primary">{correctCount}</span>
          <span className="text-muted-foreground"> / {questions.length} correct</span>
        </p>
      </div>

      <div className="relative mt-8 space-y-2">
        {questions.map((q, i) => {
          const isCorrect = !!graded[q.id]
          const isOpen = open === q.id
          const label = correctAnswerLabel(q)
          return (
            <div key={q.id} className="overflow-hidden rounded-2xl border border-border">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : q.id)}
                className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/50"
              >
                {isCorrect ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
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
                      <span className="font-semibold text-muted-foreground">Correct answer: </span>
                      {label}
                    </p>
                  )}
                  {q.explanation && <p className="mt-1 text-muted-foreground">{q.explanation}</p>}
                  {!label && !q.explanation && <p className="text-muted-foreground">No additional details.</p>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <Button onClick={onRestart} size="lg" className="relative mt-8 w-full rounded-xl">
        <RotateCcw className="mr-2 h-4 w-4" /> Try Again
      </Button>
    </div>
  )
}
