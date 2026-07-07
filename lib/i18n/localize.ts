import type { Locale } from '@/lib/i18n'

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
  for (const f of fields) {
    const es = (row as Record<string, unknown>)[`${f}_es`]
    if (hasValue(es)) (row as Record<string, unknown>)[f] = es
  }
  return row
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
// generic copy picks up `options_es` (parallel JSON with Spanish answer text).
export const COURSE_FIELDS = ['title', 'description'] as const
export const SECTION_FIELDS = ['title', 'description'] as const
export const CLASS_FIELDS = ['title', 'description'] as const
// NOTE: never add subtitle fields here — subtitles_en_url/subtitles_es_url are
// not a base/_es overlay pair; the players need both languages simultaneously.
export const ITEM_FIELDS = ['title', 'description', 'question', 'explanation', 'options'] as const
export const QUIZ_FIELDS = ['question', 'explanation', 'options'] as const
export const STYLE_FIELDS = ['name', 'description'] as const
export const COUNTRY_FIELDS = ['name', 'description'] as const
export const SONG_FIELDS = ['title'] as const

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
  return course
}
