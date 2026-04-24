"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { heroTextReveal, fadeInUp, floatAnimation } from "@/lib/animation-variants";
import GradientText from "@/components/marketing/GradientText";
import BreadcrumbNav from "@/components/marketing/BreadcrumbNav";

interface PageHeroProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: { label: string; href?: string }[];
  showBackButton?: boolean;
  backgroundImage?: string | null;
}

function getBackTarget(
  breadcrumbs: { label: string; href?: string }[] | undefined
): { label: string; href: string } | null {
  if (!breadcrumbs || breadcrumbs.length === 0) return null;
  const lastIsCurrent =
    !breadcrumbs[breadcrumbs.length - 1].href;
  const end = lastIsCurrent ? breadcrumbs.length - 1 : breadcrumbs.length;
  for (let i = end - 1; i >= 0; i--) {
    const item = breadcrumbs[i];
    if (item.href) return { label: item.label, href: item.href };
  }
  return null;
}

export default function PageHero({
  title,
  subtitle,
  breadcrumbs,
  showBackButton = false,
  backgroundImage,
}: PageHeroProps) {
  const backTarget = showBackButton ? getBackTarget(breadcrumbs) : null;
  // Split the title to apply gradient to the last word
  const words = title.split(" ");
  const leadingWords = words.slice(0, -1).join(" ");
  const lastWord = words[words.length - 1];

  return (
    <section
      className={cn(
        "relative overflow-hidden py-24 lg:py-32",
        !backgroundImage && "bg-gradient-to-b from-background via-background to-secondary/30"
      )}
    >
      {/* Optional background image */}
      {backgroundImage && (
        <>
          <Image
            src={backgroundImage}
            alt=""
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-background" />
        </>
      )}

      {/* Decorative floating gradient orbs (only when no image) */}
      {!backgroundImage && (
        <>
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
        </>
      )}

      {/* Fixed back button — stays visible while scrolling */}
      {backTarget && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut", delay: 0.2 }}
          className="fixed bottom-6 left-6 z-40"
        >
          <Link
            href={backTarget.href}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-4 py-2 text-sm font-medium text-muted-foreground shadow-lg backdrop-blur-md transition-colors hover:border-border hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to {backTarget.label}</span>
          </Link>
        </motion.div>
      )}

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
          className={cn(
            "text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl",
            backgroundImage && "text-white drop-shadow-lg"
          )}
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
            className={cn(
              "mt-6 max-w-2xl text-lg sm:text-xl",
              backgroundImage ? "text-white/90 drop-shadow" : "text-muted-foreground"
            )}
          >
            {subtitle}
          </motion.p>
        )}
      </div>
    </section>
  );
}
