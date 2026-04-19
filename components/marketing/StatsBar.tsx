"use client";

import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import {
  staggerContainer,
  countUp,
} from "@/lib/animation-variants";
import AnimatedCounter from "@/components/marketing/AnimatedCounter";
import { useTranslation } from "@/components/language-provider";

const stats = [
  { end: 0, suffix: "", labelKey: "homepage.stats.activeStudents.label", staticTextKey: "homepage.stats.activeStudents.staticText" },
  { end: 1500, suffix: "+", labelKey: "homepage.stats.videoLessons.label" },
  { end: 200, suffix: "+", labelKey: "homepage.stats.hoursOfContent.label" },
  { end: 15, suffix: "", labelKey: "homepage.stats.expertInstructors.label" },
] as const;

export default function StatsBar() {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.2,
  });
  const { t } = useTranslation();

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
            key={stat.labelKey}
            variants={countUp}
            className="flex flex-col items-center text-center"
          >
            <span className="bg-gradient-to-b from-white to-white/70 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
              {"staticTextKey" in stat && stat.staticTextKey ? (
                t(stat.staticTextKey)
              ) : (
                <AnimatedCounter
                  end={stat.end}
                  suffix={stat.suffix}
                  duration={2.5}
                />
              )}
            </span>
            <span className="mt-1.5 text-xs font-medium uppercase tracking-wider text-white/50 sm:text-sm">
              {t(stat.labelKey)}
            </span>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
