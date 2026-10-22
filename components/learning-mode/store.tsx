'use client'
import { useEffect, useSyncExternalStore } from 'react'

export type LearningMode = 'classic' | 'kids'
const KEY = 'lmm-learning-mode'
const EVENT = 'lmm-learning-mode-change'
let fallback: LearningMode = 'classic'
function read(): LearningMode {
  try { return localStorage.getItem(KEY) === 'kids' ? 'kids' : 'classic' }
  catch { return fallback }
}
function subscribe(callback: () => void) {
  window.addEventListener('storage', callback)
  window.addEventListener(EVENT, callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(EVENT, callback)
  }
}
const serverSnapshot = (): LearningMode => 'classic'

export function useLearningMode() { return useSyncExternalStore(subscribe, read, serverSnapshot) }
export function setLearningMode(value: LearningMode) {
  fallback = value
  try { localStorage.setItem(KEY, value) } catch { /* In-memory fallback. */ }
  window.dispatchEvent(new Event(EVENT))
}
export function LearningModeAppearance() {
  const mode = useLearningMode()
  useEffect(() => {
    document.documentElement.dataset.learningMode = mode
    return () => { delete document.documentElement.dataset.learningMode }
  }, [mode])
  return null
}
