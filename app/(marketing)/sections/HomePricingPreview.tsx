"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Check, Crown, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fadeInUp } from "@/lib/animation-variants";
import GradientText from "@/components/marketing/GradientText";

const instrumentFeatures = [
  "All courses for your instrument",
  "Interactive Soundslice integration",
  "Progress tracking dashboard",
  "New content added monthly",
  "Cancel anytime",
];

const allAccessFeatures = [
  "All 9 instruments included",
  "Every course and lesson",
  "Interactive Soundslice integration",
  "Progress tracking dashboard",
  "New content added monthly",
  "Cancel anytime",
];

export function HomePricingPreview() {
  return (
    <section className="py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12 text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
            Simple,{" "}
            <GradientText>flexible pricing</GradientText>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Subscribe per instrument or get unlimited access to everything.
          </p>
        </motion.div>

        {/* Pricing cards */}
        <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
          {/* Per Instrument */}
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <div className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card p-8">
              <div className="mb-8 text-center">
                <div className="mb-2 flex items-center justify-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
                  <Music className="size-4" />
                  Per Instrument
                </div>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-bold text-foreground">
                    $14.99
                  </span>
                  <span className="text-lg text-muted-foreground">/month</span>
                </div>
              </div>

              <ul className="mb-8 flex-1 space-y-4">
                {instrumentFeatures.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <Check className="size-5 shrink-0 text-primary" />
                    <span className="text-foreground/80">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant="outline"
                className="h-auto w-full rounded-full py-4 text-base font-semibold"
                asChild
              >
                <Link href="/pricing">Choose Your Instrument</Link>
              </Button>
            </div>
          </motion.div>

          {/* All-Access */}
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <div className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card p-8">
              {/* Gradient top accent */}
              <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-primary via-orange-400 to-primary" />

              <div className="mb-8 text-center">
                <div className="mb-2 flex items-center justify-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
                  <Crown className="size-4" />
                  All-Access
                </div>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-bold text-foreground">
                    $69.99
                  </span>
                  <span className="text-lg text-muted-foreground">/month</span>
                </div>
              </div>

              <ul className="mb-8 flex-1 space-y-4">
                {allAccessFeatures.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <Check className="size-5 shrink-0 text-primary" />
                    <span className="text-foreground/80">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="h-auto w-full rounded-full bg-primary py-4 text-base font-semibold text-white hover:bg-primary/90"
                asChild
              >
                <Link href="/signup">Get All-Access</Link>
              </Button>

              <p className="mt-4 text-center text-xs text-muted-foreground">
                14-day money-back guarantee
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
