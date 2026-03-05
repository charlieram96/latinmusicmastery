'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'
import { AnimatedSection } from '@/components/dashboard/animated-section'
import type { SubscriptionCtaProps } from '@/types/dashboard'

/* ------------------------------------------------------------------ */
/*  Subscription upsell banner                                         */
/* ------------------------------------------------------------------ */

export function SubscriptionCta({ hasSubscription, variant = 'default' }: SubscriptionCtaProps) {
  if (hasSubscription) return null

  if (variant === 'sidebar') {
    return (
      <AnimatedSection delay={0.35}>
        <div
          className="relative overflow-hidden rounded-2xl p-4"
          style={{
            background:
              'linear-gradient(135deg, #b45309 0%, #C4654A 50%, #b45309 100%)',
          }}
        >
          <Sparkles className="absolute top-3 right-3 h-10 w-10 text-white/10 pointer-events-none" />

          <div className="relative z-10 space-y-3">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">
                Unlock All Courses
              </h3>
              <p className="text-xs text-white/80 leading-relaxed">
                Unlimited access to every course and practice tool.
              </p>
            </div>

            <Button
              asChild
              size="sm"
              className="w-full bg-gold hover:bg-gold/90 text-[#161210] font-semibold shadow-lg shadow-black/20"
            >
              <Link href="/dashboard/subscribe">
                Upgrade Now
                <Sparkles className="h-3.5 w-3.5 ml-1.5" />
              </Link>
            </Button>
          </div>
        </div>
      </AnimatedSection>
    )
  }

  return (
    <AnimatedSection delay={0.35}>
      <div
        className="relative overflow-hidden rounded-2xl p-6 sm:p-8"
        style={{
          background:
            'linear-gradient(135deg, #b45309 0%, #C4654A 50%, #b45309 100%)',
        }}
      >
        {/* Decorative sparkles */}
        <Sparkles className="absolute top-4 right-4 h-16 w-16 text-white/10 pointer-events-none" />
        <Sparkles className="absolute bottom-4 left-4 h-10 w-10 text-white/5 pointer-events-none rotate-12" />

        {/* Content layout */}
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Left — messaging */}
          <div className="space-y-1.5">
            <h3 className="text-xl font-bold text-white">
              Unlock All Courses
            </h3>
            <p className="text-sm text-white/80 max-w-md leading-relaxed">
              Get unlimited access to every course, teacher masterclass, and
              practice tool. Elevate your Latin music skills without limits.
            </p>
          </div>

          {/* Right — CTA button */}
          <Button
            asChild
            size="lg"
            className="flex-shrink-0 bg-gold hover:bg-gold/90 text-[#161210] font-semibold shadow-lg shadow-black/20"
          >
            <Link href="/dashboard/subscribe">
              Upgrade Now
              <Sparkles className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>
      </div>
    </AnimatedSection>
  )
}
