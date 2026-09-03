'use client'

import { useMemo } from 'react'
import { Lightbulb } from 'lucide-react'
import { AnimatedSection } from '@/components/dashboard/animated-section'
import { useTranslation } from '@/components/language-provider'

// Copy lives in the locale dictionaries under dashboard.pages.home.practiceTip.tips.<key>
const PRACTICE_TIP_KEYS = ['slowDown', 'listen', 'clave', 'record', 'isolate', 'feeling', 'ears'] as const

export function DailyPracticeTip() {
  const { t } = useTranslation()
  const tipKey = useMemo(() => {
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
        86400000
    )
    return PRACTICE_TIP_KEYS[dayOfYear % PRACTICE_TIP_KEYS.length]
  }, [])

  return (
    <AnimatedSection delay={0.15}>
      <div className="warm-surface rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="rounded-lg p-1.5 bg-amber-500/15">
            <Lightbulb className="h-4 w-4 text-amber-400" />
          </div>
          <h3 className="text-sm font-heading font-semibold text-foreground">
            {t('dashboard.pages.home.practiceTip.title')}
          </h3>
        </div>
        <p className="text-sm font-medium text-foreground leading-tight">
          {t(`dashboard.pages.home.practiceTip.tips.${tipKey}.title`)}
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
          {t(`dashboard.pages.home.practiceTip.tips.${tipKey}.body`)}
        </p>
      </div>
    </AnimatedSection>
  )
}
