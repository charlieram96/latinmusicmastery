"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { PlayCircle, BarChart3, Users, ArrowRight } from "lucide-react";
import { fadeInLeft, fadeInRight } from "@/lib/animation-variants";
import GradientText from "@/components/marketing/GradientText";

interface Feature {
  icon: React.ElementType;
  title: string;
  description: string;
  link: string;
  placeholder: "play" | "chart" | "instructors";
}

const features: Feature[] = [
  {
    icon: PlayCircle,
    title: "Interactive Lessons with Real-Time Feedback",
    description:
      "HD video lessons with synchronized notation powered by Soundslice. Slow down, loop sections, and get instant feedback on your playing with PlaySense AI.",
    link: "/explore",
    placeholder: "play",
  },
  {
    icon: BarChart3,
    title: "Track Your Progress Like a Pro",
    description:
      "Comprehensive dashboard tracking practice time, completed lessons, streaks, and skill progression. Set goals and watch yourself improve.",
    link: "/explore",
    placeholder: "chart",
  },
  {
    icon: Users,
    title: "Learn from World-Class Musicians",
    description:
      "Our instructors are professional performers and educators with decades of experience in authentic Latin American music traditions.",
    link: "/instructors",
    placeholder: "instructors",
  },
];

function PlaceholderImage({ type }: { type: Feature["placeholder"] }) {
  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-orange-400/10 to-amber-500/20 border border-border">
      <div className="absolute inset-0 flex items-center justify-center">
        {type === "play" && (
          <div className="flex flex-col items-center gap-3">
            <div className="flex size-16 items-center justify-center rounded-full bg-primary/20 backdrop-blur-sm">
              <PlayCircle className="size-8 text-primary" />
            </div>
            <div className="space-y-2 px-8 w-full max-w-xs">
              <div className="h-2 rounded-full bg-primary/15 w-full" />
              <div className="h-2 rounded-full bg-primary/10 w-3/4" />
              <div className="h-2 rounded-full bg-primary/15 w-5/6" />
              <div className="h-2 rounded-full bg-primary/10 w-2/3" />
            </div>
          </div>
        )}
        {type === "chart" && (
          <div className="flex items-end gap-3 px-8">
            {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
              <div
                key={i}
                className="w-6 rounded-t-md bg-primary/20"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        )}
        {type === "instructors" && (
          <div className="flex items-center gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="size-14 rounded-full bg-primary/15" />
                <div className="h-2 w-12 rounded-full bg-primary/10" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function HomeFeaturesSection() {
  return (
    <section className="py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
            Everything you need to{" "}
            <GradientText>master Latin music</GradientText>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            A complete learning platform designed for musicians at every level.
          </p>
        </motion.div>

        {/* Feature rows */}
        <div className="space-y-24 lg:space-y-32">
          {features.map((feature, index) => {
            const isEven = index % 2 === 0;
            const Icon = feature.icon;

            return (
              <div
                key={feature.title}
                className="grid items-center gap-12 md:grid-cols-2"
              >
                {/* Text side */}
                <motion.div
                  variants={isEven ? fadeInLeft : fadeInRight}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-80px" }}
                  className={isEven ? "md:order-1" : "md:order-2"}
                >
                  <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="size-6 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold tracking-tight md:text-3xl">
                    {feature.title}
                  </h3>
                  <p className="mt-4 text-base leading-relaxed text-muted-foreground lg:text-lg">
                    {feature.description}
                  </p>
                  <Link
                    href={feature.link}
                    className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
                  >
                    Learn more
                    <ArrowRight className="size-4" />
                  </Link>
                </motion.div>

                {/* Image side */}
                <motion.div
                  variants={isEven ? fadeInRight : fadeInLeft}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-80px" }}
                  className={isEven ? "md:order-2" : "md:order-1"}
                >
                  <PlaceholderImage type={feature.placeholder} />
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
