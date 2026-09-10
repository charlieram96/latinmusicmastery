'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { markClassItemComplete } from '@/app/actions/progress'
import { finishLessonActivity, type ItemCompletion, type LessonActivity } from '@/lib/courses/lesson-completion'

interface LessonProgress {
  completedItemIds: string[]
  items: Record<string, ItemCompletion>
  finishActivity: (id: string, activity: LessonActivity, required: readonly LessonActivity[]) => void
  retry: (id: string) => void
}
const ProgressContext = createContext<LessonProgress | null>(null)
const ActivityContext = createContext<((activity: LessonActivity) => void) | null>(null)

export function LessonProgressProvider({ itemIds, initialCompletedItemIds, children, saveCompletion = markClassItemComplete }: {
  itemIds: string[]
  initialCompletedItemIds: string[]
  children: ReactNode
  /** Also supports a local preview that never writes student progress. */
  saveCompletion?: typeof markClassItemComplete
}) {
  const [items, setItems] = useState<Record<string, ItemCompletion>>({})
  const itemsRef = useRef(items)
  const completedItemIds = useMemo(() => itemIds.filter(id => initialCompletedItemIds.includes(id) || items[id]?.status === 'complete'), [itemIds, initialCompletedItemIds, items])
  const update = useCallback((id: string, next: ItemCompletion) => {
    itemsRef.current = { ...itemsRef.current, [id]: next }
    setItems(itemsRef.current)
  }, [])

  const save = useCallback(async (id: string) => {
    try {
      const result = await saveCompletion(id)
      update(id, { ...itemsRef.current[id], status: result.error ? 'error' : 'complete' })
    } catch {
      update(id, { ...itemsRef.current[id], status: 'error' })
    }
  }, [saveCompletion, update])

  const finishActivity = useCallback((id: string, activity: LessonActivity, required: readonly LessonActivity[]) => {
    if (!itemIds.includes(id) || completedItemIds.includes(id)) return
    const previous = itemsRef.current[id]
    const next = finishLessonActivity(previous, activity, required)
    if (!next || next === previous) return
    update(id, next)
    if (next.status === 'saving') void save(id)
  }, [itemIds, completedItemIds, save, update])

  const retry = useCallback((id: string) => {
    const current = itemsRef.current[id]
    if (current?.status !== 'error' || !itemIds.includes(id)) return
    update(id, { ...current, status: 'saving' })
    void save(id)
  }, [itemIds, save, update])

  return <ProgressContext.Provider value={{ completedItemIds, items, finishActivity, retry }}>{children}</ProgressContext.Provider>
}

export function useLessonProgress() { return useContext(ProgressContext) }

/** Native media end events stay scoped to this item, including the RSC body slot. */
export function LessonActivityBoundary({ classItemId, required, disabled = false, children }: {
  classItemId: string
  required: LessonActivity[]
  disabled?: boolean
  children: ReactNode
}) {
  const progress = useLessonProgress()
  const finishActivity = progress?.finishActivity
  const finish = useCallback((activity: LessonActivity) => {
    if (!disabled) finishActivity?.(classItemId, activity, required)
  }, [classItemId, required, disabled, finishActivity])
  return <ActivityContext.Provider value={finish}>
    <div className="space-y-6" onEndedCapture={event => {
      if (event.target instanceof HTMLMediaElement && !event.target.loop) finish('media')
    }}>{children}</div>
  </ActivityContext.Provider>
}

/** Outside a course (practice and visual previews), completion is a no-op. */
export function useLessonActivity(activity: LessonActivity) {
  const finish = useContext(ActivityContext)
  return useCallback(() => finish?.(activity), [finish, activity])
}
