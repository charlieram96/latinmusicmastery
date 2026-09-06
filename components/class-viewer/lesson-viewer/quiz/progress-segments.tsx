'use client'

import { cn } from '@/lib/utils'
import type { QuizQuestion } from '@/types/modules'

/** One segment per question. Filled segments keep their outcome color so the bar doubles as a scorecard. */
export function ProgressSegments({
  questions,
  graded,
  current,
}: {
  questions: QuizQuestion[]
  graded: Record<string, number>
  current: number
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-1 gap-1.5">
        {questions.map((q, i) => {
          const score = graded[q.id]
          const fill =
            score == null ? (i === current ? 'bg-primary/40' : '') : score >= 1 ? 'bg-success' : score > 0 ? 'bg-primary' : 'bg-terracotta'
          return (
            <div key={q.id} className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/10">
              <div
                className={cn('h-full origin-left rounded-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]', fill)}
                style={{ transform: fill ? 'scaleX(1)' : 'scaleX(0)' }}
              />
            </div>
          )
        })}
      </div>
      <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
        {Math.min(current + 1, questions.length)} / {questions.length}
      </span>
    </div>
  )
}
