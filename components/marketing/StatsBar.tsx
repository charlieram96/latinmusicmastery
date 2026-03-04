"use client";

import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import {
  staggerContainer,
  countUp,
} from "@/lib/animation-variants";
import AnimatedCounter from "@/components/marketing/AnimatedCounter";

const stats = [
  { end: 10000, suffix: "+", label: "Active Students" },
  { end: 500, suffix: "+", label: "Video Lessons" },
  { end: 200, suffix: "+", label: "Hours of Content" },
  { end: 15, suffix: "", label: "Expert Instructors" },
] as const;

export default function StatsBar() {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.2,
  });

  return (
    <section className="border-y border-border bg-card/50">
      <motion.div
        ref={ref}
        variants={staggerContainer(0.15, 0.1)}
        initial="hidden"
        animate={inView ? "visible" : "hidden"}
        className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-12 sm:px-6 md:grid-cols-4 lg:px-8 lg:py-16"
      >
        {stats.map((stat) => (
          <motion.div
            key={stat.label}
            variants={countUp}
            className="flex flex-col items-center text-center"
          >
            <span className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              <AnimatedCounter
                end={stat.end}
                suffix={stat.suffix}
                duration={2.5}
              />
            </span>
            <span className="mt-2 text-sm font-medium text-muted-foreground sm:text-base">
              {stat.label}
            </span>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
