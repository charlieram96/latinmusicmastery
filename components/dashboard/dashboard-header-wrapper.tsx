'use client'

import { ReactNode } from 'react'
import { useCourseMode } from '@/contexts/course-mode-context'

interface DashboardHeaderWrapperProps {
  children: ReactNode
}

export function DashboardHeaderWrapper({ children }: DashboardHeaderWrapperProps) {
  const { isCourseMode } = useCourseMode()

  return (
    <header
      className={`fixed top-0 right-0 z-40 border-b border-border/50 bg-background/70 backdrop-blur-xl left-0 transition-all duration-300 ease-out ${
        isCourseMode ? 'md:-translate-y-full md:opacity-0' : 'md:left-[240px] md:translate-y-0 md:opacity-100'
      }`}
    >
      {children}
    </header>
  )
}
