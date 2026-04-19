import { cookies } from 'next/headers'
import { DEFAULT_LOCALE, LANGUAGE_COOKIE, isLocale, getTranslation, type Locale } from './index'

export async function getServerLocale(): Promise<Locale> {
  const store = await cookies()
  const value = store.get(LANGUAGE_COOKIE)?.value
  return isLocale(value) ? value : DEFAULT_LOCALE
}

export async function getServerTranslator() {
  const locale = await getServerLocale()
  return {
    locale,
    t: (key: string, params?: Record<string, string | number>) => getTranslation(locale, key, params),
  }
}
