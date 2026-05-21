export interface CourseKindInput {
  isFundamentals: boolean
  musicalStyleId: string | null
  instrument: string | null
}

export type CourseKindValidation = { ok: true } | { ok: false; error: string }

/**
 * Enforces the fundamentals/genre invariant:
 * - a fundamentals course is genreless and must name an instrument;
 * - a genre course must have a musical style.
 */
export function validateCourseKind(input: CourseKindInput): CourseKindValidation {
  if (input.isFundamentals) {
    if (input.musicalStyleId) {
      return { ok: false, error: 'A fundamentals course cannot have a genre.' }
    }
    if (!input.instrument) {
      return { ok: false, error: 'A fundamentals course must have an instrument.' }
    }
    return { ok: true }
  }
  if (!input.musicalStyleId) {
    return { ok: false, error: 'A genre course must have a musical style.' }
  }
  return { ok: true }
}
