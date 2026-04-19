'use client'

import { useTranslation } from '@/components/language-provider'

export function PlaySenseHeader() {
  const { t } = useTranslation()
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{t('dashboard.pages.playSense.title')}</h1>
      <p className="text-sm text-muted-foreground">
        {t('dashboard.pages.playSense.subtitle')}
      </p>
    </div>
  )
}
