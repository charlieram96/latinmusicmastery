'use client'

import { useTranslation } from '@/components/language-provider'
import { fullCorrectLabel, userAnswerLabel } from '@/lib/quiz/labels'
import type { QuizQuestion } from '@/types/modules'

const NO_BANNER = new Set<QuizQuestion['question_type']>(['text_answer', 'audio', 'piece_placement'])

/**
 * Answer labels ready to render, with true/false routed through the
 * translation dictionary instead of showing the raw 'true' / 'false' string.
 */
export function useAnswerLabels() {
  const { t } = useTranslation()

  const trueFalse = (raw: string) => t(raw === 'true' ? 'dashboard.classViewer.quiz.true' : 'dashboard.classViewer.quiz.false')

  const reviewCorrect = (q: QuizQuestion): string =>
    q.question_type === 'true_false' ? trueFalse(fullCorrectLabel(q)) : fullCorrectLabel(q)

  const bannerCorrect = (q: QuizQuestion): string | null => {
    if (NO_BANNER.has(q.question_type)) return null
    return reviewCorrect(q) || null
  }

  const said = (q: QuizQuestion, answer: unknown): string => {
    const raw = userAnswerLabel(q, answer)
    if (q.question_type === 'true_false') return raw && trueFalse(raw)
    return raw
  }

  return { bannerCorrect, reviewCorrect, said }
}
