/**
 * Helpers for authoring `quiz_questions.options_es`.
 *
 * `options_es` mirrors the English `options` JSON list-by-list, keyed by the SAME
 * entry ids, and carries only translated strings (choice text, pair sides, item
 * text, blank answers, piece labels). Ids must never differ from the English
 * side: `correct_answer` and student answers are English ids, and the read-side
 * overlay (`mergeLocalizedOptions` in lib/i18n/localize.ts) matches entries by
 * id. These helpers keep that invariant for the admin builder.
 */

export type LocalizedOptions = Record<string, unknown> | null | undefined
type Entry = Record<string, unknown> & { id: string }

function listOf(es: LocalizedOptions, key: string): Entry[] {
  const value = es?.[key]
  if (!Array.isArray(value)) return []
  return value.filter(
    (e): e is Entry => !!e && typeof e === 'object' && typeof (e as Entry).id === 'string'
  )
}

/** Upsert the translated fields of one entry (by English id) in `options_es[key]`. */
export function patchLocalizedEntry(
  es: LocalizedOptions,
  key: string,
  id: string,
  patch: Record<string, string>
): Record<string, unknown> {
  const fields: Record<string, string> = { ...patch }
  delete fields.id
  const list = listOf(es, key)
  const exists = list.some((e) => e.id === id)
  const next = exists
    ? list.map((e) => (e.id === id ? { ...e, ...fields } : e))
    : [...list, { id, ...fields }]
  return { ...(es ?? {}), [key]: next }
}

/** Drop Spanish entries whose id no longer exists on the English side. */
export function pruneLocalizedEntries(
  es: LocalizedOptions,
  key: string,
  keepIds: readonly string[]
): Record<string, unknown> | null {
  const list = listOf(es, key)
  if (!es || list.length === 0) return es ?? null
  const keep = new Set(keepIds)
  const next = list.filter((e) => keep.has(e.id))
  if (next.length === list.length) return es
  return { ...es, [key]: next }
}

/** Read one translated string, defaulting to '' when absent. */
export function readLocalizedField(es: LocalizedOptions, key: string, id: string, field: string): string {
  const entry = listOf(es, key).find((e) => e.id === id)
  const value = entry?.[field]
  return typeof value === 'string' ? value : ''
}
