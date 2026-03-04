"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { heroTextReveal, fadeInUp, floatAnimation } from "@/lib/animation-variants";
import GradientText from "@/components/marketing/GradientText";
import BreadcrumbNav from "@/components/marketing/BreadcrumbNav";

interface PageHeroProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: { label: string; href?: string }[];
}

export default function PageHero({
  title,
  subtitle,
  breadcrumbs,
}: PageHeroProps) {
  // Split the title to apply gradient to the last word
  const words = title.split(" ");
  const leadingWords = words.slice(0, -1).join(" ");
  const lastWord = words[words.length - 1];

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-background via-background to-secondary/30 py-24 lg:py-32">
      {/* Decorative floating gradient orbs */}
      <motion.div
        variants={floatAnimation}
        initial="initial"
        animate="float"
        className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl"
        aria-hidden="true"
      />
      <motion.div
        variants={floatAnimation}
        initial="initial"
        animate="float"
        transition={{ delay: 1.5 }}
        className="pointer-events-none absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-orange-400/8 blur-3xl"
        aria-hidden="true"
      />
      <motion.div
        variants={floatAnimation}
        initial="initial"
        animate="float"
        transition={{ delay: 0.8 }}
        className="pointer-events-none absolute left-1/2 top-1/3 h-56 w-56 -translate-x-1/2 rounded-full bg-amber-500/6 blur-2xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="mb-8"
          >
            <BreadcrumbNav items={breadcrumbs} />
          </motion.div>
        )}

        {/* Title */}
        <motion.h1
          variants={heroTextReveal}
          initial="hidden"
          animate="visible"
          className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl"
        >
          {leadingWords}{" "}
          <GradientText>{lastWord}</GradientText>
        </motion.h1>

        {/* Subtitle */}
        {subtitle && (
          <motion.p
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.2 }}
            className="mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl"
          >
            {subtitle}
          </motion.p>
        )}
      </div>
    </section>
  );
}
