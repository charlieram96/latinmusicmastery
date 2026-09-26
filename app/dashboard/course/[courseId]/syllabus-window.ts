// Pure helpers for the compact syllabus on the course page.

/**
 * The lessons a module shows while collapsed: the current lesson with `radius`
 * lessons either side, or none when the current lesson is in another module (or
 * nothing is current). At a module edge the window shifts inward so it still
 * shows `2 * radius + 1` rows when the module has that many. `collapsible` says
 * whether any lesson is hidden, so the "Show all" toggle is worth rendering.
 */
export function syllabusWindow(classIds: string[], currentId: string | null, radius = 2) {
  const i = currentId === null ? -1 : classIds.indexOf(currentId)
  const size = 2 * radius + 1
  const start = Math.max(0, Math.min(i - radius, classIds.length - size))
  const visible = i === -1 ? [] : classIds.slice(start, start + size)
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
