// ============================================
// New Course Hierarchy Types
// Course -> Sections (Modules) -> Classes -> Class Items
// ============================================

export type ClassItemType = 'VIDEO' | 'QUIZ' | 'EXERCISE' | 'JAM_SESSION'

export type QuestionType =
  | 'multiple_choice'
  | 'text_answer'
  | 'audio'
  | 'audio_choice'
  | 'piece_placement'
  | 'matching_pairs'
  | 'fill_in_blank'
  | 'ordering_sequence'
  | 'true_false'

export interface CourseSection {
  id: string
  course_id: string
  title: string
  description: string | null
  title_es: string | null
  description_es: string | null
  order_index: number
  created_at: string | null
  updated_at: string | null
  classes?: ClassRecord[]
}

export interface ClassRecord {
  id: string
  section_id: string
  title: string
  description: string | null
  title_es: string | null
  description_es: string | null
  order_index: number
  is_free: boolean | null
  created_at: string | null
  updated_at: string | null
  items?: ClassItem[]
}

export interface ClassItem {
  id: string
  class_id: string
  item_type: string
  title: string
  description: string | null
  title_es: string | null
  description_es: string | null
  order_index: number
  rich_content: Record<string, unknown> | null

  // VIDEO fields
  video_url: string | null
  video_duration_seconds: number | null
  soundslice_embed_url: string | null
  // WebVTT subtitle tracks (both kept so the player can offer both languages;
  // not a localize _es overlay pair — never add these to ITEM_FIELDS).
  subtitles_en_url: string | null
  subtitles_es_url: string | null

  // QUIZ/EXERCISE fields
  question: string | null
  question_type: string | null
  options: QuestionOptions | null
  correct_answer: string | null
  explanation: string | null

  // JAM_SESSION fields
  audio_url: string | null
  bpm: number | null
  key_signature: string | null

  created_at: string | null
  updated_at: string | null
}

// A quiz/exercise is a CONTAINER for a series of questions (quiz_questions table).
export interface QuizQuestion {
  id: string
  class_item_id: string
  order_index: number
  question: string
  question_type: QuestionType
  options: QuestionOptions | null
  correct_answer: string | null
  explanation: string | null
  question_es: string | null
  explanation_es: string | null
  options_es: QuestionOptions | null
  // Primary media (per-option/per-piece media lives inside `options`):
  // audio_choice → prompt clip; piece_placement → background image.
  audio_url: string | null
  image_url: string | null
  created_at: string | null
  updated_at: string | null
}

export interface ClassItemProgress {
  id: string
  user_id: string
  class_item_id: string
  completed: boolean | null
  completed_at: string | null
  last_position_seconds: number | null
  created_at: string | null
  updated_at: string | null
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

// Audio question: student listens to `QuizQuestion.audio_url`, then picks a
// choice. Choices are text OR playable clips depending on `optionMode`.
export interface AudioChoiceOptions {
  optionMode: 'text' | 'audio'
  choices: { id: string; text?: string; audioUrl?: string }[]
}

// Piece placement: student freely drags pieces anywhere over
// `QuizQuestion.image_url`; a piece is correct when its center lands inside
// its hidden `area` rectangle. All geometry is in percentages of the image so
// it scales responsively. `width` is the piece's display width.
export interface PiecePlacementOptions {
  pieces: {
    id: string
    label?: string
    imageUrl: string
    width: number
    area: { x: number; y: number; width: number; height: number }
  }[]
}

export type QuestionOptions =
  | MultipleChoiceOptions
  | MatchingPairsOptions
  | FillInBlankOptions
  | OrderingSequenceOptions
  | AudioChoiceOptions
  | PiecePlacementOptions
  | { answer: boolean } // for true_false
  | null

// Legacy type alias for backward compatibility during migration
export type ModuleType = 'VIDEO' | 'QUIZ' | 'EXERCISE'
export interface CourseModule {
  id: string
  course_id: string
  module_type: ModuleType
  title: string
  description: string | null
  order_index: number
  video_url: string | null
  video_duration_seconds: number | null
  soundslice_embed_url: string | null
  question: string | null
  question_type: QuestionType | null
  options: QuestionOptions | null
  correct_answer: string | null
  explanation: string | null
  is_free: boolean
  created_at: string
  updated_at: string
}
