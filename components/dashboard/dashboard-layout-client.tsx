'use client'

import { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { isLessonModePath } from '@/lib/dashboard/lesson-mode'

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
 *
 * Lessons are the exception: they take the whole screen with their own rail,
 * top bar and scroll container, so the dashboard chrome steps aside there.
 */
export function DashboardLayoutClient({ children, sidebar, header, mobileNav }: DashboardLayoutClientProps) {
  const lessonMode = isLessonModePath(usePathname())

  if (lessonMode) {
    return (
      <div data-dashboard-shell data-lesson-mode className="h-dvh w-full overflow-hidden bg-background">
        {children}
      </div>
    )
  }

  return (
    <div data-dashboard-shell className="h-screen w-full overflow-hidden bg-background">
      <div data-dashboard-navigation>{sidebar}</div>

      <div data-dashboard-frame className="flex h-screen flex-col md:ml-16">
        <div data-dashboard-header>{header}</div>

        <main data-dashboard-main className="flex-1 overflow-y-auto pt-[var(--header-h)]">
          <div data-dashboard-content className="p-6 pb-24 md:pb-6">{children}</div>
        </main>
      </div>

      <div data-dashboard-navigation>{mobileNav}</div>
    </div>
  )
}
