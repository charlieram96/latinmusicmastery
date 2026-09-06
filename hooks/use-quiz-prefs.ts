'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { DEFAULT_QUIZ_PREFS, loadQuizPrefs, saveQuizPrefs, type QuizPrefs } from '@/lib/quiz/prefs'

/** Same external-store pattern as use-tuner-prefs: SSR renders defaults, the client swaps in stored values without a hydration mismatch. */
let cached: QuizPrefs | null = null
const listeners = new Set<() => void>()

function getSnapshot(): QuizPrefs {
  if (!cached) cached = loadQuizPrefs(typeof window === 'undefined' ? null : window.localStorage)
  return cached
}
function getServerSnapshot(): QuizPrefs {
  return DEFAULT_QUIZ_PREFS
}
function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}
function update(patch: Partial<QuizPrefs>): void {
  cached = { ...getSnapshot(), ...patch }
  saveQuizPrefs(typeof window === 'undefined' ? null : window.localStorage, cached)
  listeners.forEach((l) => l())
}

export function useQuizPrefs(): [QuizPrefs, (patch: Partial<QuizPrefs>) => void] {
  const prefs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const set = useCallback((patch: Partial<QuizPrefs>) => update(patch), [])
  return [prefs, set]
}
