'use client'

import { ReactNode } from 'react'

interface DashboardLayoutClientProps {
  children: ReactNode
  sidebar: ReactNode
  header: ReactNode
}

export function DashboardLayoutClient({ children, sidebar, header }: DashboardLayoutClientProps) {
  return (
    <div className="min-h-screen w-full">
      {sidebar}

      <div className="flex flex-col min-h-screen md:ml-16">
        {header}

        <main className="flex-1 overflow-y-auto pt-14">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
