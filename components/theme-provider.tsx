'use client'

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  mounted: boolean
}

const STORAGE_KEY = 'theme'
const CHANGE_EVENT = 'lmm-theme-change'
const DEFAULT_THEME: Theme = 'dark'

const ThemeContext = createContext<ThemeContextType>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  toggleTheme: () => {},
  mounted: false,
})

/** Anything other than an explicit "light" is dark (the app default). */
function readStoredTheme(): Theme {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

/* The preference lives in localStorage, an external system, so it is read
   through useSyncExternalStore and the only effect below writes to the DOM. */
function subscribe(callback: () => void) {
  window.addEventListener('storage', callback)
  window.addEventListener(CHANGE_EVENT, callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(CHANGE_EVENT, callback)
  }
}
const getServerTheme = (): Theme => DEFAULT_THEME
const subscribeNever = () => () => {}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, readStoredTheme, getServerTheme)
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false)

  // Keep the document in sync. The inline script in app/layout.tsx has already
  // applied the class before paint, so this never flashes.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* private mode: the event still updates the in-memory snapshot */
    }
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(readStoredTheme() === 'light' ? 'dark' : 'light')
  }, [setTheme])

  return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, mounted }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}

/** Inline, dependency-free script that applies the stored theme before hydration. */
export const THEME_INIT_SCRIPT = `try{var d=localStorage.getItem('${STORAGE_KEY}')!=='light';document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light'}catch(e){}`
