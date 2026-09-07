'use client'

import { ReactNode } from 'react'

interface DashboardLayoutClientProps {
  children: ReactNode
  sidebar: ReactNode
  header: ReactNode
  mobileNav?: ReactNode
}

/**
 * Shell: fixed 64px rail on the left (it overlays the page when it expands),
 * fixed header on top, and a scrolling main region. `main` is the scroll
 * container on purpose: lesson pages rely on `sticky top-0` inside it.
 */
export function DashboardLayoutClient({ children, sidebar, header, mobileNav }: DashboardLayoutClientProps) {
  return (
    <div className="h-screen w-full overflow-hidden bg-background">
      {sidebar}

      <div className="flex h-screen flex-col md:ml-16">
        {header}

        <main className="flex-1 overflow-y-auto pt-[var(--header-h)]">
          <div className="p-6 pb-24 md:pb-6">{children}</div>
        </main>
      </div>

      {mobileNav}
    </div>
  )
}
