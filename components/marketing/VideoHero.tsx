"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ChevronDown } from "lucide-react";
import {
  staggerContainer,
  staggerChild,
  heroTextReveal,
  fadeInUp,
  floatAnimation,
} from "@/lib/animation-variants";
import GradientText from "@/components/marketing/GradientText";
import { Button } from "@/components/ui/button";

export default function VideoHero() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoFailed, setVideoFailed] = useState(false);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background video */}
      {!videoFailed ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          poster="/hero-band.jpg"
          onError={() => setVideoFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        >
          <source src="/videos/band-performing.mp4" type="video/mp4" />
        </video>
      ) : (
        /* Fallback gradient background when video fails to load */
        <div className="absolute inset-0 marketing-gradient-dark marketing-gradient-mesh" />
      )}

      {/* Dark gradient overlay */}
      <div className="video-hero-overlay absolute inset-0 z-[1]" />

      {/* Decorative floating gradient orbs */}
      <motion.div
        variants={floatAnimation}
        initial="initial"
        animate="float"
        className="pointer-events-none absolute -left-24 top-1/4 z-[2] h-80 w-80 rounded-full bg-primary/15 blur-3xl"
        aria-hidden="true"
      />
      <motion.div
        variants={floatAnimation}
        initial="initial"
        animate="float"
        transition={{ delay: 1.2 }}
        className="pointer-events-none absolute -right-16 bottom-1/3 z-[2] h-64 w-64 rounded-full bg-amber-500/10 blur-3xl"
        aria-hidden="true"
      />
      <motion.div
        variants={floatAnimation}
        initial="initial"
        animate="float"
        transition={{ delay: 2 }}
        className="pointer-events-none absolute left-1/3 top-1/2 z-[2] h-48 w-48 rounded-full bg-orange-400/10 blur-2xl"
        aria-hidden="true"
      />

      {/* Content */}
      <motion.div
        variants={staggerContainer(0.15, 0.3)}
        initial="hidden"
        animate="visible"
        className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8"
      >
        {/* Badge */}
        <motion.div variants={staggerChild} className="mb-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
            The #1 Platform for Latin Music Education
          </span>
        </motion.div>

        {/* Heading */}
        <motion.h1
          variants={heroTextReveal}
          className="text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl"
        >
          Learning from the Masters of{" "}
          <GradientText>Latin Music</GradientText>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          variants={fadeInUp}
          className="mx-auto mt-6 max-w-2xl text-lg text-white/80 sm:text-xl"
        >
          Learn salsa, bossa nova, tango, cumbia and more from world-class
          instructors. Interactive lessons with real-time feedback for musicians
          of every level.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          variants={staggerChild}
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <Button
            asChild
            size="lg"
            className="rounded-full bg-white px-8 text-gray-900 hover:bg-white/90"
          >
            <Link href="/signup">
              Start Learning Free
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="rounded-full border-white/40 text-white hover:bg-white/10 hover:text-white"
          >
            <Link href="/explore">Explore Courses</Link>
          </Button>
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 0.8 }}
        className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{
            duration: 1.5,
            ease: "easeInOut",
            repeat: Infinity,
            repeatType: "loop",
          }}
          className="flex flex-col items-center gap-2"
        >
          <span className="text-xs font-medium uppercase tracking-widest text-white/50">
            Scroll
          </span>
          <ChevronDown className="size-5 text-white/50" />
        </motion.div>
      </motion.div>
    </section>
  );
}
