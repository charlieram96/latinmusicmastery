'use client'

import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/components/language-provider'
import { markClassItemComplete } from '@/app/actions/progress'
import { gradeQuestionScore, hasAnswer, shuffleStable, type OrderItem } from '@/lib/quiz/grading'
import type { QuizQuestion } from '@/types/modules'
import { FeedbackBanner } from './quiz/feedback-banner'
import { ProgressSegments } from './quiz/progress-segments'
import { QuestionInput } from './quiz/question-input'
import { ResultsScreen } from './quiz/results-screen'

const TYPE_LABEL_KEYS: Record<string, string> = {
  multiple_choice: 'dashboard.classViewer.quiz.types.multipleChoice',
  true_false: 'dashboard.classViewer.quiz.types.trueFalse',
  text_answer: 'dashboard.classViewer.quiz.types.textAnswer',
  audio: 'dashboard.classViewer.quiz.types.audio',
  audio_choice: 'dashboard.classViewer.quiz.types.audioChoice',
  piece_placement: 'dashboard.classViewer.quiz.types.piecePlacement',
  fill_in_blank: 'dashboard.classViewer.quiz.types.fillInBlank',
  matching_pairs: 'dashboard.classViewer.quiz.types.matchingPairs',
  ordering_sequence: 'dashboard.classViewer.quiz.types.orderingSequence',
}

interface QuizRunnerProps {
  classItemId: string
  questions: QuizQuestion[]
  /** Label shown in the header — "Quiz" or "Exercise". */
  kind?: 'Quiz' | 'Exercise'
}

/** Seed ordering questions with a stable shuffled order so grading has a defined answer. */
function seedAnswers(questions: QuizQuestion[]): Record<string, unknown> {
  const init: Record<string, unknown> = {}
  for (const qq of questions) {
    if (qq.question_type === 'ordering_sequence') {
      const items = ((qq.options ?? {}) as Record<string, unknown>).items as OrderItem[] | undefined
      init[qq.id] = shuffleStable((items ?? []).map((it) => it.id), qq.id)
    } else if (qq.question_type === 'piece_placement') {
      init[qq.id] = {} // pieceId -> {x, y} center %, filled as pieces are dragged
    }
  }
  return init
}

export function QuizRunner({ classItemId, questions, kind = 'Quiz' }: QuizRunnerProps) {
  const { t } = useTranslation()
  const kindLabel = t(kind === 'Exercise' ? 'dashboard.pages.modules.exercise' : 'dashboard.pages.modules.quiz')
  const ordered = useMemo(() => [...questions].sort((a, b) => a.order_index - b.order_index), [questions])
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [answers, setAnswers] = useState<Record<string, unknown>>(() => seedAnswers(questions))
  const [graded, setGraded] = useState<Record<string, number>>({})
  const [finished, setFinished] = useState(false)

  const q = ordered[index]
  const isGraded = q ? q.id in graded : false
  const answer = q ? answers[q.id] : undefined
  const canCheck = q ? hasAnswer(q, answer) : false
  const score = q ? (graded[q.id] ?? 0) : 0

  const setAnswer = (value: unknown) => {
    if (q) setAnswers((prev) => ({ ...prev, [q.id]: value }))
  }

  const handleCheck = () => {
    if (!q || isGraded || !canCheck) return
    setGraded((prev) => ({ ...prev, [q.id]: gradeQuestionScore(q, answer) }))
  }

  const goNext = () => {
    if (index < ordered.length - 1) {
      setDirection(1)
      setIndex((i) => i + 1)
    } else {
      setFinished(true)
      void markClassItemComplete(classItemId).catch(() => {})
    }
  }

  const goPrev = () => {
    if (index > 0) {
      setDirection(-1)
      setIndex((i) => i - 1)
    }
  }

  const handleRestart = () => {
    setAnswers(seedAnswers(questions))
    setGraded({})
    setIndex(0)
    setDirection(1)
    setFinished(false)
  }

  // Keyboard shortcuts: 1-4/A-D select, Enter check/next, arrows navigate, T/F for true-false.
  useEffect(() => {
    if (finished || !q) return
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      const inField = tag === 'INPUT' || tag === 'TEXTAREA'
      if (e.key === 'Enter') {
        e.preventDefault()
        if (isGraded) goNext()
        else handleCheck()
        return
      }
      if (inField) return
      if (e.key === 'ArrowLeft') {
        goPrev()
      } else if (e.key === 'ArrowRight' && isGraded) {
        goNext()
      } else if (!isGraded && q.question_type === 'multiple_choice') {
        const choices = ((q.options ?? {}) as { choices?: { id: string }[] }).choices ?? []
        const idx = /^[1-9]$/.test(e.key)
          ? Number(e.key) - 1
          : /^[a-h]$/i.test(e.key)
            ? e.key.toLowerCase().charCodeAt(0) - 97
            : -1
        if (idx >= 0 && idx < choices.length) setAnswer(choices[idx].id)
      } else if (!isGraded && q.question_type === 'true_false') {
        if (e.key.toLowerCase() === 't') setAnswer('true')
        if (e.key.toLowerCase() === 'f') setAnswer('false')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, isGraded, finished, answer, index, canCheck])

  if (ordered.length === 0) {
    return (
      <div className="rounded-3xl border border-border bg-card py-10 text-center text-muted-foreground">
        {t('dashboard.classViewer.quiz.noQuestions', { kind: kindLabel.toLowerCase() })}
      </div>
    )
  }

  if (finished) {
    return (
      <MotionConfig reducedMotion="user">
        <ResultsScreen kind={kindLabel} questions={ordered} graded={graded} onRestart={handleRestart} />
      </MotionConfig>
    )
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="rounded-3xl border border-border bg-card p-5 sm:p-7">
        <div className="mb-6">
          <ProgressSegments questions={ordered} graded={graded} current={index} />
        </div>

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={q.id}
            custom={direction}
            initial={{ opacity: 0, x: direction * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -40 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
                {TYPE_LABEL_KEYS[q.question_type] ? t(TYPE_LABEL_KEYS[q.question_type]) : kindLabel}
              </span>
              <h3 className="text-xl font-bold leading-snug sm:text-2xl">{q.question}</h3>
            </div>

            <QuestionInput question={q} answer={answer} isGraded={isGraded} onChange={setAnswer} />

            {isGraded && <FeedbackBanner score={score} explanation={q.explanation} />}
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={goPrev} disabled={index === 0} className="rounded-xl">
            <ArrowLeft className="mr-1 h-4 w-4" /> {t('dashboard.pages.modules.previous')}
          </Button>
          {!isGraded ? (
            <Button onClick={handleCheck} disabled={!canCheck} size="lg" className="rounded-xl px-8">
              <Check className="mr-1 h-4 w-4" /> {t('dashboard.classViewer.quiz.checkAnswer')}
            </Button>
          ) : (
            <Button onClick={goNext} size="lg" className="rounded-xl px-8">
              {index < ordered.length - 1 ? t('common.next') : t('dashboard.classViewer.quiz.finish')}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </MotionConfig>
  )
}
