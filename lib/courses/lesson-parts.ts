// Lesson parts (the class items of one lesson) as the lesson top bar shows them. Pure.

import type { CompletionStatus } from './lesson-completion'

export type PartKind = 'video' | 'play' | 'quiz' | 'other'

const KIND: Record<string, PartKind> = { VIDEO: 'video', EXERCISE: 'play', JAM_SESSION: 'play', QUIZ: 'quiz' }

export function partKind(itemType: string): PartKind {
  return KIND[itemType] ?? 'other'
}

const TYPE_LABEL_KEY: Record<string, string> = {
  VIDEO: 'dashboard.classViewer.itemTypes.lesson',
  QUIZ: 'dashboard.pages.modules.quiz',
  EXERCISE: 'dashboard.pages.modules.exercise',
  JAM_SESSION: 'dashboard.classViewer.itemTypes.jamSession',
}

/** Friendly labels, numbering repeated types (Exercise 1, Exercise 2…). */
export function partLabels(items: { item_type: string }[], t: (key: string) => string): string[] {
  const counts: Record<string, number> = {}
  const totals: Record<string, number> = {}
  for (const it of items) totals[it.item_type] = (totals[it.item_type] ?? 0) + 1
  return items.map((it) => {
    const key = TYPE_LABEL_KEY[it.item_type]
    const base = key ? t(key) : it.item_type
    counts[it.item_type] = (counts[it.item_type] ?? 0) + 1
    return totals[it.item_type] > 1 ? `${base} ${counts[it.item_type]}` : base
  })
}

/** Width (%) of a part's progress underline. Only whole activities are known, so it moves in steps. */
export function partProgress(state: 'done' | 'active' | 'todo', status?: CompletionStatus): number {
  if (state === 'done') return 100
  if (state === 'todo') return 0
  return status && status !== 'complete' ? 50 : 12
}
