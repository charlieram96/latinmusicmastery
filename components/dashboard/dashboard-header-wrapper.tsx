'use client'

import { ReactNode } from 'react'

interface DashboardHeaderWrapperProps {
  children: ReactNode
}

export function DashboardHeaderWrapper({ children }: DashboardHeaderWrapperProps) {
  return (
    <header
      className="fixed top-0 right-0 z-40 border-b border-border bg-background/60 backdrop-blur-xl left-0 md:left-16"
    >
      {children}
    </header>
  )
}
