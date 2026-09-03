import type { Locale } from '@/lib/i18n'
import { instrumentLabel } from '@/lib/i18n/instruments'

/**
 * Localization for dynamic database content.
 *
 * English columns (`title`, `description`, `name`, …) are the canonical/primary
 * source. Spanish lives in parallel `_es` columns and falls back to English when
 * empty. We localize at the data-fetch boundary: after a row is read we overwrite
 * its base field with the `_es` variant (when locale === 'es' and the variant is
 * present), so the many render sites keep reading `row.title` unchanged.
 */

function hasValue(v: unknown): boolean {
  if (v == null) return false
  if (typeof v === 'string') return v.trim().length > 0
  return true // objects/arrays (e.g. quiz options_es JSON)
}

/** Pick the ES value when present & non-empty, else fall back to English. */
export function pick<T>(locale: Locale, en: T, es: T): T {
  return locale === 'es' && hasValue(es) ? es : en
}

/**
 * Localize a row IN PLACE: for each base field, overwrite it with `${field}_es`
 * when locale === 'es' and that variant is set. No-op for English. Returns the
 * same row for convenience.
 */
export function localizeRow<T extends Record<string, unknown>>(
  row: T | null | undefined,
  locale: Locale,
  fields: readonly string[]
): T | null | undefined {
  if (!row || locale !== 'es') return row
  const r = row as Record<string, unknown>
  for (const f of fields) {
    const es = r[`${f}_es`]
    if (!hasValue(es)) continue
    // Quiz `options` is structured JSON keyed by locale-invariant ids, so it is
    // merged onto the English value rather than swapped (see mergeLocalizedOptions).
    r[f] = f === 'options' ? mergeLocalizedOptions(r[f], es) : es
  }
  return row
}

type PlainObject = Record<string, unknown>

