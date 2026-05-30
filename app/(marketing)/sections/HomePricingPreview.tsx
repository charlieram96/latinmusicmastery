"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, Check, Crown, Music, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fadeInUp, staggerContainer, staggerChild } from "@/lib/animation-variants";
import GradientText from "@/components/marketing/GradientText";
import { useTranslation } from "@/components/language-provider";
import { formatCents, type PricingMap } from "@/lib/payments/pricing-types";

interface Instrument {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
}

interface HomePricingPreviewProps {
  instruments: Instrument[];
  prices: PricingMap;
}

const instrumentFeatureKeys = [
  "homepage.homeSections.pricingPreview.instrumentFeatures.allCourses",
  "homepage.homeSections.pricingPreview.instrumentFeatures.soundslice",
  "homepage.homeSections.pricingPreview.instrumentFeatures.progress",
  "homepage.homeSections.pricingPreview.instrumentFeatures.monthly",
  "homepage.homeSections.pricingPreview.instrumentFeatures.cancelAnytime",
];

const allAccessFeatureKeys = [
  "homepage.homeSections.pricingPreview.allAccessFeatures.allInstruments",
  "homepage.homeSections.pricingPreview.allAccessFeatures.everyCourse",
  "homepage.homeSections.pricingPreview.allAccessFeatures.soundslice",
  "homepage.homeSections.pricingPreview.allAccessFeatures.progress",
  "homepage.homeSections.pricingPreview.allAccessFeatures.monthly",
  "homepage.homeSections.pricingPreview.allAccessFeatures.cancelAnytime",
];

export function HomePricingPreview({ instruments, prices }: HomePricingPreviewProps) {
  const { t } = useTranslation();
  const monthlyLabel = formatCents(prices.base_monthly.amount_cents);
  const annualLabel = formatCents(prices.base_annual.amount_cents);
  const yearlyAtMonthlyLabel = formatCents(prices.base_monthly.amount_cents * 12);
  return (
    <section className="py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12 text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
            {t('homepage.homeSections.pricingPreview.headingPrefix')}{" "}
            <GradientText>{t('homepage.homeSections.pricingPreview.headingHighlight')}</GradientText>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            {t('homepage.homeSections.pricingPreview.description')}
          </p>
        </motion.div>

        {/* Instrument showcase */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-8 text-center"
        >
          <h3 className="text-2xl font-bold tracking-tight md:text-3xl">
            <GradientText>
              {t('homepage.homeSections.pricingPreview.instrumentsAvailable', { count: instruments.length })}
            </GradientText>
          </h3>
        </motion.div>

        {instruments.length > 0 && (
          <motion.div
            variants={staggerContainer(0.08, 0.15)}
            initial="hidden"
            animate="visible"
            className="mx-auto mb-20 grid max-w-5xl grid-cols-2 gap-4 md:grid-cols-3"
          >
            {instruments.map((instrument) => (
              <motion.div
                key={instrument.id}
                variants={staggerChild}
                className="group relative flex items-end overflow-hidden rounded-2xl min-h-[220px] md:min-h-[280px]"
              >
                {instrument.image_url ? (
                  <Image
                    src={instrument.image_url}
                    alt={instrument.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 768px) 50vw, 33vw"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-br from-primary/40 via-orange-500/30 to-purple-600/40"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
                <div className="relative z-10 w-full p-4 md:p-5">
                  <p className="text-base font-semibold text-white md:text-lg">
                    {instrument.name}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Limited-time pricing notice */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="mx-auto mb-10 max-w-4xl"
        >
          <div className="overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"
                  aria-hidden="true"
                >
                  <Sparkles className="h-5 w-5" />
                </span>
                <div>
                  <span className="inline-block text-xs font-semibold uppercase tracking-wider text-primary">
                    {t('homepage.homeSections.pricingPreview.limitedTimeNotice.eyebrow')}
                  </span>
                  <h3 className="mt-1 text-lg font-semibold sm:text-xl">
                    {t('homepage.homeSections.pricingPreview.limitedTimeNotice.title')}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                    {t('homepage.homeSections.pricingPreview.limitedTimeNotice.body')}
                  </p>
                </div>
              </div>
              <Button
                asChild
                size="lg"
                className="w-full shrink-0 rounded-full sm:w-auto"
              >
                <Link href="#waitlist">
                  {t('homepage.homeSections.pricingPreview.limitedTimeNotice.ctaLabel')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Pricing cards */}
        <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
          {/* Per Instrument */}
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.1 }}
          >
            <div className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card p-8">
              <div className="mb-8 text-center">
                <div className="mb-2 flex items-center justify-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
                  <Music className="size-4" />
                  {t('homepage.homeSections.pricingPreview.perInstrument')}
                </div>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-bold text-foreground">
                    {monthlyLabel}
                  </span>
                  <span className="text-lg text-muted-foreground">{t('homepage.homeSections.pricingPreview.perMonth')}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t('homepage.homeSections.pricingPreview.addonNote')}
                </p>
                {/* Annual alternative — an "or" divider, then a roomy stacked price */}
                <div className="mt-6 flex items-center gap-3">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t('homepage.homeSections.pricingPreview.or')}
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <div className="mt-4 text-center">
                  <p className="text-lg text-muted-foreground/70 line-through">{yearlyAtMonthlyLabel}</p>
                  <div className="mt-1 flex items-center justify-center gap-2.5">
                    <span className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold text-foreground">{annualLabel}</span>
                      <span className="text-sm text-muted-foreground">
                        {t('homepage.homeSections.pricingPreview.perYear')}
                      </span>
                    </span>
                    <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary-foreground">
                      {t('homepage.homeSections.pricingPreview.annualSave')}
                    </span>
                  </div>
                </div>
              </div>

              <ul className="mb-8 flex-1 space-y-4">
                {instrumentFeatureKeys.map((featureKey) => (
                  <li key={featureKey} className="flex items-center gap-3">
                    <Check className="size-5 shrink-0 text-primary" />
                    <span className="text-foreground/80">{t(featureKey)}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="h-auto w-full rounded-full py-4 text-base font-semibold"
                asChild
              >
                <Link href="#waitlist">{t('homepage.homeSections.pricingPreview.chooseInstrument')}</Link>
              </Button>
            </div>
          </motion.div>

          {/* All-Access */}
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.2 }}
          >
            <div className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-dashed border-border bg-card/60 p-8">
              <div className="mb-8 text-center">
                <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-primary/70" aria-hidden="true" />
                  {t('homepage.homeSections.pricingPreview.comingSoon')}
                </span>
                <div className="flex items-center justify-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
                  <Crown className="size-4" />
                  {t('homepage.homeSections.pricingPreview.allAccess')}
                </div>
              </div>

              <ul className="mb-8 flex-1 space-y-4">
                {allAccessFeatureKeys.map((featureKey) => (
                  <li key={featureKey} className="flex items-center gap-3">
                    <Check className="size-5 shrink-0 text-muted-foreground/60" />
                    <span className="text-muted-foreground">{t(featureKey)}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant="outline"
                className="h-auto w-full rounded-full py-4 text-base font-semibold"
                disabled
              >
                {t('homepage.homeSections.pricingPreview.comingSoon')}
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
