"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { staggerContainer, staggerChild } from "@/lib/animation-variants";
import GradientText from "@/components/marketing/GradientText";
import InstructorCard from "@/components/marketing/InstructorCard";
import { useTranslation } from "@/components/language-provider";

interface Instructor {
  id: string;
  name: string;
  instrument: string;
  bio: unknown;
  image_url: string | null;
  specialties: string[] | null;
}

interface Props {
  instructors: Instructor[];
}

export function HomeInstructorsSection({ instructors }: Props) {
  const { t } = useTranslation();
  const displayed = instructors.slice(0, 6);

  return (
    <section className="py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end"
        >
          <div>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
              {t('homepage.homeSections.instructors.sectionHeadingPrefix')}{" "}
              <GradientText>{t('homepage.homeSections.instructors.sectionHeadingHighlight')}</GradientText>
            </h2>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">
              {t('homepage.homeSections.instructors.sectionDescription')}
            </p>
          </div>
          <Link
            href="/instructors"
            className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
          >
            {t('homepage.homeSections.instructors.viewAll')}
            <ArrowRight className="size-4" />
          </Link>
        </motion.div>

        {/* Cards - horizontal scroll on mobile, grid on desktop */}
        <motion.div
          variants={staggerContainer(0.1, 0.1)}
          initial="hidden"
          animate="visible"
          className="-mx-6 flex gap-4 overflow-x-auto px-6 pb-4 scrollbar-hide md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0 md:pb-0"
        >
          {displayed.map((instructor) => (
            <motion.div
              key={instructor.id}
              variants={staggerChild}
              className="w-64 flex-shrink-0 md:w-auto"
            >
              <InstructorCard
                name={instructor.name}
                instrument={instructor.instrument}
                bio={instructor.bio}
                imageUrl={instructor.image_url}
                specialties={instructor.specialties}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
