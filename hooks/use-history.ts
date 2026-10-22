'use client'

import { useCallback, useReducer, useRef } from 'react'

export type HistoryState<T> = { past: T[]; present: T; future: T[] }
export type HistoryAction<T> = { type: 'commit'; next: T } | { type: 'undo' } | { type: 'redo' } | { type: 'reset'; present: T }

const LIMIT = 100
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export function historyReducer<T>(state: HistoryState<T>, action: HistoryAction<T>): HistoryState<T> {
  switch (action.type) {
    case 'commit': {
      if (same(action.next, state.present)) return state
      const past = [...state.past, state.present]
      return { past: past.length > LIMIT ? past.slice(past.length - LIMIT) : past, present: action.next, future: [] }
    }
    case 'undo': {
      if (state.past.length === 0) return state
      const present = state.past[state.past.length - 1]
      return { past: state.past.slice(0, -1), present, future: [state.present, ...state.future] }
    }
    case 'redo': {
      if (state.future.length === 0) return state
      const [present, ...future] = state.future
      return { past: [...state.past, state.present], present, future }
    }
    case 'reset':
      return { past: [], present: action.present, future: [] }
  }
}

/** Undo/redo stack over snapshots. `undo`/`redo` return the snapshot to restore (or null at the ends). */
export function useHistory<T>(initial: T) {
  const [state, dispatch] = useReducer(historyReducer<T>, { past: [], present: initial, future: [] })
  const latest = useRef(state)
  const send = useCallback((action: HistoryAction<T>) => {
    latest.current = historyReducer(latest.current, action)
    dispatch(action)
  }, [])
  const commit = useCallback((next: T) => send({ type: 'commit', next }), [send])
  const reset = useCallback((present: T) => send({ type: 'reset', present }), [send])
  const undo = useCallback((): T | null => {
    if (!latest.current.past.length) return null
    send({type:'undo'})
    return latest.current.present
  }, [send])
  const redo = useCallback((): T | null => {
    if (!latest.current.future.length) return null
    send({type:'redo'})
    return latest.current.present
  }, [send])
  return { present: state.present, canUndo: state.past.length > 0, canRedo: state.future.length > 0, commit, undo, redo, reset }
}
