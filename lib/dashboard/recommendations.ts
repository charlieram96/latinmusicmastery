/** The fields the recommendation rules need; the page maps DB rows onto this. */
export interface RecCourse {
  id: string
  instrument: string | null
  teacherId: string | null
  teacherName: string | null
  createdAt: string | null
  difficulty: string | null
}

export interface RecContext {
  /** Instruments of the courses the learner is enrolled in. */
  instruments: string[]
  /** Teacher ids of those courses. */
  teacherIds: string[]
  /** One enrolled course title per teacher id, for the "more from {teacher}" reason. */
  enrolledTitlesByTeacherId: Record<string, string>
  /** ISO timestamp used as "now" so the rules are deterministic. */
  now: string
}

export type RecReason =
  | { kind: 'instrument'; instrument: string }
  | { kind: 'teacher'; teacher: string; course: string }
  | { kind: 'new' }
  | { kind: 'popular' }

export type RecFilter = 'all' | 'instrument' | 'teachers' | 'new'

const DAY_MS = 86_400_000

export function isNew(createdAt: string | null, now: string, days = 30): boolean {
  if (!createdAt) return false
  const created = new Date(createdAt).getTime()
  const at = new Date(now).getTime()
  if (Number.isNaN(created) || Number.isNaN(at)) return false
  return at - created <= days * DAY_MS
}

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()

function matchesInstrument(course: RecCourse, ctx: RecContext): boolean {
  const c = norm(course.instrument)
  return c !== '' && ctx.instruments.some((i) => norm(i) === c)
}

function matchesTeacher(course: RecCourse, ctx: RecContext): boolean {
  return !!course.teacherId && ctx.teacherIds.includes(course.teacherId)
}

/** Why a course is being recommended, in priority order: instrument, teacher, recency, popularity. */
export function reasonFor(course: RecCourse, ctx: RecContext): RecReason {
  if (matchesInstrument(course, ctx)) return { kind: 'instrument', instrument: course.instrument as string }
  if (matchesTeacher(course, ctx)) {
    return {
      kind: 'teacher',
      teacher: course.teacherName ?? '',
      course: ctx.enrolledTitlesByTeacherId[course.teacherId as string] ?? '',
    }
  }
  if (isNew(course.createdAt, ctx.now)) return { kind: 'new' }
  return { kind: 'popular' }
}

export function filterRecommended<T extends RecCourse>(list: T[], filter: RecFilter, ctx: RecContext): T[] {
  switch (filter) {
    case 'instrument':
      return list.filter((c) => matchesInstrument(c, ctx))
    case 'teachers':
      return list.filter((c) => matchesTeacher(c, ctx))
    case 'new':
      return list.filter((c) => isNew(c.createdAt, ctx.now))
    default:
      return list
  }
}
