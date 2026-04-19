'use client'

import { useTranslation } from '@/components/language-provider'

export function ClassViewerEmpty() {
  const { t } = useTranslation()
  return (
    <div className="text-center py-12 text-muted-foreground">
      {t('dashboard.pages.course.class.emptyContent')}
    </div>
  )
}
