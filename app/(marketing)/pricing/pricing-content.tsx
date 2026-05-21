"use client";

import { useState } from "react";
import Link from "next/link";
import { Music, Crown, Check, Minus, Sparkles, ArrowRight, Plus } from "lucide-react";
import PageHero from "@/components/marketing/PageHero";
import SectionWrapper from "@/components/marketing/SectionWrapper";
import CTABanner from "@/components/marketing/CTABanner";
import GradientText from "@/components/marketing/GradientText";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/components/language-provider";

function ComparisonCell({ value }: { value: boolean | string }) {
  if (typeof value === "string") {
    return <span className="font-medium">{value}</span>;
  }
  return value ? (
    <Check className="mx-auto h-5 w-5 text-primary" />
  ) : (
    <Minus className="mx-auto h-5 w-5 text-muted-foreground/40" />
  );
}

export default function PricingContent() {
  const { t } = useTranslation();
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const isAnnual = billing === "annual";

  const k = "marketing.pages.pricing";

  const perInstrumentFeatures = [
    t(`${k}.plans.perInstrument.features.0`),
    t(`${k}.plans.perInstrument.features.1`),
    t(`${k}.plans.perInstrument.features.2`),
    t(`${k}.plans.perInstrument.features.3`),
    t(`${k}.plans.perInstrument.features.4`),
    t(`${k}.plans.perInstrument.features.5`),
    t(`${k}.plans.perInstrument.features.6`),
  ];

  const allAccessFeatures = [
    t(`${k}.plans.allAccess.features.0`),
    t(`${k}.plans.allAccess.features.1`),
    t(`${k}.plans.allAccess.features.2`),
    t(`${k}.plans.allAccess.features.3`),
    t(`${k}.plans.allAccess.features.4`),
    t(`${k}.plans.allAccess.features.5`),
  ];

  const howItWorks = [
    {
      title: t(`${k}.howItWorks.step1Title`),
      body: t(`${k}.howItWorks.step1Body`),
      icon: <Music className="h-5 w-5" />,
    },
    {
      title: t(`${k}.howItWorks.step2Title`),
      body: t(`${k}.howItWorks.step2Body`),
      icon: <Plus className="h-5 w-5" />,
    },
    {
      title: t(`${k}.howItWorks.step3Title`),
      body: t(`${k}.howItWorks.step3Body`),
      icon: <Sparkles className="h-5 w-5" />,
    },
  ];

  const comparisonRows = [
    { feature: t(`${k}.comparison.rows.instruments`), perInstrument: "1", allAccess: t(`${k}.comparison.allSix`) },
    { feature: t(`${k}.comparison.rows.videoLessons`), perInstrument: true, allAccess: true },
    { feature: t(`${k}.comparison.rows.interactiveNotation`), perInstrument: true, allAccess: true },
    { feature: t(`${k}.comparison.rows.progressTracking`), perInstrument: true, allAccess: true },
    { feature: t(`${k}.comparison.rows.playSense`), perInstrument: true, allAccess: true },
    { feature: t(`${k}.comparison.rows.downloadable`), perInstrument: true, allAccess: true },
    { feature: t(`${k}.comparison.rows.monthlyContent`), perInstrument: true, allAccess: true },
    { feature: t(`${k}.comparison.rows.prioritySupport`), perInstrument: false, allAccess: true },
  ] as const;

  const instruments = [
    { name: t(`${k}.instruments.timbal`), emoji: "🥁" },
    { name: t(`${k}.instruments.conga`), emoji: "🥁" },
    { name: t(`${k}.instruments.violin`), emoji: "🎻" },
    { name: t(`${k}.instruments.bass`), emoji: "🎵" },
    { name: t(`${k}.instruments.piano`), emoji: "🎹" },
    { name: t(`${k}.instruments.vocals`), emoji: "🎤" },
  ];

  const faqItems = [
    { question: t(`${k}.faq.difference.question`), answer: t(`${k}.faq.difference.answer`) },
    { question: t(`${k}.faq.switch.question`), answer: t(`${k}.faq.switch.answer`) },
    { question: t(`${k}.faq.trial.question`), answer: t(`${k}.faq.trial.answer`) },
    { question: t(`${k}.faq.upgrade.question`), answer: t(`${k}.faq.upgrade.answer`) },
    { question: t(`${k}.faq.payment.question`), answer: t(`${k}.faq.payment.answer`) },
  ];

  return (
    <div data-marketing>
      <PageHero
        title={t(`${k}.hero.title`)}
        subtitle={t(`${k}.hero.subtitle`)}
        breadcrumbs={[
          { label: t(`${k}.breadcrumbs.home`), href: "/" },
          { label: t(`${k}.breadcrumbs.pricing`) },
        ]}
      />

      {/* Pricing Cards */}
      <SectionWrapper className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
        {/* Limited-time pricing notice */}
        <div className="mb-12 overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 sm:p-8">
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
                  {t(`${k}.limitedTimeNotice.eyebrow`)}
                </span>
                <h3 className="mt-1 text-lg font-semibold sm:text-xl">
                  {t(`${k}.limitedTimeNotice.title`)}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                  {t(`${k}.limitedTimeNotice.body`)}
                </p>
              </div>
            </div>
            <Button asChild size="lg" className="w-full shrink-0 rounded-full sm:w-auto">
              <Link href="/#waitlist">
                {t(`${k}.limitedTimeNotice.ctaLabel`)}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Billing interval toggle */}
        <div className="mb-10 flex justify-center">
          <div
            role="group"
            aria-label="Billing interval"
            className="inline-flex items-center rounded-full border bg-card p-1"
          >
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              className={cn(
                "rounded-full px-5 py-2 text-sm font-medium transition-colors",
                !isAnnual ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t(`${k}.billing.monthly`)}
            </button>
            <button
              type="button"
              onClick={() => setBilling("annual")}
              className={cn(
                "flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-colors",
                isAnnual ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t(`${k}.billing.annual`)}
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  isAnnual ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/15 text-primary"
                )}
              >
                {t(`${k}.billing.save`)}
              </span>
            </button>
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Per Instrument */}
          <div className="relative flex h-full flex-col rounded-3xl border bg-card p-8 transition-shadow hover:shadow-lg hover:shadow-primary/10">
            <div className="flex items-center gap-2">
              <span className="text-primary" aria-hidden="true">
                <Music className="h-5 w-5" />
              </span>
              <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                {t(`${k}.plans.perInstrument.name`)}
              </span>
            </div>

            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-5xl font-bold">{isAnnual ? "$199.99" : "$19.99"}</span>
              <span className="text-muted-foreground">
                {isAnnual ? t(`${k}.billing.perYear`) : t(`${k}.billing.perMonth`)}
              </span>
            </div>

            {/* Annual savings — one cohesive offer pill with the discount nested as a tag */}
            {isAnnual ? (
              <div className="mt-2 flex items-center gap-2 text-sm">
                <span className="text-muted-foreground/50 line-through">$239.88</span>
                <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-primary-foreground">
                  {t(`${k}.billing.save`)}
                </span>
              </div>
            ) : (
              <>
                {/* Annual alternative — an "or" divider, then a roomy stacked price */}
                <div className="mt-4 flex items-center gap-3">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t(`${k}.billing.or`)}
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <div className="mt-3">
                  <p className="text-lg text-muted-foreground/70 line-through">$239.88</p>
                  <div className="mt-1 flex items-center gap-2.5">
                    <span className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold text-foreground">$199.99</span>
                      <span className="text-sm text-muted-foreground">{t(`${k}.billing.perYear`)}</span>
                    </span>
                    <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary-foreground">
                      {t(`${k}.billing.save`)}
                    </span>
                  </div>
                </div>
              </>
            )}

            <div className="mt-2 flex items-center gap-1.5 text-sm font-medium text-primary">
              <Plus className="h-4 w-4" />
              {t(`${k}.addonNote`)}
            </div>

            {isAnnual && (
              <p className="mt-2 text-xs text-muted-foreground">{t(`${k}.billing.annualNote`)}</p>
            )}

            <p className="mt-3 text-sm text-muted-foreground">
              {t(`${k}.plans.perInstrument.description`)}
            </p>

            <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t(`${k}.includesLabel`)}
            </p>
            <ul className="mt-3 flex-1 space-y-3">
              {perInstrumentFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <Button asChild size="lg" className="w-full rounded-full">
                <Link href="/signup">{t(`${k}.plans.perInstrument.ctaLabel`)}</Link>
              </Button>
            </div>
          </div>

          {/* All-Access — coming soon */}
          <div className="relative flex h-full flex-col rounded-3xl border border-dashed bg-card/60 p-8">
            <span className="absolute right-6 top-6 rounded-full bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t(`${k}.comingSoon`)}
            </span>

            <div className="flex items-center gap-2">
              <span className="text-primary" aria-hidden="true">
                <Crown className="h-5 w-5" />
              </span>
              <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                {t(`${k}.plans.allAccess.name`)}
              </span>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              {t(`${k}.plans.allAccess.description`)}
            </p>

            <ul className="mt-8 flex-1 space-y-3">
              {allAccessFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <Button size="lg" variant="outline" className="w-full rounded-full" disabled>
                {t(`${k}.comingSoon`)}
              </Button>
            </div>
          </div>
        </div>
      </SectionWrapper>

      {/* How pricing works */}
      <SectionWrapper className="mx-auto max-w-5xl px-4 pb-8 sm:px-6 lg:px-8">
        <h2 className="mb-12 text-center text-3xl font-bold">
          <GradientText>{t(`${k}.howItWorks.title`)}</GradientText>
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {howItWorks.map((step, index) => (
            <div key={step.title} className="rounded-3xl border bg-card p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                  {step.icon}
                </span>
                <span className="text-sm font-semibold text-muted-foreground">{index + 1}</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>
      </SectionWrapper>

      {/* Comparison Table */}
      <SectionWrapper className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
        <h2 className="mb-12 text-center text-3xl font-bold">
          {t(`${k}.comparison.titlePrefix`)}{" "}
          <GradientText>{t(`${k}.comparison.titleHighlight`)}</GradientText>
        </h2>

        {/* Desktop table */}
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="pb-4 text-left font-medium text-muted-foreground">
                  {t(`${k}.comparison.feature`)}
                </th>
                <th className="pb-4 text-center font-medium text-muted-foreground">
                  {t(`${k}.plans.perInstrument.name`)}
                </th>
                <th className="pb-4 text-center font-medium text-muted-foreground">
                  {t(`${k}.plans.allAccess.name`)}
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.feature} className="border-b last:border-b-0">
                  <td className="py-4 font-medium">{row.feature}</td>
                  <td className="py-4 text-center">
                    <ComparisonCell value={row.perInstrument} />
                  </td>
                  <td className="py-4 text-center">
                    <ComparisonCell value={row.allAccess} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="space-y-4 md:hidden">
          {comparisonRows.map((row) => (
            <div key={row.feature} className="rounded-xl border bg-card p-4">
              <p className="mb-3 font-medium">{row.feature}</p>
              <div className="flex justify-between text-sm text-muted-foreground">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs">{t(`${k}.plans.perInstrument.name`)}</span>
                  <ComparisonCell value={row.perInstrument} />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs">{t(`${k}.plans.allAccess.name`)}</span>
                  <ComparisonCell value={row.allAccess} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionWrapper>

      {/* Instrument Grid */}
      <SectionWrapper className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
        <h2 className="mb-4 text-center text-3xl font-bold">
          {t(`${k}.instrumentGrid.titlePrefix`)}{" "}
          <GradientText>{t(`${k}.instrumentGrid.titleHighlight`)}</GradientText>{" "}
          {t(`${k}.instrumentGrid.titleSuffix`)}
        </h2>
        <p className="mx-auto mb-12 max-w-2xl text-center text-muted-foreground">
          {t(`${k}.instrumentGrid.description`)}
        </p>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {instruments.map((instrument) => (
            <div
              key={instrument.name}
              className="flex flex-col items-center gap-2 rounded-2xl border bg-card p-6 text-center transition-colors hover:border-primary/30"
            >
              <span className="text-3xl" role="img" aria-label={instrument.name}>
                {instrument.emoji}
              </span>
              <span className="text-sm font-medium">{instrument.name}</span>
            </div>
          ))}
        </div>
      </SectionWrapper>

      {/* FAQ */}
      <SectionWrapper className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        <h2 className="mb-12 text-center text-3xl font-bold">
          {t(`${k}.faq.titlePrefix`)}{" "}
          <GradientText>{t(`${k}.faq.titleHighlight`)}</GradientText>
        </h2>

        <Accordion type="single" collapsible className="w-full">
          {faqItems.map((item, index) => (
            <AccordionItem key={index} value={`faq-${index}`}>
              <AccordionTrigger className="text-left text-base">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </SectionWrapper>

      {/* CTA */}
      <CTABanner
        title={t(`${k}.cta.title`)}
        subtitle={t(`${k}.cta.subtitle`)}
        primaryAction={{ label: t(`${k}.cta.primaryLabel`), href: "/signup" }}
        secondaryAction={{ label: t(`${k}.cta.secondaryLabel`), href: "/explore" }}
      />
    </div>
  );
}
