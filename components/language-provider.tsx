'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import {
  DEFAULT_LOCALE,
  LANGUAGE_COOKIE,
  LANGUAGE_STORAGE_KEY,
  LOCALES,
  type Locale,
  getTranslation,
  isLocale,
} from '@/lib/i18n'
import { createClient } from '@/lib/supabase/client'

interface LanguageContextValue {
  locale: Locale
  setLocale: (next: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
  locales: Locale[]
}

const LanguageContext = createContext<LanguageContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key) => key,
  locales: LOCALES,
})

interface LanguageProviderProps {
  initialLocale?: Locale
  children: React.ReactNode
}

function writeCookie(value: Locale) {
  if (typeof document === 'undefined') return
  const oneYear = 60 * 60 * 24 * 365
  document.cookie = `${LANGUAGE_COOKIE}=${value}; path=/; max-age=${oneYear}; SameSite=Lax`
}

export function LanguageProvider({ initialLocale, children }: LanguageProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE)

  useEffect(() => {
    let cancelled = false

    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(LANGUAGE_STORAGE_KEY) : null
    if (isLocale(stored)) {
      if (stored !== locale) {
        setLocaleState(stored)
        writeCookie(stored)
      }
      return () => {
        cancelled = true
      }
    }

    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return
      const pref = data.user?.user_metadata?.preferred_language
      if (isLocale(pref) && pref !== locale) {
        setLocaleState(pref)
        writeCookie(pref)
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, pref)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale
    }
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    if (!isLocale(next)) return
    setLocaleState(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next)
      writeCookie(next)
    }
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase.auth.updateUser({ data: { preferred_language: next } }).catch(() => {})
      }
    })
  }, [])

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => getTranslation(locale, key, params),
    [locale]
  )

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t, locales: LOCALES }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useTranslation() {
  return useContext(LanguageContext)
}
