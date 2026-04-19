'use client'

import { useTranslation } from '@/components/language-provider'

export function DashboardWelcomeText() {
  const { t } = useTranslation()
  return (
    <p className="hidden md:flex text-sm font-medium text-foreground flex-1">
      {t('dashboard.welcome')}
    </p>
  )
}
