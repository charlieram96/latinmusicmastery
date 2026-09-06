'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useSidebarState } from './sidebar-state'

interface DashboardHeaderWrapperProps {
  children: ReactNode
}

/** Fixed header. Its left edge follows the rail: 64px, or 248px when the rail is pinned. */
export function DashboardHeaderWrapper({ children }: DashboardHeaderWrapperProps) {
  const { pinned } = useSidebarState()
  return (
    <header
      className={cn(
        'fixed left-0 right-0 top-0 z-40 h-[var(--header-h)] border-b border-border bg-background/80 backdrop-blur-xl transition-[left] duration-200 ease-out',
        pinned ? 'md:left-[248px]' : 'md:left-16'
      )}
    >
      {children}
    </header>
  )
}
