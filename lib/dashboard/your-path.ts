// The dashboard's "Your path" card: a short window of the lesson path around
// the lesson the learner is on. Pure, so it is unit-testable; it reuses the
// rows app/dashboard/page.tsx already loads for the Continue card.

import { buildPathNodes, pathWindow, type PathItem } from '@/lib/courses/path-nodes'
import { byOrder, courseHref } from './course-progress'

export interface YourPathItemRow {
  id: string
  order_index?: number | null
  item_type?: string | null
  video_duration_seconds: number | null
}
export interface YourPathClassRow {
  id: string
  title: string
  order_index: number | null
  items: YourPathItemRow[] | null
}
export interface YourPathSectionRow {
  id: string
  title?: string | null
  order_index: number | null
  classes: YourPathClassRow[] | null
}

export interface YourPath {
  courseHref: string
  /** 1-based module holding the current lesson (or the last lesson, once finished). */
  moduleNumber: number
  moduleTitle: string
  /** Desktop slice: 2 before, current, 3 after, a "N more" gap, the module checkpoint. */
  items: PathItem[]
  /**
   * Phone slice, 5 slots: 1 before, current, 2 after and the checkpoint; when
   * lessons would be skipped, 1 after, a "N more" gap and the checkpoint.
   */
  phoneItems: PathItem[]
}

const withOrder = <T extends { order_index?: number | null }>(row: T) => ({ ...row, order_index: row.order_index ?? null })

export function yourPathFor(
  course: { id: string; slug: string | null; course_sections: YourPathSectionRow[] | null },
  completed: Set<string>,
  currentClassId: string | null
): YourPath | null {
  const sections = [...(course.course_sections ?? [])].sort(byOrder).map((s) => ({
    id: s.id,
    title: s.title ?? '',
    classes: [...(s.classes ?? [])].sort(byOrder).map((c) => {
      const items = (c.items ?? []).map(withOrder).sort(byOrder)
      return {
        id: c.id,
        title: c.title,
        totalItems: items.length,
        completedItems: items.filter((it) => completed.has(it.id)).length,
        items: items.map((it) => ({ item_type: it.item_type ?? '', video_duration_seconds: it.video_duration_seconds })),
      }
    }),
  }))

  const nodes = buildPathNodes(course.slug || course.id, sections, currentClassId)
  if (!nodes.some((n) => n.kind === 'lesson')) return null

  const items = pathWindow(nodes, { before: 2, after: 3 })
  const phoneWide = pathWindow(nodes, { before: 1, after: 2 })
  // Narrow only when the wide slice overflows the 5 phone slots.
  const phoneItems = phoneWide.length > 5 ? pathWindow(nodes, { before: 1, after: 1 }) : phoneWide
  const lessons = items.filter((i) => i.kind === 'lesson')
  const anchor = lessons.find((i) => i.state === 'current') ?? lessons[lessons.length - 1]
  const moduleIndex = anchor && anchor.kind === 'lesson' ? anchor.moduleIndex : 0

  return {
    courseHref: courseHref(course),
    moduleNumber: moduleIndex + 1,
    moduleTitle: sections[moduleIndex]?.title ?? '',
    items,
    phoneItems,
  }
}
