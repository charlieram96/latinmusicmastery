// What the lesson's bottom bar says and where its main action goes. Shared by
// the legacy LessonFooter and the lesson-mode action bar. Pure.

import type { ItemCompletion } from './lesson-completion'

export interface LessonProgressInput {
  courseId: string
  classId: string
  currentIndex: number
  totalItems: number
  itemIds: string[]
  completedItemIds: string[]
  nextClassId: string | null
  activeItemId: string | null
  activeItemType: string | null
  isCompleted: boolean
  nextLabel?: string | null
}

export type LessonProgressLabel =
  | 'lessonComplete' | 'videoComplete' | 'quizComplete' | 'exerciseComplete' | 'jamComplete' | 'partComplete'
  | 'savingProgress' | 'saveFailed' | 'practiceComplete' | 'questionsComplete' | 'inProgress'

export interface LessonProgressSummary {
  label: LessonProgressLabel
  /** Key under dashboard.classViewer.footer, with its params. */
  detail: { key: string; params?: Record<string, string | number> }
  done: boolean
  lessonDone: boolean
  saving: boolean
  error: boolean
  completedCount: number
  hasNextPart: boolean
  prevHref: string | null
  nextHref: string
  next: 'part' | 'lesson' | 'course'
}

const COMPLETED_LABELS: Record<string, LessonProgressLabel> = {
  VIDEO: 'videoComplete', QUIZ: 'quizComplete', EXERCISE: 'exerciseComplete', JAM_SESSION: 'jamComplete',
}

/** `live` is the progress context: completions and the active item's save state this visit. */
export function summarizeLessonProgress(input: LessonProgressInput, live: { completedItemIds?: string[]; item?: ItemCompletion }): LessonProgressSummary {
  const { courseId, classId, currentIndex, totalItems, itemIds, nextClassId, activeItemId, activeItemType, isCompleted, nextLabel } = input
  const state = live.item
  const completed = (live.completedItemIds ?? input.completedItemIds).filter(id => itemIds.includes(id))
  const done = isCompleted || (!!activeItemId && completed.includes(activeItemId))
  const lessonDone = totalItems > 0 && completed.length === totalItems
  const saving = !done && state?.status === 'saving'
  const error = !done && state?.status === 'error'
  const partial = !done && !saving && !error && !!state?.activities.length
  const hasNextPart = currentIndex < totalItems - 1
  const lessonHref = `/dashboard/course/${courseId}/class/${classId}`
  const prevHref = currentIndex > 0 ? `${lessonHref}?item=${currentIndex - 1}` : null
  const next = hasNextPart ? 'part' : nextClassId ? 'lesson' : 'course'
  const nextHref = next === 'part' ? `${lessonHref}?item=${currentIndex + 1}`
    : next === 'lesson' ? `/dashboard/course/${courseId}/class/${nextClassId}` : `/dashboard/course/${courseId}`
  const performed = !!state?.activities.includes('performance')
  const label: LessonProgressLabel = lessonDone ? 'lessonComplete'
    : done ? COMPLETED_LABELS[activeItemType ?? ''] ?? 'partComplete'
      : saving ? 'savingProgress' : error ? 'saveFailed'
        : partial ? performed ? 'practiceComplete' : 'questionsComplete'
          : 'inProgress'
  const detail: LessonProgressSummary['detail'] = partial
    ? { key: performed ? 'finishQuestions' : 'finishPractice' }
    : done && next !== 'course'
      ? nextLabel ? { key: 'upNext', params: { title: nextLabel } } : { key: 'readyToContinue' }
      : { key: 'partsCompleted', params: { count: completed.length, total: totalItems } }
  return { label, detail, done, lessonDone, saving, error, completedCount: completed.length, hasNextPart, prevHref, nextHref, next }
}
