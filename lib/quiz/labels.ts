import { correctAnswerLabel, isPieceCorrect, type AudioChoice, type Blank, type Choice, type OrderItem, type Pair, type PiecePlacement, type PlacementPiece } from './grading'
import type { QuizQuestion } from '@/types/modules'

const DASH = '—'

/** What the student answered, as one line for the results review. Empty string when nothing usable. */
export function userAnswerLabel(q: QuizQuestion, answer: unknown): string {
  const opts = (q.options ?? {}) as Record<string, unknown>
  switch (q.question_type) {
    case 'multiple_choice':
      return ((opts.choices as Choice[]) ?? []).find((c) => c.id === answer)?.text ?? ''
    case 'audio_choice': {
      const choices = (opts.choices as AudioChoice[]) ?? []
      const i = choices.findIndex((c) => c.id === answer)
      return i < 0 ? '' : choices[i].text?.trim() || `Clip ${i + 1}`
    }
    case 'true_false':
    case 'text_answer':
    case 'audio':
      return typeof answer === 'string' ? answer : ''
    case 'fill_in_blank': {
      const given = (answer as Record<string, string>) ?? {}
      return ((opts.blanks as Blank[]) ?? []).map((b) => given[b.id] || DASH).join(', ')
    }
    case 'matching_pairs': {
      const given = (answer as Record<string, string>) ?? {}
      return ((opts.pairs as Pair[]) ?? []).map((p) => `${p.left} → ${given[p.id] || DASH}`).join(' · ')
    }
    case 'ordering_sequence': {
      const items = (opts.items as OrderItem[]) ?? []
      return ((answer as string[]) ?? []).map((id) => items.find((it) => it.id === id)?.text ?? '?').join(' → ')
    }
    default:
      return ''
  }
}

/** The full correct answer for the review list (grading's correctAnswerLabel only covers choice types). */
export function fullCorrectLabel(q: QuizQuestion): string {
  const opts = (q.options ?? {}) as Record<string, unknown>
  switch (q.question_type) {
    case 'multiple_choice':
    case 'audio_choice':
      return correctAnswerLabel(q)
    case 'true_false':
    case 'text_answer':
    case 'audio':
      return q.correct_answer ?? ''
    case 'fill_in_blank':
      return ((opts.blanks as Blank[]) ?? []).map((b) => b.answer).join(', ')
    case 'matching_pairs':
      return ((opts.pairs as Pair[]) ?? []).map((p) => `${p.left} → ${p.right}`).join(' · ')
    case 'ordering_sequence':
      return [...(((opts.items as OrderItem[]) ?? []))].sort((a, b) => a.correctPosition - b.correctPosition).map((it) => it.text).join(' → ')
    default:
      return ''
  }
}

export function countCorrectPieces(q: QuizQuestion, answer: unknown): { correct: number; total: number } {
  const pieces = (((q.options ?? {}) as Record<string, unknown>).pieces as PlacementPiece[]) ?? []
  const placed = (answer as Record<string, PiecePlacement>) ?? {}
  return { correct: pieces.filter((p) => isPieceCorrect(p, placed[p.id])).length, total: pieces.length }
}
