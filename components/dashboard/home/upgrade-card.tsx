'use client'

import Link from 'next/link'
import { Crown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/components/language-provider'

export function UpgradeCard({ hasSubscription }: { hasSubscription: boolean }) {
  const { t } = useTranslation()
  if (hasSubscription) return null

  return (
    <section
      aria-labelledby="home-upgrade"
      className="flex flex-col gap-3 rounded-xl border border-primary/25 p-5 shadow-card"
      style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.14), hsl(var(--gold-highlight) / 0.08))' }}
    >
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/[0.14] text-primary">
          <Crown className="h-4 w-4" aria-hidden />
        </span>
        <h2 id="home-upgrade" className="text-base font-semibold">
          {t('dashboard.pages.home.subscriptionCta.title')}
        </h2>
      </div>
      <p className="text-xs text-muted-foreground">{t('dashboard.pages.home.subscriptionCta.body')}</p>
      <Button asChild variant="chunky" size="sm" className="self-start">
        <Link href="/dashboard/subscribe">{t('dashboard.pages.subscription.empty.cta')}</Link>
      </Button>
    </section>
  )
}
