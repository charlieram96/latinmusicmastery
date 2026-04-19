"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { staggerContainer, staggerChild } from "@/lib/animation-variants";
import GradientText from "@/components/marketing/GradientText";
import { useTranslation } from "@/components/language-provider";

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

const countryImages: Record<string, string> = {
  brazil: "https://images.unsplash.com/photo-1516306580123-e6e52b1b7b5f?w=800&auto=format&fit=crop&q=80",
  cuba: "https://images.unsplash.com/photo-1500759285222-a95626b934cb?w=800&auto=format&fit=crop&q=80",
  argentina: "https://images.unsplash.com/photo-1612294037637-ec328d0e075e?w=800&auto=format&fit=crop&q=80",
  colombia: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&auto=format&fit=crop&q=80",
  mexico: "https://images.unsplash.com/photo-1518105779142-d975f22f1b0a?w=800&auto=format&fit=crop&q=80",
  peru: "https://images.unsplash.com/photo-1526392060635-9d6019884377?w=800&auto=format&fit=crop&q=80",
  venezuela: "https://images.unsplash.com/photo-1580137189272-c9379f8864fd?w=800&auto=format&fit=crop&q=80",
  "republica-dominicana": "https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=800&auto=format&fit=crop&q=80",
  "puerto-rico": "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&auto=format&fit=crop&q=80",
};

export function HomeCourseShowcase({ countries }: Props) {
  const { t } = useTranslation();
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
            {t('homepage.homeSections.courseShowcase.titlePrefix')}{" "}
            <GradientText>{t('homepage.homeSections.courseShowcase.titleHighlight')}</GradientText>
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            {t('homepage.homeSections.courseShowcase.description')}
          </p>
        </motion.div>

        {/* Bento Grid */}
        <motion.div
          variants={staggerContainer(0.08, 0.1)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="grid gap-4 md:grid-cols-2 lg:gap-6"
        >
          {countries.map((country) => {
            const image = countryImages[country.slug];
            const styles = country.musical_styles ?? [];
            const visibleStyles = styles.slice(0, 3);
            const extraCount = styles.length - 3;

            return (
              <motion.div key={country.id} variants={staggerChild}>
                <Link
                  href={`/explore/${country.slug}`}
                  className="group relative flex flex-col justify-end overflow-hidden rounded-2xl min-h-[260px] transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  {/* Background image */}
                  {image && (
                    <Image
                      src={image}
                      alt={country.name}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  )}

                  {/* Dark gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10 transition-opacity duration-300 group-hover:from-black/85" />

                  {/* Arrow icon */}
                  <ArrowUpRight className="absolute right-4 top-4 size-5 text-white/70 opacity-0 transition-all duration-300 group-hover:opacity-100" />

                  {/* Content */}
                  <div className="relative z-10 p-6">
                    <h3 className="text-xl font-semibold text-white">
                      {country.name}
                    </h3>

                    {country.description && (
                      <p className="mt-1.5 line-clamp-2 text-sm text-white/70">
                        {country.description}
                      </p>
                    )}

                    {styles.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {visibleStyles.map((style) => (
                          <span
                            key={style.id}
                            className="rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-xs font-medium text-white/90"
                          >
                            {style.name}
                          </span>
                        ))}
                        {extraCount > 0 && (
                          <span className="rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-xs font-medium text-white/90">
                            +{extraCount}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
