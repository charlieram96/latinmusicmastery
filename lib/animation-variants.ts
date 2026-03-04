import type { Variants } from "framer-motion";

// ─── Directional fade-ins ────────────────────────────────────────────

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

export const fadeInLeft: Variants = {
  hidden: { opacity: 0, x: -40 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

export const fadeInRight: Variants = {
  hidden: { opacity: 0, x: 40 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

// ─── Scale entrance ──────────────────────────────────────────────────

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

// ─── Stagger orchestration ───────────────────────────────────────────

/**
 * Creates a stagger container variant with configurable timing.
 * Use as the parent `motion.div` with `variants={staggerContainer()}`.
 */
export function staggerContainer(
  staggerChildren = 0.1,
  delayChildren = 0.05
): Variants {
  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren, delayChildren },
    },
  };
}

export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

// ─── Parallax scroll ─────────────────────────────────────────────────

/**
 * Parallax vertical shift driven by scroll progress.
 * Apply with `style={{ y: scrollYProgress }}` or use as variants
 * for a simple hidden/visible reveal with Y offset.
 */
export const parallaxY: Variants = {
  hidden: { opacity: 0, y: 60 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: "easeOut" },
  },
};

// ─── Continuous float ────────────────────────────────────────────────

/**
 * Continuous floating animation for decorative elements.
 * Use with `animate="float"` and `transition={{ repeat: Infinity }}`.
 */
export const floatAnimation: Variants = {
  initial: { y: 0 },
  float: {
    y: [-8, 8, -8],
    transition: {
      duration: 4,
      ease: "easeInOut",
      repeat: Infinity,
      repeatType: "loop",
    },
  },
};

// ─── Hero text reveal ────────────────────────────────────────────────

export const heroTextReveal: Variants = {
  hidden: { opacity: 0, y: 40, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

// ─── Slide from bottom ───────────────────────────────────────────────

export const slideInFromBottom: Variants = {
  hidden: { opacity: 0, y: 50 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: "easeOut" },
  },
};

// ─── Count-up (number counters) ──────────────────────────────────────

export const countUp: Variants = {
  hidden: { opacity: 0, scale: 0.6, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

// ─── Pulse glow ──────────────────────────────────────────────────────

export const pulseGlow: Variants = {
  initial: { opacity: 0.5, scale: 1 },
  pulse: {
    opacity: [0.5, 0.8, 0.5],
    scale: [1, 1.05, 1],
    transition: {
      duration: 3,
      ease: "easeInOut",
      repeat: Infinity,
      repeatType: "loop",
    },
  },
};
