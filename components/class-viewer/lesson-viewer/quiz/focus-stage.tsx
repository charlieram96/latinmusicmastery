'use client'

import { ArrowLeft, ArrowRight, Check, Volume2, VolumeX } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/components/language-provider'
import { useQuizPrefs } from '@/hooks/use-quiz-prefs'
import type { QuizEngine } from '@/hooks/use-quiz-engine'
import { cn } from '@/lib/utils'
import { cueFor, outcomeOf } from '@/lib/quiz/engine'
import { correctAnswerLabel, hasAnswer } from '@/lib/quiz/grading'
import { playCue } from '@/lib/quiz/sounds'
import type { QuizQuestion } from '@/types/modules'
import { FeedbackBanner } from './feedback-banner'
import { ProgressSegments } from './progress-segments'
import { QuestionInput } from './question-input'
import { QuestionMap } from './question-map'
import { StreakChip } from './streak-chip'
import { TypeChip } from './type-chip'
import styles from './quiz.module.css'

const KEY_CHOICE = /^[1-9]$/
const KEY_LETTER = /^[a-h]$/i

/** One question at a time: rise transition, immediate feedback, Check → Continue, streak, sound, question map on wide screens. */
export function FocusStage({
  questions,
  engine,
  kindLabel,
  title,
  onFinish,
}: {
  questions: QuizQuestion[]
  engine: QuizEngine
  kindLabel: string
  title?: string
  onFinish: () => void
}) {
  const { t } = useTranslation()
  const [prefs, setPrefs] = useQuizPrefs()
  const [index, setIndex] = useState(0)
  const [pop, setPop] = useState(false)
  const { state } = engine
  const q = questions[index]
  const isGraded = q.id in state.graded
  const score = state.graded[q.id]
  const answer = state.answers[q.id]
  const canCheck = hasAnswer(q, answer)
  const isLast = index === questions.length - 1

  const check = useCallback(() => {
    if (isGraded || !canCheck) return
    const s = engine.check(q.id)
    const streak = s >= 1 ? state.streak + 1 : 0
    playCue(cueFor(s, streak), prefs.sound)
    if (s >= 1) {
      setPop(true)
      window.setTimeout(() => setPop(false), 520)
    }
  }, [engine, q.id, isGraded, canCheck, state.streak, prefs.sound])

  const next = useCallback(() => {
    if (isLast) onFinish()
    else setIndex((i) => i + 1)
  }, [isLast, onFinish])

  // Keyboard: 1-9 / a-h pick a choice, T / F for true-false, Enter checks then continues, arrows move.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      const inField = tag === 'INPUT' || tag === 'TEXTAREA'
      if (e.key === 'Enter') {
        e.preventDefault()
        if (isGraded) next()
        else check()
        return
      }
      if (inField) return
      if (e.key === 'ArrowLeft' && index > 0) setIndex(index - 1)
      else if (e.key === 'ArrowRight' && isGraded) next()
      else if (!isGraded && (q.question_type === 'multiple_choice' || q.question_type === 'audio_choice')) {
        const choices = ((q.options ?? {}) as { choices?: { id: string }[] }).choices ?? []
        const idx = KEY_CHOICE.test(e.key) ? Number(e.key) - 1 : KEY_LETTER.test(e.key) ? e.key.toLowerCase().charCodeAt(0) - 97 : -1
        if (idx >= 0 && idx < choices.length) engine.setAnswer(q.id, choices[idx].id)
      } else if (!isGraded && q.question_type === 'true_false') {
        if (e.key.toLowerCase() === 't') engine.setAnswer(q.id, 'true')
        if (e.key.toLowerCase() === 'f') engine.setAnswer(q.id, 'false')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [q, isGraded, index, check, next, engine])

  const continueVariant = !isGraded ? 'default' : outcomeOf(score) === 'ok' ? 'success' : outcomeOf(score) === 'part' ? 'default' : 'terracotta'

  return (
    <div className={styles.focus}>
      <div className={styles.stageCol}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-0.5">
            <span className="font-heading text-[11px] font-bold uppercase tracking-[0.14em] text-gold">{kindLabel}</span>
            {title && <h3 className="font-heading text-[15px] font-bold">{title}</h3>}
          </div>
          <div className="flex items-center gap-2.5">
            <StreakChip count={state.streak} pop={pop} />
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
          <div className="basis-full sm:basis-[260px]">
            <ProgressSegments questions={questions} graded={state.graded} current={index} />
          </div>
        </div>

        <div className={cn('relative overflow-hidden rounded-[20px] border border-border bg-card', styles.panel)}>
          <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-36 h-[380px] w-[380px] rounded-full bg-[radial-gradient(closest-side,hsl(var(--gold-highlight)/0.12),transparent_70%)]" />
          <div key={q.id} className={cn('relative grid gap-5', styles.rise)}>
            <div className="grid gap-2.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-heading text-xs font-bold tabular-nums text-muted-foreground">{t('dashboard.classViewer.quiz.questionOf', { n: index + 1, total: questions.length })}</span>
                <TypeChip type={q.question_type} />
              </div>
              <h3 className={cn('font-heading font-extrabold leading-[1.25] tracking-[-0.015em]', styles.question)}>{q.question}</h3>
            </div>
            <QuestionInput question={q} answer={answer} isGraded={isGraded} onChange={(v) => engine.setAnswer(q.id, v)} />
            {isGraded && <FeedbackBanner score={score} explanation={q.explanation} correctAnswer={correctAnswerLabel(q) || null} />}
          </div>

          <div className="relative mt-6 flex items-center justify-between gap-3">
            <Button variant="ghost" disabled={index === 0} onClick={() => setIndex(index - 1)} className="rounded-xl">
              <ArrowLeft className="h-4 w-4" /> {t('dashboard.pages.modules.previous')}
            </Button>
            <span className={cn(styles.hint, 'items-center gap-1.5 text-xs text-muted-foreground')}>
              {(q.question_type === 'multiple_choice' || q.question_type === 'audio_choice') && !isGraded && (
                <>
                  <kbd className="rounded-[5px] border border-b-2 border-foreground/20 px-1.5 text-[10.5px] font-semibold">1</kbd>–
                  <kbd className="rounded-[5px] border border-b-2 border-foreground/20 px-1.5 text-[10.5px] font-semibold">{((q.options ?? {}) as { choices?: unknown[] }).choices?.length ?? 4}</kbd>
                  {t('dashboard.classViewer.quiz.hints.select')} ·
                </>
              )}
              <kbd className="rounded-[5px] border border-b-2 border-foreground/20 px-1.5 text-[10.5px] font-semibold">↵</kbd>
              {t(isGraded ? 'dashboard.classViewer.quiz.hints.continue' : 'dashboard.classViewer.quiz.hints.check')}
            </span>
            {!isGraded ? (
              <Button size="lg" disabled={!canCheck} onClick={check} className="rounded-xl px-7">
                <Check className="h-4 w-4" /> {t('dashboard.classViewer.quiz.checkAnswer')}
              </Button>
            ) : (
              <Button size="lg" variant={continueVariant} onClick={next} className="rounded-xl px-7">
                {isLast ? t('dashboard.classViewer.quiz.seeResults') : t('dashboard.classViewer.quiz.continue')} <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <aside className={styles.map}>
        <QuestionMap questions={questions} graded={state.graded} current={index} onJump={setIndex} />
      </aside>
    </div>
  )
}
