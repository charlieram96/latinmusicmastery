"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { staggerContainer, staggerChild } from "@/lib/animation-variants";
import GradientText from "@/components/marketing/GradientText";

interface MusicalStyle {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

interface Country {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  musical_styles: MusicalStyle[];
}

interface Props {
  countries: Country[];
}

const countryEmoji: Record<string, string> = {
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

export function HomeCourseShowcase({ countries }: Props) {
  return (
    <section className="py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
            Explore{" "}
            <GradientText>musical traditions</GradientText>
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Dive into the rich musical heritage of Latin America. Each country
            offers unique styles, rhythms, and techniques to master.
          </p>
        </motion.div>

        {/* Bento Grid */}
        <motion.div
          variants={staggerContainer(0.08, 0.1)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6"
        >
          {countries.map((country) => {
            const emoji = countryEmoji[country.slug] ?? "🎵";
            const styles = country.musical_styles ?? [];
            const visibleStyles = styles.slice(0, 3);
            const extraCount = styles.length - 3;

            return (
              <motion.div key={country.id} variants={staggerChild}>
                <Link
                  href={`/explore/${country.slug}`}
                  className="group relative flex flex-col rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg"
                >
                  {/* Arrow icon */}
                  <ArrowUpRight className="absolute right-4 top-4 size-5 text-muted-foreground opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:text-primary" />

                  {/* Emoji container */}
                  <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-2xl">
                    {emoji}
                  </div>

                  {/* Country name */}
                  <h3 className="text-xl font-semibold text-foreground transition-colors group-hover:text-primary">
                    {country.name}
                  </h3>

                  {/* Description */}
                  {country.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {country.description}
                    </p>
                  )}

                  {/* Style tags */}
                  {styles.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {visibleStyles.map((style) => (
                        <span
                          key={style.id}
                          className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
                        >
                          {style.name}
                        </span>
                      ))}
                      {extraCount > 0 && (
                        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                          +{extraCount}
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
