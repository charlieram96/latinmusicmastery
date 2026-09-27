/**
 * Which maestros play a style. `teachers.specialties` is free text ("Son",
 * "Timba.", "Cha cha cha"), so both sides are folded to bare letters and
 * digits before comparing, and a style named after its country ("Son
 * Cubano", "Salsa Cubana") also matches its bare genre ("Son", "Salsa").
 */

/** Lowercase, strip accents, drop everything that isn't a letter or digit. */
export function normalizeName(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

const COUNTRY_WORD = /^(cuban[oa]|puertorrique[nñ][oa]|dominican[oa]|colombian[oa])$/i

/** The normalized style name, plus the name without a trailing country adjective. */
export function styleNameVariants(name: string): string[] {
  const out = [normalizeName(name)]
  const words = name.trim().split(/\s+/)
  const last = words[words.length - 1]?.normalize('NFD').replace(/[̀-ͯ]/g, '') ?? ''
  if (words.length > 1 && COUNTRY_WORD.test(last)) out.push(normalizeName(words.slice(0, -1).join(' ')))
  return out
}

/** Teachers whose specialties name the style (whole-name match, not prefix). */
export function teachersForStyle<T extends { specialties: string[] }>(teachers: T[], styleName: string): T[] {
  const variants = new Set(styleNameVariants(styleName))
  return teachers.filter(t => t.specialties.some(s => variants.has(normalizeName(s))))
}

/** Find a teacher by display name (used when `courses.teacher_id` is empty but `teacher_name` is set). */
export function findTeacherByName<T extends { name: string }>(teachers: T[], name: string | null | undefined): T | null {
  if (!name) return null
  const want = normalizeName(name)
  if (!want) return null
  return teachers.find(t => normalizeName(t.name) === want) ?? null
}
