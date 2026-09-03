'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { DEFAULT_PREFS, loadPrefs, savePrefs, type TunerPrefs } from '@/lib/tuner/prefs'

/**
 * Tuner preferences persisted in localStorage, exposed as an external store so
 * SSR renders the defaults and the client swaps in the stored values without a
 * hydration mismatch or a setState-in-effect.
 */
let cached: TunerPrefs | null = null
const listeners = new Set<() => void>()

function getSnapshot(): TunerPrefs {
  if (!cached) cached = loadPrefs(typeof window === 'undefined' ? null : window.localStorage)
  return cached
}

function getServerSnapshot(): TunerPrefs {
  return DEFAULT_PREFS
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

function update(patch: Partial<TunerPrefs>): void {
  cached = { ...getSnapshot(), ...patch }
  savePrefs(typeof window === 'undefined' ? null : window.localStorage, cached)
  listeners.forEach((l) => l())
}

export function useTunerPrefs(): [TunerPrefs, (patch: Partial<TunerPrefs>) => void] {
  const prefs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const set = useCallback((patch: Partial<TunerPrefs>) => update(patch), [])
  return [prefs, set]
}
