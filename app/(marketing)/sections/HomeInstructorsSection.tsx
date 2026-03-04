"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { staggerContainer, staggerChild } from "@/lib/animation-variants";
import GradientText from "@/components/marketing/GradientText";

interface Instructor {
  id: string;
  name: string;
  instrument: string;
  bio: string | null;
  image_url: string | null;
  specialties: string[] | null;
}

interface Props {
  instructors: Instructor[];
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function HomeInstructorsSection({ instructors }: Props) {
  // Show up to 6 instructors on the homepage
  const displayed = instructors.slice(0, 6);

  return (
    <section className="py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end"
        >
          <div>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
              Learn from{" "}
              <GradientText>the best</GradientText>
            </h2>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">
              Professional performers and educators with decades of experience
              in authentic Latin American music.
            </p>
          </div>
          <Link
            href="/instructors"
            className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
          >
            View all instructors
            <ArrowRight className="size-4" />
          </Link>
        </motion.div>

        {/* Cards - horizontal scroll on mobile, grid on desktop */}
        <motion.div
          variants={staggerContainer(0.1, 0.1)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="-mx-6 flex gap-4 overflow-x-auto px-6 pb-4 scrollbar-hide md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0 md:pb-0"
        >
          {displayed.map((instructor) => (
            <motion.div
              key={instructor.id}
              variants={staggerChild}
              className="w-64 flex-shrink-0 md:w-auto"
            >
              <div className="group cursor-pointer">
                {/* Image area */}
                <div className="relative aspect-[3/4] overflow-hidden rounded-2xl">
                  {instructor.image_url ? (
                    <Image
                      src={instructor.image_url}
                      alt={instructor.name}
                      fill
                      className="object-cover grayscale transition-all duration-500 group-hover:scale-105 group-hover:grayscale-0"
                      sizes="(max-width: 768px) 256px, 33vw"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-gradient-to-br from-primary/20 via-orange-400/10 to-amber-500/20">
                      <span className="text-4xl font-bold text-primary/40">
                        {getInitials(instructor.name)}
                      </span>
                    </div>
                  )}
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                </div>

                {/* Info */}
                <div className="mt-3">
                  <h3 className="text-lg font-semibold text-foreground">
                    {instructor.name}
                  </h3>
                  <p className="text-sm text-primary">{instructor.instrument}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
