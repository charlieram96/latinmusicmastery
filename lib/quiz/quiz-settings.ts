import type { QuizSettings } from '@/types/modules'

export const DEFAULT_QUIZ_SETTINGS: QuizSettings = { mode: 'focus' }

/** Parse class_items.quiz_settings (jsonb). Anything unrecognized falls back to focus mode. */
export function readQuizSettings(json: unknown): QuizSettings {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return DEFAULT_QUIZ_SETTINGS
  const mode = (json as Record<string, unknown>).mode
  return { mode: mode === 'sheet' ? 'sheet' : 'focus' }
}
