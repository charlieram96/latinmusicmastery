import type { QuizQuestion } from '@/types/modules'

export interface QuestionInputProps {
  question: QuizQuestion
  answer: unknown
  isGraded: boolean
  onChange: (v: unknown) => void
}
