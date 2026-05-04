"use client";

import Link from "next/link";
import { Music, Crown, Check, Minus, Sparkles, ArrowRight } from "lucide-react";
import PageHero from "@/components/marketing/PageHero";
import SectionWrapper from "@/components/marketing/SectionWrapper";
import CTABanner from "@/components/marketing/CTABanner";
import GradientText from "@/components/marketing/GradientText";
import PricingCard from "@/components/marketing/PricingCard";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
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

  const plans = [
    {
      name: t("marketing.pages.pricing.plans.perInstrument.name"),
      price: "$14.99",
      icon: <Music className="h-5 w-5" />,
      description: t("marketing.pages.pricing.plans.perInstrument.description"),
      features: [
        t("marketing.pages.pricing.plans.perInstrument.features.0"),
        t("marketing.pages.pricing.plans.perInstrument.features.1"),
        t("marketing.pages.pricing.plans.perInstrument.features.2"),
        t("marketing.pages.pricing.plans.perInstrument.features.3"),
        t("marketing.pages.pricing.plans.perInstrument.features.4"),
        t("marketing.pages.pricing.plans.perInstrument.features.5"),
      ],
      cta: {
        label: t("marketing.pages.pricing.plans.perInstrument.ctaLabel"),
        href: "/#waitlist",
      },
      popular: false,
    },
    {
      name: t("marketing.pages.pricing.plans.allAccess.name"),
      price: "$69.99",
      icon: <Crown className="h-5 w-5" />,
      description: t("marketing.pages.pricing.plans.allAccess.description"),
      features: [
        t("marketing.pages.pricing.plans.allAccess.features.0"),
        t("marketing.pages.pricing.plans.allAccess.features.1"),
        t("marketing.pages.pricing.plans.allAccess.features.2"),
        t("marketing.pages.pricing.plans.allAccess.features.3"),
        t("marketing.pages.pricing.plans.allAccess.features.4"),
        t("marketing.pages.pricing.plans.allAccess.features.5"),
        t("marketing.pages.pricing.plans.allAccess.features.6"),
      ],
      cta: {
        label: t("marketing.pages.pricing.plans.allAccess.ctaLabel"),
        href: "/#waitlist",
      },
      popular: true,
    },
  ] as const;

  const comparisonRows = [
    {
      feature: t("marketing.pages.pricing.comparison.rows.instruments"),
      perInstrument: "1",
      allAccess: t("marketing.pages.pricing.comparison.allSix"),
    },
    {
      feature: t("marketing.pages.pricing.comparison.rows.videoLessons"),
      perInstrument: true,
      allAccess: true,
    },
    {
      feature: t("marketing.pages.pricing.comparison.rows.interactiveNotation"),
      perInstrument: true,
      allAccess: true,
    },
    {
      feature: t("marketing.pages.pricing.comparison.rows.progressTracking"),
      perInstrument: true,
      allAccess: true,
    },
    {
      feature: t("marketing.pages.pricing.comparison.rows.playSense"),
      perInstrument: true,
      allAccess: true,
    },
    {
      feature: t("marketing.pages.pricing.comparison.rows.downloadable"),
      perInstrument: true,
      allAccess: true,
    },
    {
      feature: t("marketing.pages.pricing.comparison.rows.monthlyContent"),
      perInstrument: true,
      allAccess: true,
    },
    {
      feature: t("marketing.pages.pricing.comparison.rows.prioritySupport"),
      perInstrument: false,
      allAccess: true,
    },
  ] as const;

  const instruments = [
    { name: t("marketing.pages.pricing.instruments.timbal"), emoji: "\uD83E\uDD41" },
    { name: t("marketing.pages.pricing.instruments.conga"), emoji: "\uD83E\uDD41" },
    { name: t("marketing.pages.pricing.instruments.violin"), emoji: "\uD83C\uDFBB" },
    { name: t("marketing.pages.pricing.instruments.bass"), emoji: "\uD83C\uDFB5" },
    { name: t("marketing.pages.pricing.instruments.piano"), emoji: "\uD83C\uDFB9" },
    { name: t("marketing.pages.pricing.instruments.vocals"), emoji: "\uD83C\uDFA4" },
  ];

  const faqItems = [
    {
      question: t("marketing.pages.pricing.faq.difference.question"),
      answer: t("marketing.pages.pricing.faq.difference.answer"),
    },
    {
      question: t("marketing.pages.pricing.faq.switch.question"),
      answer: t("marketing.pages.pricing.faq.switch.answer"),
    },
    {
      question: t("marketing.pages.pricing.faq.trial.question"),
      answer: t("marketing.pages.pricing.faq.trial.answer"),
    },
    {
      question: t("marketing.pages.pricing.faq.upgrade.question"),
      answer: t("marketing.pages.pricing.faq.upgrade.answer"),
    },
    {
      question: t("marketing.pages.pricing.faq.payment.question"),
      answer: t("marketing.pages.pricing.faq.payment.answer"),
    },
  ];

  return (
    <div data-marketing>
      <PageHero
        title={t("marketing.pages.pricing.hero.title")}
        subtitle={t("marketing.pages.pricing.hero.subtitle")}
        breadcrumbs={[
          { label: t("marketing.pages.pricing.breadcrumbs.home"), href: "/" },
          { label: t("marketing.pages.pricing.breadcrumbs.pricing") },
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
                  {t("marketing.pages.pricing.limitedTimeNotice.eyebrow")}
                </span>
                <h3 className="mt-1 text-lg font-semibold sm:text-xl">
                  {t("marketing.pages.pricing.limitedTimeNotice.title")}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                  {t("marketing.pages.pricing.limitedTimeNotice.body")}
                </p>
              </div>
            </div>
            <Button
              asChild
              size="lg"
              className="w-full shrink-0 rounded-full sm:w-auto"
            >
              <Link href="/#waitlist">
                {t("marketing.pages.pricing.limitedTimeNotice.ctaLabel")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {plans.map((plan) => (
            <PricingCard
              key={plan.name}
              name={plan.name}
              price={plan.price}
              icon={plan.icon}
              description={plan.description}
              features={[...plan.features]}
              cta={{ ...plan.cta }}
              popular={plan.popular}
            />
          ))}
        </div>
      </SectionWrapper>

      {/* Comparison Table */}
      <SectionWrapper className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
        <h2 className="mb-12 text-center text-3xl font-bold">
          {t("marketing.pages.pricing.comparison.titlePrefix")}{" "}
          <GradientText>
            {t("marketing.pages.pricing.comparison.titleHighlight")}
          </GradientText>
        </h2>

        {/* Desktop table */}
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="pb-4 text-left font-medium text-muted-foreground">
                  {t("marketing.pages.pricing.comparison.feature")}
                </th>
                <th className="pb-4 text-center font-medium text-muted-foreground">
                  {t("marketing.pages.pricing.plans.perInstrument.name")}
                </th>
                <th className="pb-4 text-center font-medium text-muted-foreground">
                  {t("marketing.pages.pricing.plans.allAccess.name")}
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
            <div
              key={row.feature}
              className="rounded-xl border bg-card p-4"
            >
              <p className="mb-3 font-medium">{row.feature}</p>
              <div className="flex justify-between text-sm text-muted-foreground">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs">
                    {t("marketing.pages.pricing.plans.perInstrument.name")}
                  </span>
                  <ComparisonCell value={row.perInstrument} />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs">
                    {t("marketing.pages.pricing.plans.allAccess.name")}
                  </span>
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
          {t("marketing.pages.pricing.instrumentGrid.titlePrefix")}{" "}
          <GradientText>
            {t("marketing.pages.pricing.instrumentGrid.titleHighlight")}
          </GradientText>{" "}
          {t("marketing.pages.pricing.instrumentGrid.titleSuffix")}
        </h2>
        <p className="mx-auto mb-12 max-w-2xl text-center text-muted-foreground">
          {t("marketing.pages.pricing.instrumentGrid.description")}
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
          {t("marketing.pages.pricing.faq.titlePrefix")}{" "}
          <GradientText>
            {t("marketing.pages.pricing.faq.titleHighlight")}
          </GradientText>
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
        title={t("marketing.pages.pricing.cta.title")}
        subtitle={t("marketing.pages.pricing.cta.subtitle")}
        primaryAction={{
          label: t("marketing.pages.pricing.cta.primaryLabel"),
          href: "/signup",
        }}
        secondaryAction={{
          label: t("marketing.pages.pricing.cta.secondaryLabel"),
          href: "/explore",
        }}
      />
    </div>
  );
}
