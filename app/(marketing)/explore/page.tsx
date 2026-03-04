import type { Metadata } from 'next'
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: 'Explore Courses - Latin Music Mastery',
  description: 'Discover Latin American music courses organized by country and musical tradition. From salsa to bossa nova, tango to cumbia.',
}
import PageHero from "@/components/marketing/PageHero";
import SectionWrapper from "@/components/marketing/SectionWrapper";

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

export default async function ExplorePage() {
  const supabase = await createClient();

  const { data: countries } = await supabase
    .from("countries")
    .select("id, name, slug, description, musical_styles(id, name, slug)")
    .order("name");

  return (
    <>
      <PageHero
        title="Explore Courses"
        subtitle="Discover the rich world of Latin American music organized by country and musical tradition."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Explore" }]}
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
                    {/* Background gradient image area */}
                    <div
                      className={`relative aspect-[4/3] bg-gradient-to-br ${gradient}`}
                    >
                      {/* Dark overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10 transition-opacity duration-300 group-hover:from-black/60 group-hover:via-black/20" />

                      {/* Country name overlay */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                        <span className="text-5xl">{emoji}</span>
                        <h3 className="mt-3 text-2xl font-bold text-white">
                          {country.name}
                        </h3>
                      </div>
                    </div>

                    {/* Style tags below image */}
                    {country.musical_styles &&
                      country.musical_styles.length > 0 && (
                        <div className="flex flex-wrap gap-2 bg-card p-4">
                          {country.musical_styles.map((style) => (
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
