'use client'

import { ReactNode } from 'react'
import { useSidebarState } from './sidebar-state'

interface DashboardLayoutClientProps {
  children: ReactNode
  sidebar: ReactNode
  header: ReactNode
  mobileNav?: ReactNode
}

/**
 * Shell: fixed rail on the left (64px, or 248px when pinned), fixed header on
 * top, and a scrolling main region. `main` is the scroll container on purpose:
 * lesson pages rely on `sticky top-0` inside it.
 */
export function DashboardLayoutClient({ children, sidebar, header, mobileNav }: DashboardLayoutClientProps) {
  const { pinned } = useSidebarState()

  return (
    <div data-pinned={pinned} className="group/shell h-screen w-full overflow-hidden bg-background">
      {sidebar}

      <div className="flex h-screen flex-col transition-[margin] duration-200 ease-out md:ml-16 group-data-[pinned=true]/shell:md:ml-[248px]">
        {header}

        <main className="flex-1 overflow-y-auto pt-[var(--header-h)]">
          <div className="p-6 pb-24 md:pb-6">{children}</div>
        </main>
      </div>

      {mobileNav}
    </div>
  )
}
