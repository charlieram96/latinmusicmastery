"use client";

import { Heart, Award, Globe, Users } from "lucide-react";
import PageHero from "@/components/marketing/PageHero";
import SectionWrapper from "@/components/marketing/SectionWrapper";
import GradientText from "@/components/marketing/GradientText";
import CTABanner from "@/components/marketing/CTABanner";
import { useTranslation } from "@/components/language-provider";

export default function AboutContent() {
  const { t } = useTranslation();

  const milestones = [
    {
      year: "2025",
      title: t("marketing.pages.about.milestones.founded.title"),
      description: t("marketing.pages.about.milestones.founded.description"),
    },
    {
      year: "2025",
      title: t("marketing.pages.about.milestones.community.title"),
      description: t("marketing.pages.about.milestones.community.description"),
    },
    {
      year: "July 2026",
      title: t("marketing.pages.about.milestones.launch.title"),
      description: t("marketing.pages.about.milestones.launch.description"),
    },
    {
      year: "2026",
      title: t("marketing.pages.about.milestones.playsense.title"),
      description: t("marketing.pages.about.milestones.playsense.description"),
    },
  ];

  const values = [
    {
      icon: Heart,
      title: t("marketing.pages.about.values.authenticity.title"),
      description: t("marketing.pages.about.values.authenticity.description"),
    },
    {
      icon: Award,
      title: t("marketing.pages.about.values.excellence.title"),
      description: t("marketing.pages.about.values.excellence.description"),
    },
    {
      icon: Globe,
      title: t("marketing.pages.about.values.accessibility.title"),
      description: t("marketing.pages.about.values.accessibility.description"),
    },
    {
      icon: Users,
      title: t("marketing.pages.about.values.community.title"),
      description: t("marketing.pages.about.values.community.description"),
    },
  ];

  return (
    <div>
      <PageHero
        title={t("marketing.pages.about.hero.title")}
        subtitle={t("marketing.pages.about.hero.subtitle")}
        breadcrumbs={[
          { label: t("marketing.pages.about.breadcrumbs.home"), href: "/" },
          { label: t("marketing.pages.about.breadcrumbs.about") },
        ]}
      />

      {/* Mission Section */}
      <SectionWrapper className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t("marketing.pages.about.mission.titlePrefix")}{" "}
              <GradientText>
                {t("marketing.pages.about.mission.titleHighlight")}
              </GradientText>
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              {t("marketing.pages.about.mission.paragraph1")}
            </p>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              {t("marketing.pages.about.mission.paragraph2")}
            </p>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              {t("marketing.pages.about.mission.paragraph3")}
            </p>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              {t("marketing.pages.about.mission.paragraph4")}
            </p>
          </div>

          {/* Gradient Placeholder */}
          <div className="flex items-center justify-center">
            <div className="aspect-video w-full overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-orange-400/20 to-amber-500/20 ring-1 ring-primary/10">
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <Globe className="h-8 w-8 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("marketing.pages.about.mission.mediaPlaceholder")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SectionWrapper>

      {/* Timeline Section */}
      <SectionWrapper className="bg-muted/30 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            {t("marketing.pages.about.journey.titlePrefix")}{" "}
            <GradientText>
              {t("marketing.pages.about.journey.titleHighlight")}
            </GradientText>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-muted-foreground">
            {t("marketing.pages.about.journey.description")}
          </p>

          <div className="relative mt-12">
            {/* Vertical line */}
            <div
              className="absolute left-4 top-0 h-full w-0.5 bg-gradient-to-b from-primary via-orange-400 to-amber-500 md:left-1/2 md:-translate-x-px"
              aria-hidden="true"
            />

            <div className="space-y-12">
              {milestones.map((milestone, index) => (
                <div
                  key={index}
                  className={`relative flex items-start gap-8 ${
                    index % 2 === 0
                      ? "md:flex-row"
                      : "md:flex-row-reverse"
                  }`}
                >
                  {/* Timeline dot */}
                  <div className="absolute left-4 z-10 flex h-3 w-3 -translate-x-1/2 items-center justify-center md:left-1/2">
                    <div className="h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
                  </div>

                  {/* Content */}
                  <div
                    className={`ml-12 w-full rounded-2xl border bg-card p-6 shadow-sm md:ml-0 md:w-[calc(50%-2rem)] ${
                      index % 2 === 0 ? "md:mr-auto" : "md:ml-auto"
                    }`}
                  >
                    <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                      {milestone.year}
                    </span>
                    <h3 className="mt-2 text-lg font-bold">{milestone.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {milestone.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionWrapper>

      {/* Values Section */}
      <SectionWrapper className="mx-auto max-w-7xl px-6 py-16">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("marketing.pages.about.valuesSection.titlePrefix")}{" "}
            <GradientText>
              {t("marketing.pages.about.valuesSection.titleHighlight")}
            </GradientText>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            {t("marketing.pages.about.valuesSection.description")}
          </p>
        </div>

        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((value) => {
            const Icon = value.icon;
            return (
              <div
                key={value.title}
                className="group rounded-2xl border bg-card p-6 text-center shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
                  <Icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-lg font-bold">{value.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {value.description}
                </p>
              </div>
            );
          })}
        </div>
      </SectionWrapper>

      {/* CTA Banner */}
      <CTABanner
        title={t("marketing.pages.about.cta.title")}
        subtitle={t("marketing.pages.about.cta.subtitle")}
        primaryAction={{
          label: t("marketing.pages.about.cta.primaryLabel"),
          href: "/signup",
        }}
        secondaryAction={{
          label: t("marketing.pages.about.cta.secondaryLabel"),
          href: "/explore",
        }}
      />
    </div>
  );
}
