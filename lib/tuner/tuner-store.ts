/**
 * Minimal external store for per-frame tuner values so components can
 * subscribe with useSyncExternalStore without re-rendering the whole page.
 */
import type { TunerFrame } from './pitch-tracker'

export interface TunerSnapshot {
  frame: TunerFrame | null
  /** Smoothed input level 0..1. */
  level: number
  /** True when the input peaked near full scale on the last block. */
  clip: boolean
}

export const EMPTY_SNAPSHOT: TunerSnapshot = Object.freeze({ frame: null, level: 0, clip: false })

export function createTunerStore() {
  let snapshot: TunerSnapshot = EMPTY_SNAPSHOT
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach((l) => l())
  return {
    getSnapshot: () => snapshot,
    subscribe(cb: () => void) {
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    },
    set(next: TunerSnapshot) {
      snapshot = next
      notify()
    },
    reset() {
      snapshot = EMPTY_SNAPSHOT
      notify()
    },
  }
}

export type TunerStore = ReturnType<typeof createTunerStore>
