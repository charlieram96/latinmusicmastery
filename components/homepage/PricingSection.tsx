'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Check, Crown, Music } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'

const allAccessFeatureKeys = [
  'homepage.pricing.allAccessFeatures.allInstruments',
  'homepage.pricing.allAccessFeatures.everyCourse',
  'homepage.pricing.allAccessFeatures.soundslice',
  'homepage.pricing.allAccessFeatures.progress',
  'homepage.pricing.allAccessFeatures.monthly',
  'homepage.pricing.allAccessFeatures.cancelAnytime',
]

const instrumentFeatureKeys = [
  'homepage.pricing.instrumentFeatures.allCourses',
  'homepage.pricing.instrumentFeatures.soundslice',
  'homepage.pricing.instrumentFeatures.progress',
  'homepage.pricing.instrumentFeatures.monthly',
  'homepage.pricing.instrumentFeatures.cancelAnytime',
]

export function PricingSection() {
  const { t } = useTranslation()
  return (
    <section id="pricing" className="py-24 lg:py-32">
      <div className="max-w-5xl mx-auto px-6">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground mb-4 font-heading">
            {t('homepage.pricing.heading')}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t('homepage.pricing.subheading')}
          </p>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto">
          {/* Instrument Plan */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="relative p-8 rounded-3xl bg-card border border-border overflow-hidden h-full flex flex-col">
              <div className="text-center mb-8">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground uppercase tracking-wider mb-2">
                  <Music className="w-4 h-4" />
                  {t('homepage.pricing.perInstrument')}
                </div>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-bold text-foreground">$24.99</span>
                  <span className="text-lg text-muted-foreground">{t('homepage.pricing.perMonth')}</span>
                </div>
              </div>

              <ul className="space-y-4 mb-8 flex-1">
                {instrumentFeatureKeys.map((featureKey) => (
                  <li key={featureKey} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-foreground/80">{t(featureKey)}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant="outline"
                className="w-full py-4 h-auto text-base font-semibold rounded-full"
                asChild
              >
                <Link href="/pricing">{t('homepage.pricing.chooseInstrument')}</Link>
              </Button>
            </div>
          </motion.div>

          {/* All-Access Plan */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="relative p-8 rounded-3xl bg-card border border-border overflow-hidden h-full flex flex-col">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-orange-400 to-primary" />

              <div className="text-center mb-8">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground uppercase tracking-wider mb-2">
                  <Crown className="w-4 h-4" />
                  {t('homepage.pricing.allAccess')}
                </div>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-bold text-foreground">$69.99</span>
                  <span className="text-lg text-muted-foreground">{t('homepage.pricing.perMonth')}</span>
                </div>
              </div>

              <ul className="space-y-4 mb-8 flex-1">
                {allAccessFeatureKeys.map((featureKey) => (
                  <li key={featureKey} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-foreground/80">{t(featureKey)}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="w-full bg-primary hover:bg-primary/90 text-white py-4 h-auto text-base font-semibold rounded-full"
                asChild
              >
                <Link href="#waitlist">{t('homepage.pricing.getAllAccess')}</Link>
              </Button>

              <p className="text-center text-xs text-muted-foreground mt-4">
                {t('homepage.pricing.moneyBackNote')}
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
