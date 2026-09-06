/** Per-student quiz preferences persisted in localStorage. */
import { z } from 'zod'

export const QUIZ_PREFS_KEY = 'lmm-quiz-prefs'

export const quizPrefsSchema = z.object({ sound: z.boolean() })
export type QuizPrefs = z.infer<typeof quizPrefsSchema>
export const DEFAULT_QUIZ_PREFS: QuizPrefs = { sound: true }

export function parseQuizPrefs(raw: string | null): QuizPrefs {
  if (!raw) return DEFAULT_QUIZ_PREFS
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return DEFAULT_QUIZ_PREFS
    const result = quizPrefsSchema.safeParse({ ...DEFAULT_QUIZ_PREFS, ...(parsed as Record<string, unknown>) })
    return result.success ? result.data : DEFAULT_QUIZ_PREFS
  } catch {
    return DEFAULT_QUIZ_PREFS
  }
}

export function loadQuizPrefs(storage: Pick<Storage, 'getItem'> | null): QuizPrefs {
  if (!storage) return DEFAULT_QUIZ_PREFS
  try {
    return parseQuizPrefs(storage.getItem(QUIZ_PREFS_KEY))
  } catch {
    return DEFAULT_QUIZ_PREFS
  }
}

export function saveQuizPrefs(storage: Pick<Storage, 'setItem'> | null, prefs: QuizPrefs): void {
  if (!storage) return
  try {
    storage.setItem(QUIZ_PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // private mode / quota: the preference simply does not persist
  }
}
