"use client";

import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import {
  staggerContainer,
  countUp,
} from "@/lib/animation-variants";
import AnimatedCounter from "@/components/marketing/AnimatedCounter";

const stats = [
  { end: 0, suffix: "", label: "Active Students", staticText: "In Progress" },
  { end: 1500, suffix: "+", label: "Video Lessons" },
  { end: 200, suffix: "+", label: "Hours of Content" },
  { end: 15, suffix: "", label: "Expert Instructors" },
] as const;

export default function StatsBar() {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.2,
  });

  return (
    <section className="relative border-t border-white/10 bg-gradient-to-r from-black/90 via-gray-900/95 to-black/90 backdrop-blur-md">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5" />
      <motion.div
        ref={ref}
        variants={staggerContainer(0.15, 0.1)}
        initial="hidden"
        animate={inView ? "visible" : "hidden"}
        className="relative mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-6 sm:px-6 md:grid-cols-4 lg:px-8 lg:py-8"
      >
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            variants={countUp}
            className="flex flex-col items-center text-center"
          >
            <span className="bg-gradient-to-b from-white to-white/70 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
              {"staticText" in stat && stat.staticText ? (
                stat.staticText
              ) : (
                <AnimatedCounter
                  end={stat.end}
                  suffix={stat.suffix}
                  duration={2.5}
                />
              )}
            </span>
            <span className="mt-1.5 text-xs font-medium uppercase tracking-wider text-white/50 sm:text-sm">
              {stat.label}
            </span>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
