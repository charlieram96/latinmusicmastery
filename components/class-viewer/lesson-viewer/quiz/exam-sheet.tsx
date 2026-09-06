'use client'

import { ArrowRight, Check, Minus, RotateCcw, Volume2, VolumeX, X } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/components/language-provider'
import { useQuizPrefs } from '@/hooks/use-quiz-prefs'
import type { QuizEngine } from '@/hooks/use-quiz-engine'
import { cn } from '@/lib/utils'
import { outcomeOf, percentScore } from '@/lib/quiz/engine'
import { hasAnswer } from '@/lib/quiz/grading'
import { playCue } from '@/lib/quiz/sounds'
import type { QuizQuestion } from '@/types/modules'
import { FeedbackBanner } from './feedback-banner'
import { QuestionInput } from './question-input'
import { ScoreRing } from './score-ring'
import { TypeChip } from './type-chip'
import { useAnswerLabels } from './use-answer-labels'
import styles from './quiz.module.css'

const SPANS = new Set(['matching_pairs', 'ordering_sequence', 'fill_in_blank', 'audio_choice', 'piece_placement'])
type Filter = 'all' | 'missed'

/** Every question on one sheet; graded on submit; cards turn into their reviewed state in place. */
export function ExamSheet({
  questions,
  engine,
  kindLabel,
  title,
  nextHref = null,
  onSubmit,
  onRestart,
}: {
  questions: QuizQuestion[]
  engine: QuizEngine
  kindLabel: string
  title?: string
  nextHref?: string | null
  onSubmit: () => void
  onRestart: () => void
}) {
  const { t } = useTranslation()
  const { bannerCorrect } = useAnswerLabels()
  const [prefs, setPrefs] = useQuizPrefs()
  const [submitted, setSubmitted] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const { state } = engine
  const answered = questions.filter((q) => hasAnswer(q, state.answers[q.id])).length
  const pct = percentScore(questions, state.graded)
  const missed = questions.filter((q) => (state.graded[q.id] ?? 0) < 1).length

  const submit = () => {
    const mean = engine.checkMany(questions.map((q) => q.id))
    setSubmitted(true)
    playCue(mean >= 0.7 ? 'fanfare' : 'soft', prefs.sound)
    onSubmit()
  }
  const restart = () => {
    setSubmitted(false)
    setFilter('all')
    onRestart()
  }
  const jump = (id: string) => document.getElementById(`sq-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  const statusLabel = (q: QuizQuestion) => {
    if (!submitted) return t(hasAnswer(q, state.answers[q.id]) ? 'dashboard.classViewer.quiz.sheet.answered' : 'dashboard.classViewer.quiz.sheet.unansweredLabel')
    const tone = outcomeOf(state.graded[q.id] ?? 0)
    return t(tone === 'ok' ? 'dashboard.classViewer.quiz.sheet.correct' : tone === 'part' ? 'dashboard.classViewer.quiz.sheet.partly' : 'dashboard.classViewer.quiz.sheet.missed')
  }
  const shown = questions.filter((q) => filter === 'all' || (state.graded[q.id] ?? 0) < 1)

  const jumpGrid = (
    <div className="mt-3.5 grid grid-cols-[repeat(auto-fill,minmax(34px,1fr))] gap-1.5">
      {questions.map((q, i) => {
        const g = state.graded[q.id]
        const tone = submitted ? outcomeOf(g ?? 0) : hasAnswer(q, state.answers[q.id]) ? 'done' : 'todo'
        return (
          <button
            key={q.id}
            type="button"
            onClick={() => jump(q.id)}
            className={cn(
              'grid h-[34px] place-items-center rounded-[9px] border-[1.5px] font-heading text-xs font-extrabold transition-colors',
              tone === 'todo' && 'border-border text-muted-foreground',
              tone === 'done' && 'border-primary text-foreground',
              tone === 'ok' && 'border-success bg-success/12 text-success',
              tone === 'part' && 'border-primary bg-primary/12 text-primary',
              tone === 'bad' && 'border-terracotta bg-terracotta/12 text-terracotta',
            )}
          >
            {i + 1}
          </button>
        )
      })}
    </div>
  )

  return (
    <div className={styles.sheet}>
      <div>
        <div className="mb-4 grid gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="font-heading text-[11px] font-bold uppercase tracking-[0.14em] text-gold">{kindLabel}</span>
            <button
              type="button"
              aria-pressed={prefs.sound}
              aria-label={t(prefs.sound ? 'dashboard.classViewer.quiz.sound.on' : 'dashboard.classViewer.quiz.sound.off')}
              onClick={() => setPrefs({ sound: !prefs.sound })}
              className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-raised text-muted-foreground transition-colors hover:text-foreground"
            >
              {prefs.sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
          </div>
          {title && <h3 className="font-heading text-[22px] font-extrabold tracking-[-0.015em]">{title}</h3>}
          <p className="text-[13.5px] text-muted-foreground">
            {submitted ? t('dashboard.classViewer.quiz.sheet.scored', { pct }) : t('dashboard.classViewer.quiz.sheet.intro', { count: questions.length })}
          </p>
        </div>
        {submitted && (
          <div className="mb-3.5 flex gap-2">
            <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')} className={cn('rounded-full border px-2.5 py-1.5 text-xs', filter === 'all' ? 'border-foreground text-foreground' : 'border-foreground/20 text-muted-foreground')}>{t('dashboard.classViewer.quiz.review.all')}</button>
            <button type="button" aria-pressed={filter === 'missed'} onClick={() => setFilter('missed')} className={cn('rounded-full border px-2.5 py-1.5 text-xs', filter === 'missed' ? 'border-foreground text-foreground' : 'border-foreground/20 text-muted-foreground')}>{t('dashboard.classViewer.quiz.review.missed', { count: missed })}</button>
          </div>
        )}
        <div className={styles.sheetGrid}>
          {shown.map((q) => {
            const i = questions.indexOf(q)
            const g = state.graded[q.id]
            const tone = submitted ? outcomeOf(g ?? 0) : null
            const Icon = tone === 'ok' ? Check : tone === 'part' ? Minus : X
            return (
              <section
                key={q.id}
                id={`sq-${q.id}`}
                className={cn(
                  'grid gap-3.5 rounded-2xl border bg-card p-[18px] transition-colors',
                  SPANS.has(q.question_type) && styles.span,
                  tone === null && 'border-border',
                  tone === 'ok' && 'border-success/45',
                  tone === 'part' && 'border-primary/45',
                  tone === 'bad' && 'border-terracotta/45',
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      'grid h-[26px] w-[26px] place-items-center rounded-lg font-heading text-xs font-extrabold tabular-nums',
                      tone === null && 'bg-foreground/7 text-muted-foreground',
                      tone === 'ok' && 'bg-success text-white',
                      tone === 'part' && 'bg-primary text-white',
                      tone === 'bad' && 'bg-terracotta text-white',
                    )}
                  >
                    {tone === null ? i + 1 : <Icon className="h-3.5 w-3.5" />}
                  </span>
                  <TypeChip type={q.question_type} />
                  <span className={cn('ml-auto text-[11.5px] font-bold uppercase tracking-[0.04em]', tone === null && 'text-muted-foreground', tone === 'ok' && 'text-success', tone === 'part' && 'text-primary', tone === 'bad' && 'text-terracotta')}>
                    {statusLabel(q)}
                  </span>
                </div>
                <h4 className="font-heading text-[17px] font-extrabold leading-snug tracking-[-0.01em]">{q.question}</h4>
                <QuestionInput question={q} answer={state.answers[q.id]} isGraded={submitted} onChange={(v) => engine.setAnswer(q.id, v)} />
                {submitted && <FeedbackBanner score={g ?? 0} explanation={q.explanation} correctAnswer={bannerCorrect(q)} />}
              </section>
            )
          })}
        </div>
        {!submitted && (
          <div className={cn(styles.sheetBar, 'mt-3.5 items-center justify-between gap-3 rounded-[14px] border border-border bg-sunken px-3.5 py-3')}>
            <span className="text-[13px] tabular-nums text-muted-foreground">{t('dashboard.classViewer.quiz.sheet.answeredOf', { answered, total: questions.length })}</span>
            <Button onClick={submit} className="rounded-xl">{t('dashboard.classViewer.quiz.sheet.submitAll')}</Button>
          </div>
        )}
      </div>

      <aside className={styles.sheetRail}>
        <div className="rounded-2xl border border-border bg-card p-[18px]">
          {!submitted ? (
            <>
              <div className="flex items-center gap-3.5">
                <ScoreRing pct={(answered / Math.max(1, questions.length)) * 100} size={64} stroke={7} />
                <div>
                  <span className="block font-heading text-[22px] font-extrabold tabular-nums tracking-[-0.02em]">{answered} / {questions.length}</span>
                  <small className="text-xs text-muted-foreground">{t('dashboard.classViewer.quiz.sheet.answered').toLowerCase()}</small>
                </div>
              </div>
              {jumpGrid}
              <Button onClick={submit} className="mt-3.5 w-full rounded-xl">{t('dashboard.classViewer.quiz.sheet.submitAll')}</Button>
              {answered < questions.length && <p className="mt-2 text-center text-xs text-muted-foreground">{t('dashboard.classViewer.quiz.sheet.unanswered', { count: questions.length - answered })}</p>}
            </>
          ) : (
            <>
              <div className="flex items-center gap-3.5">
                <ScoreRing pct={pct} size={72} stroke={8} />
                <div>
                  <span className="block font-heading text-[22px] font-extrabold tabular-nums tracking-[-0.02em]">{pct}%</span>
                  <small className="text-xs text-muted-foreground">{t('dashboard.classViewer.quiz.results.score')}</small>
                </div>
              </div>
              {jumpGrid}
              <div className="mt-3.5 grid gap-2.5">
                {nextHref && (
                  <Button asChild className="w-full rounded-xl">
                    <Link href={nextHref}>{t('dashboard.classViewer.quiz.results.continueNext')} <ArrowRight className="h-4 w-4" /></Link>
                  </Button>
                )}
                <Button variant="outline" className="w-full rounded-xl" onClick={restart}>
                  <RotateCcw className="h-4 w-4" /> {t('dashboard.classViewer.quiz.results.tryAgain')}
                </Button>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
