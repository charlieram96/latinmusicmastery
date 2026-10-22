'use client'
import { useSyncExternalStore } from 'react'
import { isStageCity, type StageCity } from './cities'
const KEY = 'lmm-playsense-city-v1'
const EVENT = 'lmm-playsense-city'
function subscribe(listener: () => void) {
  window.addEventListener('storage', listener); window.addEventListener(EVENT, listener)
  return () => { window.removeEventListener('storage', listener); window.removeEventListener(EVENT, listener) }
}
function snapshot(): StageCity {
  try { const city = localStorage.getItem(KEY); return isStageCity(city) ? city : 'miami' } catch { return 'miami' }
}
export function useStageCity() {
  const city = useSyncExternalStore(subscribe, snapshot, (): StageCity => 'miami')
  return [city, (next: StageCity) => {
    if (!isStageCity(next)) return
    try { localStorage.setItem(KEY, next) } catch { return }
    window.dispatchEvent(new Event(EVENT))
  }] as const
}
