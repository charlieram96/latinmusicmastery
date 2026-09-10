'use client'

import { useSyncExternalStore } from 'react'
import { isStageTheme, STAGE_THEME_STORAGE_KEY, type StageThemeId } from './themes'

const EVENT = 'playsense-stage-appearance'
function subscribe(listener: () => void) {
  window.addEventListener('storage', listener)
  window.addEventListener(EVENT, listener)
  return () => { window.removeEventListener('storage', listener); window.removeEventListener(EVENT, listener) }
}
function snapshot(): StageThemeId {
  try { const value = localStorage.getItem(STAGE_THEME_STORAGE_KEY); return isStageTheme(value) ? value : 'studio' } catch { return 'studio' }
}
export function useStageTheme() {
  const theme = useSyncExternalStore(subscribe, snapshot, (): StageThemeId => 'studio')
  const setTheme = (value: StageThemeId) => {
    if (!isStageTheme(value)) return
    try { localStorage.setItem(STAGE_THEME_STORAGE_KEY, value) } catch { /* Device storage is optional. */ }
    window.dispatchEvent(new Event(EVENT))
  }
  return [theme, setTheme] as const
}
