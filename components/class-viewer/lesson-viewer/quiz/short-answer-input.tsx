'use client'

import { Check, X } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'
import { gradeQuestion } from '@/lib/quiz/grading'
import { AudioPrompt } from './audio-prompt'
import { Burst } from './burst'
import type { QuestionInputProps } from './input-props'

/** text_answer, and audio ("listen and type") which adds the prompt player. */
export function ShortAnswerInput({ question: q, answer, isGraded, onChange }: QuestionInputProps) {
  const { t } = useTranslation()
  const listen = q.question_type === 'audio'
  const ok = isGraded ? gradeQuestion(q, answer) : null
  return (
    <div className="grid gap-3">
      {listen && q.audio_url && <AudioPrompt src={q.audio_url} />}
      <label
        className={cn(
          'relative flex h-12 items-center gap-2.5 rounded-xl border-[1.5px] bg-raised px-3.5 transition-[border-color,box-shadow] focus-within:border-primary focus-within:shadow-[0_0_0_3px_hsl(var(--primary)/0.18)]',
          ok === null && 'border-foreground/20',
          ok === true && 'border-success',
          ok === false && 'border-terracotta',
        )}
      >
        <input
          value={(answer as string) ?? ''}
          disabled={isGraded}
          onChange={(e) => onChange(e.target.value)}
          placeholder={listen ? t('dashboard.classViewer.quiz.typeWhatYouHear') : t('dashboard.classViewer.quiz.typeYourAnswer')}
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
        />
        {ok === true && <Burst count={10} spread={40} />}
        {ok !== null && (
          <span className={cn('grid h-6 w-6 place-items-center rounded-[7px] text-white', ok ? 'bg-success' : 'bg-terracotta')}>
            {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
          </span>
        )}
        {!isGraded && <kbd className="grid h-5 min-w-5 place-items-center rounded-[5px] border border-b-2 border-foreground/20 px-1.5 text-[10.5px] font-semibold text-muted-foreground">↵</kbd>}
      </label>
      {ok === false && q.correct_answer && (
        <p className="text-[12.5px] text-muted-foreground">
          {t('dashboard.classViewer.quiz.feedback.acceptedAnswers')} <span className="font-semibold text-success">{q.correct_answer}</span>
        </p>
      )}
    </div>
  )
}
