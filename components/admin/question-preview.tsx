'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { FeedbackBanner } from '@/components/class-viewer/lesson-viewer/quiz/feedback-banner'
import { QuestionInput } from '@/components/class-viewer/lesson-viewer/quiz/question-input'
import { TypeChip } from '@/components/class-viewer/lesson-viewer/quiz/type-chip'
import quizStyles from '@/components/class-viewer/lesson-viewer/quiz/quiz.module.css'
import { QUIZ_FIELDS, localizeRow } from '@/lib/i18n/localize'
import { cn } from '@/lib/utils'
import { seedAnswers } from '@/lib/quiz/engine'
import { gradeQuestionScore, hasAnswer } from '@/lib/quiz/grading'
import { fullCorrectLabel } from '@/lib/quiz/labels'
import type { QuizQuestion } from '@/types/modules'

/**
 * Renders the real student component for one question beside the form.
 * ES applies the same overlay the lesson page applies (localizeRow on a clone),
 * so admins see exactly what the Spanish overlay produces.
 */
export function QuestionPreview({ question }: { question: QuizQuestion }) {
  const [lang, setLang] = useState<'en' | 'es'>('en')
  const shown = useMemo(() => {
    if (lang === 'en') return question
    const clone = JSON.parse(JSON.stringify(question)) as Record<string, unknown>
    localizeRow(clone, 'es', QUIZ_FIELDS)
    return clone as unknown as QuizQuestion
  }, [question, lang])
  const [answer, setAnswer] = useState<unknown>(() => seedAnswers([question])[question.id])
  const [graded, setGraded] = useState(false)
  const reset = () => {
    setAnswer(seedAnswers([question])[question.id])
    setGraded(false)
  }
  return (
    <div className={cn(quizStyles.root, 'grid gap-3 rounded-xl border border-dashed border-foreground/25 bg-sunken p-3.5')}>
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
        <span>Student preview</span>
        <span className="inline-flex gap-0.5 rounded-md border border-border p-0.5">
          {(['en', 'es'] as const).map((l) => (
            <button key={l} type="button" aria-pressed={lang === l} onClick={() => { setLang(l); reset() }} className={cn('rounded px-2 py-0.5 text-[10.5px] font-bold uppercase', lang === l ? 'bg-raised text-foreground' : 'text-muted-foreground')}>
              {l}
            </button>
          ))}
        </span>
      </div>
      <div className="grid gap-3.5 rounded-[14px] border border-border bg-card p-4">
        <div className="flex items-center gap-2"><TypeChip type={shown.question_type} /></div>
        <h4 className="font-heading text-[17px] font-extrabold leading-snug tracking-[-0.01em]">{shown.question}</h4>
        <QuestionInput question={shown} answer={answer} isGraded={graded} onChange={setAnswer} />
        {graded && <FeedbackBanner score={gradeQuestionScore(shown, answer)} explanation={shown.explanation} correctAnswer={fullCorrectLabel(shown) || null} />}
        <div className="flex justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={reset}>Reset</Button>
          <Button type="button" size="sm" disabled={graded || !hasAnswer(shown, answer)} onClick={() => setGraded(true)}>Check answer</Button>
        </div>
      </div>
    </div>
  )
}
