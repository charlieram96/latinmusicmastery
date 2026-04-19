import enDict from '@/locales/en.json'
import esDict from '@/locales/es.json'

export type Locale = 'en' | 'es'

export const LOCALES: Locale[] = ['en', 'es']
export const DEFAULT_LOCALE: Locale = 'en'
export const LANGUAGE_COOKIE = 'preferred_language'
export const LANGUAGE_STORAGE_KEY = 'preferred_language'

type Dict = Record<string, unknown>

const DICTIONARIES: Record<Locale, Dict> = {
  en: enDict as Dict,
  es: esDict as Dict,
}

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
}

export const LOCALE_SHORT_LABELS: Record<Locale, string> = {
  en: 'EN',
  es: 'ES',
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as string[]).includes(value)
}

function resolve(dict: Dict, key: string): string | undefined {
  const parts = key.split('.')
  let node: unknown = dict
  for (const part of parts) {
    if (node && typeof node === 'object' && part in (node as Dict)) {
      node = (node as Dict)[part]
    } else {
      return undefined
    }
  }
  return typeof node === 'string' ? node : undefined
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name) => {
    const value = params[name]
    return value === undefined || value === null ? match : String(value)
  })
}

export function getTranslation(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>
): string {
  const value = resolve(DICTIONARIES[locale], key) ?? resolve(DICTIONARIES.en, key) ?? key
  return interpolate(value, params)
}
