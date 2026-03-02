import type { Variants, Transition } from 'framer-motion'

// Standard entrance for cards/sections
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}

// Pop-in for grade labels and badges
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.5 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.8 },
}

// Slide from left for state transitions
export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -40 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 40 },
}

// Slide from right for state transitions
export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
}

// Large scale animation for countdown numbers
export const countdownPop: Variants = {
  hidden: { opacity: 0, scale: 0.3 },
  visible: {
    opacity: 1,
    scale: [0.3, 1.2, 1.0],
    transition: { duration: 0.4, times: [0, 0.6, 1] },
  },
  exit: { opacity: 0, scale: 0.8, transition: { duration: 0.15 } },
}

// Floating grade label that rises and fades
export const gradeFloat: Variants = {
  hidden: { opacity: 0, y: 0, scale: 0.5 },
  visible: {
    opacity: [0, 1, 1, 0],
    y: [0, -20, -40, -60],
    scale: [0.5, 1.1, 1.0, 0.9],
    transition: { duration: 1.0, times: [0, 0.15, 0.5, 1] },
  },
}

// Shake + scale for high combos
export const comboFire: Variants = {
  idle: { x: 0, scale: 1 },
  active: {
    x: [0, -2, 2, -2, 0],
    scale: [1, 1.05, 1],
    transition: { duration: 0.3 },
  },
}

// Staggered children container
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
}

// Individual stagger item
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0 },
}

// Shared spring transition
export const springTransition: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 24,
}

// Standard transition for most animations
export const standardTransition: Transition = {
  duration: 0.3,
  ease: 'easeOut',
}

// Grade-specific colors with glow
export const GRADE_GLOW: Record<string, string> = {
  perfect: '0 0 20px rgba(34, 197, 94, 0.6)',
  good: '0 0 20px rgba(234, 179, 8, 0.6)',
  ok: '0 0 20px rgba(249, 115, 22, 0.5)',
  miss: '0 0 12px rgba(239, 68, 68, 0.4)',
}

// Grade display labels
export const GRADE_LABELS: Record<string, string> = {
  perfect: 'Perfect!',
  good: 'Good!',
  ok: 'OK',
  miss: 'Miss',
}

// Star count from score
export function getStarCount(score: number): number {
  if (score >= 95) return 5
  if (score >= 85) return 4
  if (score >= 70) return 3
  if (score >= 50) return 2
  return 1
}

// Track highlight for playlist rows
export const trackHighlight: Variants = {
  idle: { backgroundColor: 'rgba(255,255,255,0)' },
  active: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    transition: { duration: 0.2 },
  },
}

// Slide up for now-playing bar
export const slideUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 400, damping: 30 },
  },
  exit: { opacity: 0, y: 40, transition: { duration: 0.2 } },
}

// Equalizer bar animation
export const equalizerBar: Variants = {
  idle: { scaleY: 0.3 },
  active: {
    scaleY: [0.3, 1, 0.5, 0.8, 0.3],
    transition: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' },
  },
}

// Difficulty glow colors
export const DIFFICULTY_GLOW: Record<string, string> = {
  beginner: 'shadow-green-500/20',
  intermediate: 'shadow-yellow-500/20',
  advanced: 'shadow-red-500/20',
}

export const DIFFICULTY_BORDER: Record<string, string> = {
  beginner: 'border-green-500/30',
  intermediate: 'border-yellow-500/30',
  advanced: 'border-red-500/30',
}
