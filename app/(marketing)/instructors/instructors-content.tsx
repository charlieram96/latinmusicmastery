"use client";

import PageHero from "@/components/marketing/PageHero";
import SectionWrapper from "@/components/marketing/SectionWrapper";
import CTABanner from "@/components/marketing/CTABanner";
import GradientText from "@/components/marketing/GradientText";
import InstructorCard from "@/components/marketing/InstructorCard";
import { useTranslation } from "@/components/language-provider";

interface Teacher {
  id: string;
  name: string;
  instrument: string;
  bio?: unknown;
  image_url?: string | null;
  specialties?: string[] | null;
}

interface InstructorsContentProps {
  teachers: Teacher[] | null;
}

export default function InstructorsContent({ teachers }: InstructorsContentProps) {
  const { t } = useTranslation();

  return (
    <div data-marketing>
      <PageHero
        title={t("marketing.pages.instructors.hero.title")}
        subtitle={t("marketing.pages.instructors.hero.subtitle")}
        breadcrumbs={[
          { label: t("marketing.pages.instructors.breadcrumbs.home"), href: "/" },
          { label: t("marketing.pages.instructors.breadcrumbs.instructors") },
        ]}
      />

      {/* Instructor Grid */}
      <SectionWrapper className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        {teachers && teachers.length > 0 ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {teachers.map((teacher) => (
              <InstructorCard
                key={teacher.id}
                name={teacher.name}
                instrument={teacher.instrument}
                bio={teacher.bio}
                imageUrl={teacher.image_url}
                specialties={teacher.specialties}
              />
            ))}
          </div>
        ) : (
          <div className="py-20 text-center">
            <p className="text-lg text-muted-foreground">
              {t("marketing.pages.instructors.empty")}
            </p>
          </div>
        )}
      </SectionWrapper>

      {/* Teaching Philosophy */}
      <SectionWrapper className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8 text-center">
        <h2 className="mb-6 text-3xl font-bold">
          {t("marketing.pages.instructors.philosophy.titlePrefix")}{" "}
          <GradientText>
            {t("marketing.pages.instructors.philosophy.titleHighlight")}
          </GradientText>
        </h2>
        <p className="text-lg leading-relaxed text-muted-foreground">
          {t("marketing.pages.instructors.philosophy.description")}
        </p>
      </SectionWrapper>

      {/* CTA */}
      <CTABanner
        title={t("marketing.pages.instructors.cta.title")}
        subtitle={t("marketing.pages.instructors.cta.subtitle")}
        primaryAction={{
          label: t("marketing.pages.instructors.cta.primaryLabel"),
          href: "/signup",
        }}
        secondaryAction={{
          label: t("marketing.pages.instructors.cta.secondaryLabel"),
          href: "/pricing",
        }}
      />
    </div>
  );
}
