'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export const SIDEBAR_COOKIE = 'sidebar_state'

interface SidebarState {
  /** The rail stays expanded (248px) and the page gutter widens to match. */
  pinned: boolean
  setPinned: (pinned: boolean) => void
  /** The phone navigation sheet is open. */
  mobileOpen: boolean
  setMobileOpen: (open: boolean) => void
}

const SidebarStateContext = createContext<SidebarState>({
  pinned: false,
  setPinned: () => {},
  mobileOpen: false,
  setMobileOpen: () => {},
})

export function SidebarStateProvider({
  defaultPinned = false,
  children,
}: {
  defaultPinned?: boolean
  children: ReactNode
}) {
  const [pinned, setPinnedState] = useState(defaultPinned)
  const [mobileOpen, setMobileOpen] = useState(false)

  const setPinned = useCallback((next: boolean) => {
    setPinnedState(next)
    document.cookie = `${SIDEBAR_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
  }, [])

  const value = useMemo(
    () => ({ pinned, setPinned, mobileOpen, setMobileOpen }),
    [pinned, setPinned, mobileOpen]
  )

  return <SidebarStateContext.Provider value={value}>{children}</SidebarStateContext.Provider>
}

export function useSidebarState() {
  return useContext(SidebarStateContext)
}
