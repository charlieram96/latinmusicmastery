import type { Locale } from './index'

type Document = Record<string, unknown>
/** Keep language variants together in the existing rich_content JSON column. */
export function localizedRichContent(value: Document | null, locale: Locale): Document | null {
  if (!value) return null
  if (locale === 'en') return value
  const translations = value.translations as Partial<Record<Locale, Document>> | undefined
  return translations?.[locale] ?? null
}

export function withRichContentTranslation(value: Document | null, locale: Locale, document: Document): Document {
  const translations = (value?.translations ?? {}) as Partial<Record<Locale, Document>>
  if (locale === 'en') return { ...document, translations }
  return { ...(value ?? { type: 'doc', content: [] }), translations: { ...translations, [locale]: document } }
}
