import type { Metadata } from 'next'
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: { params: Promise<{ countrySlug: string; styleSlug: string }> }): Promise<Metadata> {
  const { countrySlug, styleSlug } = await params
  const country = countrySlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  const style = styleSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  return {
    title: `${style} - ${country} - Latin Music Mastery`,
    description: `Discover ${style} courses from ${country}. Learn authentic rhythms, techniques, and traditions.`,
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

  const { data: country } = await supabase
    .from("countries")
    .select("id, name, slug")
    .eq("slug", countrySlug)
    .single();

  if (!country) {
    notFound();
  }

  const { data: style } = await supabase
    .from("musical_styles")
    .select("id, name, slug, description")
    .eq("slug", styleSlug)
    .eq("country_id", country.id)
    .single();

  if (!style) {
    notFound();
  }

  const { data: courses } = await supabase
    .from("courses")
    .select(
      "id, title, slug, description, instrument, difficulty, thumbnail_url"
    )
    .eq("musical_style_id", style.id)
    .order("title");

  return (
    <>
      <PageHero
        title={style.name}
        subtitle={style.description ?? undefined}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Explore", href: "/explore" },
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
                No courses available yet
              </p>
              <p className="mt-2 text-sm text-muted-foreground/70">
                We are working on adding courses for {style.name}. Check back
                soon!
              </p>
            </div>
          )}
        </SectionWrapper>
      </div>

      <CTABanner />
    </>
  );
}
