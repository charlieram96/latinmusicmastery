'use client'

import Link from 'next/link'
import { Crown, ArrowRight } from 'lucide-react'
import { AnimatedSection } from '@/components/dashboard/animated-section'
import type { SubscriptionCtaProps } from '@/types/dashboard'
import { useTranslation } from '@/components/language-provider'

/* ------------------------------------------------------------------ */
/*  Quiet upgrade card — sits in the same visual family as the rail.   */
/*  (Replaces the loud terracotta gradient banner.)                    */
/* ------------------------------------------------------------------ */

export function SubscriptionCta({ hasSubscription }: SubscriptionCtaProps) {
  const { t } = useTranslation()
  if (hasSubscription) return null

  return (
    <AnimatedSection delay={0.35}>
      <div className="rounded-2xl border border-border bg-card p-[18px]">
        <div className="flex items-center gap-3">
          <span className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[10px] bg-primary/12">
            <Crown className="h-4 w-4 text-primary" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground">
              {t('dashboard.pages.home.subscriptionCta.title')}
            </div>
            <div className="mt-0.5 text-[12.5px] text-muted-foreground">
              {t('dashboard.pages.home.subscriptionCta.body')}
            </div>
          </div>
        </div>

        <Link
          href="/dashboard/subscribe"
          className="mt-3.5 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-primary/40 px-4 py-2 text-[13px] font-semibold text-primary transition-colors hover:border-primary/60 hover:bg-primary/10"
        >
          {t('dashboard.pages.subscription.empty.cta')}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </AnimatedSection>
  )
}
