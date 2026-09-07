// Pure helpers for the student-facing course structure
// (module = course_sections → lesson = classes → class_items).
// No React or Supabase imports so everything here is unit-testable.

export interface LessonSidebarClass {
  id: string
  title: string
  totalItems: number
  completedItems: number
  isFree: boolean
}

export interface LessonSidebarSection {
  id: string
  title: string
  description?: string | null
  totalItems: number
  completedItems: number
  classes: LessonSidebarClass[]
}

export type RowState = 'active' | 'completed' | 'locked' | 'available'

export function moduleOverviewHref(courseId: string, sectionId: string): string {
  return `/dashboard/course/${courseId}/module/${sectionId}`
}

export function classHref(courseId: string, classId: string): string {
  return `/dashboard/course/${courseId}/class/${classId}`
}

/** Visual state of a lesson row. `currentClassId` is null on pages that
    aren't a lesson (e.g. the module overview), so nothing is active there. */
export function classState(
  cls: Pick<LessonSidebarClass, 'id' | 'isFree' | 'totalItems' | 'completedItems'>,
  currentClassId: string | null,
  hasAccess: boolean
): RowState {
  if (currentClassId && cls.id === currentClassId) return 'active'
  if (!cls.isFree && !hasAccess) return 'locked'
  if (cls.totalItems > 0 && cls.completedItems === cls.totalItems) return 'completed'
  return 'available'
}

interface StructureItem {
  item_type: string
  video_duration_seconds: number | null
}

interface StructureClass {
  id: string
  totalItems: number
  completedItems: number
  items?: StructureItem[]
}

/** Total video runtime; non-video items and missing durations count for 0
    (same rule as getCourseStructureForStudent). */
export function videoDurationSeconds(items: StructureItem[] | undefined): number {
  let total = 0
  for (const item of items ?? []) {
    if (item.item_type === 'VIDEO' && item.video_duration_seconds) {
      total += item.video_duration_seconds
    }
  }
  return total
}

export interface ModuleSummary {
  lessonCount: number
  totalItems: number
  completedItems: number
  pct: number
  complete: boolean
  durationSeconds: number
  /** First lesson with unfinished items, or null when the module is done. */
  nextClassId: string | null
}

export function summarizeModule(section: { classes: StructureClass[] }): ModuleSummary {
  let totalItems = 0
  let completedItems = 0
  let durationSeconds = 0
  let nextClassId: string | null = null

  for (const cls of section.classes) {
    totalItems += cls.totalItems
    completedItems += cls.completedItems
    durationSeconds += videoDurationSeconds(cls.items)
    if (!nextClassId && cls.completedItems < cls.totalItems) {
      nextClassId = cls.id
    }
  }

  const pct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

  return {
    lessonCount: section.classes.length,
    totalItems,
    completedItems,
    pct,
    complete: totalItems > 0 && completedItems === totalItems,
    durationSeconds,
    nextClassId,
  }
}

interface StructureSectionInput {
  id: string
  title: string
  description?: string | null
  totalItems: number
  completedItems: number
  classes: {
    id: string
    title: string
    totalItems: number
    completedItems: number
    is_free?: boolean | null
  }[]
}

/** Trim the enriched structure from getCourseStructureForStudent down to what
    the lesson sidebar renders. */
export function toSidebarSections(sections: StructureSectionInput[]): LessonSidebarSection[] {
  return sections.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description ?? null,
    totalItems: s.totalItems,
    completedItems: s.completedItems,
    classes: s.classes.map((c) => ({
      id: c.id,
      title: c.title,
      totalItems: c.totalItems,
      completedItems: c.completedItems,
      isFree: c.is_free ?? false,
    })),
  }))
}

/** "45m", "1h", "1h 30m" — rounds to the nearest minute like the course page. */
export function formatDurationFromSeconds(seconds: number): string {
  const mins = Math.round(seconds / 60)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  const remaining = mins % 60
  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`
}
