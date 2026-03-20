"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Check, Crown, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fadeInUp, staggerContainer, staggerChild } from "@/lib/animation-variants";
import GradientText from "@/components/marketing/GradientText";

const instrumentShowcase = [
  { name: "Guitar", image: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=600&auto=format&fit=crop&q=80" },
  { name: "Piano", image: "https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=600&auto=format&fit=crop&q=80" },
  { name: "Bass", image: "https://images.unsplash.com/photo-1556449895-a33c9dba33dd?w=600&auto=format&fit=crop&q=80" },
  { name: "Drums / Percussion", image: "https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?w=600&auto=format&fit=crop&q=80" },
  { name: "Vocals", image: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=600&auto=format&fit=crop&q=80" },
  { name: "Violin", image: "https://images.unsplash.com/photo-1612225330812-01a9c73b5cd5?w=600&auto=format&fit=crop&q=80" },
];

const instrumentFeatures = [
  "All courses for your instrument",
  "Interactive Soundslice integration",
  "Progress tracking dashboard",
  "New content added monthly",
  "Cancel anytime",
];

const allAccessFeatures = [
  "All 6 instruments included",
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

        {/* Instrument showcase */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-8 text-center"
        >
          <h3 className="text-2xl font-bold tracking-tight md:text-3xl">
            <GradientText>6 Instruments</GradientText> Available
          </h3>
        </motion.div>

        <motion.div
          variants={staggerContainer(0.08, 0.15)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="mx-auto mb-20 grid max-w-5xl grid-cols-2 gap-4 md:grid-cols-3"
        >
          {instrumentShowcase.map((instrument) => (
            <motion.div
              key={instrument.name}
              variants={staggerChild}
              className="group relative flex items-end overflow-hidden rounded-2xl min-h-[220px] md:min-h-[280px]"
            >
              <Image
                src={instrument.image}
                alt={instrument.name}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 768px) 50vw, 33vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
              <div className="relative z-10 w-full p-4 md:p-5">
                <p className="text-base font-semibold text-white md:text-lg">
                  {instrument.name}
                </p>
              </div>
            </motion.div>
          ))}
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
                <Link href="#waitlist">Choose Your Instrument</Link>
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
                <Link href="#waitlist">Get All-Access</Link>
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
