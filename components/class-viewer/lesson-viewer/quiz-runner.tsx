'use client'

import { MotionConfig } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from '@/components/language-provider'
import { useLessonActivity } from './lesson-progress-context'
import { useQuizEngine } from '@/hooks/use-quiz-engine'
import type { QuizQuestion, QuizSettings } from '@/types/modules'
import { ExamSheet } from './quiz/exam-sheet'
import { FocusStage } from './quiz/focus-stage'
import { ResultsScreen } from './quiz/results-screen'
import styles from './quiz/quiz.module.css'

interface QuizRunnerProps {
  classItemId: string
  questions: QuizQuestion[]
  /** Label shown in the header — "Quiz" or "Exercise". */
  kind?: 'Quiz' | 'Exercise'
  /** Per-quiz presentation settings (class_items.quiz_settings). Exercises always use focus mode. */
  settings?: QuizSettings
  /** Where "Continue to next part" goes; omitted when this is the last part. */
  nextHref?: string | null
  /** The class item title, shown above the stage. */
  title?: string
}

/** Shell: owns the engine and the finished flag, picks the layout mode, marks completion once. */
export function QuizRunner({ questions, kind = 'Quiz', settings, nextHref = null, title }: QuizRunnerProps) {
  const { t } = useTranslation()
  const kindLabel = t(kind === 'Exercise' ? 'dashboard.pages.modules.exercise' : 'dashboard.pages.modules.quiz')
  const ordered = useMemo(() => [...questions].sort((a, b) => a.order_index - b.order_index), [questions])
  const engine = useQuizEngine(ordered)
  const [finished, setFinished] = useState(false)
  const completeQuestions = useLessonActivity('questions')
  const mode = kind === 'Quiz' && settings?.mode === 'sheet' ? 'sheet' : 'focus'

  useEffect(() => {
    if (finished) completeQuestions()
  }, [finished, completeQuestions])

  const restart = () => {
    engine.reset()
    setFinished(false)
  }

  if (ordered.length === 0) {
    return (
      <div className="rounded-3xl border border-border bg-card py-10 text-center text-muted-foreground">
        {t('dashboard.classViewer.quiz.noQuestions', { kind: kindLabel.toLowerCase() })}
      </div>
    )
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className={styles.root}>
        {mode === 'sheet' ? (
          <ExamSheet questions={ordered} engine={engine} kindLabel={kindLabel} title={title} nextHref={nextHref} onSubmit={() => setFinished(true)} onRestart={restart} />
        ) : finished ? (
          <ResultsScreen kind={kindLabel} questions={ordered} answers={engine.state.answers} graded={engine.state.graded} onRestart={restart} nextHref={nextHref} />
        ) : (
          <FocusStage questions={ordered} engine={engine} kindLabel={kindLabel} title={title} onFinish={() => setFinished(true)} />
        )}
      </div>
    </MotionConfig>
  )
}
