"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Check, Crown, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fadeInUp, staggerContainer, staggerChild } from "@/lib/animation-variants";
import GradientText from "@/components/marketing/GradientText";
import { useTranslation } from "@/components/language-provider";

const instrumentShowcase = [
  { nameKey: "homepage.homeSections.pricingPreview.instruments.timbal", image: "https://images.unsplash.com/photo-1674168460210-9f1a2fbf730b?w=600&auto=format&fit=crop&q=80" },
  { nameKey: "homepage.homeSections.pricingPreview.instruments.conga", image: "https://images.unsplash.com/photo-1732024004147-38420cac4bb8?w=600&auto=format&fit=crop&q=80" },
  { nameKey: "homepage.homeSections.pricingPreview.instruments.violin", image: "https://images.unsplash.com/photo-1690181462400-84ce69ed68fd?w=600&auto=format&fit=crop&q=80" },
  { nameKey: "homepage.homeSections.pricingPreview.instruments.bass", image: "https://images.unsplash.com/photo-1766033288242-70dd8602752a?w=600&auto=format&fit=crop&q=80" },
  { nameKey: "homepage.homeSections.pricingPreview.instruments.piano", image: "https://images.unsplash.com/photo-1764323038644-501788b28f87?w=600&auto=format&fit=crop&q=80" },
  { nameKey: "homepage.homeSections.pricingPreview.instruments.vocals", image: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=600&auto=format&fit=crop&q=80" },
];

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

export function HomePricingPreview() {
  const { t } = useTranslation();
  return (
    <section className="py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
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
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-8 text-center"
        >
          <h3 className="text-2xl font-bold tracking-tight md:text-3xl">
            <GradientText>{t('homepage.homeSections.pricingPreview.sixInstruments')}</GradientText> {t('homepage.homeSections.pricingPreview.available')}
          </h3>
        </motion.div>

        <motion.div
          variants={staggerContainer(0.08, 0.15)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="mx-auto mb-20 grid max-w-5xl grid-cols-2 gap-4 md:grid-cols-3"
        >
          {instrumentShowcase.map((instrument) => (
            <motion.div
              key={instrument.nameKey}
              variants={staggerChild}
              className="group relative flex items-end overflow-hidden rounded-2xl min-h-[220px] md:min-h-[280px]"
            >
              <Image
                src={instrument.image}
                alt={t(instrument.nameKey)}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 768px) 50vw, 33vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
              <div className="relative z-10 w-full p-4 md:p-5">
                <p className="text-base font-semibold text-white md:text-lg">
                  {t(instrument.nameKey)}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Pricing cards */}
        <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
          {/* Per Instrument */}
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
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
            whileInView="visible"
            viewport={{ once: true }}
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
