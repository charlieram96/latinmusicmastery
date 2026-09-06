'use client'

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

interface ThemeContextType {
  /** The stored preference. */
  theme: Theme
  /** What is actually applied right now (system resolved to light or dark). */
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
  /** Cycles light → dark → system → light. */
  toggleTheme: () => void
  mounted: boolean
}

const STORAGE_KEY = 'theme'
const CHANGE_EVENT = 'lmm-theme-change'
const DEFAULT_THEME: Theme = 'dark'
const MEDIA_QUERY = '(prefers-color-scheme: dark)'

const ThemeContext = createContext<ThemeContextType>({
  theme: DEFAULT_THEME,
  resolvedTheme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
  mounted: false,
})

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system'
}

function readStoredTheme(): Theme {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return isTheme(saved) ? saved : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

function resolve(theme: Theme): ResolvedTheme {
  if (theme !== 'system') return theme
  return window.matchMedia(MEDIA_QUERY).matches ? 'dark' : 'light'
}

/* The preference lives in localStorage; the OS preference lives in matchMedia.
   Both are external systems, so they are read through useSyncExternalStore and
   the only effect below writes to the DOM. */
function subscribe(callback: () => void) {
  const media = window.matchMedia(MEDIA_QUERY)
  window.addEventListener('storage', callback)
  window.addEventListener(CHANGE_EVENT, callback)
  media.addEventListener('change', callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(CHANGE_EVENT, callback)
    media.removeEventListener('change', callback)
  }
}
const getThemeSnapshot = () => readStoredTheme()
const getResolvedSnapshot = () => resolve(readStoredTheme())
const getServerTheme = (): Theme => DEFAULT_THEME
const getServerResolved = (): ResolvedTheme => 'dark'
const subscribeNever = () => () => {}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getThemeSnapshot, getServerTheme)
  const resolvedTheme = useSyncExternalStore(subscribe, getResolvedSnapshot, getServerResolved)
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false)

  // Keep the document in sync with the resolved theme. The inline script in
  // app/layout.tsx has already applied it before paint, so this never flashes.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
    document.documentElement.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  const setTheme = useCallback((next: Theme) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* private mode: the in-memory snapshot still updates via the event */
    }
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [])

  const toggleTheme = useCallback(() => {
    const current = readStoredTheme()
    setTheme(current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light')
  }, [setTheme])

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme, mounted }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

/** Inline, dependency-free script that applies the stored theme before hydration. */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem('${STORAGE_KEY}');var d=t===null?true:t==='dark'||(t==='system'&&window.matchMedia('${MEDIA_QUERY}').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light'}catch(e){}`
