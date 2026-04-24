import type { Metadata } from 'next'
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: { params: Promise<{ countrySlug: string }> }): Promise<Metadata> {
  const { countrySlug } = await params
  const name = countrySlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  return {
    title: `${name} Music - Latin Music Mastery`,
    description: `Explore musical styles and courses from ${name}. Learn authentic rhythms and techniques.`,
  }
}
import PageHero from "@/components/marketing/PageHero";
import SectionWrapper from "@/components/marketing/SectionWrapper";
import CTABanner from "@/components/marketing/CTABanner";
import CourseCard from "@/components/marketing/CourseCard";
import Link from "next/link";

export default async function CountryPage({
  params,
}: {
  params: Promise<{ countrySlug: string }>;
}) {
  const { countrySlug } = await params;
  const supabase = await createClient();

  const { data: country } = await supabase
    .from("countries")
    .select(
      "id, name, slug, description, image_url, musical_styles(id, name, slug, description)"
    )
    .eq("slug", countrySlug)
    .single();

  if (!country) {
    notFound();
  }

  // Get style IDs for this country
  const styleIds = (country.musical_styles ?? []).map((s) => s.id);

  // Fetch courses via musical_style_id (courses don't have country_id directly)
  const { data: courses } = styleIds.length > 0
    ? await supabase
        .from("courses")
        .select(
          "id, title, slug, description, instrument, difficulty, thumbnail_url, musical_style_id, musical_styles(name)"
        )
        .in("musical_style_id", styleIds)
        .order("title")
    : { data: [] as never[] };

  // Count courses per style
  const courseCountByStyle: Record<string, number> = {};
  if (courses) {
    for (const course of courses) {
      const styleName =
        course.musical_styles &&
        !Array.isArray(course.musical_styles)
          ? course.musical_styles.name
          : null;
      if (styleName) {
        courseCountByStyle[styleName] =
          (courseCountByStyle[styleName] || 0) + 1;
      }
    }
  }

  return (
    <>
      <PageHero
        title={country.name}
        subtitle={country.description ?? undefined}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Explore", href: "/explore" },
          { label: country.name },
        ]}
        showBackButton
        backgroundImage={country.image_url}
      />

      {/* Musical Styles Section */}
      {country.musical_styles && country.musical_styles.length > 0 && (
        <div className="mx-auto max-w-7xl px-6 py-16">
          <SectionWrapper>
            <h2 className="mb-8 text-2xl font-bold tracking-tight sm:text-3xl">
              Musical Styles
            </h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {country.musical_styles.map((style) => (
                <Link
                  key={style.id}
                  href={`/explore/${countrySlug}/${style.slug}`}
                  className="group block"
                >
                  <div className="rounded-2xl border bg-card p-6 transition-all duration-300 group-hover:border-primary/30 group-hover:shadow-lg group-hover:-translate-y-1">
                    <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">
                      {style.name}
                    </h3>
                    {style.description && (
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                        {style.description}
                      </p>
                    )}
                    <p className="mt-3 text-xs font-medium text-primary">
                      {courseCountByStyle[style.name] ?? 0}{" "}
                      {(courseCountByStyle[style.name] ?? 0) === 1
                        ? "course"
                        : "courses"}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </SectionWrapper>
        </div>
      )}

      {/* All Courses Section */}
      {courses && courses.length > 0 && (
        <div className="mx-auto max-w-7xl px-6 pb-16">
          <SectionWrapper>
            <h2 className="mb-8 text-2xl font-bold tracking-tight sm:text-3xl">
              All Courses
            </h2>
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
          </SectionWrapper>
        </div>
      )}

      <CTABanner />
    </>
  );
}
