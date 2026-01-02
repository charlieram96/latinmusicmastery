export type ModuleType = 'VIDEO' | 'QUIZ' | 'EXERCISE'

export type QuestionType =
  | 'multiple_choice'
  | 'text_answer'
  | 'audio'
  | 'matching_pairs'
  | 'fill_in_blank'
  | 'ordering_sequence'
  | 'true_false'

export interface CourseModule {
  id: string
  course_id: string
  module_type: ModuleType
  title: string
  description: string | null
  order_index: number

  // VIDEO fields
  video_url: string | null
  video_duration_seconds: number | null
  soundslice_embed_url: string | null

  // QUIZ/EXERCISE fields
  question: string | null
  question_type: QuestionType | null
  options: QuestionOptions | null
  correct_answer: string | null
  explanation: string | null

  is_free: boolean
  created_at: string
  updated_at: string
}

// Options structures for different question types
export interface MultipleChoiceOptions {
  choices: { id: string; text: string }[]
}

export interface MatchingPairsOptions {
  pairs: { id: string; left: string; right: string }[]
}

export interface FillInBlankOptions {
  text: string // Text with {{blank}} placeholders
  blanks: { id: string; answer: string }[]
}

export interface OrderingSequenceOptions {
  items: { id: string; text: string; correctPosition: number }[]
}

export type QuestionOptions =
  | MultipleChoiceOptions
  | MatchingPairsOptions
  | FillInBlankOptions
  | OrderingSequenceOptions
  | { answer: boolean } // for true_false
  | null
