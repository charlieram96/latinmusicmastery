import { gradeQuestionScore, shuffleStable, type OrderItem } from './grading'
import type { QuizQuestion } from '@/types/modules'

export type Outcome = 'ok' | 'part' | 'bad'
export type SoundCue = 'ok' | 'part' | 'bad' | 'streak' | 'fanfare' | 'soft'

export const outcomeOf = (score: number): Outcome => (score >= 1 ? 'ok' : score > 0 ? 'part' : 'bad')

export interface QuizState {
  answers: Record<string, unknown>
  graded: Record<string, number>
  /** consecutive fully-correct checks in this session; resets on any miss */
  streak: number
}

export type QuizAction =
  | { type: 'set'; id: string; value: unknown }
  | { type: 'check'; id: string }
  | { type: 'checkMany'; ids: string[] }
  | { type: 'reset' }

/** Seed ordering questions with a stable shuffled order so grading always has a defined answer. */
export function seedAnswers(questions: QuizQuestion[]): Record<string, unknown> {
  const init: Record<string, unknown> = {}
  for (const q of questions) {
    if (q.question_type === 'ordering_sequence') {
      const items = ((q.options ?? {}) as Record<string, unknown>).items as OrderItem[] | undefined
      init[q.id] = shuffleStable((items ?? []).map((it) => it.id), q.id)
    } else if (q.question_type === 'piece_placement' || q.question_type === 'matching_pairs') {
      init[q.id] = {}
    }
  }
  return init
}

export function initQuizState(questions: QuizQuestion[]): QuizState {
  return { answers: seedAnswers(questions), graded: {}, streak: 0 }
}

export function quizReducer(questions: QuizQuestion[]) {
  const byId = new Map(questions.map((q) => [q.id, q]))
  return (state: QuizState, action: QuizAction): QuizState => {
    switch (action.type) {
      case 'set':
        return { ...state, answers: { ...state.answers, [action.id]: action.value } }
      case 'check': {
        const q = byId.get(action.id)
        if (!q || action.id in state.graded) return state
        const score = gradeQuestionScore(q, state.answers[action.id])
        return { ...state, graded: { ...state.graded, [action.id]: score }, streak: score >= 1 ? state.streak + 1 : 0 }
      }
      case 'checkMany': {
        const graded = { ...state.graded }
        for (const id of action.ids) {
          const q = byId.get(id)
          if (q && !(id in graded)) graded[id] = gradeQuestionScore(q, state.answers[id])
        }
        return { ...state, graded, streak: 0 }
      }
      case 'reset':
        return initQuizState(questions)
    }
  }
}

export function totalScore(questions: QuizQuestion[], graded: Record<string, number>): number {
  return questions.reduce((sum, q) => sum + (graded[q.id] ?? 0), 0)
}

export function percentScore(questions: QuizQuestion[], graded: Record<string, number>): number {
  return questions.length ? Math.round((totalScore(questions, graded) / questions.length) * 100) : 0
}

/** Which cue to play after a check. Every third consecutive hit gets the streak sparkle. */
export function cueFor(score: number, streak: number): SoundCue {
  if (score >= 1) return streak >= 3 && streak % 3 === 0 ? 'streak' : 'ok'
  return score > 0 ? 'part' : 'bad'
}
