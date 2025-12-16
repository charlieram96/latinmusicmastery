'use client'

import { ReactNode } from 'react'
import { useCourseMode } from '@/contexts/course-mode-context'

interface DashboardLayoutClientProps {
  children: ReactNode
  sidebar: ReactNode
  header: ReactNode
}

export function DashboardLayoutClient({ children, sidebar, header }: DashboardLayoutClientProps) {
  const { isCourseMode } = useCourseMode()

  return (
    <div className="min-h-screen w-full">
      {/* Sidebar - hidden in course mode */}
      <div className={`transition-all duration-300 ${isCourseMode ? 'opacity-0 pointer-events-none -translate-x-full' : ''}`}>
        {sidebar}
      </div>

      {/* Main Content Area */}
      <div className={`flex flex-col min-h-screen transition-all duration-300 ${isCourseMode ? 'md:ml-0' : 'md:ml-[240px]'}`}>
        {/* Header */}
        {header}

        {/* Page Content */}
        <main className={`flex-1 overflow-y-auto transition-all duration-300 ${isCourseMode ? 'md:pt-0 pt-[50px]' : 'pt-[50px]'}`}>
          <div className={`p-6 ${isCourseMode ? 'max-w-none' : ''}`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
