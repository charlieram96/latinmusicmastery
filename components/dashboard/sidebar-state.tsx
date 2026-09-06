'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

interface SidebarState {
  /** The phone navigation sheet is open. */
  mobileOpen: boolean
  setMobileOpen: (open: boolean) => void
}

const SidebarStateContext = createContext<SidebarState>({
  mobileOpen: false,
  setMobileOpen: () => {},
})

export function SidebarStateProvider({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const value = useMemo(() => ({ mobileOpen, setMobileOpen }), [mobileOpen])
  return <SidebarStateContext.Provider value={value}>{children}</SidebarStateContext.Provider>
}

export function useSidebarState() {
  return useContext(SidebarStateContext)
}
