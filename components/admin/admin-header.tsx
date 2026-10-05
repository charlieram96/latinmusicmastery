'use client'

import { AdminText } from '@/components/admin/admin-text'


import { AdminMobileSidebar } from './admin-mobile-sidebar'
import { LanguageToggle } from '@/components/language-toggle'

export function AdminHeader() {
  return (
    <header className="sticky top-0 z-40 md:hidden flex items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 h-14">
      <AdminMobileSidebar />
      <h1 className="font-semibold"><AdminText text={"Admin Panel"} /></h1>
      <LanguageToggle variant="icon" className="ml-auto" />
    </header>
  )
}
