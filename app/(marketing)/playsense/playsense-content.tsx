"use client";

import { Mic, Target, Music, Repeat, LineChart, Sparkles } from "lucide-react";
import PageHero from "@/components/marketing/PageHero";
import SectionWrapper from "@/components/marketing/SectionWrapper";
import GradientText from "@/components/marketing/GradientText";
import CTABanner from "@/components/marketing/CTABanner";
import { useTranslation } from "@/components/language-provider";

export default function PlaysenseContent() {
  const { t } = useTranslation();

  const features = [
    {
      icon: Mic,
      title: t("marketing.pages.playsense.features.realtime.title"),
      description: t("marketing.pages.playsense.features.realtime.description"),
    },
    {
      icon: Target,
      title: t("marketing.pages.playsense.features.accuracy.title"),
      description: t("marketing.pages.playsense.features.accuracy.description"),
    },
    {
      icon: Music,
      title: t("marketing.pages.playsense.features.notation.title"),
      description: t("marketing.pages.playsense.features.notation.description"),
    },
    {
      icon: Repeat,
      title: t("marketing.pages.playsense.features.practice.title"),
      description: t("marketing.pages.playsense.features.practice.description"),
    },
    {
      icon: LineChart,
      title: t("marketing.pages.playsense.features.progress.title"),
      description: t("marketing.pages.playsense.features.progress.description"),
    },
    {
      icon: Sparkles,
      title: t("marketing.pages.playsense.features.guided.title"),
      description: t("marketing.pages.playsense.features.guided.description"),
    },
  ];

  const steps = [
    {
      title: t("marketing.pages.playsense.howItWorks.step1.title"),
      description: t("marketing.pages.playsense.howItWorks.step1.description"),
    },
    {
      title: t("marketing.pages.playsense.howItWorks.step2.title"),
      description: t("marketing.pages.playsense.howItWorks.step2.description"),
    },
    {
      title: t("marketing.pages.playsense.howItWorks.step3.title"),
      description: t("marketing.pages.playsense.howItWorks.step3.description"),
    },
  ];

  return (
    <div>
      <PageHero
        title={t("marketing.pages.playsense.hero.title")}
        subtitle={t("marketing.pages.playsense.hero.subtitle")}
        breadcrumbs={[
          { label: t("marketing.pages.playsense.breadcrumbs.home"), href: "/" },
          { label: t("marketing.pages.playsense.breadcrumbs.playsense") },
        ]}
      />

      {/* Intro Section */}
      <SectionWrapper className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t("marketing.pages.playsense.intro.titlePrefix")}{" "}
              <GradientText>
                {t("marketing.pages.playsense.intro.titleHighlight")}
              </GradientText>
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              {t("marketing.pages.playsense.intro.paragraph1")}
            </p>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              {t("marketing.pages.playsense.intro.paragraph2")}
            </p>
          </div>

          {/* Gradient Placeholder */}
          <div className="flex items-center justify-center">
            <div className="aspect-video w-full overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-orange-400/20 to-amber-500/20 ring-1 ring-primary/10">
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <Mic className="h-8 w-8 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("marketing.pages.playsense.intro.mediaPlaceholder")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SectionWrapper>

      {/* Features Section */}
      <SectionWrapper className="bg-muted/30 px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t("marketing.pages.playsense.features.titlePrefix")}{" "}
              <GradientText>
                {t("marketing.pages.playsense.features.titleHighlight")}
              </GradientText>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              {t("marketing.pages.playsense.features.description")}
            </p>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="group rounded-2xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
                    <Icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </SectionWrapper>

      {/* How It Works Section */}
      <SectionWrapper className="mx-auto max-w-7xl px-6 py-16">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("marketing.pages.playsense.howItWorks.titlePrefix")}{" "}
            <GradientText>
              {t("marketing.pages.playsense.howItWorks.titleHighlight")}
            </GradientText>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            {t("marketing.pages.playsense.howItWorks.description")}
          </p>
        </div>

        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="relative rounded-2xl border bg-card p-6 shadow-sm"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-amber-500 text-lg font-bold text-white shadow-md">
                {index + 1}
              </div>
              <h3 className="text-lg font-bold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </SectionWrapper>

      {/* CTA Banner */}
      <CTABanner
        title={t("marketing.pages.playsense.cta.title")}
        subtitle={t("marketing.pages.playsense.cta.subtitle")}
        primaryAction={{
          label: t("marketing.pages.playsense.cta.primaryLabel"),
          href: "/signup",
        }}
        secondaryAction={{
          label: t("marketing.pages.playsense.cta.secondaryLabel"),
          href: "/explore",
        }}
      />
    </div>
  );
}
