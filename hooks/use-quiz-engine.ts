'use client'

import { useCallback, useMemo, useReducer } from 'react'
import { initQuizState, quizReducer, type QuizState } from '@/lib/quiz/engine'
import { gradeQuestionScore } from '@/lib/quiz/grading'
import type { QuizQuestion } from '@/types/modules'

export interface QuizEngine {
  state: QuizState
  setAnswer: (id: string, value: unknown) => void
  /** Grades one question and returns the score it recorded (or the existing one). */
  check: (id: string) => number
  /** Grades several questions at once and returns their mean score. */
  checkMany: (ids: string[]) => number
  reset: () => void
}

export function useQuizEngine(questions: QuizQuestion[]): QuizEngine {
  const reducer = useMemo(() => quizReducer(questions), [questions])
  const [state, dispatch] = useReducer(reducer, questions, initQuizState)
  const byId = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions])

  const setAnswer = useCallback((id: string, value: unknown) => dispatch({ type: 'set', id, value }), [])
  const check = useCallback(
    (id: string) => {
      if (id in state.graded) return state.graded[id]
      const q = byId.get(id)
      const score = q ? gradeQuestionScore(q, state.answers[id]) : 0
      dispatch({ type: 'check', id })
      return score
    },
    [state, byId],
  )
  const checkMany = useCallback(
    (ids: string[]) => {
      const scores = ids.flatMap((id) => {
        if (id in state.graded) return [state.graded[id]]
        const q = byId.get(id)
        return q ? [gradeQuestionScore(q, state.answers[id])] : []
      })
      dispatch({ type: 'checkMany', ids })
      return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
    },
    [state, byId],
  )
  const reset = useCallback(() => dispatch({ type: 'reset' }), [])

  return { state, setAnswer, check, checkMany, reset }
}
