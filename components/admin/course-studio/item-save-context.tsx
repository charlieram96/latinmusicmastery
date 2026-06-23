'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

interface ItemSaveValue {
  /** True when any registered editor has unsaved/in-flight local edits. */
  dirty: boolean
  /** Report a named editor's dirty state (e.g. 'fields', 'quiz'). */
  setDirty: (key: string, value: boolean) => void
  /** Register a flush callback; returns an unregister function. */
  registerFlush: (fn: () => void) => () => void
  /** Fire every registered flush immediately (Save button). */
  flushAll: () => void
}

const ItemSaveContext = createContext<ItemSaveValue | null>(null)

/** Scopes "unsaved changes" + manual-save across the parts of a single item
    editor (its fields and the nested quiz editor), independent of the global
    save-status indicator. */
export function ItemSaveProvider({ children }: { children: ReactNode }) {
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set())
  const flushes = useRef<Set<() => void>>(new Set())

  const setDirty = useCallback((key: string, value: boolean) => {
    setDirtyKeys((prev) => {
      if (value === prev.has(key)) return prev
      const next = new Set(prev)
      if (value) next.add(key)
      else next.delete(key)
      return next
    })
  }, [])

  const registerFlush = useCallback((fn: () => void) => {
    flushes.current.add(fn)
    return () => {
      flushes.current.delete(fn)
    }
  }, [])

  const flushAll = useCallback(() => {
    flushes.current.forEach((fn) => fn())
  }, [])

  const value = useMemo(
    () => ({ dirty: dirtyKeys.size > 0, setDirty, registerFlush, flushAll }),
    [dirtyKeys, setDirty, registerFlush, flushAll]
  )

  return <ItemSaveContext.Provider value={value}>{children}</ItemSaveContext.Provider>
}

export function useItemSave() {
  const ctx = useContext(ItemSaveContext)
  if (!ctx) throw new Error('useItemSave must be used within an ItemSaveProvider')
  return ctx
}
