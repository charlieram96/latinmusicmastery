"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { fadeInUp, staggerContainer, staggerChild } from "@/lib/animation-variants";
import { Button } from "@/components/ui/button";

interface CTABannerProps {
  title?: string;
  subtitle?: string;
  primaryAction?: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
}

export default function CTABanner({
  title = "Ready to Start Your Musical Journey?",
  subtitle,
  primaryAction,
  secondaryAction,
}: CTABannerProps) {
  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-orange-500 to-amber-500 px-8 py-16 text-center shadow-2xl shadow-primary/20 sm:px-16 sm:py-20"
      >
        {/* Decorative highlight */}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 to-white/5"
          aria-hidden="true"
        />

        <motion.div
          variants={staggerContainer()}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="relative z-10"
        >
          <motion.h2
            variants={staggerChild}
            className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl"
          >
            {title}
          </motion.h2>

          {subtitle && (
            <motion.p
              variants={staggerChild}
              className="mx-auto mt-4 max-w-2xl text-lg text-white/85"
            >
              {subtitle}
            </motion.p>
          )}

          <motion.div
            variants={staggerChild}
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            {primaryAction && (
              <Button
                asChild
                size="lg"
                className="bg-white text-primary hover:bg-white/90 font-semibold shadow-lg"
              >
                <Link href={primaryAction.href}>{primaryAction.label}</Link>
              </Button>
            )}

            {secondaryAction && (
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link href={secondaryAction.href}>
                  {secondaryAction.label}
                </Link>
              </Button>
            )}
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
}
