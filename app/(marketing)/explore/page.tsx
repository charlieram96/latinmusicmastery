import type { Metadata } from 'next'
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHero from "@/components/marketing/PageHero";
import SectionWrapper from "@/components/marketing/SectionWrapper";
import CourseCard from "@/components/marketing/CourseCard";

export const metadata: Metadata = {
  title: 'Explore Courses - Latin Music Mastery',
  description: 'Discover Latin American music courses organized by country, style, and instrument.',
}

const countryEmojis: Record<string, string> = {
  brazil: "\u{1F1E7}\u{1F1F7}",
  cuba: "\u{1F1E8}\u{1F1FA}",
  argentina: "\u{1F1E6}\u{1F1F7}",
  colombia: "\u{1F1E8}\u{1F1F4}",
  mexico: "\u{1F1F2}\u{1F1FD}",
  peru: "\u{1F1F5}\u{1F1EA}",
  venezuela: "\u{1F1FB}\u{1F1EA}",
  "dominican-republic": "\u{1F1E9}\u{1F1F4}",
  "puerto-rico": "\u{1F1F5}\u{1F1F7}",
};

const countryGradients: Record<string, string> = {
  brazil: "from-green-700 to-yellow-600",
  cuba: "from-blue-800 to-red-700",
  argentina: "from-sky-500 to-white/80",
  colombia: "from-yellow-500 to-blue-700",
  mexico: "from-green-700 to-red-700",
  peru: "from-red-700 to-white/80",
  venezuela: "from-yellow-500 to-blue-800",
  "dominican-republic": "from-red-700 to-blue-800",
  "puerto-rico": "from-red-600 to-blue-700",
};

type CourseRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  instrument: string | null;
  difficulty: string | null;
  thumbnail_url: string | null;
};

const COURSE_FIELDS = "id, title, slug, description, instrument, difficulty, thumbnail_url";

function FilteredCourses({
  title,
  subtitle,
  crumbLabel,
  courses,
}: {
  title: string;
  subtitle?: string;
  crumbLabel: string;
  courses: CourseRow[];
}) {
  return (
    <>
      <PageHero
        title={title}
        subtitle={subtitle}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Explore", href: "/explore" },
          { label: crumbLabel },
        ]}
        showBackButton
      />
      <div className="mx-auto max-w-7xl px-6 py-16">
        <SectionWrapper>
          {courses.length > 0 ? (
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
                We are adding more courses for {crumbLabel}. Check back soon!
              </p>
            </div>
          )}
        </SectionWrapper>
      </div>
    </>
  );
}

interface ExplorePageProps {
  searchParams: Promise<{ instrument?: string; style?: string }>;
}

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const { instrument: instrumentParam, style: styleSlug } = await searchParams;
  const supabase = await createClient();

  // ── Filtered view: courses for a single instrument ──────────────────────
  // courses.instrument is free text (e.g. "Conga"), so we match it directly.
  if (instrumentParam) {
    const { data: courses } = await supabase
      .from("courses")
      .select(COURSE_FIELDS)
      .eq("instrument", instrumentParam)
      .order("title");

    return (
      <FilteredCourses
        title={`${instrumentParam} Courses`}
        subtitle={`Browse courses for ${instrumentParam}.`}
        crumbLabel={instrumentParam}
        courses={(courses ?? []) as CourseRow[]}
      />
    );
  }

  // ── Filtered view: courses for a single style ───────────────────────────
  if (styleSlug) {
    const { data: style } = await supabase
      .from("musical_styles")
      .select("id, name, slug, description")
      .eq("slug", styleSlug)
      .single();

    if (!style) notFound();

    const { data: courses } = await supabase
      .from("courses")
      .select(COURSE_FIELDS)
      .eq("musical_style_id", style.id)
      .order("title");

    return (
      <FilteredCourses
        title={style.name}
        subtitle={style.description ?? `Explore ${style.name} courses.`}
        crumbLabel={style.name}
        courses={(courses ?? []) as CourseRow[]}
      />
    );
  }

  // ── Default view: browse by country ─────────────────────────────────────
  const { data: countries } = await supabase
    .from("countries")
    .select("id, name, slug, description, image_url, musical_styles(id, name, slug)")
    .order("name");

  return (
    <>
      <PageHero
        title="Explore Courses"
        subtitle="Discover the rich world of Latin American music organized by country and musical tradition."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Explore" }]}
        showBackButton
      />

      <div className="mx-auto max-w-7xl px-6 py-16">
        <SectionWrapper>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {countries?.map((country) => {
              const emoji = countryEmojis[country.slug] ?? "";
              const gradient =
                countryGradients[country.slug] ?? "from-primary to-primary/60";

              return (
                <Link
                  key={country.id}
                  href={`/explore/${country.slug}`}
                  className="group block"
                >
                  <div className="relative overflow-hidden rounded-2xl transition-all duration-300 group-hover:shadow-xl group-hover:-translate-y-1">
                    <div
                      className={`relative aspect-[4/3] ${country.image_url ? "" : `bg-gradient-to-br ${gradient}`}`}
                    >
                      {country.image_url && (
                        <Image
                          src={country.image_url}
                          alt={country.name}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10 transition-opacity duration-300 group-hover:from-black/60 group-hover:via-black/20" />
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                        <span className="text-5xl">{emoji}</span>
                        <h3 className="mt-3 text-2xl font-bold text-white">
                          {country.name}
                        </h3>
                      </div>
                    </div>
                    {country.musical_styles &&
                      country.musical_styles.length > 0 && (
                        <div className="flex flex-wrap gap-2 bg-card p-4">
                          {country.musical_styles.map((style: { id: string; name: string; slug: string }) => (
                            <span
                              key={style.id}
                              className="rounded-full border bg-secondary/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                            >
                              {style.name}
                            </span>
                          ))}
                        </div>
                      )}
                  </div>
                </Link>
              );
            })}
          </div>
        </SectionWrapper>
      </div>
    </>
  );
}
