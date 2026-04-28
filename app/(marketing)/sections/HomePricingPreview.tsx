"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Check, Crown, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fadeInUp, staggerContainer, staggerChild } from "@/lib/animation-variants";
import GradientText from "@/components/marketing/GradientText";
import { useTranslation } from "@/components/language-provider";

interface Instrument {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
}

interface HomePricingPreviewProps {
  instruments: Instrument[];
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

export function HomePricingPreview({ instruments }: HomePricingPreviewProps) {
  const { t } = useTranslation();
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
                    $14.99
                  </span>
                  <span className="text-lg text-muted-foreground">{t('homepage.homeSections.pricingPreview.perMonth')}</span>
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
                variant="outline"
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
            <div className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card p-8">
              {/* Gradient top accent */}
              <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-primary via-orange-400 to-primary" />

              <div className="mb-8 text-center">
                <div className="mb-2 flex items-center justify-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
                  <Crown className="size-4" />
                  {t('homepage.homeSections.pricingPreview.allAccess')}
                </div>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-bold text-foreground">
                    $69.99
                  </span>
                  <span className="text-lg text-muted-foreground">{t('homepage.homeSections.pricingPreview.perMonth')}</span>
                </div>
              </div>

              <ul className="mb-8 flex-1 space-y-4">
                {allAccessFeatureKeys.map((featureKey) => (
                  <li key={featureKey} className="flex items-center gap-3">
                    <Check className="size-5 shrink-0 text-primary" />
                    <span className="text-foreground/80">{t(featureKey)}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="h-auto w-full rounded-full bg-primary py-4 text-base font-semibold text-white hover:bg-primary/90"
                asChild
              >
                <Link href="#waitlist">{t('homepage.homeSections.pricingPreview.getAllAccess')}</Link>
              </Button>

              <p className="mt-4 text-center text-xs text-muted-foreground">
                {t('homepage.homeSections.pricingPreview.moneyBack')}
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
