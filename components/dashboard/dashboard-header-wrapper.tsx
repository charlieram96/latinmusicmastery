'use client'

import { ReactNode } from 'react'

interface DashboardHeaderWrapperProps {
  children: ReactNode
}

/** Fixed header; its left edge sits at the 64px rail on desktop. */
export function DashboardHeaderWrapper({ children }: DashboardHeaderWrapperProps) {
  return (
    <header className="fixed left-0 right-0 top-0 z-40 h-[var(--header-h)] border-b border-border bg-background/80 backdrop-blur-xl md:left-16">
      {children}
    </header>
  )
}
