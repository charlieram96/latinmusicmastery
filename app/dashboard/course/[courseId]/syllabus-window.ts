// Pure helpers for the compact syllabus on the course page.

/**
 * The lessons a module shows while collapsed: the current lesson with `radius`
 * lessons either side (clamped to the module), or none when the current lesson
 * is in another module (or nothing is current). `collapsible` says whether any
 * lesson is hidden, so the "Show all" toggle is worth rendering.
 */
export function syllabusWindow(classIds: string[], currentId: string | null, radius = 2) {
  const i = currentId === null ? -1 : classIds.indexOf(currentId)
  const visible = i === -1 ? [] : classIds.slice(Math.max(0, i - radius), i + radius + 1)
  return { visible, collapsible: visible.length < classIds.length }
}

export type Segment = 'done' | 'current' | 'upcoming'

/** One progress segment per lesson; the current one is filled by its item progress. */
export function lessonSegments(
  classes: { id: string; totalItems: number; completedItems: number }[],
  currentId: string | null
): { state: Segment; fraction: number }[] {
  return classes.map((c) => {
    const done = c.totalItems > 0 && c.completedItems >= c.totalItems
    if (c.id === currentId && !done) {
      return { state: 'current', fraction: c.totalItems > 0 ? c.completedItems / c.totalItems : 0 }
    }
    return done ? { state: 'done', fraction: 1 } : { state: 'upcoming', fraction: 0 }
  })
}
