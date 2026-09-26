/**
 * Course position and completion, shared by the home page and My Courses so
 * both screens report the same lesson, module and percentage for a course.
 *
 * Vocabulary: a course has sections (shown as "modules"), each section has
 * classes (shown as "lessons"), each class has items. Progress rows are per item.
 */

export interface ItemLike {
  id: string
}
export interface ClassLike {
  id: string
  title: string
  order_index: number | null
  items: ItemLike[] | null
}
export interface SectionLike<C extends ClassLike = ClassLike> {
  order_index: number | null
  classes: C[] | null
}
export interface ProgressLike {
  class_item_id: string
  completed?: boolean | null
  updated_at?: string | null
  created_at?: string | null
}

export const byOrder = <T extends { order_index: number | null }>(a: T, b: T) =>
  (a.order_index ?? 0) - (b.order_index ?? 0)

/** Classes of a course in section/class order, each with its items. */
export function orderedClasses<C extends ClassLike>(sections: SectionLike<C>[] | null | undefined): C[] {
  return [...(sections ?? [])].sort(byOrder).flatMap((s) => [...(s.classes ?? [])].sort(byOrder))
}

/** Ids of the items marked complete. */
export function completedItemIds(progress: ProgressLike[]): Set<string> {
  return new Set(progress.filter((p) => p.completed).map((p) => p.class_item_id))
}

/** A class counts as done only when it has items and every item is complete. */
export function classIsDone(cls: ClassLike, completed: Set<string>): boolean {
  const items = cls.items ?? []
  return items.length > 0 && items.every((it) => completed.has(it.id))
}

/** When a progress row was last touched, for "most recent" ordering. */
export const progressTime = (p: ProgressLike) => new Date(p.updated_at ?? p.created_at ?? 0).getTime()

/**
 * The class the learner is "on": the one holding their most recent progress row,
 * or the next unfinished class when that one is complete. `null` when the course
 * has no progress at all, or when every class with items is done.
 */
export function currentClassIndexFor(
  classes: ClassLike[],
  progress: ProgressLike[],
  completed: Set<string>
): number | null {
  const itemToIndex = new Map<string, number>()
  classes.forEach((c, i) => (c.items ?? []).forEach((it) => itemToIndex.set(it.id, i)))
  const latest = progress
    .filter((p) => itemToIndex.has(p.class_item_id))
    .sort((a, b) => progressTime(b) - progressTime(a))[0]
  if (!latest) return null
  const idx = itemToIndex.get(latest.class_item_id) ?? 0
  if (!classIsDone(classes[idx], completed)) return idx
  // A class with no items yet is never "open": it can't be finished, so it never
  // becomes the current lesson (the course page's nextClassId skips it the same way).
  const open = (c: ClassLike) => (c.items?.length ?? 0) > 0 && !classIsDone(c, completed)
  const next = classes.findIndex((c, i) => i > idx && open(c))
  if (next !== -1) return next
  const anyOpen = classes.findIndex(open)
  return anyOpen === -1 ? null : anyOpen
}

/** 1-based index of the section that holds the class at `classIndex` (in ordered-class numbering). */
export function moduleIndexForClass(sections: SectionLike[] | null | undefined, classIndex: number): number | null {
  let seen = 0
  const ordered = [...(sections ?? [])].sort(byOrder)
  for (let s = 0; s < ordered.length; s++) {
    const count = (ordered[s].classes ?? []).length
    if (classIndex < seen + count) return s + 1
    seen += count
  }
  return null
}

export interface CourseCompletion {
  totalItems: number
  doneItems: number
  totalClasses: number
  doneClasses: number
  /** Whole percent of items complete; 0 for a course with no items. */
  pct: number
  status: 'not-started' | 'in-progress' | 'completed'
}

export function courseCompletion(classes: ClassLike[], completed: Set<string>): CourseCompletion {
  const items = classes.flatMap((c) => c.items ?? [])
  const doneItems = items.filter((it) => completed.has(it.id)).length
  const doneClasses = classes.filter((c) => classIsDone(c, completed)).length
  const pct = items.length > 0 ? Math.round((doneItems / items.length) * 100) : 0
  const status: CourseCompletion['status'] =
    items.length > 0 && doneItems === items.length ? 'completed' : doneItems > 0 ? 'in-progress' : 'not-started'
  return { totalItems: items.length, doneItems, totalClasses: classes.length, doneClasses, pct, status }
}

export function courseHref(course: { slug: string | null; id: string }): string {
  return `/dashboard/course/${course.slug || course.id}`
}

export function classHref(course: { slug: string | null; id: string }, classId: string): string {
  return `${courseHref(course)}/class/${classId}`
}
