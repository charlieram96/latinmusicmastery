'use client'

import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSidebar } from '@/components/ui/sidebar'
import { useTranslation } from '@/components/language-provider'

export function MobileSidebarTrigger() {
  const { toggleSidebar } = useSidebar()
  const { t } = useTranslation()

  return (
    <Button
      variant="ghost"
      size="icon"
      className="md:hidden h-9 w-9"
      onClick={toggleSidebar}
    >
      <Menu className="h-5 w-5" />
      <span className="sr-only">{t('common.toggleSidebar')}</span>
    </Button>
  )
}
