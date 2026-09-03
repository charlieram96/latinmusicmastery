'use client'

import Link from 'next/link'
import { ArrowRight, Drum, Ear, Gauge, Waves, type LucideIcon } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'

const TIPS: { icon: LucideIcon; key: string }[] = [
  { icon: Gauge, key: 'meter' },
  { icon: Waves, key: 'cents' },
  { icon: Ear, key: 'order' },
]

export function TunerTips() {
  const { t } = useTranslation()
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
      {TIPS.map(({ icon: Icon, key }) => (
        <div key={key} className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3.5">
          <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] bg-gold/10 text-gold">
            <Icon className="h-[17px] w-[17px]" />
          </span>
          <div>
            <div className="text-sm font-semibold">{t(`dashboard.pages.tuner.tips.${key}Title`)}</div>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t(`dashboard.pages.tuner.tips.${key}Body`)}</p>
          </div>
        </div>
      ))}
      <Link
        href="/dashboard/play-sense"
        className="flex items-center gap-3.5 rounded-2xl border border-border bg-card px-4 py-3.5 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[10px] bg-primary/12 text-primary">
          <Drum className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0">
          <span className="block text-xs text-muted-foreground">{t('dashboard.pages.tuner.tips.keepPracticing')}</span>
          <span className="block text-sm font-semibold">{t('dashboard.pages.tuner.tips.openPlaySense')}</span>
        </span>
        <ArrowRight className="ml-1.5 h-4 w-4 text-muted-foreground" />
      </Link>
    </div>
  )
}