function isPlainObject(v: unknown): v is PlainObject {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Merge a quiz `options_es` JSON onto the English `options` JSON.
 *
 * Choice / pair / blank / item / piece ids are locale-invariant: `correct_answer`
 * and the student's answers are English ids, so the overlay must never replace
 * them. Only non-empty strings are copied from the Spanish side; ids and
 * structural values (correctPosition, placement geometry, booleans, media the
 * Spanish side doesn't provide) stay English. List entries match by id first;
 * when no id lines up at all (a row saved with freshly generated ids) they match
 * by position, and if even the lengths differ the English list is kept.
 *
 * Falls back to the Spanish JSON wholesale only when there is no English object.
 */
export function mergeLocalizedOptions(en: unknown, es: unknown): unknown {
  if (!isPlainObject(en)) return hasValue(es) ? es : en
  if (!isPlainObject(es)) return en
  const out: PlainObject = { ...en }
  for (const [key, esValue] of Object.entries(es)) {
    if (key === 'id') continue
    const enValue = en[key]
    if (Array.isArray(esValue)) {
      if (Array.isArray(enValue)) out[key] = mergeLocalizedList(enValue, esValue)
      else if (enValue === undefined) out[key] = esValue
    } else if (isPlainObject(esValue)) {
      if (isPlainObject(enValue)) out[key] = mergeLocalizedOptions(enValue, esValue)
      else if (enValue === undefined) out[key] = esValue
    } else if (typeof esValue === 'string') {
      if (esValue.trim().length > 0 && (typeof enValue === 'string' || enValue === undefined)) out[key] = esValue
    } else if (enValue === undefined && esValue != null) {
      out[key] = esValue
    }
  }
  return out
}

function mergeLocalizedList(en: unknown[], es: unknown[]): unknown[] {
  const esById = new Map<string, PlainObject>()
  for (const item of es) {
    if (isPlainObject(item) && typeof item.id === 'string') esById.set(item.id, item)
  }
  const anyIdMatches = en.some((item) => isPlainObject(item) && typeof item.id === 'string' && esById.has(item.id))
  if (anyIdMatches) {
    return en.map((item) => {
      if (!isPlainObject(item) || typeof item.id !== 'string') return item
      const match = esById.get(item.id)
      return match ? mergeLocalizedOptions(item, match) : item
    })
  }
  if (en.length !== es.length) return en
  return en.map((item, i) => (isPlainObject(item) && isPlainObject(es[i]) ? mergeLocalizedOptions(item, es[i]) : item))
}

/** Localize an array of rows in place. Tolerates null/undefined. */
export function localizeRows<T extends Record<string, unknown>>(
  rows: T[] | null | undefined,
  locale: Locale,
  fields: readonly string[]
): T[] {
  if (!rows) return []
  if (locale !== 'es') return rows
  for (const row of rows) localizeRow(row, locale, fields)
  return rows
}

// Per-entity localizable field sets. `options` is included for quiz rows so the
// generic copy picks up `options_es` (parallel JSON with Spanish answer text);
// it is merged onto the English JSON, keeping every id, not swapped.
export const COURSE_FIELDS = ['title', 'description'] as const
export const SECTION_FIELDS = ['title', 'description'] as const
export const CLASS_FIELDS = ['title', 'description'] as const
// NOTE: never add `subtitles` here — the jsonb track list is not a base/_es
// overlay pair; the players need every language simultaneously.
export const ITEM_FIELDS = ['title', 'description', 'question', 'explanation', 'options'] as const
export const QUIZ_FIELDS = ['question', 'explanation', 'options'] as const
export const STYLE_FIELDS = ['name', 'description'] as const
export const COUNTRY_FIELDS = ['name', 'description'] as const
export const SONG_FIELDS = ['title'] as const
export const INSTRUMENT_FIELDS = ['name', 'description'] as const
// `bio` is a TipTap JSON document (bio_es likewise); `instrument` is free text.
export const TEACHER_FIELDS = ['bio', 'instrument'] as const

/**
 * Localize a teacher row in place. `bio` and `instrument` use the `_es` overlay;
 * when `instrument_es` is empty we fall back to a token translation of the
 * English label so "Piano, Violin" still reads "Piano, Violín".
 */
export function localizeTeacher<T extends Record<string, unknown>>(
  teacher: T | null | undefined,
  locale: Locale
): T | null | undefined {
  if (!teacher || locale !== 'es') return teacher
  localizeRow(teacher, locale, TEACHER_FIELDS)
  const row = teacher as Record<string, unknown>
  if (!hasValue(row['instrument_es']) && typeof row['instrument'] === 'string') {
    row['instrument'] = instrumentLabel(row['instrument'], locale)
  }
  return teacher
}

export function localizeTeachers<T extends Record<string, unknown>>(
  teachers: T[] | null | undefined,
  locale: Locale
): T[] {
  if (!teachers) return []
  if (locale !== 'es') return teachers
  for (const t of teachers) localizeTeacher(t, locale)
  return teachers
}

/**
 * Localize a nested course tree (sections → classes → items) in place. Handles
 * the common `course_sections` select shape `{ *, classes(*, items:class_items(*)) }`.
 */
export function localizeSectionTree<T extends Record<string, unknown>>(
  sections: T[] | null | undefined,
  locale: Locale
): T[] {
  if (!sections) return []
  if (locale !== 'es') return sections
  for (const section of sections) {
    localizeRow(section, locale, SECTION_FIELDS)
    const classes = section['classes'] as Record<string, unknown>[] | undefined
    if (Array.isArray(classes)) {
      for (const cls of classes) {
        localizeRow(cls, locale, CLASS_FIELDS)
        const items = cls['items'] as Record<string, unknown>[] | undefined
        if (Array.isArray(items)) localizeRows(items, locale, ITEM_FIELDS)
        // some shapes nest as class_items rather than items
        const classItems = cls['class_items'] as Record<string, unknown>[] | undefined
        if (Array.isArray(classItems)) localizeRows(classItems, locale, ITEM_FIELDS)
      }
    }
  }
  return sections
}

/** Localize a course row plus an optionally-joined musical_style/country. */
export function localizeCourse<T extends Record<string, unknown>>(
  course: T | null | undefined,
  locale: Locale
): T | null | undefined {
  if (!course || locale !== 'es') return course
  localizeRow(course, locale, COURSE_FIELDS)
  const style = course['musical_style'] as Record<string, unknown> | undefined
  if (style) {
    localizeRow(style, locale, STYLE_FIELDS)
    const country = style['country'] as Record<string, unknown> | undefined
    if (country) localizeRow(country, locale, COUNTRY_FIELDS)
  }
  const country = course['country'] as Record<string, unknown> | undefined
  if (country) localizeRow(country, locale, COUNTRY_FIELDS)
  // Joined teacher (select shapes use `teacher:teachers(...)` or `teachers(...)`).
  for (const key of ['teacher', 'teachers'] as const) {
    const joined = course[key]
    if (Array.isArray(joined)) localizeTeachers(joined as Record<string, unknown>[], locale)
    else if (joined && typeof joined === 'object') localizeTeacher(joined as Record<string, unknown>, locale)
  }
  return course
}
