'use client'

import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/components/language-provider'
import { useSidebarState } from './sidebar-state'

export function MobileSidebarTrigger() {
  const { setMobileOpen } = useSidebarState()
  const { t } = useTranslation()

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="md:hidden"
      onClick={() => setMobileOpen(true)}
      aria-label={t('dashboard.nav.openMenu')}
    >
      <Menu className="h-5 w-5" />
    </Button>
  )
}
