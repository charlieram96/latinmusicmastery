import type { Metadata } from 'next'
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerTranslator } from "@/lib/i18n/server";
import { localizeRow, localizeRows, pick } from "@/lib/i18n/localize";

function titleFromSlug(slug: string): string {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export async function generateMetadata({ params }: { params: Promise<{ countrySlug: string; styleSlug: string }> }): Promise<Metadata> {
  const { countrySlug, styleSlug } = await params
  const { t, locale } = await getServerTranslator()
  const supabase = await createClient()
  const [{ data: countryRow }, { data: styleRow }] = await Promise.all([
    supabase.from('countries').select('name, name_es').eq('slug', countrySlug).maybeSingle(),
    supabase.from('musical_styles').select('name, name_es').eq('slug', styleSlug).limit(1).maybeSingle(),
  ])
  const country = countryRow ? pick(locale, countryRow.name, countryRow.name_es ?? '') : titleFromSlug(countrySlug)
  const style = styleRow ? pick(locale, styleRow.name, styleRow.name_es ?? '') : titleFromSlug(styleSlug)
  return {
    title: t('marketing.pages.explore.style.metadata.title', { style, country }),
    description: t('marketing.pages.explore.style.metadata.description', { style, country }),
  }
}
import PageHero from "@/components/marketing/PageHero";
import SectionWrapper from "@/components/marketing/SectionWrapper";
import CTABanner from "@/components/marketing/CTABanner";
import CourseCard from "@/components/marketing/CourseCard";

export default async function StylePage({
  params,
}: {
  params: Promise<{ countrySlug: string; styleSlug: string }>;
}) {
  const { countrySlug, styleSlug } = await params;
  const supabase = await createClient();
  const { t, locale } = await getServerTranslator();

  const { data: country } = await supabase
    .from("countries")
    .select("id, name, name_es, slug")
    .eq("slug", countrySlug)
    .single();

  if (!country) {
    notFound();
  }
  localizeRow(country as Record<string, unknown>, locale, ['name']);

  const { data: style } = await supabase
    .from("musical_styles")
    .select("id, name, name_es, slug, description, description_es")
    .eq("slug", styleSlug)
    .eq("country_id", country.id)
    .single();

  if (!style) {
    notFound();
  }
  localizeRow(style as Record<string, unknown>, locale, ['name', 'description']);

  const { data: courses } = await supabase
    .from("courses")
    .select(
      "id, title, title_es, slug, description, description_es, instrument, difficulty, thumbnail_url"
    )
    .eq("musical_style_id", style.id)
    .order("title");

  localizeRows(courses as Record<string, unknown>[] | null, locale, ['title', 'description']);

  return (
    <>
      <PageHero
        title={style.name}
        subtitle={style.description ?? undefined}
        breadcrumbs={[
          { label: t("marketing.common.home"), href: "/" },
          { label: t("nav.explore"), href: "/explore" },
          { label: country.name, href: `/explore/${countrySlug}` },
          { label: style.name },
        ]}
        showBackButton
      />

      <div className="mx-auto max-w-7xl px-6 py-16">
        <SectionWrapper>
          {courses && courses.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <CourseCard
                  key={course.id}
                  title={course.title}
                  description={course.description}
                  instrument={course.instrument ?? undefined}
                  difficulty={course.difficulty ?? undefined}
                  imageUrl={course.thumbnail_url}
                  href={`/course-preview/${course.id}`}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center">
              <p className="text-lg font-medium text-muted-foreground">
                {t("marketing.pages.explore.empty.title")}
              </p>
              <p className="mt-2 text-sm text-muted-foreground/70">
                {t("marketing.pages.explore.style.emptyBody", { style: style.name })}
              </p>
            </div>
          )}
        </SectionWrapper>
      </div>

      <CTABanner />
    </>
  );
}
