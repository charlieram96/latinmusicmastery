'use client'

import { Check, Minus, X } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'
import { outcomeOf } from '@/lib/quiz/engine'
import type { QuizQuestion } from '@/types/modules'
import { typeIcon } from './type-chip'

/** Sticky rail listing every question with its outcome; click to jump. Hidden below 1000px by the CSS module. */
export function QuestionMap({
  questions,
  graded,
  current,
  onJump,
}: {
  questions: QuizQuestion[]
  graded: Record<string, number>
  current: number
  onJump: (index: number) => void
}) {
  const { t } = useTranslation()
  const checked = questions.filter((q) => q.id in graded).length
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <span className="font-heading text-[11.5px] font-bold uppercase tracking-[0.14em] text-gold">{t('dashboard.classViewer.quiz.map.title')}</span>
      <ol className="mt-2.5 grid gap-1">
        {questions.map((q, i) => {
          const score = graded[q.id]
          const tone = score == null ? null : outcomeOf(score)
          const Icon = typeIcon(q.question_type)
          return (
            <li key={q.id}>
              <button
                type="button"
                aria-current={i === current}
                onClick={() => onJump(i)}
                className={cn(
                  'grid w-full grid-cols-[24px_1fr_auto] items-center gap-2.5 rounded-[10px] px-2 py-2 text-left text-[12.5px] text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground',
                  i === current && 'bg-primary/10 text-foreground',
                )}
              >
                <span
                  className={cn(
                    'grid h-6 w-6 place-items-center rounded-[7px] border-[1.5px] font-heading text-[11px] font-extrabold',
                    tone === null && (i === current ? 'border-primary text-primary' : 'border-foreground/25 text-muted-foreground'),
                    tone === 'ok' && 'border-success bg-success text-white',
                    tone === 'part' && 'border-primary bg-primary text-white',
                    tone === 'bad' && 'border-terracotta bg-terracotta text-white',
                  )}
                >
                  {tone === null ? i + 1 : tone === 'ok' ? <Check className="h-3 w-3" /> : tone === 'part' ? <Minus className="h-3 w-3" /> : <X className="h-3 w-3" />}
                </span>
                <span className="truncate">{q.question}</span>
                <Icon className="h-[13px] w-[13px] opacity-80" />
              </button>
            </li>
          )
        })}
      </ol>
      <div className="mt-3.5 flex justify-between border-t border-border pt-3 text-xs text-muted-foreground">
        <span>{t('dashboard.classViewer.quiz.map.checked')}</span>
        <b className="tabular-nums text-foreground">{checked} / {questions.length}</b>
      </div>
    </div>
  )
}
