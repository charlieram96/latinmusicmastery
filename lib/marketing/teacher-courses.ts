const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const isUuid = (v: string): boolean => UUID_RE.test(v)

type Orderable = { id: string; order_index: number | null; title: string }

/**
 * A teacher's courses come from two links: `courses.teacher_id` and the older
 * free-text `courses.teacher_name`. Merge both, once each, in catalog order.
 */
export function mergeTeacherCourses<T extends Orderable>(...lists: (readonly T[] | null | undefined)[]): T[] {
  const byId = new Map<string, T>()
  for (const list of lists) for (const c of list ?? []) if (!byId.has(c.id)) byId.set(c.id, c)
  const rank = (c: T) => c.order_index ?? Number.MAX_SAFE_INTEGER
  return [...byId.values()].sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title))
}
